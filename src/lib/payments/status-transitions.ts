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
 *
 * "Payment received" (deposit_paid) and "Balance paid" belonged to the older
 * deposit system. They are kept only as display labels and in the database's
 * allowed-values list; no booking can enter or leave them (the migration stops
 * if any booking is in one).
 *
 * "Work completed" is final apart from cancelling: there is no documented
 * business need to move a completed job back to "Booking confirmed".
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
    booking_confirmed: ["work_completed", "cancelled"],
    work_completed: ["cancelled"],
    // cancelled (after payment) is final: refund through Stripe; it can't be reopened
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

/** Old deposit-era statuses: shown if ever present, never offered or entered. */
export const LEGACY_STATUSES: readonly string[] = ["deposit_paid", "balance_paid"];
