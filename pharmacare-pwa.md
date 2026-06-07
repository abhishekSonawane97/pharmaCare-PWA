# PharmaCare-PWA — Project Plan

> **Status:** PLANNING (no code written yet)
> **New repo:** https://github.com/abhishekSonawane97/pharmaCare-PWA
> **Old repo (frozen, in production with client):** https://github.com/abhishekSonawane97/pharmacare
> **Live system that must not be disturbed:** http://13.205.80.177 (EC2 + Atlas, two tenants)

---

## Context

We're forking PharmaCare into a new project, `pharmaCare-PWA`, where we'll build the **Progressive Web App** version. The original deployment has been handed over to a real pharmacy client and is now frozen — no further changes go there until we've validated the PWA on a separate environment.

The PWA goal is to make the app feel like a native mobile app for the pharmacist:
- Installable to the phone's home screen (no App Store)
- Works offline for read paths (customer list, medicines, today's queue)
- Optional: push notifications nudging the pharmacist when reminders are due
- HTTPS-served (mandatory for service workers)

The new repo currently contains a verbatim mirror of the live codebase. From here, we strip the parts that tie us to the live infra and build the PWA layer on top.

---

## Goals (in order of priority)

1. **Tier 1: Installable PWA** — manifest + icons + minimal service worker. Home-screen install works on Android + iOS. Fullscreen, no browser chrome.
2. **Tier 2: Offline-capable** — service worker caches the app shell + read-path API responses. Network failure shows a graceful "offline" state instead of breaking. Background sync queues writes for retry when back online.
3. **Tier 3: Push notifications** *(optional, decide later)* — pharmacist receives a daily "X customers due today" push at 10 AM IST. Reintroduces a scheduled job on the backend (which we deliberately removed earlier). The push only nudges the pharmacist to open the app and tap their click-to-send buttons — the customer messaging flow stays unchanged.
4. **HTTPS** — required for any of the above (browsers refuse to register a service worker on `http://`). Strategy decision in [Infrastructure](#infrastructure).
5. **Side-by-side with the live system** — same Atlas clusters (read on), same multi-tenant model. PWA dev environment runs on a separate EC2 with a separate domain. Live EC2 is untouched until the user explicitly cuts over.

---

## What carries over from the live codebase (unchanged)

- All `apps/api/src/` — Express, Mongoose schemas, routes, middleware, services
- All `apps/web/src/` — Next.js 14 App Router, pages, components, lib helpers
- Multi-tenant infrastructure: `config/tenants.ts`, `db/connections.ts`, `db/models.ts`, `middleware/tenant.ts`
- Auth model (JWT access + refresh, tenant claim in JWT)
- Click-to-send reminder flow (`wa.me` + `sms:` URIs)
- Domain model (User, Customer, Medicine, Payment, Settings, ActivityLog)
- Dockerfiles for api + web
- Local-dev `docker-compose.yml`
- `scripts/preflight.sh`, `scripts/seed-ssm.sh.template`
- `.env.example`, the env-var naming conventions
- Atlas clusters (`pharmacare.uoxcurq.mongodb.net` and `adilphramcy.tqfmyii.mongodb.net`) — both reused

---

## What does NOT carry over

These files are still in the new repo's mirror but must be **dropped or rewritten** before the PWA work begins:

| File | Why drop |
|---|---|
| `.github/workflows/deploy.yml` | Pinned to the live EC2 + the live IAM role's OIDC trust (which is scoped to the old repo). Will fail on every push from the new repo until replaced. |
| `infra/cloudformation.yaml` | References live stack name `pharmacare-prod`. We need a fresh stack for the new EC2. Plan: copy-modify, not delete-and-rewrite from scratch. |
| `render.yaml` | Render parallel-fallback was tied to the old repo. We're not using Render for the PWA dev environment. |
| `README.md`, `ARCHITECTURE.md`, `DEPLOY.md`, `PRODUCTION.md`, `COST.md`, `GITHUB.md` | All reference the live EIP `13.205.80.177`, account `059567100086`, old repo URL. They'll be rewritten as we land the new infra. |
| `pharmacare-pwa.md` *(this file)* | This **is** the new doc. Stays. |

---

## High-level architecture

```
                              Pharmacist's phone
                                    │
                                    │ tap "PharmaCare" home-screen icon
                                    ▼
                            (Standalone PWA)
                                    │
                            HTTPS via domain
                                    │
                                    ▼
                         New EC2 (separate from live)
                          ┌──────────────────────┐
                          │ Caddy (TLS + reverse │
                          │  proxy)              │
                          │   ├─ web :3000       │
                          │   └─ api :4000       │
                          │     (+ optional      │
                          │      push worker)    │
                          └──────────┬───────────┘
                                     │
                       ┌─────────────┴────────────┐
                       │                          │
        Atlas: pharmacare cluster   Atlas: adilpharmacy cluster
        (shared with live EC2)       (shared with live EC2)
                       │                          │
                       └────────────┬─────────────┘
                                    │
                             (LIVE EC2 also       │ pharmacare-PWA
                              hits these)        EC2 also hits these
```

**Sharing Atlas with the live system:**
- *Pro:* Pharmacists keep their data — no migration. PWA users see their actual customers.
- *Pro:* Schema additions (e.g. `PushSubscription` collection) are additive; the live app doesn't notice them.
- *Con:* Anything destructive in PWA dev (running `make seed` against the wrong tenant) wipes live data. Mitigated by the existing `SEED_CONFIRM` guard, but is a risk.
- *Con:* Atlas M0 connection slots are shared. Two EC2 instances pulling from the same cluster halves the per-process pool budget. Atlas M0 allows 500 concurrent → still plenty.

**Alternative:** Run a separate Atlas pair (pharmacare-pwa + adilpharmacy-pwa). Clean isolation but lose the real customer data for testing. **Recommended path: share Atlas; add a `SEED_CONFIRM`-protected `--dry-run` mode to seed for extra safety.**

---

## PWA implementation breakdown

### Tier 1 — Installable (must-have)

**Effort:** ~1 day

**Frontend additions** (`apps/web/`):
- `public/manifest.webmanifest` (or `app/manifest.ts` for dynamic Next.js manifest)
  - `name`, `short_name`, `start_url: /`, `display: standalone`, `theme_color`, `background_color`
  - Per-tenant manifest: see [Per-tenant branding](#per-tenant-branding) decision
- `public/icons/`:
  - `icon-192.png`, `icon-512.png`
  - `icon-maskable-192.png`, `icon-maskable-512.png` (Android adaptive icons)
  - `apple-touch-icon.png` (180×180)
- `app/layout.tsx`:
  - `<meta name="theme-color">`
  - `<link rel="manifest">`
  - `<link rel="apple-touch-icon">`
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- Service worker (minimal):
  - Register the SW in `app/layout.tsx` or via a client component
  - Library: **Serwist** (modern, maintained, official Next.js 14/15 support — successor to `next-pwa`)
  - At Tier 1, the SW just enables installability; no real caching strategy yet
- An **install-prompt UI** — capture `beforeinstallprompt` event, surface a "Install PharmaCare" button after first successful login

**Backend additions:** none.

**Verification:**
- Chrome Lighthouse on `/login` shows "Installable" ✓
- Mobile Chrome shows the "Install" / "Add to Home Screen" banner
- iOS Safari → Share → "Add to Home Screen" works
- Tapping the installed icon opens in fullscreen (no URL bar)

### Tier 2 — Offline-capable

**Effort:** +2 days

**Caching strategy** (in `apps/web/src/sw.ts` or whatever Serwist config we land on):

| Resource | Strategy | TTL |
|---|---|---|
| HTML pages (`/`, `/customers`, etc.) | **NetworkFirst** with 2s timeout, fall back to cache | 1 day |
| Next.js JS/CSS chunks (`/_next/static/...`) | **CacheFirst** — already hash-named, immutable | 30 days |
| `/api/auth/me`, `/api/dashboard`, `/api/customers`, `/api/medicines`, `/api/reminders` | **StaleWhileRevalidate** — show cached, refresh in background | 1 hour |
| `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` | **NetworkOnly** — never cache auth flows | n/a |
| Other writes (`POST`, `PATCH`, `DELETE`, `PUT`) | **NetworkOnly** + queue via Background Sync API | n/a |
| Images / fonts | **CacheFirst** | 30 days |

**Offline UX:**
- A small banner appears when `navigator.onLine === false`: "You're offline — changes will sync when reconnected."
- Failed writes get queued in IndexedDB via the SW's Background Sync, retried automatically.
- A dedicated `/offline.html` fallback for hard cache misses while offline.
- An "Update available" banner when a new SW activates: pharmacist taps to refresh.

**Auth + offline conflict:**
- If access token expires while offline, the `/api/auth/refresh` call fails (NetworkOnly).
- App falls back to "Reconnect to continue" screen — not a hard logout. When network returns, refresh resumes; user keeps their data.

**Backend additions:** none.

**Verification:**
- DevTools → Application → Service Worker → Offline checkbox enabled → pages still load
- Customer list visible from cache; trying to add a customer queues + retries when back online
- Lighthouse "Works offline" criterion passes

### Tier 3 — Push notifications *(optional, defer)*

**Effort:** +3–4 days

**Why optional:** This is the only piece that re-introduces a server-side scheduled job (which we explicitly removed earlier). It's high value (pharmacist actually gets reminded without opening the app) but high scope. Decide after Tier 1 + 2 are real and pharmacists have used them.

**Frontend additions:**
- After login, prompt for `Notification.permission` → if granted, register a `pushManager.subscribe()` with the VAPID public key
- POST the subscription JSON to `/api/push/subscribe`
- A Settings → Notifications subpage to toggle on/off, see which devices are subscribed, etc.

**Backend additions:**
- `npm install web-push` in `apps/api/`
- New env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (generated once via `web-push generate-vapid-keys`)
- New model `apps/api/src/models/PushSubscription.ts`: `{ userId, endpoint, keys, createdAt }` — one doc per browser/device that subscribed
- New routes:
  - `POST /api/push/subscribe` — save subscription
  - `DELETE /api/push/unsubscribe` — remove on logout / opt-out
  - `POST /api/push/test` — send a test push (admin only)
- New scheduled job (probably node-cron, daily 10 AM IST per tenant):
  - Query today's reminders queue (same logic as `/api/reminders` GET)
  - For each admin user with an active push subscription, send a notification: "9 customers due today — tap to open"

**Verification:**
- Service worker receives `push` event, displays notification
- Tapping notification opens the app on `/reminders`
- Daily cron in api logs shows "[push] 1 admin notified for pharmacare, 1 admin notified for adilpharmacy"

---

## Per-tenant branding

The PWA manifest defines the installed app's name and icon. We have two tenants. Decisions:

**Option A: Single brand "PharmaCare"** *(simpler)*
- Both tenants install the same icon labeled "PharmaCare"
- Inside the app, the dropdown still distinguishes them at login
- Adil Pharmacy users may find this slightly off-brand but it works
- One static `manifest.webmanifest`

**Option B: Per-tenant manifest** *(more polished)*
- Pharmacist installs from `https://app.example.in/?tenant=adilpharmacy`
- Next.js dynamic manifest at `app/manifest.ts` reads the `?tenant=` query param
- Returns the right name + icon
- Two installed icons on home screen if pharmacist serves both pharmacies

**Recommendation:** Start with Option A. Revisit if tenants ask for their own branding.

---

## Infrastructure

### HTTPS strategy

PWA mandates HTTPS. Three concrete paths:

| Path | Cost | URL looks like | Effort |
|---|---|---|---|
| **Buy a domain + Caddy + Let's Encrypt** | ~₹100/yr (.in) or ~₹1000/yr (.com) | `pharmacare.example.in` | ~30 min once domain DNS propagates |
| **sslip.io subdomain + Caddy + Let's Encrypt** | ₹0 | `<eip>.sslip.io`, e.g. `13-205-80-178.sslip.io` | ~15 min, immediate |
| **Cloudflare Tunnel** | ₹0 | `<random>.trycloudflare.com` (or custom domain if you have one on Cloudflare) | ~10 min |

**Recommended:** Get a cheap `.in` domain (~₹100/yr). The pharmacy-app context benefits from a professional URL. sslip.io is the no-cost fallback if domain registration is friction.

### New EC2 instance

- **Separate** from the live EC2 (which stays untouched per "frozen for client")
- Same approach as the original migration:
  - CloudFormation stack named `pharmacare-pwa-prod`
  - t4g.small ARM64 Ubuntu 24.04
  - New Elastic IP
  - Docker + Caddy
  - Same per-tenant SSM Parameter Store conventions but under a new prefix `/pharmacare-pwa/env/...` to avoid clashes
- Fresh GitHub OIDC role `pharmacare-pwa-gha-deploy` pinned to the new repo
- New ECR repos: `pharmacare-pwa-api`, `pharmacare-pwa-web`
- Cost: ~$18/mo, covered by remaining AWS Activate credit for ~3 more months

### CI/CD

A new `.github/workflows/deploy.yml` (replacing the mirrored one):
- Triggers on push to `main` in the new repo
- Same shape as the original (OIDC → buildx ARM64 → ECR push → SSM SendCommand → smoke test)
- New IAM role + new EC2 tag = no chance of accidentally deploying to the live EC2

---

## Order of operations

Sequenced so each phase is independently shippable.

### Phase 0 — Plan + cleanup (this PR)
1. Land **this `pharmacare-pwa.md`** file in the new repo's `main`
2. Delete the mirrored files that don't apply: `.github/workflows/deploy.yml`, `render.yaml`, `infra/cloudformation.yaml`, all the old docs
3. Update the old `README.md` and others (or replace with a minimal new README pointing to this plan)
4. Push to `pharmaCare-PWA` main — no CI fires (no workflow file = no GHA run)

### Phase 1 — Local PWA build (no infra needed yet)
5. Add `serwist` + `@serwist/next` to `apps/web/package.json`
6. Create manifest, icons, basic service worker
7. Add iOS meta tags to `app/layout.tsx`
8. Add the install-prompt UI component
9. `make build && make up` locally → verify PWA installs on a phone (over HTTPS via tailscale / ngrok for testing, since localhost is browser-trusted for SW but not as a real PWA install target)
10. Commit incrementally

### Phase 2 — Caching strategies + offline UX
11. Define caching strategies in the SW config
12. Add the offline banner + offline fallback page
13. Add the "Update available" banner
14. Wire up Background Sync for failed writes
15. Test offline workflow thoroughly with DevTools throttling

### Phase 3 — Infrastructure for the PWA environment
16. Fresh CloudFormation stack `pharmacare-pwa-prod` (new EIP, ECR, IAM, OIDC role)
17. Domain or sslip.io decision → register / configure
18. Caddy config with Let's Encrypt
19. New `.github/workflows/deploy.yml` mirroring the old structure but pointed at the new role + stack
20. Seed SSM with `TENANT_*_MONGO_URI` (same values as live — shared Atlas)
21. First deploy → smoke-test HTTPS + PWA install via real domain

### Phase 4 — Push notifications *(decide if go/no-go)*
22. Generate VAPID keys, add to SSM
23. `PushSubscription` model + routes
24. Frontend permission prompt + subscribe flow
25. Daily cron job for the push dispatch
26. Test end-to-end

### Phase 5 — Cutover (when PWA is proven)
*(Far future — when the pharmacist is happy with the PWA and we're ready to retire the live HTTP-only deployment)*

---

## Decisions still open (need user input before execution)

1. **HTTPS path:** Domain (~₹100/yr) OR sslip.io (free) OR Cloudflare Tunnel (free)?
2. **Per-tenant branding:** Option A (single PharmaCare brand) OR Option B (per-tenant manifest)?
3. **Push notifications:** in scope OR defer until Tier 1 + 2 prove themselves?
4. **Atlas:** share with live (chosen) OR separate clusters?
5. **App name on home screen:** "PharmaCare", "PharmaCare PWA", "Pharmacy", something else?
6. **Notification permission timing:** ask immediately after login OR after the user completes their first successful task (less aggressive)?
7. **Icon design:** Use existing Logomark.tsx as the basis OR design a fresh app icon?

---

## Verification plan

For each tier, the deliverable is verifiable on a real phone:

- **Tier 1 acceptance:** Pharmacist's Android + iPhone can both install the icon. Tapping opens fullscreen. App icon and name look right.
- **Tier 2 acceptance:** Toggle airplane mode → app still loads, customer list visible, "You're offline" banner shows, queued writes flush when back online.
- **Tier 3 acceptance:** At 10 AM IST, both admins (PharmaCare + Adil) receive a push notification on their phones with today's due count. Tapping opens the Reminders page.
- **Production acceptance:** Lighthouse PWA score ≥ 90, no console errors on first load, HTTPS green padlock, both tenants log in correctly.

---

## Risks

| Risk | Mitigation |
|---|---|
| Service worker caches stale code, breaks logged-in users after deploy | Use Serwist's built-in "skipWaiting + clientsClaim" + the "Update available" banner. Hash-name everything. |
| Pharmacist denies notification permission, can't be re-asked | Ask once, after first successful task. Document how to re-enable in Settings page. |
| Atlas connection ceiling hit (live + PWA EC2 sharing) | Atlas M0 has 500 conn cap, current usage is ~10. Plenty of headroom. Add per-conn pool size cap if needed. |
| Cutover confusion — pharmacist installs the PWA but has the old HTTP URL bookmarked | When PWA is ready, redirect the live HTTP URL to the new HTTPS URL via Caddy on the OLD EC2 (small change to the live system, justified). |
| Push notifications surface bugs in cron job — wrong tenant data, double-send, etc. | Phase 4 explicitly gated behind real-world Phase 1+2 validation. |
| iOS PWA limits (50MB cache, 7-day inactivity wipe) | Document them. Pharmacist who opens the app daily won't hit these. |
| New EC2 + new domain = more ops surface | Documented in fresh PRODUCTION.md before launch. Same monitoring (UptimeRobot + AWS Budgets at $10 thresholds). |

---

## What stays the same across both projects

- **Atlas clusters** — both `pharmacare.uoxcurq.mongodb.net` and `adilphramcy.tqfmyii.mongodb.net` are shared.
- **App behavior** — same login, same customer list, same click-to-send buttons. PWA is a presentation upgrade, not a feature reset.
- **The two tenants** — PharmaCare and Adil Pharmacy login with the same credentials.
- **Pharmacist's actual data** — every customer, payment, medicine they've entered in the live app appears in the PWA.

The PWA gives the pharmacist a better wrapper around the same product they already know.
