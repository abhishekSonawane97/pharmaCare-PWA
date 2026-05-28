# WhatsApp Business Cloud API — Setup Guide

This is a **manual setup guide** for the pharmacy owner / developer to follow once you're ready to send real WhatsApp messages. Until you complete these steps, keep `WHATSAPP_API_MOCK=true` in your `.env` — the app will run normally and log fake sends to the console.

---

## What you'll get

A WhatsApp Business account that can send template-based messages to customers from your own business phone number, integrated automatically with PharmaCare.

**Cost:** Meta charges per "conversation" — roughly ₹0.30–₹0.80 per reminder message in India (rates vary; check Meta's current pricing). The first 1000 utility-category conversations per month are free.

---

## Step-by-step

### 1. Create a Meta Business account
- Go to <https://business.facebook.com/> and sign up with your business email
- Add basic info about your pharmacy (legal name, address, phone, website if any)

### 2. Add WhatsApp to your Meta Business
- Inside Business Manager, go to **Settings** → **WhatsApp Accounts** → **Add**
- Create a new WhatsApp Business Account (WABA)
- You'll be asked to verify a **business phone number** that customers will see as the sender — this must be a number that does NOT already have WhatsApp installed (or you'll need to delete WhatsApp from it first). A landline works.

### 3. Get your credentials from Meta Developer Console
- Go to <https://developers.facebook.com/apps/> and create a new app (type: Business)
- Add the **WhatsApp** product to your app
- In the WhatsApp → API Setup panel, you'll see:
  - **Phone Number ID** → copy as `WHATSAPP_PHONE_NUMBER_ID`
  - **WhatsApp Business Account ID** → copy as `WHATSAPP_BUSINESS_ACCOUNT_ID`
  - **Temporary access token** (24h) → use this initially as `WHATSAPP_ACCESS_TOKEN`

### 4. Generate a permanent access token (production)
The 24h token won't last. For production:
- In Business Manager → **System Users**, create a new system user named "PharmaCare API"
- Give it admin access to your WABA and your Meta App
- Generate a token with scopes: `whatsapp_business_messaging`, `whatsapp_business_management`
- Set token expiry to "Never" (System User tokens can be permanent)
- Copy this token — that's your real `WHATSAPP_ACCESS_TOKEN`

### 5. Get your message templates approved
**Critical:** WhatsApp does NOT allow free-form business-initiated messages. Every reminder must use a pre-approved template.

In WhatsApp Manager → **Message Templates**, create two templates:

#### Template 1: `pharmacy_refill_reminder` (Category: UTILITY)
Body:
```
Hello {{1}}, this is a reminder from {{2}} — your medicine refill ({{3}}) is due on {{4}}. Please visit us to collect your prescription. Thank you.
```
- `{{1}}` = customer name
- `{{2}}` = pharmacy name
- `{{3}}` = medicine list (comma-separated)
- `{{4}}` = due date (formatted)

#### Template 2: `pharmacy_thank_you` (Category: UTILITY)
Body:
```
Thank you for visiting {{1}}, {{2}}. Your next refill ({{3}}) is scheduled for {{4}}. See you then!
```
- `{{1}}` = pharmacy name
- `{{2}}` = customer name
- `{{3}}` = medicine list
- `{{4}}` = next due date

Submit both for approval. UTILITY-category templates usually approve in 1-24 hours.

### 6. Configure PharmaCare

Once you have everything, edit your `.env` file:

```env
WHATSAPP_API_MOCK=false
WHATSAPP_ACCESS_TOKEN=EAAxxxxxx_your_permanent_token_xxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_API_VERSION=v21.0
```

Then restart:
```bash
docker compose restart api
```

In the PharmaCare Settings page (admin only), the credentials will also be visible (masked) and can be edited from the UI — but the env file is the source of truth at boot.

### 7. Test
- Add yourself as a customer with a real phone number and a due date set to today
- Open the Reminders page → you should see your name appear, get auto-sent immediately, and receive an actual WhatsApp message on your phone within seconds

---

## Implementation reference (for the developer)

The api service should expose a simple `WhatsAppClient` interface:

```ts
// apps/api/src/services/whatsapp.ts

interface SendArgs {
  to: string;                  // E.164 format, e.g. '+919876543210'
  templateName: string;        // 'pharmacy_refill_reminder' | 'pharmacy_thank_you'
  params: string[];            // ordered placeholder values for {{1}}, {{2}}, ...
}

interface WhatsAppClient {
  send(args: SendArgs): Promise<{ messageId: string }>;
}

// Mock implementation
class MockWhatsAppClient implements WhatsAppClient {
  async send(args: SendArgs) {
    console.log(`[MOCK WA] → ${args.to} · template=${args.templateName} · params=${JSON.stringify(args.params)}`);
    return { messageId: `mock_${Date.now()}` };
  }
}

// Real implementation (Meta Cloud API)
class MetaWhatsAppClient implements WhatsAppClient {
  constructor(private accessToken: string, private phoneNumberId: string, private apiVersion: string) {}

  async send(args: SendArgs) {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: args.to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: args.templateName,
        language: { code: 'en' },
        components: [{
          type: 'body',
          parameters: args.params.map(text => ({ type: 'text', text })),
        }],
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WhatsApp send failed: ${res.status} ${err}`);
    }
    const json = await res.json();
    return { messageId: json.messages?.[0]?.id ?? 'unknown' };
  }
}

// Factory based on env
export function createWhatsAppClient(): WhatsAppClient {
  if (process.env.WHATSAPP_API_MOCK === 'true' || !process.env.WHATSAPP_ACCESS_TOKEN) {
    return new MockWhatsAppClient();
  }
  return new MetaWhatsAppClient(
    process.env.WHATSAPP_ACCESS_TOKEN!,
    process.env.WHATSAPP_PHONE_NUMBER_ID!,
    process.env.WHATSAPP_API_VERSION ?? 'v21.0',
  );
}
```

The reminder service then calls:

```ts
const wa = createWhatsAppClient();
await wa.send({
  to: customer.phone,
  templateName: 'pharmacy_refill_reminder',
  params: [
    customer.name,
    settings.pharmacyName,
    customer.medicines.map(m => m.medicineName).join(', '),
    formatDate(customer.nextDueDate, 'en-IN'),
  ],
});
```

---

## Phone number format

Phone numbers must be in **E.164** (international format with `+` and country code, no spaces or dashes):
- ✅ `+919876543210`
- ❌ `9876543210`
- ❌ `+91 98765-43210`

The Express API should normalize phone numbers on customer create/update (strip non-digits except leading `+`, and prepend `+91` if no country code is provided).

---

## Troubleshooting

**Q: Auto-send fires but no message arrives.**
- Check api logs: `docker compose logs api | grep WA`
- If you see `[MOCK WA]`, you're still in mock mode — check `.env`
- If you see a real send but no message: check Meta's WhatsApp Manager → Message Logs for delivery status

**Q: Template not approved error.**
- Templates must be approved by Meta before use. Check WhatsApp Manager → Message Templates → Status

**Q: Rate limit (HTTP 429).**
- Meta enforces rate limits per phone number quality rating. Slow down or contact Meta support to upgrade your tier.

**Q: Customer says they got the message but didn't open it.**
- Meta charges per conversation, not per delivery. Both sent + read are billed the same.
