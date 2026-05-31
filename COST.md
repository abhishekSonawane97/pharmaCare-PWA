# Cost to run

> All prices in **Indian Rupees (₹)** as the primary currency, with **USD** in parentheses where relevant. Rates as of 2026.

PharmaCare has two valid deployment modes (see [`ARCHITECTURE.md`](ARCHITECTURE.md) for diagrams). The choice between them is purely a function of how much downtime and data loss you can tolerate.

## TL;DR

| Mode | Use when | Monthly cost | Annual cost |
|---|---|---|---|
| **Dev / Testing** | Internal use, demos, pilot | **₹0** | **₹0** |
| **Production grade** | Real pharmacy, paying customers | **~₹5,800** | **~₹70,000** |

The leap is mostly the MongoDB Atlas upgrade. Compute, monitoring, TLS, CDN, and tooling stay free even in production mode.

---

## Mode 1 — Dev / Testing (current setup)

This is what's running today on Render + Atlas free tier.

| Component | Service | Spec | Monthly | Annual |
|---|---|---|---|---|
| Web hosting | Render free tier | 512 MB RAM, sleeps after 15 min idle | ₹0 | ₹0 |
| API hosting | Render free tier | 512 MB RAM, sleeps after 15 min idle | ₹0 | ₹0 |
| Database | MongoDB Atlas M0 | 512 MB storage, shared CPU, **no backups** | ₹0 | ₹0 |
| TLS certificate | Let's Encrypt via Render | Auto-renewed | ₹0 | ₹0 |
| Domain | `*.onrender.com` (Render-provided) | No custom domain | ₹0 | ₹0 |
| WhatsApp / SMS delivery | User's own phone account | Click-to-send via `wa.me` / `sms:` | ₹0 | ₹0 |
| Uptime monitoring | None (optional UptimeRobot free) | — | ₹0 | ₹0 |
| Error tracking | None | — | ₹0 | ₹0 |
| **TOTAL** | | | **₹0** | **₹0** |

### What you give up

| Limitation | Real-world impact |
|---|---|
| 15-minute idle sleep | First request after sleep takes ~30s (Render free) |
| Atlas M0 storage cap: 512 MB | ~3 years of data for a typical small pharmacy. Hard cap. |
| No Atlas backups | If Atlas corrupts data, it's gone. Manual `mongodump` is the only fallback. |
| No SLA | Outages of hours/year. Acceptable for testing; unacceptable for a paying pharmacy. |
| `0.0.0.0/0` IP allowlist on Atlas | Password is the only protection on patient PII. Real PII risk. |
| Render free can be discontinued | Render's free tier is at their discretion. |

### When you'd add UptimeRobot
Even in free mode, UptimeRobot (free) pinging `/api/health` every 5 min keeps the Render services warm so the first user request isn't a 30-second cold start. Recommended once you start showing the app to a real pharmacist. Still ₹0.

---

## Mode 2 — Production grade

For a real pharmacy with real customer data and a "must work when I open it" expectation. Compute is on AWS EC2 in Mumbai; DB is on Atlas M10; backups are continuous.

| Component | Service | Spec | Monthly | Annual |
|---|---|---|---|---|
| Compute | AWS EC2 (Mumbai) | Small instance, low traffic | ~₹100 | **~₹1,200** ¹ |
| Database | MongoDB Atlas M10 | 10 GB, dedicated CPU, continuous backups, 99.95% SLA | ~₹4,800 (~$57) | ~₹57,600 |
| Object storage | AWS S3 (Mumbai) | ~5 GB for `mongodump` mirror | ~₹40 | ~₹500 |
| Domain | `.in` or `.com` registrar | E.g. Namecheap, GoDaddy | ~₹100 | ~₹1,200 |
| TLS certificate | Let's Encrypt via Caddy | Auto-renewed | ₹0 | ₹0 |
| CDN + DDoS | Cloudflare free | Static asset caching, DDoS shield | ₹0 | ₹0 |
| DNS | Cloudflare free | — | ₹0 | ₹0 |
| Error tracking | Sentry free tier | 5k errors/month | ₹0 | ₹0 |
| Uptime monitoring | UptimeRobot free | 50 monitors, 5-min interval | ₹0 | ₹0 |
| WhatsApp / SMS delivery | User's own phone account (still!) | Click-to-send unchanged | ₹0 | ₹0 |
| **TOTAL ongoing** | | | **~₹5,040** | **~₹60,500** |

¹ **EC2 cost — important footnote**

AWS EC2 is **pay-as-you-go**, not a flat fee. The ~₹1,200/year figure assumes:
- First 12 months: **free** (AWS Free Tier covers 750 hrs/month of t2.micro or t3.micro)
- After that: a small instance like `t3.nano` or `t4g.nano` running 24/7 in Mumbai
- Very low traffic — appropriate for a single pharmacy with ~50–200 customers
- ~8 GB EBS storage included

For a heavier workload (e.g. multiple pharmacies on one server), bump to `t3.small` (~₹1,100/month after free year). AWS Pricing Calculator: <https://calculator.aws/#/createCalculator>.

### One-time setup costs (Mode 2)

| Item | Cost | Notes |
|---|---|---|
| Domain registration | ~₹100–1,000 (one-time/year) | `.in` is cheapest, `.com` is ~₹1,000/yr |
| AWS account setup | ₹0 | Free, but requires international credit card for billing |
| Atlas M10 cluster creation | ₹0 | Pro-rated billing starts when cluster is provisioned |
| EC2 launch + Caddy install | ₹0 | First-year free; ~30 min of setup time |
| Total one-time | **~₹100–1,000** | Domain only — everything else is service-level |

### Optional add-ons (Mode 2)

| Service | When you'd add it | Monthly cost |
|---|---|---|
| Atlas M20 upgrade | ~50+ pharmacies / 5 GB+ data | ~₹19,500 (~$230)/mo |
| Render Starter (instead of EC2) | If you prefer fully-managed over EC2 | ₹580 (~$7)/mo |
| Cloudflare Pro | DDoS/WAF for high-profile deploys | ₹1,700 (~$20)/mo |
| Sentry Team | >5k errors/month | ₹2,200 (~$26)/mo |
| Real WhatsApp Business API | If pharmacist wants automated sends (no taps) | ~₹0.30 per message + Twilio/Gupshup base ~₹0 |
| **Note** | These are luxuries, not requirements | — |

---

## What scaling looks like

| Customers | Reminders/month | Data size | Recommended mode |
|---|---|---|---|
| 1–100 | <500 | <20 MB | Mode 1 (free) is fine |
| 100–500 | 500–2,500 | 20–100 MB | Mode 1 with UptimeRobot, OR Mode 2 if real PII |
| 500–2,000 | 2,500–10,000 | 100 MB–1 GB | Mode 2 minimum |
| 2,000+ | 10,000+ | 1+ GB | Mode 2 + Atlas M20 + EC2 t3.small |
| Multi-pharmacy chain | — | — | Mode 2 + EC2 t3.medium + Atlas M20 |

The **storage cap on Atlas M0 (512 MB)** is the hardest limit on Mode 1. For a single small pharmacy, you'd hit it after roughly **3 years** of normal use (customers + payments + activity log).

---

## Cost per customer per month (Mode 2, real pharmacy)

| Pharmacy size | Customers | Monthly ops cost | Cost per customer |
|---|---|---|---|
| Small (single shop) | 200 | ~₹5,000 | ₹25 |
| Medium (3 shops) | 800 | ~₹5,000 | ₹6 |
| Chain (10 shops) | 3,000 | ~₹15,000 ¹ | ₹5 |

¹ Assumes upgrade to EC2 t3.small (~₹1,100/mo) and Atlas M20 (~₹19,500/mo)

For comparison: Indian pharmacy management SaaS like Marg ERP, Pharmasoft, and similar charge **₹500–2,000 per shop per month**. So even at the highest-cost configuration, this self-hosted setup is significantly cheaper if you have the operational appetite.

---

## What this does NOT cost

A few things commonly assumed:

- **No per-message WhatsApp cost** — messages go from the pharmacist's own phone via `wa.me`. The pharmacist's WhatsApp plan covers it (essentially zero in India).
- **No per-message SMS cost** — same model. Most Indian mobile plans include unlimited SMS (Jio, Airtel, Vi typically 100/day free).
- **No Meta Business Account fees** — not using WABA at all.
- **No DLT registration fees for SMS** — only required if you go through a gateway (Twilio, MSG91), which we don't.
- **No per-user license** — admin + employees are free; create as many as needed.

The only delivery cost in either mode is if the pharmacy later decides to switch to the WhatsApp Business API for automated sends. That's a separate decision documented in git history before the click-to-send rewrite.
