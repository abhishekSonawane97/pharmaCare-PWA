# API Contract — Express REST Endpoints

Base URL: `/api`. All non-auth routes require `Authorization: Bearer <jwt>` header.

Response format:
- Success: `{ data: <payload> }` with appropriate HTTP status
- Error: `{ error: { code: string, message: string } }` with 4xx/5xx status

---

## Authentication

### POST `/api/auth/signup`
**Public.** Create a new user account.

Body: `{ name, email, phone, password }`

Logic:
- If `User.countDocuments() === 0` → `role: 'admin', status: 'active'`
- Else → `role: 'employee', status: 'pending'`

Response 201: `{ data: { user: <without passwordHash>, accessToken?, refreshToken? } }` (tokens only if `status === 'active'`)

If pending, return user with status info but no tokens. Frontend shows "awaiting approval" screen.

---

### POST `/api/auth/login`
**Public.**

Body: `{ email, password }`

Errors:
- `401` if email not found or password mismatch
- `403` with code `pending` if user status is `pending`
- `403` with code `rejected` if rejected

Response 200: `{ data: { user, accessToken, refreshToken } }`

`accessToken` lifetime: 15 min. `refreshToken` lifetime: 7 days.

---

### POST `/api/auth/refresh`
**Public** (but requires valid refresh token).

Body: `{ refreshToken }`

Response 200: `{ data: { accessToken, refreshToken } }` (rotate both)

---

### POST `/api/auth/logout`
**Auth required.** Invalidate the user's refresh token (server-side blacklist or token version increment).

Response 204.

---

### GET `/api/auth/me`
**Auth required.** Returns the current user's profile.

Response 200: `{ data: { user } }`

---

## Customers

### GET `/api/customers`
**Auth required.**

Query params:
- `q` — search string (matches name + phone)
- `filter` — `all` | `due_this_week` | `overdue` (default `all`)
- `sort` — `name` | `due_date` (default `due_date`)
- `page`, `limit` — pagination (default 1, 50)

Response 200: `{ data: { customers: [...], total, page, limit } }`

Default filter: `isActive: true` — soft-deleted customers never returned (except via dedicated admin endpoint, not in v1).

---

### GET `/api/customers/:id`
**Auth required.**

Response 200: `{ data: { customer, recentPayments: [...up to 10] } }`

---

### POST `/api/customers`
**Auth required.**

Body: `{ name, phone, altPhone?, notes?, medicines: [{medicineName, dosage?}], nextDueDate }`

Side effects:
- Create activity log: `customer.create`

Response 201: `{ data: { customer } }`

---

### PUT `/api/customers/:id`
**Admin only.** Full update.

Body: same as POST.

Side effects:
- If `nextDueDate` changed: also reset `autoReminderSentForCycle: false`, `autoReminderSentAt: null`, `reminderIgnored: false`
- Activity log: `customer.update` (with metadata `{ changedFields: [...] }`)

Response 200: `{ data: { customer } }`

---

### PATCH `/api/customers/:id/due-date`
**Admin only.**

Body: `{ nextDueDate }`

Side effects:
- Reset `autoReminderSentForCycle: false`, `autoReminderSentAt: null`, `reminderIgnored: false`
- Activity log: `customer.due_date_update`

Response 200: `{ data: { customer } }`

---

### DELETE `/api/customers/:id`
**Admin only.** Soft-delete (sets `isActive: false`).

Side effects:
- Activity log: `customer.delete`

Response 200: `{ data: { customer } }`

---

### POST `/api/customers/:id/ignore`
**Admin only.** Set `reminderIgnored: true`.

Side effects:
- Activity log: `customer.ignore`

Response 200: `{ data: { customer } }`

---

### POST `/api/customers/:id/unignore`
**Admin only.** Set `reminderIgnored: false`.

Side effects:
- Activity log: `customer.unignore`

Response 200: `{ data: { customer } }`

---

## Reminders

### GET `/api/reminders`
**Auth required.**

Returns customers due in the next 48 hours (specifically: `−1d ≤ nextDueDate ≤ +2d` from start-of-today).

Server-side: this endpoint also runs the auto-send check inline before returning. Any customer in the window without `autoReminderSentForCycle` (and with phone + medicines) gets the WhatsApp send dispatched + flag set.

Filter: `isActive: true, reminderIgnored: false`.

Response 200: `{ data: { reminders: [...customers...], autoSentNow: [<array of customer names just sent>] } }`

The frontend uses `autoSentNow` to show the green "Auto-sent to N customers" banner.

---

### POST `/api/reminders/:customerId/complete`
**Admin only.** Mark a customer's refill as completed.

Body: `{ nextDueDate, sendThankYou: boolean }`

Side effects:
- Update customer: `nextDueDate = body.nextDueDate`, reset `autoReminderSentForCycle: false`, `autoReminderSentAt: null`, `reminderIgnored: false`
- If `sendThankYou`: dispatch thank-you WhatsApp message
- Activity log: `reminder.complete`

Response 200: `{ data: { customer } }`

---

### POST `/api/reminders/:customerId/send`
**Auth required.** Manually send (or resend) a reminder WhatsApp message.

Side effects:
- Dispatch WhatsApp send
- Does NOT change `autoReminderSentForCycle` flag (it's specifically for auto-sends)
- Activity log: `reminder.manual_sent`

Response 200: `{ data: { sent: true, sentAt } }`

---

## Payments

### GET `/api/payments`
**Auth required.**

Query: `q`, `type` (`all`/`received`/`given`), `customerId?`, `from?`, `to?`, `page`, `limit`

Response 200: `{ data: { payments, total, summary: { received, given } } }`

---

### POST `/api/payments`
**Auth required.**

Body: `{ customerId, type, amount, date, notes? }`

Activity log: `payment.create`

Response 201: `{ data: { payment } }`

---

### DELETE `/api/payments/:id`
**Admin only.**

Activity log: `payment.delete`

Response 204.

---

## Employees

### GET `/api/employees`
**Admin only.**

Response 200: `{ data: { active: [...], pending: [...] } }`

---

### POST `/api/employees`
**Admin only.** Create a pre-approved employee directly.

Body: `{ name, email, phone, password, role }`

Side effects:
- `status: 'active'` immediately (skips approval)
- Activity log: `auth.approved`

Response 201: `{ data: { user } }`

---

### POST `/api/employees/:id/approve`
**Admin only.** Approve a pending signup.

Side effects:
- Set `status: 'active'`
- Activity log: `auth.approved`

Response 200: `{ data: { user } }`

---

### POST `/api/employees/:id/reject`
**Admin only.** Reject a pending signup.

Side effects:
- Set `status: 'rejected'`
- Activity log: `auth.rejected`

Response 200: `{ data: { user } }`

---

### DELETE `/api/employees/:id`
**Admin only.** Remove an employee. Soft-delete via `status: 'rejected'` (or hard-delete — implementer's call, but soft is safer).

Activity log: `auth.removed`

Response 204.

---

## Medicines

### GET `/api/medicines`
**Auth required.**

Query: `q` (search), `inStock?` (boolean filter)

Response 200: `{ data: { medicines: [...] } }`

Used both for the catalog page and as autocomplete source on customer forms.

---

### POST `/api/medicines`
**Admin only.**

Body: `{ name, category?, inStock? }`

Activity log: `medicine.create`

Response 201: `{ data: { medicine } }`

---

### PUT `/api/medicines/:id`
**Admin only.**

Body: partial update.

Activity log: `medicine.update`

Response 200: `{ data: { medicine } }`

---

### DELETE `/api/medicines/:id`
**Admin only.** Hard delete is fine here (catalog item, no historical reference).

Activity log: `medicine.delete`

Response 204.

---

## Activity Log

### GET `/api/activity`
**Admin only.**

Query: `actorId?`, `action?`, `from?`, `to?`, `page`, `limit` (default 50)

Response 200: `{ data: { activities, total, page, limit } }`

Sorted by `createdAt` descending.

---

## Settings

### GET `/api/settings`
**Admin only.**

Response 200: `{ data: { settings } }`

WhatsApp credentials should be returned masked: only show last 4 chars of access token.

---

### PUT `/api/settings`
**Admin only.**

Body: partial update of settings.

Side effects:
- If `reminderAutoSendTime` changed → reschedule the cron job
- Activity log: `settings.update`

Response 200: `{ data: { settings } }`

---

## Dashboard

### GET `/api/dashboard/summary`
**Auth required.** Combined KPIs for the dashboard page.

Response 200:
```json
{
  "data": {
    "kpis": {
      "totalCustomers": 0,
      "remindersDue": 0,
      "moneyReceivedThisMonth": 0,
      "moneyGivenThisMonth": 0
    },
    "remindersPreview": [...up to 5 customers with nextDueDate in next 48h],
    "recentPayments": [...up to 6],
    "pendingEmployeeRequests": [...if admin]
  }
}
```

---

## Middleware Stack

1. CORS — allow the Next.js origin
2. JSON body parser (limit 100kb)
3. Request logger (morgan or pino)
4. JWT verifier (skip for `/auth/login`, `/auth/signup`, `/auth/refresh`, `/health`)
5. Role guard (per-route, `requireAdmin` for admin-only)
6. Error handler — translates thrown errors to standard `{ error: { code, message } }` shape

---

## Error Codes (suggested)

| Code | HTTP | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing/invalid JWT |
| `forbidden` | 403 | Logged in but not allowed (wrong role) |
| `pending` | 403 | Account awaiting approval |
| `rejected` | 403 | Account rejected |
| `not_found` | 404 | Resource doesn't exist |
| `validation_error` | 400 | Body/query failed schema validation |
| `conflict` | 409 | Duplicate (e.g. email already exists) |
| `whatsapp_failed` | 502 | Meta API returned an error |
| `internal` | 500 | Anything else |

---

## Health Check

### GET `/api/health`
**Public.** Returns `{ status: 'ok', uptime, mongoConnected }`. Useful for Docker healthchecks.
