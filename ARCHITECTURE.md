# Architecture

> **Audience:** A new engineer who just inherited this repo and needs to understand how the pieces fit, why they were chosen, and how data moves through them. Read this in one sitting — about 15 minutes.

PharmaCare is a **pharmacy customer-management web app** for small/mid Indian pharmacies. Its killer feature is **click-to-send refill reminders**: the pharmacist opens the Reminders page on their phone, sees who's due for a refill in the next 48 hours, and one-taps a button that opens WhatsApp or SMS with a pre-filled message. The message goes from the pharmacist's own phone account — no API gateway, no business verification, no per-message cost.

---

## Two deployment modes

The same codebase runs in two very different topologies depending on lifecycle stage. Both use the same `docker compose` setup; only the host differs.

### Mode 1 — Development / Testing (current setup, ₹0)

```
                                Internet
                                    │
                                    ▼
            ┌───────────────────────────────────────────┐
            │   Render.com  (free tier, Singapore)      │
            │                                           │
            │   ┌──────────────────┐  ┌──────────────┐  │
            │   │ pharmacare-web   │  │ pharmacare-  │  │
            │   │ Next.js 14       │  │ api          │  │
            │   │ standalone       │  │ Express      │  │
            │   │ Port 3000        │  │ Port 4000    │  │
            │   └──────────────────┘  └──────┬───────┘  │
            └────────────────────────────────│──────────┘
                                             │
                                  Mongoose driver (TLS)
                                             │
                                             ▼
                          ┌────────────────────────────────┐
                          │  MongoDB Atlas M0 (FREE)       │
                          │  AWS Mumbai (ap-south-1)       │
                          │  - 512 MB storage              │
                          │  - Shared CPU                  │
                          │  - No backups                  │
                          │  - No SLA                      │
                          └────────────────────────────────┘

   Pharmacist (mobile browser)
        │
        │ tap "WhatsApp" / "SMS" button
        ▼
   Native app opens (WhatsApp/Messages) with pre-filled text
        │
        │ pharmacist taps Send in the native app
        ▼
   Message goes from pharmacist's OWN PHONE NUMBER directly to customer.
   No backend involvement. Backend is just notified via fire-and-forget POST.
```

**What it's good for:** development, internal testing, demos with a client, the first 1–2 weeks of any pilot. Zero cost, set-up in under 30 minutes.

**What it's NOT good for:** real pharmacy data. Render free tier sleeps after 15 min of idle (30-second cold start), Atlas M0 has no backups, no SLA. Acceptable downtime: occasional hours/year. Customer phone numbers + medication history sit in a database with `0.0.0.0/0` IP allowlist.

### Mode 2 — Production grade (paid, ~₹6,000/month total ops)

```
                                Internet
                                    │
                                    ▼
                  ┌─────────────────────────────────┐
                  │  Cloudflare (free)              │
                  │  - DNS                          │
                  │  - DDoS protection              │
                  │  - Edge cache for static assets │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  AWS EC2  (Mumbai region, ap-south-1)            │
        │  t3.small or similar  — ~₹1,200/yr after free yr │
        │                                                  │
        │  Caddy (reverse proxy)                           │
        │    ├─ auto Let's Encrypt TLS                     │
        │    ├─ HTTP→HTTPS redirect                        │
        │    ├─ → web container :3000                      │
        │    └─ → api container :4000  (/api/*)            │
        │                                                  │
        │  docker compose                                  │
        │    ├─ web (Next.js standalone)                   │
        │    ├─ api (Express + Mongoose)                   │
        │    └─ daily cron: mongodump → S3                 │
        └─────────────────┬────────────────────────────────┘
                          │
              Mongoose driver (TLS, IP-allowlisted)
                          │
                          ▼
        ┌─────────────────────────────────────────────────┐
        │  MongoDB Atlas M10 (Mumbai)  — ~$57/month       │
        │  - 10 GB storage                                │
        │  - Dedicated CPU                                │
        │  - Continuous backups (point-in-time restore)   │
        │  - 99.95% SLA                                   │
        │  - VPC peering with EC2 (no public IP)          │
        └─────────────────────────────────────────────────┘

        ┌─────────────────────────────────┐
        │  AWS S3 (Mumbai)                │
        │  Daily mongodump archive        │
        │  Encrypted, lifecycle to Glacier│
        │  ~₹40/month                     │
        └─────────────────────────────────┘

        ┌─────────────────────────────────┐
        │  Sentry  (free tier)            │
        │  Error tracking + alerts        │
        └─────────────────────────────────┘

        ┌─────────────────────────────────┐
        │  UptimeRobot  (free tier)       │
        │  Ping /api/health every 5 min   │
        │  Alert via email/WhatsApp       │
        └─────────────────────────────────┘
```

**What it adds vs. dev mode:**
- Real downtime SLA (99.95%) instead of "best effort"
- Continuous backups + point-in-time restore (instead of nothing)
- Always-on (no cold starts)
- TLS termination + Cloudflare DDoS shield
- Error tracking + uptime alerts
- Network isolation between EC2 and Atlas (no public DB endpoint)

See [`PRODUCTION.md`](PRODUCTION.md) for the step-by-step migration path from Mode 1 → Mode 2.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | Best React DX, file-based routing, standalone server output works in any container |
| Frontend styling | TailwindCSS | Co-located styles, no CSS file proliferation, sane defaults |
| Frontend state | React hooks only (no Redux) | App is simple — pages own their state, `auth-context` for the user |
| Backend framework | Express + TypeScript | Smallest possible surface area, every dev knows it |
| ORM | Mongoose | Schema validation + lifecycle hooks; MongoDB driver alone is too low-level |
| Auth | JWT (access + refresh) | Stateless, no Redis dependency, simple to scale horizontally |
| Validation | zod | Same schema definition does typing + runtime validation |
| Database | MongoDB Atlas | Managed, easy backups (paid tier), works the same locally as in prod |
| Containerization | Docker + docker-compose | Same image runs everywhere — laptop, Render, EC2 |
| Reminder delivery | `wa.me` + `sms:` URIs | Zero cost, zero setup. Pharmacist's own phone is the delivery channel |

---

## Project structure

```
.
├── apps/
│   ├── api/                       Express + Mongoose backend
│   │   ├── src/
│   │   │   ├── index.ts           App entrypoint — mounts routers, connects mongo
│   │   │   ├── models/            Mongoose schemas
│   │   │   │   ├── User.ts        Admins + employees
│   │   │   │   ├── Customer.ts    Pharmacy customers + their next refill date
│   │   │   │   ├── Medicine.ts    Catalog (name, content, location, prices)
│   │   │   │   ├── Payment.ts     Received/given payments (paise)
│   │   │   │   ├── Settings.ts    Singleton (pharmacy info, message templates)
│   │   │   │   └── ActivityLog.ts Append-only audit trail
│   │   │   ├── routes/            REST endpoints — one file per resource
│   │   │   │   ├── auth.ts        signup, login, refresh, logout, me
│   │   │   │   ├── customers.ts   CRUD + ignore/unignore
│   │   │   │   ├── reminders.ts   queue + mark-sent + complete-refill
│   │   │   │   ├── medicines.ts   CRUD (admin), read (employees)
│   │   │   │   ├── payments.ts    create + list
│   │   │   │   ├── employees.ts   admin manages user accounts
│   │   │   │   ├── settings.ts    update pharmacy settings + templates
│   │   │   │   ├── dashboard.ts   KPIs for landing page
│   │   │   │   └── activity.ts    audit log read
│   │   │   ├── services/
│   │   │   │   ├── messageLinks.ts  Builds wa.me and sms: URLs per customer
│   │   │   │   └── reminders.ts     Queue lookup + mark-sent + thank-you
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        requireAuth + requireAdmin
│   │   │   │   └── error.ts       JSON error envelope
│   │   │   ├── utils/             phone normalize, jwt sign/verify, etc.
│   │   │   └── scripts/seed.ts    Wipe DB + insert sample data
│   │   └── Dockerfile             Multi-stage build → tiny runtime image
│   │
│   └── web/                       Next.js 14 frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── login/         Public sign-in / sign-up
│       │   │   └── (app)/         All authed routes share a single layout
│       │   │       ├── page.tsx       Dashboard
│       │   │       ├── customers/     Customer CRUD + detail
│       │   │       ├── reminders/     The killer feature
│       │   │       ├── payments/      Payment history
│       │   │       ├── medicines/     Catalog (read for employees, CRUD for admin)
│       │   │       ├── employees/     User management (admin only)
│       │   │       ├── activity/      Audit log (admin only)
│       │   │       └── settings/      Pharmacy info + templates (admin only)
│       │   ├── components/        Shared UI primitives (Button, Modal, AppShell, ...)
│       │   └── lib/
│       │       ├── api.ts             Fetch wrapper with 401-driven refresh-token retry
│       │       ├── auth-context.tsx   User state across the app
│       │       ├── format.ts          Date/time formatters
│       │       └── types.ts           Shared TypeScript types
│       └── Dockerfile             Multi-stage Next.js standalone build
│
├── scripts/preflight.sh           Validates .env before build (fail-fast)
├── docker-compose.yml             web + api services (Atlas is remote)
├── Makefile                       Common command shortcuts
├── render.yaml                    Render Blueprint — one-click deploy
└── docs (this folder)
    ├── README.md                  Setup + start here
    ├── ARCHITECTURE.md            This file
    ├── COST.md                    What it costs to run
    ├── PRODUCTION.md              How to go from dev → prod
    ├── DEPLOY.md                  Render deploy walkthrough (dev mode)
    ├── GITHUB.md                  Pushing the code to GitHub
    └── design_handoff_pharmacare/ Original product spec (reference, read-only)
```

---

## Domain model

```
        ┌──────────────────┐
        │  User            │      role: 'admin' | 'employee'
        │  (admins + emps) │      status: 'pending' | 'active' | 'rejected'
        └────────┬─────────┘
                 │ created
                 ▼
        ┌──────────────────┐
        │  Customer        │      nextDueDate ─── drives reminder queue
        │  (pharmacy       │      autoReminderSentForCycle ─ dedup flag
        │   customers)     │      medicines: [{ medicineName, dosage? }]
        └────────┬─────────┘
                 │ has many
                 ▼
        ┌──────────────────┐
        │  Payment         │      type: 'received' | 'given'
        │                  │      amount stored in PAISE (integer)
        └──────────────────┘

        ┌──────────────────┐
        │  Medicine        │      Independent catalog
        │  (catalog)       │      Referenced by name in Customer.medicines
        └──────────────────┘

        ┌──────────────────┐
        │  Settings        │      Singleton document (_id: 'settings')
        │  (singleton)     │      Pharmacy info + message templates
        └──────────────────┘

        ┌──────────────────┐
        │  ActivityLog     │      Append-only, every write action logged
        │  (audit trail)   │      actor, action, target, timestamp, metadata
        └──────────────────┘
```

### Key invariants
- **Customer.medicines** is denormalized — stores `medicineName` as a string, not a Medicine ObjectId reference. Deliberate: lets a customer have medicines that aren't in your catalog (a quirky one-off, or one you haven't added yet).
- **Payment.amount** is always in PAISE (integer rupees × 100). Never float, never decimal. Display layer divides by 100.
- **Settings** uses `_id: 'settings'` as a string — only ever one document. `ensureSettings()` creates it if missing.
- **ActivityLog** is append-only — never updated, never deleted. Source of truth for "who did what when".

---

## Auth model

```
   POST /api/auth/login {email, password}
                 │
                 ▼
   bcrypt.compare → if ok:
                 │
                 ▼
   ┌──────────────────────────────────────┐
   │ access  token  (15-min TTL, JWT)     │   includes: sub, role, status
   │ refresh token  (7-day TTL, JWT)      │   includes: sub, ver
   └──────────────────────────────────────┘
                 │
                 │ web stores both in localStorage
                 ▼
   Every authed request: Authorization: Bearer <access>
                 │
                 ▼
   When access expires (401):
                 │
                 ▼
   POST /api/auth/refresh {refreshToken}
                 │
                 ▼
   Server: verify refresh, check User.refreshTokenVersion matches → mint new pair
                 │
                 ▼
   On logout: User.refreshTokenVersion++ → all outstanding refresh tokens invalid
```

### Roles
- **admin** — full access to every page + every API write
- **employee** — sees Dashboard, Customers, Reminders, Payments, Medicines (read-only). Hidden: Employees, Activity, Settings.

### Account lifecycle
1. First-ever signup auto-becomes **admin + active** (bootstrap; only happens once)
2. Every subsequent signup is **employee + pending** — admin must approve via Employees page
3. Admin can also create employees directly (no pending step) — `POST /api/employees`

---

## The reminder flow (the heart of the app)

This is the one piece that's genuinely different from a standard CRUD app, so it deserves its own diagram.

```
                  ┌─────────────────────────────────────┐
                  │  Pharmacist opens /reminders        │
                  │  (preferably on their PHONE)        │
                  └────────────────┬────────────────────┘
                                   │
                                   ▼
              GET /api/reminders   (requireAuth)
                                   │
                                   ▼
        listReminderQueue() in services/reminders.ts
                                   │
        Mongo query:               │
          isActive: true           │
          reminderIgnored: false   │
          nextDueDate ∈            │
            [today-1d, today+2d]   │
                                   ▼
        For each due customer, buildReminderLinks() returns:
                                   │
        {                          │
          message: "Hi Ramesh, refill reminder from PharmaCare:
                    Metformin 500mg due 12 May 2026. Visit us to collect.",
          whatsappUrl: "https://wa.me/919822041567?text=Hi%20Ramesh%2C...",
          smsUrl: "sms:+919822041567?body=Hi%20Ramesh%2C..."
        }
                                   │
                                   ▼
                  ┌─────────────────────────────────────┐
                  │  UI renders per customer:           │
                  │   • Avatar + name + phone           │
                  │   • Medicines tags                  │
                  │   • Message preview                 │
                  │   • [WhatsApp] [SMS] [Mark complete]│
                  └────────────────┬────────────────────┘
                                   │
                                   │ pharmacist taps "WhatsApp" or "SMS"
                                   ▼
        Two things happen in parallel:
                                   │
        1) <a href> opens native    2) onClick fires
           app pre-filled              POST /api/reminders/:id/mark-sent
                │                            │
                ▼                            ▼
        Native app (WhatsApp / Messages)   markReminderSent() in services/reminders.ts
                │                            │
                │                            ▼
                │              autoReminderSentForCycle = true
                │              ActivityLog: 'reminder.manual_sent'
                ▼
        Pharmacist taps SEND in the native app
                │
                ▼
        Message goes from pharmacist's OWN PHONE NUMBER
        to the customer. Not from a server. Not from a gateway.
        Zero cost, zero compliance.
```

### Why no automatic sending?
The original v1 used Meta WhatsApp Business Cloud API + a daily 10:00 IST cron to auto-send. That was removed because:
1. Meta WABA requires business verification (1–2 weeks paperwork)
2. Templates need pre-approval (UTILITY category, 1–24h each)
3. Costs ~₹0.30 per message
4. SMS gateways in India require DLT template registration (2–7 days)

The click-to-send approach trades automation for **zero friction to go live**. A pharmacist can use this on day zero with no accounts, no approvals, no costs.

### Why the `autoReminderSentForCycle` flag?
Without it, the same customer would appear in the queue every time the pharmacist opens the page. The flag is set when they tap a send button and **automatically clears** when the customer's `nextDueDate` is updated (i.e., when the refill is marked complete and a new cycle starts).

---

## Request flow (login example)

```
Browser                  Next.js (web)                  Express (api)            Atlas
   │                          │                              │                     │
   │  POST /api/auth/login    │                              │                     │
   ├─────────────────────────►│                              │                     │
   │                          │  proxied internally if /api  │                     │
   │                          │  OR direct fetch if          │                     │
   │                          │  NEXT_PUBLIC_API_URL is full │                     │
   │                          ├─────────────────────────────►│                     │
   │                          │                              │                     │
   │                          │                              │  User.findOne()     │
   │                          │                              ├────────────────────►│
   │                          │                              │◄────────────────────┤
   │                          │                              │  bcrypt.compare()   │
   │                          │                              │  sign JWTs          │
   │                          │                              │                     │
   │                          │◄─────────────────────────────┤                     │
   │  {accessToken, refresh}  │                              │                     │
   │◄─────────────────────────┤                              │                     │
   │  Store in localStorage   │                              │                     │
```

In the current Render deployment, **the browser hits the api URL directly** (not through the web proxy). This was a workaround for a Next.js standalone limitation where `next.config.js` `rewrites()` evaluates `process.env` at build time, not runtime — making the proxy target unconfigurable per-environment without rebuilds. See README "Troubleshooting" for details.

---

## Key design decisions and tradeoffs

### 1. MongoDB over PostgreSQL
**Choice:** MongoDB Atlas.
**Why:** Each customer's `medicines` array is variable-length and varies in shape. Modeling that in Postgres needs a join table; in Mongo it's a native array on the document. The app is read-heavy, schema-flexible, and small enough that joins aren't needed. Atlas free tier is also more generous than any free Postgres host.
**When you'd switch:** if you needed cross-customer analytics (joins across thousands of payments + customers), Postgres + a proper query planner would beat Mongo here.

### 2. JWT (stateless) over server-side sessions
**Choice:** JWT access + refresh.
**Why:** No Redis dependency, no shared session store, scales horizontally for free. Refresh token rotation via `refreshTokenVersion` gives revocation without needing a session DB.
**Tradeoff:** Tokens in localStorage are XSS-vulnerable. For production, [`PRODUCTION.md`](PRODUCTION.md) recommends moving to httpOnly cookies.

### 3. Click-to-send reminders over WhatsApp Business API
**Choice:** `wa.me/` and `sms:` URI schemes.
**Why:** Zero setup, zero cost, no compliance overhead. A pharmacist can adopt this on day one.
**Tradeoff:** Not automatic — requires one tap per customer per day. For pharmacies with >50 daily reminders, this gets tedious; the WhatsApp Business API path stays available as a future upgrade (the factory pattern is documented in git history before the rewrite).

### 4. No automated tests
**Choice:** Zero test coverage in this version.
**Why:** Tradeoff for shipping speed in a 1-engineer build. The app is small enough that manual testing catches most regressions.
**When this hurts:** the moment a second engineer joins. [`PRODUCTION.md`](PRODUCTION.md) flags adding integration tests as a Week-2 task before going to a real pharmacy.

### 5. Two Docker containers instead of one
**Choice:** Separate `web` and `api` containers behind a proxy.
**Why:** Independent scaling, independent restart, independent deploy. Also makes the architecture portable — same images run on Render, on EC2, on a laptop.
**Tradeoff:** Slight overhead vs. a monolith. Not material at this scale.

### 6. Mongoose `strict: false` (default)
**Choice:** Default Mongoose behavior — unknown fields silently dropped on save, preserved on load.
**Why:** Forgives schema evolution. When we renamed `whatsappTemplateReminder` → `messageTemplateReminder`, the old field stayed dormant in existing Settings documents without errors.
**Tradeoff:** Catches no typos. [`PRODUCTION.md`](PRODUCTION.md) recommends switching to `strict: 'throw'` before going to a real pharmacy.

---

## Where to read more

- **[`README.md`](README.md)** — setup + start here
- **[`COST.md`](COST.md)** — what it costs to run, both modes
- **[`PRODUCTION.md`](PRODUCTION.md)** — how to migrate from dev to production-grade
- **[`DEPLOY.md`](DEPLOY.md)** — Render deploy walkthrough (current dev mode)
- **[`design_handoff_pharmacare/`](design_handoff_pharmacare/)** — original product spec (background only; the code is the source of truth now)
