import test from "node:test";
import assert from "node:assert/strict";
import { orderSchema } from "./invoice_service.ts";

test("an invoice order requires a patient-safe email and a non-negative amount", () => {
  const result = orderSchema.safeParse({
    orderId: "ord-7", patientName: "A. Patient", patientEmail: "patient@example.com",
    appointmentAt: "2026-11-04T09:30:00Z", clinician: "Dr. Rivera", amountCents: 12500
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.currency, "USD");
  assert.equal(orderSchema.safeParse({ orderId: "ord-7", patientName: "A", patientEmail: "wrong", appointmentAt: "now", clinician: "Dr", amountCents: -1 }).success, false);
});
