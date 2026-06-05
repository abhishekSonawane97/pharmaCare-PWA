# Operating PharmaCare in production

> **Audience:** the engineer on-call. This is the runbook — daily ops, common tasks, rollback procedures, hardening checklist. For *how to deploy*, see [DEPLOY.md](DEPLOY.md). For *how the system is built*, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Current state (snapshot)

| | |
|---|---|
| AWS account | `059567100086` |
| Region | `ap-south-1` (Mumbai) |
| CloudFormation stack | `pharmacare-prod` |
| EC2 instance | `i-0e4e1b0ced7aeb3cb` (t4g.small, Ubuntu 24.04, ARM64) |
| Elastic IP / live URL | `13.205.80.177` → http://13.205.80.177 |
| ECR repos | `pharmacare-api`, `pharmacare-web` (lifecycle: 10 sha-tags retained) |
| Atlas cluster | `pharmacare.uoxcurq.mongodb.net` (M0 free, AWS Mumbai) |
| Atlas IP allowlist | `0.0.0.0/0` (TODO: tighten to EIP/32 — see [Atlas allowlist](#atlas-allowlist)) |
| Budget alerts | $10/$20/.../$100 via AWS Budgets → `healthcare.pharmacy9988@gmail.com` |
| Render fallback | https://pharmacare-web.onrender.com (kept parallel, same Atlas) |
| GHA deploy role | `arn:aws:iam::059567100086:role/pharmacare-gha-deploy` (OIDC) |
| GitHub secret | `AWS_DEPLOY_ROLE_ARN` (= the role ARN above) |
| Admin login | `shaikhabusaeed1@gmail.com` / `admin123` |

---

## Quick access cheatsheet

```bash
# Set AWS profile once per shell
export AWS_PROFILE=pharmacare-boot   # or whatever profile holds your AWS creds

# SSH break-glass (rarely needed; SSM Session Manager preferred)
ssh -i ~/.ssh/pharmacare-keypair.pem ubuntu@13.205.80.177

# SSM Session Manager (preferred — no SSH port, auditable)
aws ssm start-session --target i-0e4e1b0ced7aeb3cb --region ap-south-1

# Live container status
aws ssm send-command --instance-ids i-0e4e1b0ced7aeb3cb \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["cd /opt/pharmacare && docker compose ps"]' \
  --region ap-south-1

# Live logs (last 100 lines per service)
aws ssm send-command --instance-ids i-0e4e1b0ced7aeb3cb \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["cd /opt/pharmacare && docker compose logs --tail=100"]' \
  --region ap-south-1

# Health check
curl -s http://13.205.80.177/api/health
```

---

## Daily / weekly / monthly checks

| Cadence | Task | How |
|---|---|---|
| Daily (passive) | Monitor budget alert emails | Inbox of `healthcare.pharmacy9988@gmail.com` |
| Daily (passive) | Monitor GHA deploy results | GitHub repo → Actions tab; failures email you |
| Weekly | Smoke test `/api/health` | `curl http://13.205.80.177/api/health` |
| Weekly | Verify Atlas storage usage | Atlas dashboard → cluster → Metrics tab |
| Monthly | Apply Ubuntu security patches | SSM session → `sudo apt update && sudo apt upgrade -y && sudo reboot` |
| Monthly | Confirm ECR retention is working | `aws ecr describe-images --repository-name pharmacare-api --query 'length(imageDetails)'` should be ≤10 |
| Quarterly | Test backup restore | Take `mongodump` → restore to a scratch Atlas project → verify counts |
| Quarterly | Rotate JWT secrets | New `openssl rand -base64 64` for both → update SSM → trigger redeploy. Forces all sessions to re-login. |
| Yearly | Rotate the EC2 SSH keypair | Generate new, attach via AWS Systems Manager, retire old |

---

## Common tasks

### Push a code change

```bash
git add … && git commit -m "…" && git push origin main
```

GHA fires automatically. See [DEPLOY.md](DEPLOY.md). No manual steps.

### Rollback to a previous SHA

```bash
git log --oneline -10
gh workflow run deploy.yml --ref <commit-sha>
```

Takes ~10 seconds (cached image). Atlas data untouched.

### Update an env var (e.g. ADMIN_EMAIL, CORS_ORIGIN)

```bash
# 1. Update SSM
aws ssm put-parameter --name /pharmacare/env/<NAME> \
  --value "<new value>" --type String --overwrite --region ap-south-1

# 2. Trigger redeploy (so the new value is read into /opt/pharmacare/.env)
gh workflow run deploy.yml --ref main
```

For `SecureString` params (secrets like `MONGO_URI`, `JWT_*_SECRET`, `ADMIN_PASSWORD`), use `--type SecureString` instead of `--type String`.

### Restart containers without redeploying

```bash
aws ssm send-command --instance-ids i-0e4e1b0ced7aeb3cb \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["cd /opt/pharmacare && docker compose restart"]' \
  --region ap-south-1
```

### Reset admin password

This requires connecting to Atlas and updating the user's `passwordHash`. There's no UI flow for forgot-password.

```bash
# Via the running api container (uses bcryptjs already installed)
aws ssm send-command --instance-ids i-0e4e1b0ced7aeb3cb \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["docker exec pharmacare-api-1 node -e \"const m=require(\\\"mongoose\\\"),b=require(\\\"bcryptjs\\\");(async()=>{await m.connect(process.env.MONGO_URI);const U=m.model(\\\"User\\\",new m.Schema({},{strict:false}),\\\"users\\\");const u=await U.findOne({role:\\\"admin\\\"});u.passwordHash=await b.hash(\\\"<NEW-PASSWORD>\\\",10);await u.save();console.log(\\\"OK\\\");await m.disconnect();})()\""]' \
  --region ap-south-1
```

Replace `<NEW-PASSWORD>` in the snippet. The user can change it via the UI later if a profile-edit page exists (currently it doesn't).

### Add a new employee directly (skip the signup-approval flow)

Log in as admin → Employees → **Add employee** → fill the form → set role. They're created with `status=active` immediately, no approval needed.

### View the audit trail

Log in as admin → **Activity** page. Or query Mongo directly:
```bash
docker exec pharmacare-api-1 node -e "..."  # similar pattern to password reset
```

### Re-seed the database (DESTRUCTIVE)

⚠️ **Wipes all collections.** Only do this on a fresh DB or with explicit consent.

```bash
# Run from your local machine — it executes against the shared Atlas
docker compose exec -e SEED_FORCE=true \
  -e ADMIN_EMAIL=shaikhabusaeed1@gmail.com \
  -e ADMIN_PASSWORD=admin123 \
  api npm run seed
```

After running: the live site (both EC2 and Render) immediately reflects the new data.

### Take a manual DB backup

```bash
mongodump --uri="$MONGO_URI" --archive=./backup-$(date +%F).gz --gzip
```

Store the archive somewhere safe (S3, off-machine).

### Restore from a backup

```bash
mongorestore --uri="$MONGO_URI" --archive=./backup-2026-06-04.gz --gzip --drop
```

The `--drop` flag wipes existing collections before restoring. Be sure you have the right archive.

---

## Atlas allowlist tightening

**Current state:** Atlas IP allowlist is `0.0.0.0/0` (open to the internet). The Atlas database user's password is the only thing protecting customer + medical data. This is acceptable for a dev/testing parallel-cutover phase but **must be tightened** before any real pharmacy data goes in.

### Cutover sequence (do this after 24h of stable EC2 + Render parallel run)

1. Atlas → Network Access → Add IP Address → enter `13.205.80.177/32` → comment "AWS EC2 prod" — **but keep `0.0.0.0/0` for now**.
2. Wait 24h. Both EC2 and Render should still connect (they use the same Atlas user).
3. Verify EC2 still talks to Atlas:
   ```bash
   curl http://13.205.80.177/api/health  # → mongoConnected:true
   ```
4. If yes: Atlas → Network Access → delete the `0.0.0.0/0` entry. Only `13.205.80.177/32` remains.
5. Render will **stop working** the moment `0.0.0.0/0` is removed — Render's free tier has no static egress IPs.
6. If you want Render to keep working too, take the egress IP ranges from https://render.com/docs/static-outbound-ip-addresses and allowlist those `/32`s. They change quarterly — fragile, not recommended. Better to decommission Render once EC2 is verified.

### Rollback if api stops connecting

```bash
# Re-add 0.0.0.0/0 in Atlas Network Access — api reconnects within ~30 seconds
# (mongoose default retry on disconnect)
```

---

## Decommission Render (post-cutover)

After at least **1 week** of stable production traffic on EC2 with no rollback needed:

1. Update DNS TTL to 60s on any domain pointing at Render (currently there is none — just the `*.onrender.com` URL).
2. Watch UptimeRobot / GHA results for 1 week. No regressions.
3. Render dashboard → `pharmacare-web` → Settings → **Delete Service**. Same for `pharmacare-api`.
4. **Revoke the Render API key** (was committed in some session — find and rotate; future engineers shouldn't reuse the leaked key).
5. Update [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md) to remove Render references (or keep as historical reference).
6. Atlas: tighten IP allowlist to EC2 EIP only (see above).

---

## Monitoring

### What's set up today

- **AWS Budgets** — `pharmacare-every-10-dollars` budget with 10 thresholds (10%, 20%, …, 100% of $100/mo). Email: `healthcare.pharmacy9988@gmail.com`. Fires when actual usage burn crosses each threshold, ignoring the $100 Activate credit.
- **GitHub Actions failure notifications** — deploy failures email the committer via the default GitHub notification settings.
- **Docker `restart: unless-stopped`** — every container auto-restarts on crash.
- **API `/api/health` endpoint** — returns `{status, uptime, mongoConnected}` for external probes.

### What's NOT set up yet (recommended additions)

| Tool | What it gives | Setup time | Cost |
|---|---|---|---|
| **UptimeRobot** (free) | 5-min HTTP ping on `/api/health` with email/SMS alerts on down | 10 min | ₹0 |
| **CloudWatch alarm** on `StatusCheckFailed_Instance` | EC2 hardware/hypervisor failure detection (rare but fatal) | 5 min | ~₹10/mo |
| **Sentry** (free tier) | Server + client exception capture with stack traces | 20 min | ₹0 (up to 5k errors/mo) |
| **Cron `mongodump` → S3** | Daily DB backup (Atlas M0 has no automatic backups!) | 30 min | ~₹40/mo |
| **CloudWatch Logs agent** | Container stdout/stderr collected into CloudWatch | 20 min | ~₹50/mo per 5 GB |

These are listed in priority order. **The `mongodump` → S3 cron is the highest-priority gap** — without it, any data loss is permanent.

---

## Backups

⚠️ **Atlas M0 has NO automatic backups.** This is the single biggest production risk.

### Manual backup (one-off)

```bash
mongodump --uri="$MONGO_URI" --archive=./backup-$(date +%F).gz --gzip
# Store the archive off-machine: S3, Backblaze, even Google Drive
```

### Automated backup (recommended setup)

A daily cron on the EC2 instance dumps Atlas → uploads to S3. Outline:

1. Create S3 bucket: `aws s3 mb s3://pharmacare-backups-<random> --region ap-south-1`
2. Add lifecycle: move objects to Glacier after 30 days, delete after 365 days
3. Create IAM role with `s3:PutObject` on the bucket only; attach to EC2 instance role
4. Add `/usr/local/bin/pharmacare-backup.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   set -a; source /opt/pharmacare/.env; set +a
   DATE=$(date +%F-%H%M)
   ARCHIVE=/tmp/pharmacare-$DATE.gz
   mongodump --uri="$MONGO_URI" --archive="$ARCHIVE" --gzip
   aws s3 cp "$ARCHIVE" "s3://pharmacare-backups-<random>/" --storage-class STANDARD_IA
   rm "$ARCHIVE"
   ```
5. Crontab: `30 3 * * * /usr/local/bin/pharmacare-backup.sh >> /var/log/pharmacare-backup.log 2>&1`

This is **listed but not yet implemented**. Add it before storing real customer data.

---

## Security hardening checklist

These are the items from the original `PRODUCTION.md` migration plan. Items I marked as **done** are in the current setup; **pending** items are gaps to close before serving real customers.

| Item | Status | Notes |
|---|---|---|
| HTTPS / real TLS cert | ❌ pending | HTTP-only currently (no domain). Adds 30 min once a domain is bought. |
| Atlas IP allowlist locked to EC2 EIP | ❌ pending | See [Atlas allowlist](#atlas-allowlist) cutover above. |
| Rate limiting on `/api/auth/*` | ❌ pending | Add `express-rate-limit` — 5/15min on login, 10/hr on signup. |
| Helmet security headers | ❌ pending | `npm i helmet` then `app.use(helmet())` in `src/index.ts`. One line. |
| Bcrypt rounds 10 → 12 | ❌ pending | In `routes/auth.ts` and `routes/employees.ts`. |
| Password min length 6 → 10 | ❌ pending | Zod schema in `routes/auth.ts`. |
| Account lockout after N failed logins | ❌ pending | Add `failedLoginCount` + `lockedUntil` to User model. |
| JWT in httpOnly cookies (not localStorage) | ❌ pending | Eliminates XSS token theft. ~50 lines refactor. |
| Audit log captures IP + user-agent | ❌ pending | Add `req.ip` + `req.get('user-agent')` to every `ActivityLog.create`. |
| Mongoose `strict: 'throw'` on all schemas | ❌ pending | Catches typos at write time. |
| Graceful shutdown on SIGTERM | ❌ pending | `process.on('SIGTERM', () => server.close())`. |
| `.env` mirrored to a secret manager | ✅ done | SSM Parameter Store on AWS side. |
| `/auth/signup` has reCAPTCHA | ❌ pending | Cloudflare Turnstile (free) — ~10 lines. |
| All admin actions in ActivityLog | ✅ done | Already done in all writeable routes. |
| Defense-in-depth role gates (UI hidden + page guard + server requireAdmin) | ✅ done | Three-layer enforcement everywhere. |
| Real backups | ❌ pending | See [Backups](#backups). Highest priority gap. |
| Image scanning | ✅ done | ECR `ScanOnPush: true` on both repos. |
| OIDC for CI (no AWS keys in GitHub) | ✅ done | `pharmacare-gha-deploy` role, ref-pinned. |
| Server doesn't need GitHub access | ✅ done | SSM Run Command is the deploy mechanism. |
| No long-lived AWS access keys in use | ⚠️ partial | OIDC for CI ✓. The `pharmacare-bootstrap` user key still exists — delete after stable for a week (see below). |
| Single point of failure: one EC2 | ❌ accepted | Acceptable for single pharmacy. Add ALB + autoscaling group at 5+ tenants. |

Top 5 priorities (closing biggest risks first):
1. **Backups** (data loss is permanent)
2. **Atlas allowlist** (everyone with the password can read all customer PII)
3. **Rate limit + helmet** (auth abuse + common attack vectors)
4. **JWT → httpOnly cookies** (XSS token theft)
5. **mongoose `strict: 'throw'`** (catch typos)

---

## Cleanup tasks (one-time)

### Delete the bootstrap IAM access key

The `pharmacare-bootstrap` user has an active access key (`AKIAQ3XTZ2C3DX7ZYJXL`) that was used for the initial CFN deploy. Future deploys use OIDC — the key is now only useful for break-glass infrastructure changes.

**Recommendation: delete it.** Recreate when needed for the next infra change.

```bash
aws iam delete-access-key --user-name pharmacare-bootstrap \
  --access-key-id AKIAQ3XTZ2C3DX7ZYJXL --profile pharmacare-boot
```

After deleting, the local `~/.aws/credentials` will stop working for that profile. CI is unaffected (uses OIDC).

### Lock the SSH allowlist down

CFN was deployed with `SshCidr=0.0.0.0/0` (SSH open to the world). The instance only opens 22 — the OS itself is up-to-date, but defense-in-depth says lock the network too.

```bash
aws cloudformation deploy --stack-name pharmacare-prod \
  --template-file infra/cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides KeyName=pharmacare-keypair SshCidr=$(curl -s ifconfig.me)/32
```

---

## Cost monitoring

See [COST.md](COST.md). Current spend rate is **~$18/mo** (~₹1,500), all currently covered by the $100 AWS Activate credit.

| Threshold | What it means |
|---|---|
| $10 reached | Normal monthly burn at month-end (no concern) |
| $20-30 reached early in month | Something unusual — investigate |
| $50+ reached | Either traffic spiked, EIP got detached, or a stuck process. Investigate. |
| $100 reached | Credit exhausted — billing converts to actual charges |

All thresholds email `healthcare.pharmacy9988@gmail.com`. Whitelist `no-reply@email.amazonbudgets.com` to avoid spam folder.

---

## Troubleshooting (production-specific)

### Live site returns 502 for everything

Check, in order:
1. EC2 instance running? `aws ec2 describe-instances --instance-ids i-0e4e1b0ced7aeb3cb --query 'Reservations[0].Instances[0].State.Name' --output text`
2. Docker daemon up? SSM session → `sudo systemctl status docker`
3. Containers running? `docker compose ps` in `/opt/pharmacare`
4. Nginx config valid? `docker compose exec nginx nginx -t`

### `mongoConnected:false` after a deploy

Atlas allowlist or `MONGO_URI` issue.
1. Verify SSM has the right URI: `aws ssm get-parameter --name /pharmacare/env/MONGO_URI --with-decryption --region ap-south-1`
2. Verify EC2's egress IP matches what Atlas expects.
3. Quick fix: re-add `0.0.0.0/0` in Atlas Network Access (api reconnects in ~30s).

### Lost SSH access (forgot key)

Use SSM Session Manager instead — no SSH needed:
```bash
aws ssm start-session --target i-0e4e1b0ced7aeb3cb --region ap-south-1
```

If even SSM is down (rare), the EC2 console serial port via AWS console works as last resort.

### Out of EBS disk space

```bash
docker system prune -af --filter "until=168h"   # clears images >7 days old
docker image prune -af                           # clears unused images
journalctl --vacuum-time=14d                     # rotates old systemd logs
```

t4g.small + 20 GiB gp3 has plenty of headroom for years at single-pharmacy scale. Watch via CloudWatch metrics → `EBSReadOps` / disk-used (need CloudWatch agent for the latter).

### "Stack pharmacare-prod is in ROLLBACK_COMPLETE state"

CFN refuses to update a stack in this state. Delete + recreate:
```bash
aws cloudformation delete-stack --stack-name pharmacare-prod
aws cloudformation wait stack-delete-complete --stack-name pharmacare-prod
# Then re-deploy normally
```

Resources to know about: EIP, ECR repos, OIDC provider all get destroyed too. Customer data in Atlas is safe (separate account).

---

## What's still missing for "enterprise-grade"

This setup is appropriate for **one small/mid pharmacy**. To scale beyond that:

- **Multi-AZ HA** — second EC2 in a different AZ, behind an ALB
- **Blue/green / canary deploys** — currently `up -d` is a brief downtime
- **Centralized logs** — Logtail, Datadog, or self-hosted Loki
- **APM** — request tracing, slow query detection
- **Pen test + security audit** — by a third party before 100+ pharmacies
- **GDPR/DPDP compliance** — customer data export + deletion-on-request endpoints
- **Real WhatsApp Business API** — if pharmacists ever want fully automated sends
- **Per-pharmacy data isolation** — currently single-tenant; multi-tenant needs auth + DB scoping refactor

None of those are needed for the first 1–10 pharmacies. They're flagged here so future engineers know they exist when you grow into them.
