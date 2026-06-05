# Cost to run

> All prices in **Indian Rupees (₹)** as the primary currency, with **USD** in parentheses where relevant. Rates as of 2026, USD → INR at ~₹83.

PharmaCare runs in three configurations. Today we have **AWS EC2 + Atlas + Render-parallel** all live at once — Render is the rollback safety net. After cutover, you'll be on AWS-only.

## TL;DR

| Configuration | Use when | Monthly | Annual |
|---|---|---|---|
| **AWS EC2 + Atlas M0** *(today's setup)* | Production for one small pharmacy | **~$18 (~₹1,500)** | **~$220 (~₹18,000)** |
| **Render free + Atlas M0** *(parallel fallback)* | Demo / dev / fallback only | **₹0** | **₹0** |
| **AWS EC2 + Atlas M10 + S3 + monitoring** *(true production)* | Real pharmacy with PII + SLA | **~$77 (~₹6,400)** | **~$924 (~₹77,000)** |

The first 5–6 months of the AWS setup are **fully covered by the $100 AWS Activate credit**. After that, ~$18/mo billing begins.

---

## Current setup: AWS EC2 + Atlas M0 (live today)

| Component | Spec | Monthly | Annual | Covered by credit? |
|---|---|---|---|---|
| EC2 `t4g.small` (24/7, ARM64, Mumbai) | 2 vCPU, 2 GB RAM | $16.35 (~₹1,360) | $196 (~₹16,300) | ✅ ~5 months |
| EBS gp3 root volume | 20 GiB encrypted | $1.85 (~₹155) | $22 (~₹1,830) | ✅ |
| Elastic IP (attached) | 1 | $0 | $0 | n/a |
| ECR storage | ~1.5 GB | $0.15 (~₹13) | $1.80 (~₹150) | ✅ |
| Data transfer out | ~5 GB/mo | $0 (under 100 GB free) | $0 | n/a |
| SSM Parameter Store | 12 standard params | $0 | $0 | n/a |
| AWS Budgets | 1 (`pharmacare-every-10-dollars`) | $0 (first 2 free) | $0 | n/a |
| **AWS subtotal** | | **~$18.35 (~₹1,530)** | **~$220 (~₹18,300)** | **5–6 months free** |
| Atlas M0 (Mumbai) | 512 MB | $0 | $0 | n/a |
| Render free (kept parallel) | 2 services | $0 | $0 | n/a |
| **TOTAL ongoing** | | **~$18 (~₹1,500)** | **~$220 (~₹18,000)** | |

### Burn-rate gotchas
- **Stopping the EC2 instance keeps the EIP attached.** If you ever stop without releasing the EIP, the unattached-EIP fee kicks in at $0.005/hour = ~$3.65/mo for nothing. Either keep running or `delete-stack`.
- **ECR storage grows without lifecycle pruning.** Our lifecycle rule keeps last 10 sha-tagged images per repo. Without it, storage would balloon to ~5+ GB.
- **GitHub Actions runner minutes** are **free** for public repos and 2,000 min/mo for private repos. Each deploy uses ~3-5 min. Plenty of headroom.
- **Forgetting to delete the bootstrap IAM access key** after first deploy isn't a cost issue but is a security one — see [PRODUCTION.md → Cleanup](PRODUCTION.md#cleanup-tasks-one-time).

### What's NOT included
- Backups beyond Atlas's built-in M0 snapshots (M0 has limited snapshot retention) — see [PRODUCTION.md → Backups](PRODUCTION.md#backups). Add daily `mongodump` → S3 (~$0.50/mo extra).
- Sentry, UptimeRobot, etc. — all free tiers.
- Domain registration. Currently using the raw EIP.

---

## Budget alerts (already configured)

AWS Budgets is set up to email **`healthcare.pharmacy9988@gmail.com`** when monthly usage crosses each $10 threshold:

| Budget name | Amount | Period | Thresholds | Includes credits? |
|---|---|---|---|---|
| `pharmacare-every-10-dollars` | $100 | Monthly | 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100% | **No** (credits excluded so alerts fire on actual usage even during credit phase) |

Once the $100 Activate credit is exhausted, alerts continue firing each month as you cross the same thresholds against real billing.

**Free** — AWS gives 2 budgets per account at no cost.

### To change the email or thresholds
```bash
# Read current
aws budgets describe-budget --account-id 059567100086 \
  --budget-name pharmacare-every-10-dollars --region us-east-1

# Update — easiest via console: https://us-east-1.console.aws.amazon.com/billing/home#/budgets
```

---

## Dev / fallback: Render free + Atlas M0

| Component | Service | Spec | Monthly |
|---|---|---|---|
| Web hosting | Render free | 512 MB RAM, sleeps after 15 min idle | ₹0 |
| API hosting | Render free | 512 MB RAM, sleeps after 15 min idle | ₹0 |
| Database | MongoDB Atlas M0 | (same as AWS) | ₹0 |
| TLS | Let's Encrypt via Render | Auto-renewed | ₹0 |
| **TOTAL** | | | **₹0** |

### Tradeoffs
- **30-second cold start** after 15 min idle. Annoying for demos.
- **No SLA**, no backups (M0).
- **Free tier can be discontinued** with notice (Render's prerogative).

Acceptable for: internal testing, demos, **fallback during the AWS cutover**.
Not acceptable for: real pharmacy daily operations.

---

## True production: AWS EC2 + Atlas M10 + S3 + monitoring

When you upgrade to a real pharmacy with real customer data, add these line items:

| Component | Spec | Monthly | Annual |
|---|---|---|---|
| AWS EC2 + EBS + EIP + ECR (same as today) | | $18.35 | $220 |
| **MongoDB Atlas M10** | 10 GB storage, dedicated CPU, continuous backups, 99.95% SLA | $57 (~₹4,800) | $684 (~₹57,000) |
| **S3 backup mirror** | ~5 GB for `mongodump` archives + lifecycle | $0.50 (~₹40) | $6 (~₹500) |
| Domain registration | `.in` or `.com` | $1 (~₹100/mo) | $10–12 (~₹1,200) |
| TLS cert | Let's Encrypt via Caddy | $0 | $0 |
| CDN + DDoS | Cloudflare free | $0 | $0 |
| DNS | Cloudflare free | $0 | $0 |
| Error tracking | Sentry free tier (5k errors/mo) | $0 | $0 |
| Uptime monitoring | UptimeRobot free (5-min interval) | $0 | $0 |
| **CloudWatch alarm** | 1× `StatusCheckFailed_Instance` | $0.10 | $1.20 |
| WhatsApp / SMS delivery | Still pharmacist's own phone | $0 | $0 |
| **TOTAL** | | **~$77 (~₹6,400)** | **~$924 (~₹77,000)** |

### The jump explained
Most of the cost increase is the **Atlas M10 upgrade** — that's $57/mo (~₹4,800) for the SLA + backups. Everything else stays free tier.

### When to upgrade
- Real customer PII is in the DB (legal/ethical: must have backups)
- Pharmacist relies on it daily (must have uptime SLA)
- Storage > 200 MB (approaching M0's 512 MB cap)

Until *any* of these is true, stick with the current $18/mo configuration.

---

## What scaling looks like

| Customers | Reminders/month | Data size | Recommended setup | Monthly |
|---|---|---|---|---|
| 1–100 | <500 | <20 MB | AWS today's setup (no Atlas upgrade) | ~$18 |
| 100–500 | 500–2,500 | 20–100 MB | Same + UptimeRobot + S3 backups | ~$19 |
| 500–2,000 | 2,500–10,000 | 100 MB–1 GB | + Atlas M10 + Sentry | ~$77 |
| 2,000–5,000 | 10,000+ | 1–5 GB | + EC2 t3.small (4 GB RAM) | ~$93 |
| 5,000+ | — | 5+ GB | + Atlas M20 + ALB + multi-AZ | ~$300+ |

The **Atlas M0 storage cap (512 MB)** is the hardest single limit. For a single small pharmacy, you'd hit it after roughly **3 years** of normal use (customers + payments + activity log).

---

## Cost per customer per month

| Pharmacy size | Customers | Monthly ops cost | Cost per customer |
|---|---|---|---|
| Single shop (small) | 200 | ~$18 (~₹1,500) | ~$0.09 (~₹7.50) |
| Single shop (real production) | 200 | ~$77 (~₹6,400) | ~$0.39 (~₹32) |
| 3-shop chain | 800 | ~$77 (~₹6,400) | ~$0.10 (~₹8) |
| 10-shop chain | 3,000 | ~$200 (~₹16,600) ¹ | ~$0.07 (~₹5.50) |

¹ Assumes EC2 t3.small + Atlas M10

For comparison: Indian pharmacy management SaaS (Marg ERP, Pharmasoft, Medeil, etc.) charge **₹500–2,000 per shop per month**. So even the production-grade self-hosted setup is significantly cheaper if you have the operational appetite.

---

## What this does NOT cost

Common assumptions that don't apply here:

- **No per-message WhatsApp cost** — messages go from the pharmacist's own phone via `wa.me`. The pharmacist's WhatsApp plan covers it (essentially zero in India).
- **No per-message SMS cost** — same model via `sms:` URI. Most Indian plans include unlimited SMS.
- **No Meta Business Account fees** — not using WABA at all.
- **No DLT registration fees** — only required if going through an SMS gateway.
- **No per-user license** — admin + employees are free; create as many as needed.
- **No SSL/TLS cert cost** — Let's Encrypt is free; Cloudflare Edge SSL also free.

The only delivery cost in either configuration is if the pharmacy later decides to switch to the WhatsApp Business API for automated sends. That's a separate decision documented in git history before the click-to-send rewrite.

---

## Quarterly cost review

Each quarter, run through:

1. **AWS Cost Explorer** — https://us-east-1.console.aws.amazon.com/cost-management/home → confirm spend matches projection
2. **Atlas usage** — Atlas dashboard → cluster → Metrics → storage usage trending
3. **ECR storage** — `aws ecr describe-images --repository-name pharmacare-api` to confirm lifecycle prune is working
4. **Image count** — should be ≤10 sha-tagged per repo

The total should not exceed ~$25/mo for the current single-pharmacy setup. If it does, investigate before the next budget alert fires.
