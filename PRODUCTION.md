# Production migration guide

> **Audience:** the engineer responsible for taking this app from "Render free + Atlas M0" (current dev setup) to "EC2 + Atlas M10 + backups + monitoring" (real pharmacy use). Read once end-to-end before starting; it's all reversible if something goes wrong.

This document is **not** the original deployment guide — see [`DEPLOY.md`](DEPLOY.md) for that. This is specifically about **upgrading** from the dev setup to production-grade infrastructure.

---

## When to upgrade

Trigger criteria — if **any** of these are true, it's time for Mode 2:

- 🔴 **Real customer PII is going into the database** (a paying pharmacy's actual customers, not test data)
- 🔴 **The pharmacist relies on it daily** for actual operations (not just "trying it out")
- 🟡 Atlas storage usage > 200 MB (you're approaching the 512 MB free cap)
- 🟡 You've started paying for any AWS / Atlas / Cloudflare add-on
- 🟡 The pharmacist has complained about cold starts more than once

Until **none** of these are true, Mode 1 is fine. Don't over-engineer.

---

## What changes (and what doesn't)

### Unchanged
- The code itself. Same `apps/api` and `apps/web`. Same Docker images.
- The reminder flow. Pharmacist's phone still sends the messages.
- The seed script. Atlas Mongo behaves identically on M10 vs M0.
- Local development workflow. `make up` still works exactly the same.

### What changes
- **Where compute runs:** Render → AWS EC2 (or Hetzner, or Oracle Cloud Always Free as alternative)
- **Database tier:** Atlas M0 → Atlas M10 (continuous backups, dedicated CPU, SLA)
- **TLS termination:** Render's auto-Let's Encrypt → Caddy on EC2 (also auto-Let's Encrypt)
- **DNS + edge:** none → Cloudflare (free)
- **Backups:** none → Atlas built-in + daily `mongodump` mirror to S3
- **Monitoring:** none → Sentry (errors) + UptimeRobot (uptime)
- **Security hardening:** see checklist at end of this doc

---

## Migration plan — step by step

Read all steps before starting. Total elapsed time: **~3 hours** of focused work. Plan for evening/weekend; expect ~10 minutes of customer-facing downtime during DNS cutover.

### Step 0 — Pre-flight (do this BEFORE touching anything)

1. **Take a fresh backup of current Atlas data:**
   ```bash
   mongodump --uri="$MONGO_URI" --archive=./pre-prod-migration-$(date +%F).gz --gzip
   ```
   Keep this archive safe. It's your rollback fuel.

2. **Document current state:**
   - Capture `https://pharmacare-web.onrender.com` (current URL)
   - Note who uses it daily and warn them about the 10-minute cutover window
   - Snapshot the Render env vars (Settings → Environment → screenshot all of them)

3. **Decide your domain.** You need one. Suggestions:
   - `.in` from a registrar (Namecheap, BigRock) — ~₹100–500/yr
   - `.com` — ~₹1,000/yr
   - For a non-public internal tool, even `.online` or `.app` works

---

### Step 1 — Atlas M0 → M10 upgrade (15 min, no downtime)

The Atlas in-place upgrade is non-destructive — same data, same connection string.

1. Atlas dashboard → your cluster → ⚙️ → **Edit Configuration**
2. Cluster Tier → **M10** ($57/mo)
3. Cloud Provider: AWS, Region: Mumbai (ap-south-1) — match existing
4. Backup: **Enable Continuous Cloud Backup** (this is what you're paying for)
5. **Review Changes** → **Apply Changes**
6. Wait ~5–15 minutes. Atlas does a rolling upgrade. Connection string stays the same.

**Verify:**
- Atlas Backup tab now shows daily snapshots scheduled
- Cluster metrics tab shows dedicated CPU (no more "shared")

**Cost trigger:** the moment you click Apply, billing begins. ~$57/mo prorated.

---

### Step 2 — Provision the EC2 instance (30 min)

1. AWS Console → EC2 → **Launch Instance**
   - **Name:** `pharmacare-prod`
   - **AMI:** Amazon Linux 2023 (or Ubuntu 24.04 LTS — easier for most devs)
   - **Type:** `t3.nano` (cheapest, fine for small pharmacy) or `t3.small` (recommended buffer)
   - **Key pair:** generate a new one, download the `.pem` and chmod 600
   - **Network:** default VPC, public subnet, **enable auto-assign public IP**
   - **Security group rules:** SSH (22) from your IP only, HTTP (80) + HTTPS (443) from anywhere
   - **Storage:** 20 GB gp3 (default 8 GB is too tight if you keep backups locally)
2. Launch — note the public IP

3. SSH in and install Docker + Docker Compose:
   ```bash
   ssh -i pharmacare.pem ubuntu@<public-ip>
   sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
   sudo usermod -aG docker ubuntu
   newgrp docker
   ```

4. Clone the repo:
   ```bash
   git clone git@github.com:abhishekSonawane97/pharmacare.git
   cd pharmacare
   cp .env.example .env
   nano .env    # fill in MONGO_URI (same as Render), JWT secrets, ADMIN credentials
   ```

5. Test the build (don't expose to internet yet):
   ```bash
   make build
   make up
   curl http://localhost:4000/api/health    # should return {"status":"ok",...}
   ```

---

### Step 3 — Install Caddy as reverse proxy + TLS terminator (15 min)

Caddy auto-provisions Let's Encrypt certificates and renews them. No manual cert wrangling.

1. Install:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```

2. Configure: `sudo nano /etc/caddy/Caddyfile`
   ```
   pharmacare.yourdomain.in {
       # Web app
       handle {
           reverse_proxy localhost:3000
       }
       # API
       handle_path /api/* {
           reverse_proxy localhost:4000
           rewrite * /api{path}
       }
   }
   ```
   Replace `pharmacare.yourdomain.in` with your actual domain.

3. Reload:
   ```bash
   sudo systemctl restart caddy
   sudo systemctl enable caddy
   ```

Caddy will fail until DNS points to this EC2 instance (next step). That's fine.

---

### Step 4 — DNS via Cloudflare (10 min, this is the cutover moment)

1. **Add domain to Cloudflare** (free): https://dash.cloudflare.com → Add site → enter your domain → free plan
2. Cloudflare gives you 2 nameservers — go to your registrar and replace the existing nameservers with these. **Wait 5–60 minutes for propagation.**
3. Once propagated, in Cloudflare DNS settings:
   - Add **A record**: `pharmacare` → `<EC2 public IP>` → **Proxy status: DNS only** (orange cloud OFF initially)
4. Test SSL: open `https://pharmacare.yourdomain.in` — Caddy should auto-fetch a Let's Encrypt cert and serve. Login should work.
5. Once verified, **turn on Cloudflare proxy** (orange cloud ON). Now you get DDoS + edge caching.

**This is the cutover moment.** Tell the pharmacist to use the new URL. Keep the Render URL alive for one more week as a fallback.

---

### Step 5 — Lock down Atlas IP allowlist (5 min)

The Atlas DB is currently open to `0.0.0.0/0` — the entire internet. Replace with the EC2's public IP only.

1. Atlas → Network Access → Add IP Address → enter `<EC2 public IP>/32` → comment "Production EC2"
2. Test that the api on EC2 still connects: `curl https://pharmacare.yourdomain.in/api/health`
3. **Only after verifying:** delete the `0.0.0.0/0` entry

**Verify:** `dig +short pharmacare.yourdomain.in` should resolve to Cloudflare's edge (not your EC2 IP, since proxy is on).

For extra security, set up [VPC peering between EC2 and Atlas](https://www.mongodb.com/docs/atlas/security-vpc-peering/) — but only if you're comfortable with AWS VPC routing tables. Optional.

---

### Step 6 — Daily backups to S3 (20 min)

Atlas's built-in backups (now enabled on M10) protect against Atlas-side disasters. The S3 mirror protects against **Atlas-account-level disasters** (deleted cluster, lost account access, billing issue).

1. Create S3 bucket: AWS → S3 → Create bucket
   - Name: `pharmacare-backups-{random}`
   - Region: Mumbai (ap-south-1)
   - Block all public access: ✅
   - Encryption: SSE-S3 (default)
2. Create IAM user with `s3:PutObject` only on this bucket. Save Access Key + Secret.
3. On EC2:
   ```bash
   sudo apt install -y awscli mongodb-mongosh
   aws configure   # paste IAM key + secret + region ap-south-1
   ```
4. Create `/usr/local/bin/pharmacare-backup.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   set -a; source /home/ubuntu/pharmacare/.env; set +a
   DATE=$(date +%F-%H%M)
   ARCHIVE=/tmp/pharmacare-$DATE.gz
   mongodump --uri="$MONGO_URI" --archive="$ARCHIVE" --gzip
   aws s3 cp "$ARCHIVE" "s3://pharmacare-backups-{random}/" --storage-class STANDARD_IA
   rm "$ARCHIVE"
   ```
5. `chmod +x /usr/local/bin/pharmacare-backup.sh`
6. Add to cron: `crontab -e`
   ```
   30 3 * * * /usr/local/bin/pharmacare-backup.sh >> /var/log/pharmacare-backup.log 2>&1
   ```
   (runs daily at 03:30 server time)
7. Run it once manually to verify the first backup lands in S3.

**Add S3 lifecycle rule** for cost control:
- Move backups older than 30 days to Glacier (Cheaper)
- Delete backups older than 365 days

---

### Step 7 — Monitoring (15 min)

#### UptimeRobot (uptime alerts)
1. Sign up: https://uptimerobot.com (free)
2. Add Monitor: HTTP keyword
   - URL: `https://pharmacare.yourdomain.in/api/health`
   - Keyword: `"status":"ok"`
   - Interval: 5 minutes
3. Add yourself + pharmacy owner as alert contacts (email/WhatsApp)

#### Sentry (error tracking)
1. Sign up: https://sentry.io (free tier = 5k errors/month)
2. Create two projects: `pharmacare-api` (Node.js), `pharmacare-web` (Next.js)
3. Install in api:
   ```bash
   cd apps/api
   npm install @sentry/node
   ```
   Add to `src/index.ts` (top of file):
   ```typescript
   import * as Sentry from '@sentry/node';
   Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
   ```
4. Install in web:
   ```bash
   cd apps/web
   npx @sentry/wizard@latest -i nextjs
   ```
   Follow the wizard.
5. Add `SENTRY_DSN` (api) and `NEXT_PUBLIC_SENTRY_DSN` (web) to `.env`.
6. Rebuild + redeploy: `make build && make restart`.

---

### Step 8 — Security hardening checklist

Before flipping to production traffic, run through this checklist. Each item is small and high-impact.

| Item | Status | What to add |
|---|---|---|
| Atlas IP allowlist locked to EC2 IP only | — | See Step 5 above |
| Rate limiting on `/api/auth/*` | — | `npm i express-rate-limit` — 5 req/15min on login, 10 req/hr on signup |
| Helmet security headers | — | `npm i helmet` then `app.use(helmet())` in `src/index.ts` |
| Bcrypt rounds | — | Bump from 10 → 12 in `routes/auth.ts` and `routes/employees.ts` |
| Password min length | — | Bump zod schema from `min(6)` → `min(10)` |
| Account lockout after N failed logins | — | Add `failedLoginCount` + `lockedUntil` to User model; 5 fails = 15-min lock |
| JWT tokens in httpOnly cookies (not localStorage) | — | Larger refactor; ~50 lines. Eliminates XSS token theft. |
| Audit log captures IP + user-agent | — | Add `req.ip` + `req.get('user-agent')` to every `ActivityLog.create` |
| Mongoose `strict: 'throw'` on all schemas | — | Catches typos at write time |
| Graceful shutdown on SIGTERM | — | `const server = app.listen(...); process.on('SIGTERM', () => server.close())` |
| `.env` mirrored to a secret manager | — | 1Password, Bitwarden, or AWS Secrets Manager |
| `/auth/signup` has reCAPTCHA | — | Cloudflare Turnstile (free) — drop in 10 lines |
| All admin actions in ActivityLog | ✅ | Already done |
| HTTPS everywhere | ✅ | Caddy + Cloudflare |
| Real backups | ✅ | Step 6 + Atlas continuous |

The first 8 items add up to maybe 4–6 hours. None individually is hard. Together they're the difference between "demo software" and "I'd put a real pharmacy on this."

---

### Step 9 — Decommission Render (1 week after cutover)

After at least 1 week of stable production traffic on EC2:

1. Update DNS TTL to 60s (in case you need to revert)
2. Watch logs/Sentry/UptimeRobot for any regression
3. Once confident:
   - Render dashboard → `pharmacare-api` → Settings → **Delete Service**
   - Same for `pharmacare-web`
   - Revoke the Render API key (which is currently committed in places I shouldn't mention 😅)

---

## Rollback plan

If something breaks during migration:

| Issue | Rollback |
|---|---|
| EC2 instance won't start | Atlas + Render are unchanged — just don't cut DNS over |
| Caddy can't get TLS cert | Check Cloudflare DNS A record; Caddy needs port 80 reachable for HTTP-01 challenge |
| API can't reach Atlas | Check IP allowlist on Atlas (Step 5); revert to `0.0.0.0/0` temporarily |
| Browser shows wrong content | DNS still pointing to Render — wait propagation or flip Cloudflare A record back |
| Data lost / corrupted | Restore from `pre-prod-migration-YYYY-MM-DD.gz` you took in Step 0 |

The migration is fully reversible **at every step** because Atlas (the source of truth) is unchanged until Step 5, and Render keeps running until Step 9.

---

## Ongoing operations (post-migration)

| Task | Frequency | Where |
|---|---|---|
| Check UptimeRobot alerts | Daily (passive — alerts come to you) | Email/WhatsApp |
| Check Sentry for new errors | Weekly | sentry.io dashboard |
| Verify backups succeeded | Weekly | `aws s3 ls s3://pharmacare-backups-{random}/ | tail -7` |
| Rotate JWT secrets | Yearly | New `openssl rand -base64 64`, update env, restart |
| Atlas storage check | Monthly | Atlas dashboard → metrics |
| Apply security patches | Monthly | `sudo apt update && sudo apt upgrade` on EC2 + restart |
| Re-test backup restore | Quarterly | `mongorestore` a backup into a scratch Atlas project |
| Rotate AWS IAM access key | Yearly | New key, update cron script, deactivate old |

Set calendar reminders for the quarterly backup restore test. It's the only one that catches the failure mode "backups exist but are unrestorable."

---

## What's still missing for "enterprise grade"

This guide gets you to "production-grade for a single small/mid pharmacy." If you ever scale beyond that, here's what you'd add:

- **Multi-region failover** — EC2 in another region, Atlas with geo-distributed replicas
- **Blue/green or canary deploys** — currently `git push` deploys to production atomically
- **Centralized log aggregation** — Logtail, Datadog, or self-hosted Loki
- **APM** — application performance monitoring (request traces, slow query detection)
- **Pen test + security audit** — by a third party before serving 100+ pharmacies
- **GDPR/DPDP compliance work** — customer data export, deletion-on-request endpoints
- **Real WhatsApp Business API** — if pharmacists want fully automated sends
- **Per-pharmacy data isolation** — currently single-tenant; multi-tenant needs auth + DB scoping refactor

None of those are needed for the first 1–10 pharmacies. They're flagged here so you know they exist when you grow into them.
