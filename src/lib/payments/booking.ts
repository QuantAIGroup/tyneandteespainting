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

/**
 * Status after a VERIFIED Stripe payment. Full payment confirms the booking
 * straight away; an older part-payment (deposit) is "Payment received" and
 * the booking is confirmed by hand.
 */
export function statusAfterVerifiedPayment(paymentType: string | null | undefined): BookingStatus {
  return paymentType === "full" ? "booking_confirmed" : "deposit_paid";
}

/** Statuses that require a verified deposit. */
export const PAID_STATUSES: BookingStatus[] = ["deposit_paid", "booking_confirmed", "work_completed", "balance_paid"];

/**
 * Which statuses the admin may choose from the status menu.
 * "Price agreed" and "Deposit requested" are set by their own buttons (so a
 * price and payment link always exist), and "Deposit paid" is ONLY ever set by
 * the verified Stripe webhook.
 */
export function manualStatusOptions(b: { status: string; depositPaid: boolean; balanceDue?: boolean }): BookingStatus[] {
  const options = new Set<BookingStatus>([b.status as BookingStatus]);
  if (b.depositPaid) {
    options.add("booking_confirmed");
    options.add("work_completed");
    // "Balance paid" only makes sense if something is still owed (older deposit bookings)
    if (b.balanceDue !== false) options.add("balance_paid");
    options.add("cancelled");
  } else {
    options.add("awaiting_consultation");
    options.add("declined");
    options.add("cancelled");
  }
  return BOOKING_STATUSES.map((s) => s.id).filter((id) => options.has(id));
}

export function canSetStatusManually(target: string, b: { status: string; depositPaid: boolean; balanceDue?: boolean }): boolean {
  if (target === b.status) return true;
  return manualStatusOptions(b).includes(target as BookingStatus);
}

export interface EnquiryPaymentState {
  id: string;
  status: string;
  /** The amount requested from the customer (for new bookings: 100% of the agreed price). */
  depositPence: number | null;
  depositPaidAt: string | null;
  stripePaymentIntentId: string | null;
  /**
   * When given (the live webhook always gives them), only a FULL payment of
   * the agreed price can confirm a booking.
   */
  paymentType?: string | null;
  agreedPricePence?: number | null;
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
  if (enquiry.paymentType !== undefined) {
    if (enquiry.paymentType !== "full") {
      return { action: "needs_review", reason: `Only full payment of the agreed price is accepted (this request was "${enquiry.paymentType ?? "unknown"}")` };
    }
    if (enquiry.agreedPricePence == null || enquiry.depositPence !== enquiry.agreedPricePence) {
      return { action: "needs_review", reason: `Amount requested (${enquiry.depositPence ?? "none"}p) is not 100% of the agreed price (${enquiry.agreedPricePence ?? "none"}p)` };
    }
  }
  if (enquiry.depositPence === null || payment.amountPence !== enquiry.depositPence) {
    return { action: "needs_review", reason: `Amount paid (${payment.amountPence}p) does not match the amount due (${enquiry.depositPence ?? "none"}p)` };
  }
  if (enquiry.status !== "deposit_requested") return { action: "needs_review", reason: `Booking was "${bookingStatusLabel(enquiry.status)}" when the payment arrived` };
  return { action: "mark_paid" };
}
