/**
 * REFUNDS – rules shared by the admin refund button and the Stripe webhook.
 *
 * Refunds always go through Stripe, back to the customer's original payment
 * method. Each one is kept in its own record (public.refunds); the original
 * payment record is never changed or deleted.
 */
export const REFUND_STATUSES = ["pending", "requires_action", "succeeded", "failed", "canceled"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** Refunds that count against what can still be refunded (not failed or cancelled). */
export function isActiveRefund(status: string): boolean {
  return status === "pending" || status === "requires_action" || status === "succeeded";
}

export function refundStatus(status: string | null | undefined): RefundStatus {
  return (REFUND_STATUSES as readonly string[]).includes(status ?? "") ? (status as RefundStatus) : "pending";
}

export function refundablePence(paidPence: number, refunds: { amount_pence: number; status: string }[]): number {
  const used = refunds.filter((r) => isActiveRefund(r.status)).reduce((sum, r) => sum + r.amount_pence, 0);
  return Math.max(0, paidPence - used);
}

export type RefundCheck = { ok: true; amountPence: number } | { ok: false; message: string };

/** Validates an admin refund request. Amounts are whole pence. */
export function checkRefundRequest(input: { paid: boolean; paidPence: number | null; refunds: { amount_pence: number; status: string }[]; amountPence: number | null; note: string }): RefundCheck {
  if (!input.paid || !input.paidPence) return { ok: false, message: "There is no Stripe payment on this booking to refund." };
  const remaining = refundablePence(input.paidPence, input.refunds);
  if (remaining <= 0) return { ok: false, message: "This payment has already been refunded in full." };
  if (input.amountPence === null || !Number.isInteger(input.amountPence) || input.amountPence <= 0) return { ok: false, message: "Please enter a valid refund amount, e.g. 375.50." };
  if (input.amountPence > remaining) return { ok: false, message: `You can refund at most the amount not yet refunded (£${(remaining / 100).toFixed(2)}).` };
  const note = input.note.trim();
  if (note.length < 3 || note.length > 500) return { ok: false, message: "Please note the reason for the refund (3–500 characters), e.g. 'Cancelled more than 48 hours before'." };
  return { ok: true, amountPence: input.amountPence };
}
