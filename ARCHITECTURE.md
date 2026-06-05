# Architecture

> **Audience:** A new engineer who just inherited this repo and needs to understand how the pieces fit, why they were chosen, and how data + deploys move through them. Read this in one sitting — ~15 minutes.

PharmaCare is a **pharmacy customer-management web app** for small/mid Indian pharmacies. Its killer feature is **click-to-send refill reminders**: the pharmacist opens the Reminders page on their phone, sees who's due for a refill in the next 48 hours, and one-taps a button that opens WhatsApp or SMS with a pre-filled message. The message goes from the pharmacist's own phone account — no API gateway, no business verification, no per-message cost.

Two live deployments share one Atlas database, but **AWS EC2 is now the production primary** and Render is kept as a parallel fallback during cutover.

---

## Live deployment topology

```
                                Internet
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
   http://13.205.80.177                           https://pharmacare-web.onrender.com
   (AWS EC2, PRIMARY)                             (Render, parallel fallback)

  ┌──────────────────────────────┐                ┌────────────────────────────────┐
  │ AWS EC2 t4g.small (Mumbai)   │                │ Render free tier (Singapore)   │
  │ Account 059567100086         │                │                                │
  │                              │                │  ┌──────────────────────────┐  │
  │  ┌────────────────────────┐  │                │  │ pharmacare-web (Next.js) │  │
  │  │ Nginx 1.27-alpine :80  │  │                │  │ port 3000                │  │
  │  │  /api/* → api:4000     │  │                │  │ Next.js rewrites /api/*  │  │
  │  │       / → web:3000     │  │                │  │ to api-40oz.onrender.com │  │
  │  └─┬────────────┬─────────┘  │                │  └──────────────────────────┘  │
  │    │            │            │                │              │                 │
  │  ┌─▼─────────┐ ┌▼──────────┐ │                │              ▼ (server-side)   │
  │  │ web :3000 │ │ api :4000 │ │                │  ┌──────────────────────────┐  │
  │  │ Next.js   │ │ Express   │ │                │  │ pharmacare-api-40oz      │  │
  │  │ standalone│ │ + Mongoose│ │                │  │ Express + Mongoose       │  │
  │  └───────────┘ └────┬──────┘ │                │  │ port 4000                │  │
  │  (images from       │       │                │  └────────────┬─────────────┘  │
  │   ECR private,     │        │                └───────────────│─────────────────┘
  │   ARM64)            │       │                                │
  └────────────────────│────────┘                                │
                       │                                         │
                       └─────────────────┬───────────────────────┘
                                         │
                                         ▼  TLS, Mongoose driver
                  ┌────────────────────────────────────────────┐
                  │  MongoDB Atlas M0 (FREE)                   │
                  │  cluster: pharmacare.uoxcurq.mongodb.net   │
                  │  region: AWS ap-south-1 (Mumbai)           │
                  │  db:     pharmacare                        │
                  │  IP allowlist: 0.0.0.0/0 (TODO: tighten)   │
                  └────────────────────────────────────────────┘

  Pharmacist's phone
       │
       │ opens /reminders → sees today's queue
       │ taps "WhatsApp" or "SMS" button on a customer row
       ▼
  Native app opens (WhatsApp / Messages) with pre-filled text
       │
       │ pharmacist taps SEND in the native app
       ▼
  Message goes from pharmacist's OWN PHONE NUMBER directly to customer.
  Backend is only notified via a fire-and-forget POST to mark "sent this cycle".
```

**Why the cutover works seamlessly**: both deployments connect to the same Atlas cluster with the same `MONGO_URI` and the same JWT secrets, so an access token issued by Render is verifiable by EC2 and vice versa. Users don't need to re-login during the move.

---

## AWS production topology (zoomed in)

```
                     Internet
                        │
                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  AWS account 059567100086                                    │
   │  Region: ap-south-1 (Mumbai)                                 │
   │  Stack: pharmacare-prod (CloudFormation)                     │
   │                                                              │
   │  ┌────────────────────────────────────────────────────────┐  │
   │  │ VPC 10.20.0.0/16                                       │  │
   │  │                                                        │  │
   │  │  ┌──────────────────────────────────────────────────┐  │  │
   │  │  │ PublicSubnet 10.20.1.0/24                        │  │  │
   │  │  │                                                  │  │  │
   │  │  │  ┌────────────────────────────────────────────┐  │  │  │
   │  │  │  │ EC2 i-0e4e1b0ced7aeb3cb (t4g.small ARM64)  │  │  │  │
   │  │  │  │ Elastic IP 13.205.80.177                   │  │  │  │
   │  │  │  │ 20 GiB gp3 encrypted root                  │  │  │  │
   │  │  │  │ Ubuntu 24.04 LTS                           │  │  │  │
   │  │  │  │ Instance role: pharmacare-prod-InstanceRole│  │  │  │
   │  │  │  │   - AmazonSSMManagedInstanceCore           │  │  │  │
   │  │  │  │   - AmazonEC2ContainerRegistryReadOnly     │  │  │  │
   │  │  │  │   - SSM Parameter read on /pharmacare/*    │  │  │  │
   │  │  │  │                                            │  │  │  │
   │  │  │  │ ┌── docker compose (in /opt/pharmacare) ─┐ │  │  │  │
   │  │  │  │ │ nginx  :80 │ web :3000 │ api :4000     │ │  │  │  │
   │  │  │  │ │  (ports 80 only on host, others bind   │ │  │  │  │
   │  │  │  │ │   to internal Docker network)          │ │  │  │  │
   │  │  │  │ └────────────────────────────────────────┘ │  │  │  │
   │  │  │  └────────────────────────────────────────────┘  │  │  │
   │  │  │                       ▲                          │  │  │
   │  │  │  ┌─ SG (80, 443, 22) ─┘                          │  │  │
   │  │  └──────────────────────────────────────────────────┘  │  │
   │  └────────────────────────────────────────────────────────┘  │
   │                                                              │
   │  ┌─ ECR (private) ────────────────────────────────────────┐  │
   │  │ pharmacare-api  (10 sha-tags retained, lifecycle rule) │  │
   │  │ pharmacare-web  (10 sha-tags retained, lifecycle rule) │  │
   │  └────────────────────────────────────────────────────────┘  │
   │                                                              │
   │  ┌─ SSM Parameter Store ──────────────────────────────────┐  │
   │  │ /pharmacare/env/MONGO_URI          (SecureString)      │  │
   │  │ /pharmacare/env/JWT_ACCESS_SECRET  (SecureString)      │  │
   │  │ /pharmacare/env/JWT_REFRESH_SECRET (SecureString)      │  │
   │  │ /pharmacare/env/ADMIN_PASSWORD     (SecureString)      │  │
   │  │ /pharmacare/env/{8 more, plain Strings}                │  │
   │  └────────────────────────────────────────────────────────┘  │
   │                                                              │
   │  ┌─ GitHub OIDC ──────────────────────────────────────────┐  │
   │  │ Provider: token.actions.githubusercontent.com          │  │
   │  │ Role: pharmacare-gha-deploy                            │  │
   │  │ Trust pinned to: repo:abhishekSonawane97/pharmacare    │  │
   │  │                  :ref:refs/heads/main                  │  │
   │  └────────────────────────────────────────────────────────┘  │
   │                                                              │
   │  ┌─ AWS Budgets ──────────────────────────────────────────┐  │
   │  │ pharmacare-every-10-dollars                            │  │
   │  │ 10 thresholds (10%, 20%, ..., 100% of $100 monthly)    │  │
   │  │ Email: healthcare.pharmacy9988@gmail.com               │  │
   │  └────────────────────────────────────────────────────────┘  │
   └──────────────────────────────────────────────────────────────┘
```

All resources are defined in [`infra/cloudformation.yaml`](infra/cloudformation.yaml) and managed as one stack. Destroy = `aws cloudformation delete-stack`. No state outside CFN except the EC2 SSH keypair (stored locally at `~/.ssh/pharmacare-keypair.pem`) and the SSM parameter values (managed via `scripts/seed-ssm.sh`).

---

## Build + deploy flow (every push to main)

```
   git push origin main
        │
        ▼
   GitHub Actions: .github/workflows/deploy.yml
   │
   │ steps (all in one job, ubuntu-latest amd64 runner):
   │
   ├─[1]─ Checkout
   │
   ├─[2]─ aws-actions/configure-aws-credentials@v4
   │     → OIDC token exchange → assume pharmacare-gha-deploy
   │       (no long-lived AWS keys anywhere in GitHub)
   │
   ├─[3]─ amazon-ecr-login@v2 → docker login to ECR
   │
   ├─[4]─ setup-qemu-action + setup-buildx-action
   │     → enables cross-compiling linux/arm64 from amd64 runner
   │
   ├─[5]─ Compute tag: sha-<12-char shortsha>
   │
   ├─[6]─ Build & push api image (linux/arm64)
   │     → cache from/to GHA (type=gha,scope=api)
   │     → tags: :sha-XXX  and  :latest
   │
   ├─[7]─ Build & push web image (linux/arm64)
   │     → build-args: NEXT_PUBLIC_API_URL=/api  (BAKED into client bundle)
   │     → tags: :sha-XXX  and  :latest
   │
   ├─[8]─ Resolve EC2: filter Project=Pharmacare, get instance ID + Elastic IP
   │
   ├─[9]─ Build SSM SendCommand payload:
   │     - base64-encode deploy/docker-compose.yml + deploy/nginx.conf
   │     - generate remote-deploy.sh (fetches SSM env vars → writes .env on disk,
   │       logs in to ECR, docker compose pull, docker compose up -d,
   │       polls /api/health locally for 10s before returning)
   │     - assemble JSON with jq → /tmp/ssm-cmd.json
   │
   ├─[10]─ aws ssm send-command --cli-input-json file:///tmp/ssm-cmd.json
   │      ↓ runs on EC2:
   │      ┌─────────────────────────────────────────────────────────────┐
   │      │ /opt/pharmacare/ on EC2                                     │
   │      │   docker-compose.yml  (rewritten from base64 in command)    │
   │      │   nginx.conf          (rewritten from base64 in command)    │
   │      │   .env                (regenerated from SSM Parameter Store)│
   │      │                                                             │
   │      │ docker login → ECR                                          │
   │      │ docker compose pull (~30s, only changed layers)             │
   │      │ docker compose up -d --remove-orphans (~10s)                │
   │      │ wait for /api/health = "ok" (~5-15s)                        │
   │      └─────────────────────────────────────────────────────────────┘
   │
   ├─[11]─ aws ssm wait command-executed  +  fetch logs
   │
   └─[12]─ Smoke test from runner: GET http://<EIP>/api/health
          (retries 10 times with backoff)

   Typical total: 2-3 min on cached builds; first build is 8-10 min (QEMU cold).
```

**Image traceability**: every container that runs is pinned to the exact git SHA that built it. Rollback = re-run the workflow on a previous SHA via `gh workflow run deploy.yml --ref <old-sha>`.

---

## Local dev topology

For comparison — what runs when you do `make up` on your laptop:

```
            Browser (localhost)
                  │
   ┌──────────────┼──────────────┐
   ▼              ▼              ▼
http://...:3000  http://...:4000  (no Nginx locally)
                  ▲
   ┌──────────────┴──────────────┐
   │ docker compose (root file)  │
   │  web :3000  →  api :4000    │   web's Next.js rewrites /api/* internally
   │  ports 3000, 4000 exposed   │
   └──────────────┬──────────────┘
                  ▼  Mongoose
            MongoDB Atlas (same cluster as prod)
```

Local skips Nginx because `next dev` (or standalone) is fine on localhost, and exposing 3000 + 4000 directly is convenient for debugging. Production uses Nginx because:
- single-origin (no CORS preflight from the browser)
- TLS termination point when a domain is added later
- gzip + connection keepalive across app restarts

---

## Tech stack rationale

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | Best React DX, file-based routing, standalone server output works in any container |
| Frontend styling | TailwindCSS | Co-located styles, sane defaults, no CSS file proliferation |
| Frontend state | React hooks only (no Redux) | App is simple — pages own their state, `auth-context` for the user |
| Backend framework | Express + TypeScript | Smallest surface area, every dev knows it |
| ORM | Mongoose | Schema validation + lifecycle hooks; raw MongoDB driver is too low-level |
| Auth | JWT (access 15m + refresh 365d) | Stateless, no Redis dependency, scales horizontally for free |
| Validation | zod | Same schema definition does typing + runtime validation |
| Database | MongoDB Atlas | Managed, easy backups (paid tier), same locally + in prod |
| Containerization | Docker + Compose v2 | Same image runs everywhere — laptop, EC2, Render |
| Reverse proxy (prod) | Nginx 1.27-alpine | Tiny, fast, well-understood, easy to add TLS later via Caddy or LE |
| Reminder delivery | `wa.me` + `sms:` URI schemes | Zero cost, zero setup, no compliance overhead, pharmacist's own phone is the channel |
| CI/CD | GitHub Actions + OIDC | No long-lived AWS keys in repo; ref-pinned trust |
| Image registry | ECR private | Colocated with EC2 in same region (free intra-region pulls) |
| Infra-as-code | CloudFormation | AWS-native, no Terraform state file to manage |
| Remote command | SSM Run Command | Server never needs GitHub access; agent ships with Ubuntu |

---

## Project structure

```
.
├── apps/
│   ├── api/                          Express + Mongoose backend
│   │   ├── src/
│   │   │   ├── index.ts              App entrypoint — mounts routers, connects mongo
│   │   │   ├── models/               Mongoose schemas
│   │   │   │   ├── User.ts           Admins + employees
│   │   │   │   ├── Customer.ts       Pharmacy customers + nextDueDate
│   │   │   │   ├── Medicine.ts       Catalog (name, content, location, prices)
│   │   │   │   ├── Payment.ts        Received/given payments (paise)
│   │   │   │   ├── Settings.ts       Singleton (pharmacy info, templates)
│   │   │   │   └── ActivityLog.ts    Append-only audit trail
│   │   │   ├── routes/               REST endpoints (one file per resource)
│   │   │   │   ├── auth.ts           signup, login, refresh, logout, me
│   │   │   │   ├── customers.ts      CRUD + ignore/unignore
│   │   │   │   ├── reminders.ts      queue + mark-sent + complete (ADMIN ONLY)
│   │   │   │   ├── medicines.ts      CRUD (admin), read (employees)
│   │   │   │   ├── payments.ts       create (admin) + list (all) + delete (admin)
│   │   │   │   ├── employees.ts      admin manages user accounts
│   │   │   │   ├── settings.ts       update pharmacy settings + templates
│   │   │   │   ├── dashboard.ts      KPIs for landing page
│   │   │   │   └── activity.ts       audit log read
│   │   │   ├── services/
│   │   │   │   ├── messageLinks.ts   Builds wa.me + sms: URLs per customer
│   │   │   │   └── reminders.ts      Queue lookup + mark-sent + thank-you
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           requireAuth + requireAdmin
│   │   │   │   └── error.ts          JSON error envelope
│   │   │   ├── utils/                phone normalize, jwt sign/verify, etc.
│   │   │   └── scripts/seed.ts       Wipe DB + insert sample data (DESTRUCTIVE)
│   │   └── Dockerfile                Multi-stage build → tiny runtime image
│   │
│   └── web/                          Next.js 14 frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── login/            Public sign-in / sign-up
│       │   │   └── (app)/            All authed routes share a single layout
│       │   │       ├── page.tsx          Dashboard
│       │   │       ├── customers/        Customer CRUD + detail
│       │   │       ├── reminders/        The killer feature (ADMIN ONLY)
│       │   │       ├── payments/         Payment history (view for employees)
│       │   │       ├── medicines/        Catalog (read for employees, CRUD for admin)
│       │   │       ├── employees/        User management (admin only)
│       │   │       ├── activity/         Audit log (admin only)
│       │   │       └── settings/         Pharmacy info + templates (admin only)
│       │   ├── components/           Shared UI (Button, Modal, AppShell, ...)
│       │   └── lib/                  API client, auth context, formatters, types
│       └── Dockerfile                Multi-stage Next.js standalone build
│
├── infra/
│   └── cloudformation.yaml           AWS stack: VPC, EC2, EIP, ECR, IAM, OIDC, GHA role
│
├── deploy/
│   ├── docker-compose.yml            PRODUCTION compose (ECR images, Nginx fronts)
│   └── nginx.conf                    Reverse proxy: /api → api:4000, / → web:3000
│
├── .github/
│   └── workflows/deploy.yml          CI/CD: OIDC → build ARM64 → ECR push → SSM deploy
│
├── scripts/
│   ├── preflight.sh                  Pre-build .env + Docker validation (local)
│   └── seed-ssm.sh.template          One-time SSM seed (copy to seed-ssm.sh + fill)
│
├── docker-compose.yml                LOCAL DEV compose (source build, no Nginx)
├── render.yaml                       Render Blueprint (parallel fallback)
├── Makefile                          Common workflow shortcuts
├── .env.example                      Template — copy to .env
├── README.md                         You-are-here entry point
├── ARCHITECTURE.md                   This file
├── DEPLOY.md                         Deployment runbook
├── PRODUCTION.md                     Operating runbook (rollback, monitoring, hardening)
├── COST.md                           Real-world cost breakdown + budget alerts
├── GITHUB.md                         GitHub repo + GHA secrets setup
└── design_handoff_pharmacare/        Original product spec (reference only)
```

---

## Domain model

```
        ┌──────────────────┐
        │  User            │      role: 'admin' | 'employee'
        │  (admins + emps) │      status: 'pending' | 'active' | 'rejected'
        │                  │      refreshTokenVersion (bump to revoke all tokens)
        └────────┬─────────┘
                 │ created
                 ▼
        ┌──────────────────┐
        │  Customer        │      nextDueDate ─── drives the reminder queue
        │  (pharmacy       │      autoReminderSentForCycle ── dedup flag
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
        │  (catalog)       │      purchasePrice, mrp, discountedPrice, location
        └──────────────────┘      Referenced by name (not ObjectId) in Customer.medicines

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
- **Customer.medicines** stores `medicineName` as a string, not a Medicine ObjectId. Deliberate: lets a customer have medicines that aren't in your catalog.
- **Payment.amount** is always in PAISE (integer rupees × 100). Never float. UI divides by 100 for display.
- **Settings** uses `_id: 'settings'` as a string — only ever one document. `ensureSettings()` creates it if missing.
- **ActivityLog** is append-only — never updated, never deleted. Source of truth for "who did what when".

---

## Auth model

```
   POST /api/auth/login {email, password}
                 │
                 ▼
   bcrypt.compare → on success:
                 │
                 ▼
   ┌──────────────────────────────────────┐
   │ access  token  (15-min TTL, JWT)     │   payload: { sub, role, status }
   │ refresh token  (365-day TTL, JWT)    │   payload: { sub, ver }
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

### Roles + access matrix

| Page | Admin | Employee |
|---|---|---|
| Dashboard | ✅ | ✅ |
| Customers (view + CRUD) | ✅ | ✅ |
| Reminders | ✅ | ❌ (hidden from nav + page-level guard + API 403) |
| Payments — view | ✅ | ✅ |
| Payments — add / edit / delete | ✅ | ❌ (buttons hidden + API 403) |
| Medicines — view | ✅ | ✅ |
| Medicines — add / edit / delete | ✅ | ❌ (buttons hidden + API 403) |
| Customer detail — Add payment record button | ✅ | ❌ (hidden) |
| Employees | ✅ | ❌ |
| Activity log | ✅ | ❌ |
| Settings | ✅ | ❌ |

Defense in depth: every restricted route has THREE layers — nav hidden, page guard, server `requireAdmin`. The server enforcement is load-bearing.

### Account lifecycle
1. First-ever signup auto-becomes **admin + active** (bootstrap; only happens once on a fresh DB)
2. Every subsequent signup is **employee + pending** — admin must approve via Employees page
3. Admin can also create employees directly (no pending step) — `POST /api/employees`

---

## Reminder flow (the killer feature)

This is the one piece that's genuinely different from a standard CRUD app, so it deserves its own diagram.

```
                  ┌─────────────────────────────────────┐
                  │  Pharmacist opens /reminders        │
                  │  (preferably on their PHONE)        │
                  └────────────────┬────────────────────┘
                                   │
                                   ▼
              GET /api/reminders   (requireAuth + requireAdmin)
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
        Zero cost, zero compliance overhead.
```

### Why no automatic sending?
The original v1 used Meta WhatsApp Business Cloud API + a daily 10:00 IST cron to auto-send. That was removed because:
1. Meta WABA requires business verification (1–2 weeks paperwork)
2. Templates need pre-approval (UTILITY category, 1–24h each)
3. Costs ~₹0.30 per message
4. SMS gateways in India require DLT template registration (2–7 days)

The click-to-send approach trades automation for **zero friction to go live**.

### Why the `autoReminderSentForCycle` flag?
Without it, the same customer would appear in the queue every time the pharmacist opens the page. The flag is set when they tap a send button and **automatically clears** when the customer's `nextDueDate` is updated (i.e., when the refill is marked complete and a new cycle starts).

---

## Request flow (login example, AWS path)

```
Browser                Nginx :80              api :4000              Atlas
   │                       │                      │                     │
   │  POST /api/auth/login │                      │                     │
   ├──────────────────────►│                      │                     │
   │                       │  location /api/ {    │                     │
   │                       │    proxy_pass api;   │                     │
   │                       │  }                   │                     │
   │                       ├─────────────────────►│                     │
   │                       │                      │                     │
   │                       │                      │  User.findOne()     │
   │                       │                      ├────────────────────►│
   │                       │                      │◄────────────────────┤
   │                       │                      │  bcrypt.compare()   │
   │                       │                      │  sign JWTs          │
   │                       │                      │                     │
   │                       │◄─────────────────────┤                     │
   │  {accessToken, refresh}                      │                     │
   │◄──────────────────────┤                      │                     │
   │  Store in localStorage│                      │                     │
```

Same flow on Render, just without the Nginx hop — the web Next.js process rewrites `/api/*` to the api service over the Render internal network.

---

## Key design decisions and tradeoffs

### 1. MongoDB over PostgreSQL
**Choice:** MongoDB Atlas.
**Why:** Each customer's `medicines` array is variable-length and varies in shape. Modeling that in Postgres needs a join table; in Mongo it's a native array on the document. Atlas free tier is also more generous than any free Postgres host.
**When you'd switch:** if you needed cross-customer analytics (joins across thousands of payments + customers), Postgres + a proper query planner would beat Mongo.

### 2. JWT (stateless) over server-side sessions
**Choice:** JWT access + refresh.
**Why:** No Redis dependency, no shared session store, scales horizontally for free. Refresh rotation via `refreshTokenVersion` gives revocation without a session DB.
**Tradeoff:** Tokens in localStorage are XSS-vulnerable. For production hardening, see [PRODUCTION.md](PRODUCTION.md#security-hardening) — move to httpOnly cookies eliminates the XSS vector.

### 3. Click-to-send reminders over WhatsApp Business API
**Choice:** `wa.me/` and `sms:` URI schemes.
**Why:** Zero setup, zero cost, no compliance overhead. A pharmacist can adopt this on day one.
**Tradeoff:** Not automatic — requires one tap per customer per day. For pharmacies with >50 daily reminders, this gets tedious; the WhatsApp Business API path stays available as a future upgrade.

### 4. Nginx single-origin (instead of separate web + api URLs)
**Choice:** Production routes everything through Nginx :80.
**Why:** Browser hits `/api/...` relative to the page origin — no CORS preflight, no cross-origin cookies headache. Also one TLS cert needed when a domain is added later.
**Tradeoff:** Extra hop adds ~1ms per request (negligible on same-host loopback).

### 5. AWS EC2 over fully-managed (Vercel, App Runner, Fargate)
**Choice:** Single EC2 instance running docker-compose.
**Why:** ~$1,200/year (compute, after free year), full control over the runtime, same image works locally. No serverless cold-start, no per-request pricing.
**Tradeoff:** You operate it. Patching, monitoring, backups are all on you. Acceptable at single-pharmacy scale; revisit at 5+ pharmacies.

### 6. CloudFormation over Terraform
**Choice:** AWS-native CFN, one stack.
**Why:** No state file to manage. Stack deletion cleans up every resource atomically.
**Tradeoff:** Vendor lock-in. Terraform would let you re-target to another cloud later. Not a real concern at this scale.

### 7. SSM Parameter Store over Secrets Manager
**Choice:** SecureString parameters at `/pharmacare/env/*`.
**Why:** Free up to 10k standard params; Secrets Manager is $0.40/secret/mo × ~6 secrets = $2.40/mo extra.
**Tradeoff:** No automatic rotation. Not needed for this app's threat model.

### 8. SSM Run Command over SSH for deploys
**Choice:** GHA uses SSM SendCommand to trigger `docker compose pull && up -d`.
**Why:** Server never needs an open SSH port to the world (22 is allowlisted to your IP only as break-glass). No SSH keys live in GitHub. Audit log of every command is automatic in CloudTrail.
**Tradeoff:** Slightly more verbose in the workflow vs. `ssh user@host docker compose pull`. Worth it.

### 9. Heredoc-in-SSM over S3 for compose+nginx files
**Choice:** The GHA workflow base64-encodes `deploy/docker-compose.yml` + `deploy/nginx.conf` and embeds them in the SSM command parameters.
**Why:** No S3 bucket to provision, no extra IAM permission, no race condition on file uploads.
**Tradeoff:** SSM has a 100KB limit per command payload. Both files are <5KB so plenty of headroom. If they ever exceed limits, switch to S3.

### 10. No automated tests
**Choice:** Zero test coverage in this version.
**Why:** Tradeoff for shipping speed in a 1-engineer build.
**When this hurts:** the moment a second engineer joins. [PRODUCTION.md](PRODUCTION.md#hardening-checklist) flags adding integration tests as a Week-2 task before going to a real pharmacy.

### 11. Mongoose `strict: false` (default)
**Choice:** Default Mongoose behavior — unknown fields silently dropped on save, preserved on load.
**Why:** Forgives schema evolution.
**Tradeoff:** Catches no typos. [PRODUCTION.md](PRODUCTION.md#hardening-checklist) recommends switching to `strict: 'throw'` before going to a real pharmacy.

---

## Where to read more

- **[README.md](README.md)** — entry + setup
- **[DEPLOY.md](DEPLOY.md)** — deployment runbook (first deploy + ongoing deploys)
- **[PRODUCTION.md](PRODUCTION.md)** — operating the production stack
- **[COST.md](COST.md)** — current real costs + budget alerts
- **[GITHUB.md](GITHUB.md)** — GitHub + OIDC + CI secrets setup
- **[`infra/cloudformation.yaml`](infra/cloudformation.yaml)** — source of truth for every AWS resource
- **[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)** — source of truth for the deploy pipeline
- **[design_handoff_pharmacare/](design_handoff_pharmacare/)** — original product spec (background only)
