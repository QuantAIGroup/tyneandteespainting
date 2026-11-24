/**
 * REFUNDS – rules shared by the admin refund button and the Stripe webhook.
 *
 * Refunds always go through Stripe, back to the customer's original payment
 * method. Each one is kept in its own record (public.refunds); the original
 * payment record is never changed or deleted.
 */
/** Payment-log outcomes meaning "verified payment recorded" (the second is the historical label). */
export const RECORDED_PAYMENT_OUTCOMES: readonly string[] = ["payment_recorded", "deposit_recorded"];

export const REFUND_STATUSES = ["pending", "requires_action", "succeeded", "failed", "canceled"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/**
 * The only status changes Stripe makes to a refund, mirrored exactly by the
 * database (protect_refund_log). A refund can fail even after it succeeded.
 * Failed and cancelled are final.
 */
export const REFUND_STATUS_CHANGES: readonly string[] = [
  "pending>requires_action", "pending>succeeded", "pending>failed", "pending>canceled",
  "requires_action>pending", "requires_action>succeeded", "requires_action>failed", "requires_action>canceled",
  "succeeded>failed",
];

export function canChangeRefundStatus(from: string, to: string): boolean {
  return from === to || REFUND_STATUS_CHANGES.includes(`${from}>${to}`);
}

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

/**
 * What Stripe says about the ORIGINAL payment (a PaymentIntent with its
 * latest charge). A refund is only made if this matches the booking exactly.
 */
export type StripePaymentFacts = {
  status: string;
  amountReceived: number;
  currency: string;
  enquiryId: string | undefined;
  chargeAmount: number | null;
  chargeAmountRefunded: number | null;
};

export function checkOriginalPayment(
  facts: StripePaymentFacts,
  booking: { id: string; paidPence: number; loggedAmountPence: number | null; loggedCurrency: string | null },
): { ok: true; stripeRefundablePence: number } | { ok: false; message: string } {
  if (facts.status !== "succeeded") return { ok: false, message: `Stripe reports the original payment as "${facts.status}", not succeeded. No refund was made.` };
  if (facts.currency.toLowerCase() !== "gbp") return { ok: false, message: "The original payment is not in GBP. Please refund it in your Stripe dashboard." };
  if (facts.enquiryId !== booking.id) return { ok: false, message: "Stripe says this payment belongs to a different booking. No refund was made." };
  if (facts.amountReceived !== booking.paidPence) return { ok: false, message: "Stripe's payment amount doesn't match this booking's recorded payment. No refund was made." };
  if (booking.loggedAmountPence !== booking.paidPence || (booking.loggedCurrency ?? "").toLowerCase() !== "gbp") {
    return { ok: false, message: "The payment log doesn't match this booking's payment. Please check before refunding." };
  }
  const charged = facts.chargeAmount ?? facts.amountReceived;
  const stripeRefundablePence = Math.max(0, charged - (facts.chargeAmountRefunded ?? 0));
  return { ok: true, stripeRefundablePence };
}
