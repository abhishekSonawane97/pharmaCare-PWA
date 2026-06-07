# PharmaCare PWA

The PharmaCare app, being upgraded into a **Progressive Web App**: home-screen install on Android + iOS, offline-capable read paths, optional push notifications for the pharmacist.

This is the active development repo. The original (non-PWA) build at <https://github.com/abhishekSonawane97/pharmacare> is frozen and running in production with a real pharmacy client — do not touch it.

## Where to read next

- **[pharmacare-pwa.md](pharmacare-pwa.md)** — the master plan: context, goals, what's coming from the original codebase, what's new, the phased execution order, all the locked-in design decisions.

Everything else in this repo (the `apps/` source) is the working code, with PWA features being added incrementally.

## Quick start (local dev)

```bash
cp .env.example .env
# fill in the two TENANT_*_MONGO_URI values + JWT secrets + admin email/password

make build       # preflight + docker compose build
make up          # start the stack
```

Open <http://localhost:3000>. Login dropdown lets you pick PharmaCare or Adil Pharmacy. Both tenants point at the same Atlas clusters as the live production system.

> Service workers register on `http://localhost` — Tier 1 + Tier 2 PWA work can be developed entirely against the local docker stack. HTTPS is only required for public-internet deployment (Phase 3).

## Branch model

- `main` — production-ready, gets deployed once Phase 3 lands.
- Feature branches per phase or per substantive change. Squash-merge to `main`.

## Tech stack

Same as the original PharmaCare build, plus the PWA additions:

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + TailwindCSS |
| Backend | Node.js + Express + TypeScript + Mongoose |
| Database | MongoDB Atlas (one cluster per tenant — `pharmacare`, `adilpharmacy`) |
| Auth | JWT (15-min access + 365-day refresh) — tenant claim embedded |
| Reminders | Click-to-send via `wa.me` (WhatsApp) and `sms:` (native SMS) URI schemes |
| PWA layer (this repo's addition) | Serwist (Next.js 14 official adapter), Web App Manifest, service worker, Background Sync |

## What's frozen on the original repo

The production deployment at <http://13.205.80.177> is the original `pharmacare` repo's `main`, running on AWS EC2 with the two-tenant setup (PharmaCare + Adil Pharmacy). It is in active use by a real pharmacy. **Every change in this PWA repo stays here until Phase 3 ships a separate, HTTPS-enabled deployment.**
