# PharmaCare

A pharmacy customer-management web app with one-tap WhatsApp + SMS refill reminders, built for small-to-mid pharmacies in India.

## 🌐 Live deployments

| Environment | URL | Hosted on | Purpose |
|---|---|---|---|
| **Production** | http://13.205.80.177 | AWS EC2 t4g.small (Mumbai) | Primary |
| **Parallel fallback** | https://pharmacare-web.onrender.com | Render free tier (Singapore) | Kept live during cutover; same Atlas DB |

Both deployments hit the **same MongoDB Atlas M0 cluster** (Mumbai), so any data change is immediately visible on both. Decommission Render once you're confident in EC2.

**Admin login** (after `make seed` or via the live URL):
- Email: `shaikhabusaeed1@gmail.com`
- Password: `admin123`
- 6 sample employee accounts also exist — emails listed in [`apps/api/src/scripts/seed.ts`](apps/api/src/scripts/seed.ts), password `changeme123`

---

## 📚 Documentation index

If you just inherited this repo, read in this order:

| File | What it covers | Read first if you're... |
|---|---|---|
| **[README.md](README.md)** *(this file)* | Live URLs, setup, project structure, env vars, common commands | Setting up locally / orientation |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | How the system works — components, data flow, deploy flow, design decisions | Trying to understand the codebase |
| **[DEPLOY.md](DEPLOY.md)** | Deployment runbook: AWS EC2 (primary) + Render (parallel) | Pushing a change / first deploy |
| **[PRODUCTION.md](PRODUCTION.md)** | Operating the production stack: monitoring, rollback, common tasks, hardening | Running the system day-to-day |
| **[COST.md](COST.md)** | What it costs to run, including AWS budget alerts setup | Planning capacity / cost monitoring |
| **[GITHUB.md](GITHUB.md)** | GitHub repo + GHA secrets + CI/CD wiring | First time touching the repo |
| **[design_handoff_pharmacare/](design_handoff_pharmacare/)** | Original product spec (reference only — code is source of truth now) | Looking for the original intent |

> **TL;DR for a new engineer:** read this file end-to-end (~10 min), then skim [`ARCHITECTURE.md`](ARCHITECTURE.md) for the mental model. Everything else is on-demand reference.

---

## 🔭 30-second mental model

```
                     Internet
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  http://13.205.80.177           https://pharmacare-web.onrender.com
  (AWS EC2, primary)              (Render, parallel fallback)
        │                               │
        │  Nginx :80 → web :3000        │  web container (proxies /api to api)
        │            → api :4000        │              │
        │                               │              ▼
        └───────────────┬───────────────┘     pharmacare-api-40oz.onrender.com
                        ▼
            ┌────────────────────────┐
            │ MongoDB Atlas M0       │
            │ pharmacare.uoxcurq...  │
            │ (AWS Mumbai region)    │
            └────────────────────────┘

  Pharmacist (mobile browser)
    │
    │ taps "WhatsApp" or "SMS" on the Reminders page
    ▼
  Native app opens with pre-filled text
    │
    │ pharmacist hits Send in WhatsApp/Messages
    ▼
  Customer receives the message from the pharmacist's OWN PHONE.
  No message ever leaves the server — backend just records that
  the customer was marked-as-sent.
```

Full deployment + build/deploy diagrams in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + TailwindCSS |
| Backend | Node.js + Express + TypeScript + Mongoose |
| Database | **MongoDB Atlas M0** (free, AWS Mumbai) |
| Auth | JWT (15-min access + 365-day refresh) |
| Reminders | Click-to-send via `wa.me` (WhatsApp) and `sms:` (native SMS) URI schemes — no API account ([details](#reminders)) |
| Container runtime | Docker + Docker Compose v2 |
| Reverse proxy (AWS) | Nginx 1.27-alpine (single-origin, terminates :80) |
| Container registry | AWS ECR private (Mumbai, ARM64 images) |
| CI/CD | GitHub Actions (OIDC, no AWS keys stored) |
| Infra-as-code | CloudFormation (one stack: `pharmacare-prod`) |

Three containers in production: `web` (Next.js, :3000), `api` (Express, :4000), `nginx` (terminates :80). MongoDB runs in Atlas (not self-hosted).

---

## Quick start (local dev, 5 minutes)

### 0. Prerequisites
- Docker + Docker Compose v2 (`docker compose version` should print 2.x)
- A MongoDB Atlas cluster + connection string ([how to](#how-to-create-an-atlas-cluster))

### 1. Configure secrets
```bash
cp .env.example .env
# then edit .env — set MONGO_URI, JWT_*_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```

### 2. Build (preflight runs first)
```bash
make build
```
`scripts/preflight.sh` verifies `.env` and Docker, then runs `docker compose build`.

### 3. Start
```bash
make up
```
Open http://localhost:3000.

### 4. Seed sample data (first time only)
```bash
make seed
```
Wipes Atlas and inserts: 1 admin + 6 employees + 22 medicines + 20 customers + 15 payments + Settings. Login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

> ⚠️ `make seed` is **destructive** on Atlas. It wipes all collections before inserting samples. Atlas M0 has no automatic backups — losing real data is permanent. Skip this in production unless you really mean it.

### Common commands

| Command | What it does |
|---|---|
| `make check` | Run preflight checks alone (no build) |
| `make build` | Preflight + `docker compose build` |
| `make up` | Start the local stack |
| `make down` | Stop the local stack |
| `make restart` | Recreate api + web containers (e.g. after `.env` change) |
| `make logs` | Tail logs from all services |
| `make seed` | **Destructive**: wipe Atlas + insert sample data |
| `make shell-api` | Shell into the api container |
| `make nuke` | Stop + delete local containers (Atlas data untouched) |

For **deploying** (vs. running locally), see [DEPLOY.md](DEPLOY.md).

---

## Project structure

```
.
├── apps/
│   ├── api/                         Express + Mongoose backend (port 4000)
│   │   ├── src/
│   │   │   ├── index.ts             App entrypoint — mounts routers, connects mongo
│   │   │   ├── models/              Mongoose schemas (User, Customer, Medicine, Payment, ...)
│   │   │   ├── routes/              REST endpoints (one file per resource)
│   │   │   ├── services/
│   │   │   │   ├── messageLinks.ts  Builds wa.me + sms: URLs per customer
│   │   │   │   └── reminders.ts     Queue lookup + mark-sent + thank-you
│   │   │   ├── middleware/          requireAuth + requireAdmin + error handler
│   │   │   ├── utils/               phone normalize, jwt sign/verify, etc.
│   │   │   └── scripts/seed.ts      Sample-data seeder
│   │   └── Dockerfile               Multi-stage build → tiny runtime image
│   │
│   └── web/                         Next.js 14 (App Router) (port 3000)
│       ├── src/
│       │   ├── app/                 Routes (login, dashboard, customers, reminders, ...)
│       │   ├── components/          Shared UI (Button, Modal, AppShell, ...)
│       │   └── lib/                 API client, auth context, formatters, types
│       └── Dockerfile               Multi-stage Next.js standalone build
│
├── infra/
│   └── cloudformation.yaml          AWS stack: VPC, EC2, EIP, ECR, IAM, OIDC
│
├── deploy/
│   ├── docker-compose.yml           PRODUCTION compose (pulls from ECR, runs Nginx)
│   └── nginx.conf                   Nginx reverse proxy: /api/* → api:4000, / → web:3000
│
├── .github/
│   └── workflows/deploy.yml         GHA CI/CD: build ARM64 → push ECR → SSM deploy
│
├── scripts/
│   ├── preflight.sh                 Pre-build .env + Docker validation (local)
│   └── seed-ssm.sh.template         One-time SSM Parameter Store seed (gitignored when filled)
│
├── docker-compose.yml               LOCAL DEV compose (builds from source, no Nginx)
├── render.yaml                      Render Blueprint (parallel fallback deployment)
├── Makefile                         Common workflow shortcuts
├── .env.example                     Template — copy to .env
└── design_handoff_pharmacare/       Original product spec (read-only reference)
```

Two `docker-compose.yml` files — root one is for **local dev**, `deploy/docker-compose.yml` is for **production on EC2**. They differ in: image source (source build vs ECR pull), inclusion of Nginx, port exposure.

---

## Database

**MongoDB Atlas M0 free tier**, AWS Mumbai region (`ap-south-1`), database name `pharmacare`. The cluster hostname is `pharmacare.uoxcurq.mongodb.net`. The connection string lives in:
- Local: `.env` `MONGO_URI`
- AWS prod: SSM Parameter Store at `/pharmacare/env/MONGO_URI` (SecureString)
- Render: Render service env var

All three point at the same cluster, so data is shared.

### Why Atlas

- Free up to 512 MB
- Managed (no local disk usage)
- Same connection from laptop, EC2, Render — single source of truth
- Migrated off self-hosted `mongo` container on 2026-05-05

### How to create an Atlas cluster (if starting fresh)
1. Sign up at <https://www.mongodb.com/cloud/atlas/register> (no credit card needed for M0)
2. **Build a Database** → **M0 FREE** → AWS → **Mumbai** (`ap-south-1`)
3. Create a database user (autogenerate the password — save it)
4. Network access → add `0.0.0.0/0` for now; tighten to the EC2 Elastic IP later (see [PRODUCTION.md](PRODUCTION.md#atlas-allowlist))
5. Connect → Drivers → Node.js → copy the connection string. Replace `<password>` with the real one and add `/pharmacare` before `?`:
   ```
   mongodb+srv://pharmacare:<password>@<cluster>.mongodb.net/pharmacare?retryWrites=true&w=majority
   ```
6. Paste into `.env` as `MONGO_URI` (and SSM if deploying)

### Backup / restore

Atlas M0 has **no automatic backups**. For manual snapshots:

```bash
# Backup
mongodump --uri="$MONGO_URI" --archive=./backup-$(date +%F).gz --gzip

# Restore
mongorestore --uri="$MONGO_URI" --archive=./backup-2026-05-05.gz --gzip --drop
```

> ⚠️ Real customer data must be backed up. M0 has no SLA, no point-in-time restore. [PRODUCTION.md](PRODUCTION.md#backups) covers the daily-`mongodump` → S3 cron path. Set this up before any real pharmacy data goes in.

---

## Reminders (the killer feature)

There is **no auto-send and no message gateway**. The Reminders page lists every customer whose `nextDueDate` falls in the `[today−1d, today+2d]` window. Each row shows two buttons:

- **WhatsApp** — `<a href="https://wa.me/91XXXXXXXXXX?text=...">` — opens WhatsApp (web or app) with the customer's number and a pre-filled message. Pharmacist taps Send in WhatsApp.
- **SMS** — `<a href="sms:+91XXXXXXXXXX?body=...">` — opens the native Messages app with the same.

Tapping either fires `POST /api/reminders/:id/mark-sent` (channel: `whatsapp|sms`) so the customer is flagged as messaged this cycle (`autoReminderSentForCycle: true`). The flag clears automatically when the next due date is set (refill completed).

**Messages go from the pharmacist's own phone account** — no Meta Business Account, no WhatsApp Business API, no DLT registration for SMS, no per-message cost.

Templates live in **Settings**: one for the reminder, one for the optional thank-you sent after marking a refill complete. Placeholders: `{{name}}`, `{{pharmacyName}}`, `{{medicines}}`, `{{dueDate}}` / `{{nextDueDate}}`. Aim for ≤160 chars so SMS doesn't get split — the Settings preview shows the running count.

Link builder: [`apps/api/src/services/messageLinks.ts`](apps/api/src/services/messageLinks.ts).

---

## Environment variables

13 vars total. Same set on local `.env`, in SSM Parameter Store for AWS, and Render env vars.

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | ✅ | Atlas connection string |
| `JWT_ACCESS_SECRET` | ✅ | Signs 15-min access tokens — `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | ✅ | Signs 365-day refresh tokens — different value than above |
| `JWT_ACCESS_TTL` | optional | Default `15m` |
| `JWT_REFRESH_TTL` | optional | Default `365d` (bumped from 7d for indefinite sessions) |
| `ADMIN_EMAIL` | ✅ | First-admin email (used by seed script) — currently `shaikhabusaeed1@gmail.com` |
| `ADMIN_PASSWORD` | ✅ | First-admin password (used by seed script) — currently `admin123` |
| `CORS_ORIGIN` | ✅ | Allowed browser origin for cross-origin API calls |
| `NEXT_PUBLIC_API_URL` | ✅ | **Build-time** for web — Next.js inlines this into the client bundle at `next build`. Local: `/api`. AWS prod: `/api` (Nginx single-origin). |
| `API_PROXY_TARGET` | ✅ | Where the web container's Next.js rewrite forwards `/api/*`. Local: `http://api:4000`. Prod: `http://api:4000` (Docker network). |
| `NODE_ENV` | optional | Default `production` |
| `PORT` | optional | Default `4000` (api) / `3000` (web) |
| `TZ` | optional | Default `Asia/Kolkata` |

The preflight script (`scripts/preflight.sh`) validates the required ones before each local build. SSM seeding for AWS is done via `scripts/seed-ssm.sh.template` (copy to `seed-ssm.sh`, fill, run).

---

## What changed since the original handoff

- **2026-06-04 — Migrated to AWS EC2 (production-grade).** Built infra/, deploy/, .github/workflows/. CFN stack `pharmacare-prod` provisions VPC + EC2 t4g.small + Elastic IP + ECR + IAM + OIDC. GitHub Actions pushes ARM64 images to ECR and triggers `docker compose pull/up` via SSM. Render kept live in parallel during cutover. See [ARCHITECTURE.md](ARCHITECTURE.md#aws-production-topology) and [DEPLOY.md](DEPLOY.md).
- **2026-06-04 — JWT refresh TTL bumped to 365 days.** Users now stay logged in for a year (was 7d). Refresh-on-401 + localStorage already in place; this just extends the window.
- **2026-06-04 — Tightened employee role gates.** Hidden Reminders for employees; Payments view-only for employees. Server-side requireAdmin on all relevant routes. Hidden Add-record button on customer detail page for employees.
- **2026-05-30 — Modal mobile fix.** Capped modal panel at 90vh + flex-column layout so the footer Cancel/Save buttons stay visible on small phones (was being pushed off-screen).
- **2026-05-30 — Medicine pricing + location surfaced.** Added `discountedPrice` field; exposed `purchasePrice`, `mrp`, `discountedPrice`, `location` in the Medicines page table + mobile card + form.
- **2026-05-28 — Reminder delivery rewritten as click-to-send.** Removed Meta WhatsApp Business API client, removed `node-cron` daily auto-send, removed the `whatsappCredentials` / `reminderAutoSendTime` fields from Settings. Pharmacist sends from their own number.
- **2026-05-05 — MongoDB moved to Atlas.** Local `mongo` container removed from compose.
- **2026-04 — Mobile responsiveness pass.** Sidebar slide-in drawer, table → card layouts below 768px.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `make build` fails with red ✗ marks | Preflight caught a missing/placeholder `.env` value. Fix and retry. |
| API logs show `MongooseServerSelectionError` | Atlas IP allowlist must include the client's IP (or `0.0.0.0/0`). |
| Web shows "Sign-in failed" but `curl` works | Bundled `NEXT_PUBLIC_API_URL` is wrong. Rebuild web with `--no-cache`: `docker compose build --no-cache web && make restart`. |
| Tapping "WhatsApp" on desktop does nothing useful | The `wa.me` link opens WhatsApp Web (needs login). For real use, open the Reminders page from a phone. |
| Tapping "SMS" on desktop does nothing | `sms:` URIs only work on phones (or macOS with iPhone handoff). |
| Customer not marked as messaged after sending | The `mark-sent` POST is fire-and-forget. If the page was offline when you tapped, reload and tap again. |
| Bash error: "Illegal option -o pipefail" in SSM | AWS-RunShellScript uses dash, not bash. Don't use `pipefail` in the SSM-invoked commands array. |
| GHA deploy fails at "Send deploy command" with `implicitDeny` | The `aws:ResourceTag/Project=pharmacare` condition was applied to both the AWS-managed document and the instance. Split the IAM statement (current CFN does this). |
| 502 from `http://<EIP>/` immediately after first deploy | Render-style "Next.js standalone binds to localhost". The web Dockerfile and `deploy/docker-compose.yml` both handle this — Next 14 standalone respects `HOSTNAME=0.0.0.0` via the `node server.js` entrypoint. If you still see 502, ensure the web container's `expose` is on port 3000 (not 10000). |

More in [PRODUCTION.md](PRODUCTION.md#troubleshooting).

---

## License & ownership

Internal pharmacy management tool. No public license — all rights belong to the pharmacy commissioning the build.
