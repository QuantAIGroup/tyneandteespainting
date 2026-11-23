/**
 * BOOKING STATUS CHANGES – the complete list of allowed moves.
 *
 * The database enforces exactly the same list (protect_payment_fields() in
 * supabase/migrations/20261123170000_price_revision_full_payment.sql) and
 * migration-sync.test.ts fails if the two ever differ.
 *
 * Three situations:
 * - unpaid:  no payment received yet
 * - payment: the verified Stripe payment being recorded (only ever by the webhook)
 * - paid:    payment already received – the booking can never become unpaid again
 *
 * Keeping the same status (e.g. adding notes) is always allowed, except when a
 * payment is being recorded, which must move "Payment requested" → "Booking confirmed".
 * "Payment received" (deposit_paid) and "Balance paid" belonged to the older
 * deposit system and can no longer be entered.
 */
export type TransitionKind = "unpaid" | "payment" | "paid";

export const STATUS_TRANSITIONS: Record<TransitionKind, Record<string, readonly string[]>> = {
  unpaid: {
    awaiting_consultation: ["price_agreed", "declined", "cancelled"],
    price_agreed: ["awaiting_consultation", "deposit_requested", "declined", "cancelled"],
    deposit_requested: ["awaiting_consultation", "price_agreed", "declined", "cancelled"],
    declined: ["awaiting_consultation", "cancelled"],
    cancelled: ["awaiting_consultation", "declined"],
  },
  payment: {
    deposit_requested: ["booking_confirmed"],
  },
  paid: {
    deposit_paid: ["booking_confirmed", "work_completed", "cancelled"], // older deposit bookings only
    booking_confirmed: ["work_completed", "cancelled"],
    work_completed: ["booking_confirmed", "cancelled"], // undo a mistaken "completed"
    // cancelled (after payment) is final: refund in Stripe; it can't be reopened
  },
};

/** Every allowed move as "kind:from>to" – the same strings the database uses. */
export function allowedTransitionKeys(): string[] {
  return (Object.keys(STATUS_TRANSITIONS) as TransitionKind[]).flatMap((kind) =>
    Object.entries(STATUS_TRANSITIONS[kind]).flatMap(([from, tos]) => tos.map((to) => `${kind}:${from}>${to}`)),
  );
}

export function canChangeStatus(kind: TransitionKind, from: string, to: string): boolean {
  if (kind !== "payment" && from === to) return true;
  return STATUS_TRANSITIONS[kind][from]?.includes(to) ?? false;
}
