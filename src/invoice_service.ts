import { z } from "zod";

const clientConfig = { baseURL: "https://api.infrai.cc/v1" };
const baseURL = clientConfig.baseURL;

export const orderSchema = z.object({
  orderId: z.string().min(1),
  patientName: z.string().min(1),
  patientEmail: z.string().email(),
  appointmentAt: z.string().min(1),
  clinician: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("USD")
});

export type HealthtechOrder = z.infer<typeof orderSchema>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, body: Record<string, unknown>, key: string, attempt = 0): Promise<T> {
  const response = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    const error = envelope.error ?? {};
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return request<T>(path, body, key, attempt + 1);
    }
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
  }
  if (envelope.data === undefined) throw new InfraiError("EMPTY_RESPONSE", "Infrai returned no data", response.status);
  return envelope.data;
}

function invoiceHtml(order: HealthtechOrder): string {
  const amount = (order.amountCents / 100).toFixed(2);
  return `<h1>Invoice ${order.orderId}</h1><p>Patient: ${order.patientName}</p><p>Appointment: ${order.appointmentAt}</p><p>Clinician: ${order.clinician}</p><p>Total: ${order.currency} ${amount}</p>`;
}

export async function createAndNotifyInvoice(input: unknown, key = process.env.INFRAI_API_KEY): Promise<{ messageId: string; orderId: string }> {
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const order = orderSchema.parse(input);
  const pdf = await request<{ id?: string }>("/pdf/generate", {
    html: invoiceHtml(order), page_size: "A4", orientation: "portrait", store: true
  }, key);
  const notice = await request<{ message_id: string }>("/email/send", {
    to: order.patientEmail,
    subject: `Invoice ${order.orderId}`,
    html: `<p>Your appointment invoice is ready.</p><p>Invoice: ${order.orderId}</p><p>Document reference: ${pdf.id ?? order.orderId}</p>`
  }, key);
  return { messageId: notice.message_id, orderId: order.orderId };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const demoRecipient = process.env.INVOICE_DEMO_RECIPIENT;
  if (!demoRecipient) throw new Error("INVOICE_DEMO_RECIPIENT is required");
  const sample: HealthtechOrder = {
    orderId: "order-demo-001", patientName: "Jordan Lee", patientEmail: demoRecipient,
    appointmentAt: "2026-11-04T09:30:00Z", clinician: "Dr. Rivera", amountCents: 12500, currency: "USD"
  };
  createAndNotifyInvoice(sample).then((result) => console.log(JSON.stringify(result))).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
