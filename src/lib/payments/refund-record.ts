import "server-only";
import type Stripe from "stripe";
import type { createAdminClient } from "@/lib/supabase/admin";
import { refundStatus } from "./refunds";

type Db = NonNullable<ReturnType<typeof createAdminClient>>;
export type RefundSource = "admin" | "duplicate_payment" | "stripe_dashboard";

/**
 * Records a Stripe refund in its OWN record (public.refunds). Never touches the
 * original payment. Safe to call more than once for the same refund: the first
 * call adds it, later calls only update a pending refund's Stripe status.
 * Returns true if this call added a new record.
 */
export async function recordRefund(
  supabase: Db,
  refund: Pick<Stripe.Refund, "id" | "amount" | "currency" | "status" | "reason"> & { payment_intent: string | Stripe.PaymentIntent | null },
  ctx: { enquiryId: string | null; source: RefundSource; note?: string | null },
): Promise<boolean> {
  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : (refund.payment_intent?.id ?? null);
  if (!paymentIntentId) throw new Error(`Refund ${refund.id} has no payment reference`);
  const status = refundStatus(refund.status);

  const { data: existing, error: readError } = await supabase.from("refunds").select("status").eq("stripe_refund_id", refund.id).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!existing) {
    const { error } = await supabase.from("refunds").upsert(
      {
        enquiry_id: ctx.enquiryId,
        stripe_refund_id: refund.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_pence: refund.amount,
        currency: (refund.currency ?? "gbp").toLowerCase(),
        status,
        stripe_reason: refund.reason ?? null,
        source: ctx.source,
        note: ctx.note?.slice(0, 500) ?? null,
      },
      { onConflict: "stripe_refund_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return true;
  }
  // Already recorded: only a pending refund's status can move on (the database enforces this too)
  if (existing.status !== status && (existing.status === "pending" || existing.status === "requires_action")) {
    const { error } = await supabase.from("refunds").update({ status, updated_at: new Date().toISOString() }).eq("stripe_refund_id", refund.id);
    if (error) throw new Error(error.message);
  }
  return false;
}
