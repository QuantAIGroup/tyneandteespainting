import "server-only";
import type Stripe from "stripe";
import type { createAdminClient } from "@/lib/supabase/admin";
import { canChangeRefundStatus, isActiveRefund, refundStatus } from "./refunds";

type Db = NonNullable<ReturnType<typeof createAdminClient>>;
export type RefundSource = "admin" | "duplicate_payment" | "stripe_dashboard";

/** A refund that doesn't match its original payment. It is NOT recorded; the caller alerts the owner. */
export class RefundMismatchError extends Error {}

type RefundLike = Pick<Stripe.Refund, "id" | "amount" | "currency" | "status" | "reason"> & {
  payment_intent: string | Stripe.PaymentIntent | null;
};

/**
 * Records a Stripe refund in its OWN record (public.refunds). Never touches the
 * original payment. Checks (in the application, before the database does):
 *  - the original payment is in the payment log, and the refund belongs to the same booking;
 *  - the refund is in the same currency as the original payment;
 *  - all refunds of that payment together (except failed/cancelled ones) don't exceed it.
 * Safe to call more than once, and at the same time, for the same refund: the
 * first call adds it; any call applies only Stripe's genuine status changes.
 * Returns whether this call added the record, and whether it moved the record to a new status
 * (so callers alert once per change, not once per Stripe notice).
 */
export type RefundRecordResult = { added: boolean; statusChanged: boolean };

export async function recordRefund(supabase: Db, refund: RefundLike, ctx: { enquiryId: string | null; source: RefundSource; note?: string | null }): Promise<RefundRecordResult> {
  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : (refund.payment_intent?.id ?? null);
  if (!paymentIntentId) throw new RefundMismatchError(`Refund ${refund.id} has no payment reference`);
  const status = refundStatus(refund.status);
  const currency = (refund.currency ?? "").toLowerCase();

  const { data: original, error: originalError } = await supabase
    .from("payments")
    .select("enquiry_id, amount_pence, currency")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (originalError) throw new Error(originalError.message);
  if (!original) throw new RefundMismatchError(`Refund ${refund.id}: the original payment ${paymentIntentId} is not in the payment log`);
  const enquiryId = (original.enquiry_id as string | null) ?? null;
  if (ctx.enquiryId !== null && ctx.enquiryId !== enquiryId) {
    throw new RefundMismatchError(`Refund ${refund.id} is for a payment that belongs to a different booking`);
  }
  if (currency !== String(original.currency ?? "").toLowerCase()) {
    throw new RefundMismatchError(`Refund ${refund.id} is in ${currency || "no currency"}, but the original payment was in ${original.currency}`);
  }

  const { data: existing, error: readError } = await supabase.from("refunds").select("status").eq("stripe_refund_id", refund.id).maybeSingle();
  if (readError) throw new Error(readError.message);
  let added = false;
  let statusChanged = false;
  if (!existing) {
    if (isActiveRefund(status)) {
      const { data: others, error: othersError } = await supabase.from("refunds").select("amount_pence, status").eq("stripe_payment_intent_id", paymentIntentId);
      if (othersError) throw new Error(othersError.message);
      const already = ((others ?? []) as { amount_pence: number; status: string }[]).filter((r) => isActiveRefund(r.status)).reduce((s, r) => s + r.amount_pence, 0);
      if (already + refund.amount > (original.amount_pence as number)) {
        throw new RefundMismatchError(`Refund ${refund.id} of ${refund.amount}p would take refunds above the original payment (${already}p of ${original.amount_pence}p already refunded)`);
      }
    }
    const { data: inserted, error } = await supabase
      .from("refunds")
      .upsert(
        {
          enquiry_id: enquiryId,
          stripe_refund_id: refund.id,
          stripe_payment_intent_id: paymentIntentId,
          amount_pence: refund.amount,
          currency,
          status,
          stripe_reason: refund.reason ?? null,
          source: ctx.source,
          note: ctx.note?.slice(0, 500) ?? null,
        },
        { onConflict: "stripe_refund_id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    added = (inserted ?? []).length === 1;
  }

  // Apply Stripe's status change if it's a genuine one (the database enforces the same list).
  // Compare-and-set, so two notices about the same refund arriving at once can't undo each other;
  // stale or out-of-order notices that would move a refund backwards are ignored.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current, error: currentError } = await supabase.from("refunds").select("status").eq("stripe_refund_id", refund.id).maybeSingle();
    if (currentError) throw new Error(currentError.message);
    const from = (current?.status as string | undefined) ?? status;
    if (from === status || !canChangeRefundStatus(from, status)) break;
    const { data: changed, error } = await supabase
      .from("refunds")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("stripe_refund_id", refund.id)
      .eq("status", from)
      .select("id");
    if (error) throw new Error(error.message);
    if ((changed ?? []).length === 1) {
      statusChanged = true;
      break;
    }
  }
  return { added, statusChanged };
}
