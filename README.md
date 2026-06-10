# PharmaCare PWA

The PharmaCare app re-shipped as a **Progressive Web App**: home-screen install on Android + iOS, offline-capable read paths, write-queue with background retry, and (later) push notifications for the pharmacist.

This is the active development repo. The original (non-PWA) build at <https://github.com/abhishekSonawane97/pharmacare> is **frozen and running in production with a real pharmacy client** — do not touch it.

## 🌐 Where this app lives

| Environment | URL | Hosted on | Status |
|---|---|---|---|
| Production (planned) | https://pharmacare.rohinisonawane.com | Google Cloud VM via [Dokploy](https://dokploy.com) | DNS + Dokploy app config pending |
| Live (frozen, original repo) | http://13.205.80.177 | AWS EC2 + Atlas | Untouched, in active use by the client |
| Local dev | http://localhost:3000 | Docker on your laptop | Always-on for whoever's hacking |

Both deployments connect to the **same Atlas clusters** so PWA work sees the live customer/medicine data immediately — no migration needed.

## 📖 Where to read next

- **[pharmacare-pwa.md](pharmacare-pwa.md)** — the master plan. Context, goals, architecture, the 4 phases of execution, all the locked-in design decisions, risks, and what's out of scope.

Everything else in this repo (under `apps/`) is the working code, with PWA features added incrementally on top of the original PharmaCare codebase.

## 📍 Where development currently stands

| Phase | Scope | Status |
|---|---|---|
| **0 — Cleanup** | Strip live-infra files from the mirror; fresh `README.md` + `pharmacare-pwa.md` | ✅ done (`d1887e2`) |
| **1 — Installable** | Service worker (Serwist), web app manifest, brand icons (5 PNGs), iOS meta tags, install prompt UI | ✅ done (`f4b286b`) |
| **2 — Offline-capable** | Explicit per-route caching strategies, background sync queue for writes, `/offline` fallback page, offline banner, update-available banner | ✅ done (`6998b9d`) |
| **2.5 — Compose split** | `docker-compose.yml` is now production-shape (no host port exposure); `docker-compose.override.yml` adds back local-dev port mappings | ✅ done (`eb8b171`) |
| **3 — Deploy** | DNS at Cloudflare + Dokploy app config + first deploy → smoke-test on real device | 🚧 next |
| **4 — Push notifications** | VAPID keys, push subscription model, daily "X due today" cron | ⏸ deferred — decide go/no-go after Phase 3 is stable |

## 🚀 Quick start (local dev)

```bash
cp .env.example .env
# fill in:
#   TENANT_PHARMACARE_MONGO_URI=<from the live setup>
#   TENANT_ADILPHARMACY_MONGO_URI=<from the live setup>
#   JWT_ACCESS_SECRET=<openssl rand -base64 64>
#   JWT_REFRESH_SECRET=<openssl rand -base64 64>
#   ADMIN_EMAIL=...
#   ADMIN_PASSWORD=...

make build       # preflight + docker compose build
make up          # start the stack
```

Open <http://localhost:3000>. Login dropdown picks PharmaCare or Adil Pharmacy. Both tenants share the same Atlas clusters as the live production deployment.

> Service workers register on `http://localhost` (browsers treat it as a secure context for SW purposes), so all PWA Tier-1 + Tier-2 work runs locally without HTTPS. HTTPS is only required for real-device install + the production deploy.

### Common commands

| Command | What it does |
|---|---|
| `make check` | Validate `.env` + Docker |
| `make build` | Preflight + `docker compose build` |
| `make up` | Start (merges `docker-compose.yml` + `docker-compose.override.yml`) |
| `make down` | Stop |
| `make restart` | Recreate api + web containers |
| `make logs` | Tail logs |
| `make seed-pharmacare` / `make seed-adil` | **Destructive**: wipe + seed a tenant's DB |
| `make shell-api` | Shell into the api container |
| `make nuke` | Stop + delete containers (Atlas untouched) |

## 🚢 Deployment (Phase 3 — Dokploy)

Production runs on a self-hosted Google Cloud VM via **[Dokploy](https://dokploy.com)**, an open-source PaaS built on Docker + Traefik. Dokploy reads `docker-compose.yml` from this repo, builds the images on the VM, and auto-provisions a Let's Encrypt cert for the configured domain.

The DNS layer is **Cloudflare** (domain bought at Namecheap, NS pointed to Cloudflare).

### DNS records to add (one-time, at Cloudflare)

| Type | Name | Value | Proxy | Notes |
|---|---|---|---|---|
| `A` | `pharmacare` | `<GCP VM public IPv4>` | **DNS only** (gray cloud) | Orange-cloud blocks Let's Encrypt's HTTP-01 challenge. Flip to Proxied later if you want DDoS/cache. |

### Dokploy app config (in the Dokploy UI)

1. New project → Create Application → Compose
2. Git source: `abhishekSonawane97/pharmaCare-PWA`, branch `main`, compose path `docker-compose.yml`
3. Domain: `pharmacare.rohinisonawane.com` → service `web` → port `3000` → HTTPS on
4. Env vars (use **fresh** JWT secrets, distinct from the live deployment):
   ```
   TENANT_PHARMACARE_MONGO_URI=...
   TENANT_ADILPHARMACY_MONGO_URI=...
   JWT_ACCESS_SECRET=...   # openssl rand -base64 64
   JWT_REFRESH_SECRET=...  # openssl rand -base64 64
   ADMIN_EMAIL=...
   ADMIN_PASSWORD=...
   CORS_ORIGIN=https://pharmacare.rohinisonawane.com
   ```
5. Deploy. First build ~5–8 min.

### Why no `infra/`, `render.yaml`, `.github/workflows/` in this repo

Dokploy replaces all three:
- Auto-builds from Git push (no GitHub Actions needed)
- Auto-provisions HTTPS via Traefik + Let's Encrypt (no CloudFormation/Caddy needed)
- Manages env vars in its own UI (no SSM Parameter Store needed)

Compared to the original repo's AWS-native setup, this stack is dramatically simpler. The trade-off is that Dokploy itself becomes the single point of failure for deployments — if the GCP VM dies, recovery means provisioning a new VM, reinstalling Dokploy, and re-importing the app config from the UI (no codified infra).

## 🏛️ Tech stack

Same as the original PharmaCare build, plus the PWA additions:

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + TailwindCSS |
| Backend | Node.js + Express + TypeScript + Mongoose |
| Database | MongoDB Atlas (one cluster per tenant — `pharmacare` + `adilpharmacy`) |
| Auth | JWT (15-min access + 365-day refresh, tenant claim embedded) |
| Reminders | Click-to-send via `wa.me` (WhatsApp) and `sms:` (native SMS) URI schemes |
| Multi-tenant | Per-tenant Mongoose connections selected by the JWT's `tenant` claim |
| **PWA layer (new)** | Serwist (Next.js 14 adapter), Web App Manifest, service worker with 8 explicit caching strategies, Background Sync queue, offline fallback page |
| Container runtime | Docker + Docker Compose v2 |
| Production hosting | GCP VM via Dokploy (Docker + Traefik + Let's Encrypt) |
| DNS / edge | Cloudflare (free tier) |

## 📁 Project structure

```
.
├── apps/
│   ├── api/                          Express + Mongoose backend
│   │   └── src/                      Models, routes, services, multi-tenant DB layer
│   └── web/                          Next.js 14 frontend
│       ├── public/
│       │   ├── manifest.webmanifest  Web app manifest
│       │   └── icons/                5 PNG icons (192/512 standard + maskable, 180 apple)
│       ├── scripts/
│       │   └── generate-icons.mjs    `npm run gen-icons` — regenerate icons via sharp
│       └── src/
│           ├── app/
│           │   ├── sw.ts             Service worker entry (Serwist)
│           │   ├── offline/page.tsx  Offline fallback page
│           │   ├── (app)/            Authed routes
│           │   └── login/            Public sign-in / sign-up (with tenant dropdown)
│           ├── components/
│           │   ├── InstallPrompt.tsx Add-to-home-screen prompt (Android + iOS)
│           │   ├── OfflineBanner.tsx Network-status strip
│           │   ├── UpdateBanner.tsx  "New version available, tap reload" banner
│           │   └── ...               Existing AppShell, Modal, Button, etc.
│           └── lib/
│               ├── tenants.ts        Frontend tenant registry
│               ├── auth-context.tsx  Multi-tenant auth + JWT handling
│               └── api.ts            Fetch wrapper with 401 → refresh
│
├── docker-compose.yml                PRODUCTION compose (no host ports — Dokploy/Traefik routes internally)
├── docker-compose.override.yml       LOCAL DEV overlay (adds 3000/4000 host ports)
├── Makefile                          make build / make up / make seed-*
├── scripts/
│   ├── preflight.sh                  Pre-build .env validation
│   └── seed-ssm.sh.template          (Legacy — not used for Dokploy; kept for reference)
├── .env.example
├── pharmacare-pwa.md                 The master plan
└── README.md                         You-are-here
```

## 🌳 Branch model

- `main` — production-ready. Pushing here triggers a Dokploy redeploy.
- Feature branches per substantive change. Squash-merge to `main`.

## 🔐 What changes for the live system?

**Nothing.** The original repo's OIDC IAM trust on AWS is pinned to that repo's name, so no push from this PWA repo can deploy to the live EC2. The two deployments are completely independent — they only share the Atlas clusters. The live system continues to serve the pharmacy client unchanged until you explicitly decide to retire it.
