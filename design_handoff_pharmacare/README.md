# PharmaCare — Developer Handoff Package

A pharmacy customer-management web application with WhatsApp-based refill reminders, built for small-to-mid pharmacies in India.

---

## ⚠️ About the Files in This Bundle

The HTML/JSX files in `design-source/` are **design references** created in HTML+React+Tailwind as an interactive prototype. They are **not production code**. Your task as the developer is to **recreate these designs in a real Next.js + Express + MongoDB stack** — pixel-perfect for visuals, behaviorally identical, but built properly with real auth, a real database, and a real WhatsApp API integration.

The fidelity of these mockups is **high (hifi)** — colors, typography, spacing, copy, interactions, and layout are all final. Match them exactly.

---

## 1. Tech Stack (locked)

| Layer | Choice |
|---|---|
| **Frontend** | Next.js 14+ (App Router) + TypeScript + TailwindCSS |
| **Backend** | Node.js + Express + TypeScript |
| **Auth** | JWT (access + refresh tokens) — handled in Express |
| **Database** | MongoDB with Mongoose |
| **WhatsApp** | Meta WhatsApp Business Cloud API (mocked initially) |
| **Deployment** | Docker + docker-compose (self-hosted) |
| **Scheduler** | `node-cron` for daily 10:00 AM auto-send job |

Three Docker services in compose:
- `web` — Next.js (port 3000)
- `api` — Express + cron worker (port 4000)
- `mongo` — MongoDB 7 (port 27017, persistent volume)

See `DOCKER.md` for the full setup.

---

## 2. What This Application Does

PharmaCare helps a pharmacy:
1. **Track regular customers** who come for monthly/recurring medicine refills
2. **Auto-send WhatsApp reminders** when a customer's next refill due date is within 48 hours — automatically, without staff lifting a finger
3. **Manage staff (employees)** with role-based access — admins can do everything, employees are limited
4. **Track payments** (received from customers, given as refunds) — basic ledger
5. **Audit every action** in an activity log
6. **Manage a medicine catalog** for autocomplete when adding customer prescriptions

The core value proposition: **the pharmacy never has to remember to call/message anyone — the system does it.**

---

## 3. User Roles

There are exactly two roles: `admin` and `employee`.

### Admin can:
- Everything an employee can do, plus:
- Create / edit / soft-delete customers
- Mark reminders as complete (set new due date + optional thank-you WhatsApp)
- Ignore reminders (hide a customer from the reminders list)
- Update any customer's due date
- Approve / reject employee signup requests
- Add / remove employees
- Add / remove medicines from catalog
- Delete payment records
- View activity log
- Access settings page

### Employee can:
- View customers (read-only)
- View reminders list (read-only — cannot mark complete or ignore)
- Manually open WhatsApp message for a reminder (the system already auto-sent first time, this is for resends)
- Add new customers (depending on settings — see below)
- Record payments

The **first user to sign up becomes admin automatically**. Every subsequent signup is an employee request that needs admin approval before they can log in.

---

## 4. Screens / Views

There are **9 main screens** plus the login/signup screen. Screenshots in `screenshots/` folder.

### 4.1 Login / Signup screen (`screenshots/10-login.png`)
- Two-tab card: "Sign in" and "Sign up"
- Sign in: email + password fields → POST `/api/auth/login` → store JWT, redirect to dashboard
- Sign up: name + email + phone + password fields → POST `/api/auth/signup` → creates an employee with `status: 'pending'` (or admin if first user) → redirect to "waiting for approval" view if pending
- Pending users cannot log in until an admin approves them — show a clear message: *"Your account is pending admin approval"*

### 4.2 Dashboard (`screenshots/01-dashboard.png`)
The home page after login. Shows at-a-glance KPIs:
- **4 metric cards** at the top:
  - Total customers (active count)
  - Reminders due (next 48h)
  - Money received this month
  - Money given this month
- **Reminders preview** — top 5 customers due soon, each as a small card with name, due date, "Send WhatsApp" button
- **Recent payments list** — last 6 payment entries with type badge (received/given), amount, customer name
- **Approval requests panel** (admin only) — pending employee signups with Approve / Reject buttons

### 4.3 Customers list (`screenshots/02-customers.png`)
Searchable, sortable table:
- Columns: Name (with avatar initial), Phone, Medicines (comma-separated), Next due date, Status badge (Due today / Tomorrow / In N days / N days overdue / —)
- Search bar (live filter on name + phone)
- Filter chips: All / Due this week / Overdue
- "Add customer" button (top right) opens the customer form modal
- Click any row → Customer detail page
- An "Ignored" pill appears next to the name if `reminderIgnored: true`

### 4.4 Customer detail (`screenshots/09-customer-detail.png`)
Full profile view:
- Header: avatar, name, contact info, "Edit profile" + "Update due date" buttons (admin only)
- "Ignored from reminders" badge in header if applicable
- 3-card row: Contact info / Medicine list / Refill schedule (next due date, days until due)
- Recent payments table for this customer
- "Record payment" button opens payment modal

### 4.5 Reminders (`screenshots/03-reminders.png`)
**The most important page in the app.** Shows all customers with `nextDueDate` within next 48 hours (specifically: −1 to +2 days from today).

Each customer = one card with:
- Avatar + name + phone
- Due-status badge (Due today / Tomorrow / Overdue Nd)
- **Highlighted medicines section** — small "MEDICINES" eyebrow label, then prominent brand-tinted pills (medium font weight, 28px tall) for each medicine
- **Footer row:**
  - Left: "Auto-sent · 10:42 AM" (muted green) if auto-send fired this cycle, else "Due · [date]". Shows "Unreachable · no phone" (red) if customer has no phone
  - Right: "Send WhatsApp" button (green primary) OR "Resend" (secondary) if already auto-sent. Plus a **split button** for "Mark complete | ▼" with dropdown menu containing:
    - Mark complete (default) — opens a modal: pick next due date (default = today + 30d) + optional "Send thank-you" checkbox
    - Ignore — silently removes customer from reminders list, sets `reminderIgnored: true`
- **Auto-send banner** at top of page (green): "First-time reminder auto-sent to N customers · [names] · sent at HH:MM" — shown when one or more customers were just auto-sent

**Auto-send logic** (critical — see Section 7):
- Every customer with due date in next 48h, who has phone + medicines, and `autoReminderSentForCycle !== true` → automatically gets a reminder WhatsApp message sent
- Sets `autoReminderSentForCycle: true` and `autoReminderSentAt: <ISO timestamp>`
- The flag is cleared (back to `false`) the moment `nextDueDate` changes (Mark complete, Update due date, or Edit profile with date change)
- This means: each refill cycle, exactly ONE auto-send fires. Subsequent sends in the same cycle are manual ("Resend" button)

### 4.6 Payments (`screenshots/04-payments.png`)
- 2 KPI cards: total received this month, total given this month
- Tabs: All / Received / Given
- Searchable payments table: date, customer name, type badge, amount (green for received, red for given), notes, delete button (admin only)
- "Record payment" button opens payment modal

### 4.7 Employees (`screenshots/05-employees.png`) — admin only
- **Pending approvals section** at top — each request = card with name, email, phone, "Approve" / "Reject" buttons
- **Active employees table** — name, email, phone, role, last active, status badge, remove button
- "Add employee" button → modal with name/email/phone/role fields (creates a pre-approved employee directly)

### 4.8 Activity log (`screenshots/06-activity.png`) — admin only
Append-only audit log:
- Each entry: timestamp, actor (employee name + role), action description, target customer/employee
- Filter by actor or action type
- Examples: "Aditi Sharma marked Rajesh Kumar as complete · 2h ago", "Rohan Mehta added customer Priya Singh", "System auto-sent reminder to Amit Patel"

### 4.9 Medicines catalog (`screenshots/07-medicines.png`) — admin only
- Searchable table of medicines: name, category, in-stock toggle, last updated
- "Add medicine" button → modal with name + category fields
- Used as autocomplete source when adding/editing customers

### 4.10 Settings (`screenshots/08-settings.png`) — admin only
- Pharmacy name, address, phone (used in WhatsApp template signoff)
- Default refill cycle (in days, default 30)
- WhatsApp templates editor (reminder + thank-you) — preview shown
- WhatsApp Business API credentials (masked)
- Reminder auto-send time (default 10:00 AM)

---

## 5. Data Model (MongoDB / Mongoose)

See `DATABASE.md` for full Mongoose schemas. High-level:

### `User` collection
```ts
{
  _id: ObjectId,
  name: string,
  email: string (unique),
  phone: string,
  passwordHash: string,
  role: 'admin' | 'employee',
  status: 'pending' | 'active' | 'rejected',
  lastActive: Date,
  createdAt: Date,
  updatedAt: Date,
}
```

### `Customer` collection
```ts
{
  _id: ObjectId,
  name: string,
  phone: string,
  altPhone?: string,
  notes?: string,
  medicines: [{ medicineName: string, dosage?: string }],
  nextDueDate: Date,
  isActive: boolean,                    // soft-delete flag
  reminderIgnored: boolean,             // hide from reminders list
  autoReminderSentForCycle: boolean,    // auto-send fired this cycle
  autoReminderSentAt?: Date,
  createdBy: ObjectId (User),
  createdAt: Date,
  updatedAt: Date,
}
```

### `Payment` collection
```ts
{
  _id: ObjectId,
  customerId: ObjectId (Customer),
  type: 'received' | 'given',
  amount: number (paise/cents — store as int),
  date: Date,
  notes?: string,
  recordedBy: ObjectId (User),
  createdAt: Date,
}
```

### `Medicine` collection
```ts
{
  _id: ObjectId,
  name: string (unique),
  category?: string,
  inStock: boolean,
  createdAt: Date,
  updatedAt: Date,
}
```

### `ActivityLog` collection
```ts
{
  _id: ObjectId,
  actorId: ObjectId (User) | null,    // null for system actions
  actorName: string,                  // denormalized snapshot
  action: string,                     // e.g. 'customer.create', 'reminder.auto_sent', 'reminder.complete'
  targetType?: 'customer' | 'employee' | 'payment' | 'medicine',
  targetId?: ObjectId,
  targetName?: string,                // denormalized snapshot
  metadata?: object,                  // action-specific extras
  createdAt: Date,
}
```

### `Settings` collection (single document)
```ts
{
  _id: 'settings',
  pharmacyName: string,
  pharmacyAddress: string,
  pharmacyPhone: string,
  defaultRefillCycleDays: number,
  reminderAutoSendTime: string,        // 'HH:MM' format
  whatsappTemplateReminder: string,    // with {{name}} {{medicines}} {{dueDate}} placeholders
  whatsappTemplateThankYou: string,
  whatsappCredentials: {
    accessToken: string,
    phoneNumberId: string,
    businessAccountId: string,
    apiVersion: string,                // e.g. 'v21.0'
  },
}
```

---

## 6. REST API Contract

See `API.md` for full endpoint list. High-level groups:

- `/api/auth/*` — login, signup, refresh, logout, me
- `/api/customers/*` — CRUD + search + due-date update + ignore/unignore
- `/api/reminders/*` — list (next 48h), mark complete, send (manual)
- `/api/payments/*` — CRUD + filter
- `/api/employees/*` — list, approve, reject, add, remove
- `/api/medicines/*` — CRUD + search (autocomplete)
- `/api/activity/*` — list with filters
- `/api/settings/*` — get + update
- `/api/dashboard/summary` — combined KPIs for dashboard

All routes (except `/auth/login`, `/auth/signup`) require a valid JWT in the `Authorization: Bearer <token>` header. Admin-only routes additionally check `role === 'admin'`.

---

## 7. The Auto-Send WhatsApp System (most important behavior)

This is the core value of the app. Two trigger paths:

### Path A — Daily cron job (primary)
- A `node-cron` job runs every day at the time configured in Settings (default 10:00 AM, server timezone)
- Query: `Customer.find({ isActive: true, reminderIgnored: false, autoReminderSentForCycle: { $ne: true }, nextDueDate: { $gte: now − 1d, $lte: now + 2d }, phone: { $ne: '' }, 'medicines.0': { $exists: true } })`
- For each match: call `sendWhatsAppReminder(customer)` → if successful, set `autoReminderSentForCycle: true`, `autoReminderSentAt: now`, write activity log entry `reminder.auto_sent`

### Path B — Real-time check on Reminders page load (secondary, defensive)
- When a user opens `/reminders`, the API endpoint that returns the list also runs the same check inline (limited to customers in the 48h window) — covers the case where a customer's due date was just updated and they entered the window between cron runs
- Same logic, same flag, same activity log

### The cycle reset
The `autoReminderSentForCycle` flag is **cleared** (set back to `false`) and `autoReminderSentAt` is set to `null` whenever any of these happen:
- `PATCH /api/customers/:id/due-date` (manual update)
- `POST /api/reminders/:customerId/complete` (mark complete)
- `PUT /api/customers/:id` (edit profile) **only if** `nextDueDate` changed in the request

This guarantees: **exactly one auto-send per refill cycle, ever**. Subsequent reminders in the same cycle are manual via the "Resend" button.

### WhatsApp template (configurable in Settings)
Default reminder template:
```
Hello {{name}}, this is a reminder from {{pharmacyName}} — your medicine refill ({{medicines}}) is due on {{dueDate}}. Please visit us to collect your prescription. Thank you.
```

Default thank-you template (sent optionally on Mark complete):
```
Thank you for visiting {{pharmacyName}}, {{name}}. Your next refill ({{medicines}}) is scheduled for {{nextDueDate}}. See you then!
```

Placeholders are substituted server-side before calling Meta's API.

### Mocking the WhatsApp API initially
While `WHATSAPP_API_MOCK=true` (env var):
- Skip the actual Meta API call
- Log a fake "send" line: `[MOCK WA] → +91xxxx — "<rendered message>"`
- Pretend the send succeeded (return 200) and proceed with flag-setting + activity log
- This lets the developer build the entire flow without Meta credentials

When the user obtains real credentials, they flip `WHATSAPP_API_MOCK=false` and the real client kicks in. See `WHATSAPP_SETUP.md` for the full guide.

---

## 8. Design Tokens

Lift these EXACTLY into your Tailwind config / CSS variables. They're already in `design-source/PharmaCare.html` inside `<style>` — copy them.

### Colors (OKLCH)
```css
--brand:       oklch(0.55 0.13 200);   /* teal — primary actions */
--brand-50:    oklch(0.97 0.025 200);
--brand-100:   oklch(0.92 0.05 200);
--brand-700:   oklch(0.46 0.13 200);
--brand-800:   oklch(0.40 0.12 200);
--ink:         oklch(0.20 0.02 250);   /* primary text */
--ink-2:       oklch(0.40 0.02 250);   /* secondary text */
--muted:       oklch(0.55 0.015 250);  /* tertiary / labels */
--bg:          oklch(0.985 0.005 250); /* page background */
--bg-soft:     oklch(0.965 0.008 250); /* hover, alt rows */
--border:      oklch(0.91 0.008 250);
--success:     oklch(0.62 0.14 155);
--success-ink: oklch(0.40 0.14 155);
--warning:     oklch(0.78 0.13 65);
--warning-ink: oklch(0.46 0.12 65);
--danger:      oklch(0.62 0.18 25);
--danger-ink:  oklch(0.45 0.16 25);
```

### Typography
- Font family: **Inter** (from Google Fonts), fallback to system UI sans
- Sizes used: 10/10.5/11/11.5/12/12.5/13/14/15/16/18/22 px
- Weights: 400 (regular), 500 (medium), 600 (semibold)
- Tabular numerals (`tabular-nums`) on all numeric columns and dates

### Spacing & radius
- Standard Tailwind scale (4px increments)
- Radius: 6 (`rounded-md`), 8 (`rounded-lg`), full pills for badges
- Sidebar width: 240px expanded, 64px collapsed

### Shadows
- Cards: `border` only (no shadow)
- Modals: standard Tailwind `shadow-xl`
- Dropdowns: `shadow-lg`

### Iconography
- Icon component is a small inline-SVG factory (see `design-source/ui.jsx` line 1–60)
- All icons drawn with `stroke="currentColor"`, `stroke-width="1.6"`, `fill="none"`
- Use lucide-react in production — every icon name in the prototype maps directly to a lucide name (e.g. `bell` → `Bell`, `check` → `Check`, `chevD` → `ChevronDown`)

---

## 9. Critical Interactions to Preserve Exactly

1. **Reminders page split-button** — main click = Mark complete; chevron click = dropdown with Mark complete + Ignore. Outside-click closes the dropdown.
2. **Customer search** — live (debounce 200ms recommended), filters on name + phone, case-insensitive
3. **Soft-delete** — customers and employees never hard-delete; they get `isActive: false`. Lists hide them. History (payments, activity) keeps the reference.
4. **Toast notifications** — success/error toasts at bottom-right, auto-dismiss after 3s, dismissible by click
5. **Modal escape behavior** — Esc closes any open modal; click on backdrop also closes
6. **Auto-send banner** — appears on Reminders page after auto-send fires; stays visible (not dismissible — design choice, confirmed with user)
7. **First user = admin** — signup logic checks `User.countDocuments() === 0` → if true, role = admin, status = active. Otherwise role = employee, status = pending.
8. **Currency formatting** — all amounts display as `₹XX,XXX` (Indian numbering: 1,00,000 not 100,000). Use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
9. **Date formatting** — full dates as "12 Jan 2025", short as "12 Jan", times as "10:42 AM". Use Intl.DateTimeFormat with `en-IN` locale.

---

## 10. Files in This Bundle

```
design_handoff_pharmacare/
├── README.md                  ← you are here
├── DATABASE.md                ← Mongoose schemas + indexes
├── API.md                     ← REST endpoint contract
├── DOCKER.md                  ← Docker setup, compose, env vars
├── WHATSAPP_SETUP.md          ← How to obtain & configure Meta credentials
├── design-source/
│   ├── PharmaCare.html        ← Single-file React prototype (open in browser)
│   ├── app.jsx                ← App shell + sidebar + topbar + login
│   ├── pages-1.jsx            ← Dashboard, Customers list, Customer form
│   ├── pages-2.jsx            ← Customer detail, Reminders, Payments, Employees, Activity, Settings, Medicines
│   ├── ui.jsx                 ← Shared UI primitives (Button, Modal, Badge, Icon, etc.)
│   ├── data.jsx               ← Seed/mock data (use as inspiration for seed scripts)
│   └── tweaks-panel.jsx       ← (ignore — design-only Tweaks UI)
└── screenshots/               ← Reference screenshots of every screen
    ├── 01-dashboard.png
    ├── 02-customers.png
    ├── 03-reminders.png
    ├── 04-payments.png
    ├── 05-employees.png
    ├── 06-activity.png
    ├── 07-medicines.png
    ├── 08-settings.png
    ├── 09-customer-detail.png
    └── 10-login.png
```

---

## 11. Implementation Plan (suggested order)

1. **Repo scaffolding** — monorepo with `apps/web` (Next.js), `apps/api` (Express), `packages/shared` (types) — or two separate folders, your choice
2. **Docker compose** — get web + api + mongo running locally with `docker compose up`
3. **MongoDB schemas** — define all 6 Mongoose models, write seed script
4. **Auth** — JWT login/signup/refresh, password hashing (bcrypt), JWT middleware, role middleware
5. **Customer + Medicine + Payment CRUD** — full backend
6. **Frontend shell** — sidebar, topbar, layout, theme tokens, base components (Button, Modal, Badge, Icon, Input, Select)
7. **Dashboard + Customers list + Customer detail** — read-only first
8. **Customer form (add/edit)** — with medicine autocomplete
9. **Reminders page** — display logic + Mark complete + Ignore + manual send
10. **Payments page**
11. **Employees + activity log + Settings + Medicines catalog** (admin-only screens)
12. **WhatsApp mock client** — implement the interface, log to console
13. **Cron job** — daily auto-send at 10 AM
14. **Real WhatsApp API** — once mock works end-to-end, swap in real Meta client

---

## 12. Open Questions for the Developer

If anything in this spec is unclear, refer to the source HTML in `design-source/PharmaCare.html` — open it in a browser; it's a fully working interactive prototype. When in doubt, **the prototype is the source of truth.**

---

## 13. Out of Scope (do not build in v1)

- SMS / email reminders (WhatsApp only)
- Multi-pharmacy / multi-tenant (single pharmacy per deployment)
- Customer-facing portal (staff-only app)
- Inventory tracking / stock counts
- Billing / invoicing / GST
- Prescription image uploads
- Mobile app (web responsive is enough)

These can be v2 features later.
