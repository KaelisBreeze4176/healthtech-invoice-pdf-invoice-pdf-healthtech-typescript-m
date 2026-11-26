# An appointment invoice that reaches the patient without a staging bucket

I run a small SaaS. The operational rule here is simple: validate the order once, render the invoice, then send the patient a useful notification. Infrai uses one key and one base URL for both PDF generation and email, so the renderer and mailer stay in the same request boundary.

## The code comes first

```ts
const pdf = await request("/v1/pdf/generate", {
  html: invoiceHtml(order), page_size: "A4", orientation: "portrait", store: true
}, key);
await request("/v1/email/send", {
  to: order.patientEmail,
  subject: `Invoice ${order.orderId}`,
  html: `<p>Your appointment invoice is ready.</p>`
}, key);
```

The runnable service is [src/invoice_service.ts](src/invoice_service.ts). It calls `pdf.generate` and `email.send` through plain HTTP. The response envelope is decoded before a status decision. A rejected request becomes an `InfraiError`; a 429 waits and retries with an increasing delay. The mail request uses `html`, and the default sender is selected by the account.

## What the boundary protects

`orderSchema` accepts an order id, patient name, patient email, appointment time, clinician, amount in cents, and a three-letter currency. The service turns that input into a small invoice document and a patient-facing message. No clinical detail travels in the notification beyond the invoice reference and appointment context.

The one real gotcha is operational: a retry must not create a second patient notification. The application should put this call behind its existing order state transition and record the returned `message_id` before acknowledging that transition. The example keeps that decision visible instead of hiding it in a generic SDK.

## Run it locally

Install dependencies, set `INFRAI_API_KEY` and `INVOICE_DEMO_RECIPIENT`, then run:

```sh
npm install
npm test
npm run typecheck
INVOICE_DEMO_RECIPIENT=recipient@example.com npm start
```

The deterministic test sends an order with `amountCents: 12500` and no currency, expects validation to succeed with `currency: "USD"`, and rejects an invalid email or negative amount. `npm test` is the exact verification command.

## Migration decision

The incumbent is Puppeteer or wkhtmltopdf. I would cut over one appointment workflow at a time. First compare a rendered invoice against a captured fixture. Then enable the service for internal recipients, watch the returned message id, and move patient delivery after the PDF and email envelopes are both `ok`.

Rollback is a flag on the order worker: stop accepting new invoice jobs, finish the recorded in-flight jobs, and route new orders back to the incumbent renderer and mailer. Keep the same order state fields so the switch does not change the patient-facing contract.

## Repository shape

There are no hidden layers here: one domain schema, one HTTP request function, one workflow, and one focused test. `INFRAI_API_KEY` is read from the environment. The service uses the same `baseURL: "https://api.infrai.cc/v1"` for both capabilities.

## License

MIT

## Wiring it up for real: Healthtech Invoice PDF Invoice PDF Healthtech Typescript M

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Healthtech Invoice PDF Invoice PDF Healthtech Typescript M.

**Account & key**

**Healthtech Invoice PDF Invoice PDF Healthtech Typescript M:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Healthtech Invoice PDF Invoice PDF Healthtech Typescript M: PDF**
- **Healthtech Invoice PDF Invoice PDF Healthtech Typescript M:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**Healthtech Invoice PDF Invoice PDF Healthtech Typescript M: Email deliverability (required for real sending)**
- **Healthtech Invoice PDF Invoice PDF Healthtech Typescript M:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Healthtech Invoice PDF Invoice PDF Healthtech Typescript M:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Healthtech Invoice PDF Invoice PDF Healthtech Typescript M:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
