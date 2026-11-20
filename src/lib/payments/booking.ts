/**
 * Booking status rules and the decision made when Stripe reports a payment.
 * Pure functions – unit tested in booking.test.ts.
 */

export const BOOKING_STATUSES = [
  { id: "awaiting_consultation", label: "Awaiting phone consultation" },
  { id: "price_agreed", label: "Price agreed" },
  { id: "deposit_requested", label: "Payment requested" },
  { id: "deposit_paid", label: "Payment received" },
  { id: "booking_confirmed", label: "Booking confirmed" },
  { id: "work_completed", label: "Work completed" },
  { id: "balance_paid", label: "Balance paid" },
  { id: "declined", label: "Customer declined" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number]["id"];

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** Statuses that require a verified deposit. */
export const PAID_STATUSES: BookingStatus[] = ["deposit_paid", "booking_confirmed", "work_completed", "balance_paid"];

/**
 * Which statuses the admin may choose from the status menu.
 * "Price agreed" and "Deposit requested" are set by their own buttons (so a
 * price and payment link always exist), and "Deposit paid" is ONLY ever set by
 * the verified Stripe webhook.
 */
export function manualStatusOptions(b: { status: string; depositPaid: boolean }): BookingStatus[] {
  const options = new Set<BookingStatus>([b.status as BookingStatus]);
  if (b.depositPaid) {
    options.add("booking_confirmed");
    options.add("work_completed");
    options.add("balance_paid");
    options.add("cancelled");
  } else {
    options.add("awaiting_consultation");
    options.add("declined");
    options.add("cancelled");
  }
  return BOOKING_STATUSES.map((s) => s.id).filter((id) => options.has(id));
}

export function canSetStatusManually(target: string, b: { status: string; depositPaid: boolean }): boolean {
  if (target === b.status) return true;
  return manualStatusOptions(b).includes(target as BookingStatus);
}

export interface EnquiryPaymentState {
  id: string;
  status: string;
  depositPence: number | null;
  depositPaidAt: string | null;
  stripePaymentIntentId: string | null;
}

export interface StripePaymentReport {
  amountPence: number;
  currency: string;
  paymentIntentId: string;
}

export type DepositDecision =
  | { action: "mark_paid" }
  | { action: "already_recorded" }
  | { action: "refund_duplicate"; reason: string }
  | { action: "needs_review"; reason: string };

/**
 * Decides what to do when Stripe tells us (via a VERIFIED webhook) that a
 * deposit payment succeeded.
 */
export function decideDepositOutcome(enquiry: EnquiryPaymentState | null, payment: StripePaymentReport): DepositDecision {
  if (!enquiry) return { action: "needs_review", reason: "Payment could not be matched to an enquiry" };
  if (enquiry.stripePaymentIntentId === payment.paymentIntentId) return { action: "already_recorded" };
  if (enquiry.depositPaidAt) return { action: "refund_duplicate", reason: "A deposit had already been paid for this booking" };
  if (payment.currency.toLowerCase() !== "gbp") return { action: "needs_review", reason: `Unexpected currency ${payment.currency}` };
  if (enquiry.depositPence === null || payment.amountPence !== enquiry.depositPence) {
    return { action: "needs_review", reason: `Amount paid (${payment.amountPence}p) does not match the deposit due (${enquiry.depositPence ?? "none"}p)` };
  }
  if (enquiry.status !== "deposit_requested") return { action: "needs_review", reason: `Booking was "${bookingStatusLabel(enquiry.status)}" when the payment arrived` };
  return { action: "mark_paid" };
}
