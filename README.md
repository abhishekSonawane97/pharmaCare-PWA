# PharmaCare

A pharmacy customer-management web app with one-tap WhatsApp + SMS refill reminders, built for small-to-mid pharmacies in India.

> **For new engineers:** if you only read one file, read this one. It's the source of truth for how the project is set up and how to run it. The `design_handoff_pharmacare/` folder is the original product spec — useful background but not how the code is currently configured.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + TailwindCSS |
| Backend | Node.js + Express + TypeScript + Mongoose |
| Database | **MongoDB Atlas** (M0 free cluster, AWS Mumbai) — see [Database](#database) |
| Auth | JWT (access + refresh tokens) |
| Reminders | Click-to-send via `wa.me` (WhatsApp) and `sms:` (native SMS) URI schemes — no API account ([details](#reminders)) |
| Container runtime | Docker + docker compose |

Two Docker services in compose: `web` (Next.js, :3000) and `api` (Express, :4000). MongoDB runs in Atlas (not self-hosted).

---

## Quick start (5 minutes)

### 0. Prerequisites
- Docker + Docker Compose v2 (`docker compose version` should print 2.x)
- A MongoDB Atlas cluster + connection string ([how to](#how-to-create-an-atlas-cluster))

### 1. Configure secrets
```bash
cp .env.example .env
# then edit .env — set MONGO_URI, JWT_*_SECRET, ADMIN_PASSWORD
```

### 2. Build (preflight runs first)
```bash
make build
```
This invokes `scripts/preflight.sh` first — it verifies `.env` is filled in correctly and Docker is reachable, **then** runs `docker compose build`. If any check fails, the build doesn't start.

### 3. Start
```bash
make up
```
Open http://localhost:3000.

### 4. Seed sample data (first time only)
```bash
make seed
```
This wipes Atlas and inserts: 1 admin, 6 employees, 22 medicines, 20 customers, 15 payments. Login with the email/password from `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### Common commands

| Command | What it does |
|---|---|
| `make check` | Run preflight checks alone (no build) |
| `make build` | Preflight + `docker compose build` |
| `make up` | Start the stack |
| `make down` | Stop the stack |
| `make restart` | Recreate api + web containers (e.g. after `.env` change) |
| `make logs` | Tail logs from all services |
| `make seed` | Seed Atlas with sample data |
| `make shell-api` | Shell into the api container |
| `make nuke` | Stop + delete containers (Atlas data untouched) |

---

## Project structure

```
.
├── apps/
│   ├── api/                    Express + Mongoose
│   │   ├── src/
│   │   │   ├── models/         Mongoose schemas (User, Customer, Payment, …)
│   │   │   ├── routes/         REST endpoints (one file per resource)
│   │   │   ├── services/       messageLinks (wa.me + sms: URL builders), reminders
│   │   │   ├── middleware/     auth + JWT + role guards + error handler
│   │   │   ├── scripts/seed.ts Sample-data seeder
│   │   │   └── index.ts        App entrypoint
│   │   └── Dockerfile
│   └── web/                    Next.js 14 (App Router) + Tailwind
│       ├── src/
│       │   ├── app/            Routes (login, dashboard, customers, …)
│       │   ├── components/     Shared UI (Button, Modal, AppShell, …)
│       │   └── lib/            API client, format helpers, auth context
│       └── Dockerfile
├── scripts/preflight.sh        Pre-build env validation
├── docker-compose.yml          web + api services (no mongo)
├── Makefile                    Common workflow shortcuts
├── .env.example                Template — copy to .env
└── design_handoff_pharmacare/  Original product spec (read-only reference)
```

---

## Database

We migrated from a local Docker `mongo` container to **MongoDB Atlas (M0 free tier)** on **2026-05-05**. The `mongo` service no longer exists in `docker-compose.yml`.

**Why:** Atlas is free up to 512 MB, runs as a managed service (no local disk usage, automatic backups in Atlas's UI), and works the same from your laptop, a VPS, or a serverless host. Lets us deploy anywhere without dragging the database along.

### How to create an Atlas cluster
1. Sign up at <https://www.mongodb.com/cloud/atlas/register> (no credit card needed for M0)
2. **Build a Database** → **M0 FREE** → AWS → **Mumbai** (`ap-south-1`) — closest region for India
3. Create a database user (autogenerate the password — save it)
4. Network access → add `0.0.0.0/0` (the password is your only protection — that's fine)
5. Connect → Drivers → Node.js → copy the connection string. Replace `<password>` with the real one and add `/pharmacare` before `?`:
   ```
   mongodb+srv://pharmacare:YOUR_PASSWORD@<cluster>.mongodb.net/pharmacare?retryWrites=true&w=majority
   ```
6. Paste into `.env` as `MONGO_URI`

### Backup / restore
Atlas takes its own daily snapshots (visible in the cluster's "Backup" tab). For a manual dump from your machine:
```bash
# Backup
mongodump --uri="$MONGO_URI" --archive=./backup-$(date +%F).gz --gzip

# Restore
mongorestore --uri="$MONGO_URI" --archive=./backup-2026-05-05.gz --gzip --drop
```

### Switching back to a local mongo (for offline dev)
1. Add a `mongo` service block back to `docker-compose.yml` (see git history of this file)
2. In `.env`, change `MONGO_URI` to:
   ```
   MONGO_URI=mongodb://pharmacare:<password>@mongo:27017/pharmacare?authSource=admin
   ```
3. `make restart`

---


---

## Reminders

There is no auto-send and no message gateway. The Reminders page lists every customer whose `nextDueDate` falls in the `[today−1d, today+2d]` window. Each row shows two buttons:

- **WhatsApp** — `<a href="https://wa.me/91XXXXXXXXXX?text=...">` — opens WhatsApp (web or app) with the customer's number and a pre-filled message. Pharmacist taps Send.
- **SMS** — `<a href="sms:+91XXXXXXXXXX?body=...">` — opens the native Messages app with the same.

Tapping either also fires `POST /api/reminders/:id/mark-sent` (channel: `whatsapp|sms`) so the customer is flagged as messaged this cycle (`autoReminderSentForCycle: true`). The flag clears automatically when the next due date is set (refill completed). Messages go from the pharmacist's own phone number / WhatsApp account — nothing leaves the server but the click-tracking ping.

Templates live in **Settings**: one for the reminder, one for the optional thank-you sent after marking a refill complete. Placeholders `{{name}}`, `{{pharmacyName}}`, `{{medicines}}`, `{{dueDate}}` / `{{nextDueDate}}`. Aim for ≤160 chars so SMS doesn't get split — the preview shows the running count.

Link builder: [`apps/api/src/services/messageLinks.ts`](apps/api/src/services/messageLinks.ts).

---

## Environment variables (.env)

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | ✅ | Atlas (or local) Mongo connection string |
| `JWT_ACCESS_SECRET` | ✅ | Signs 15-min access tokens — `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | ✅ | Signs 7-day refresh tokens — different value than above |
| `ADMIN_EMAIL` | ✅ | First-admin email (used by seed script) |
| `ADMIN_PASSWORD` | ✅ | First-admin password (used by seed script) |

The preflight script (`scripts/preflight.sh`) validates these before each build.

---

## What changed since the original handoff

- **2026-05-28 — Reminder delivery rewritten as click-to-send.** Removed Meta WhatsApp Business API client, removed `node-cron` daily auto-send, removed the `whatsappCredentials` / `reminderAutoSendTime` fields from Settings. Reminders page now lists due customers with per-row WhatsApp + SMS buttons that open the native app pre-filled. Pharmacist sends from their own number. (See [Reminders](#reminders).)
- **2026-05-05 — MongoDB moved to Atlas.** Local `mongo` container removed from compose. Connection string lives in `MONGO_URI`. Migration was done with `mongodump` + `mongorestore`, no data loss. (See [Database](#database).)
- **2026-04–05 — Mobile responsiveness pass.** Below 768px:
  - Sidebar becomes a slide-in drawer with backdrop + close button
  - Tables on Customers / Payments / Medicines turn into card layouts (no horizontal scroll)
  - Reminders cards have search; status row + actions stack vertically
  - PageHeader stacks title above actions
  - `body.mobile` class is auto-applied below 768px for any custom CSS targeting
- **2026-04 — Next.js `/api/*` rewrite.** The web container proxies `/api/*` to the api container internally so a single public URL covers both services (works behind ngrok / Cloudflare Tunnel without exposing port 4000). Set via `API_PROXY_TARGET` in compose.
- **Build args.** `NEXT_PUBLIC_API_URL` is passed as a Docker build argument because Next.js inlines `NEXT_PUBLIC_*` at build time (not runtime). See `apps/web/Dockerfile`.
- **Preflight + Makefile.** Added `scripts/preflight.sh` and a `Makefile` so the next engineer doesn't have to memorize commands and gets clear errors when `.env` is misconfigured.

---

## Deployment options

The app runs anywhere Docker runs. Picks ordered by simplicity:

1. **Cloudflare Tunnel + your laptop** — free, no CC, stable subdomain. Laptop must stay on. Best for client demos.
2. **Render.com** (free) — auto-deploys from GitHub. Cold-start delay (~45s) on the free tier.
3. **VPS + docker compose** — Hetzner CX22 (€3.79/mo), Oracle Cloud Always Free, AWS EC2 free tier. Real production-grade. ~30-min setup.
4. **Vercel + Atlas** (Next.js + Express on Vercel functions) — requires refactoring Express into Next.js API routes.

The repo is deployment-agnostic — same `make build && make up && make seed` works on any host.

---

## Troubleshooting

- **`make build` fails immediately with red ✗ marks** → preflight caught a missing/placeholder env value. Fix `.env` and try again.
- **API logs show `MongooseServerSelectionError`** → check `MONGO_URI` and Atlas IP allowlist (should include `0.0.0.0/0` or your server's public IP).
- **Web shows "Sign-in failed" but curl works** → the bundled `NEXT_PUBLIC_API_URL` is wrong. Rebuild web with `--no-cache`: `docker compose build --no-cache web && make restart`.
- **Tapping "WhatsApp" on desktop does nothing useful** → the `wa.me` link opens WhatsApp Web (needs login). For real use the Reminders page from a phone.
- **Tapping "SMS" on desktop does nothing** → `sms:` URIs only work on phones (or macOS with iPhone handoff).
- **Customer not marked as messaged after sending** → the `mark-sent` POST is fire-and-forget; if the page was offline when you tapped, just reload and the customer will reappear in the queue. Re-tap to send + mark.

---

## License & ownership

Internal pharmacy management tool. No public license — all rights belong to the pharmacy commissioning the build.
