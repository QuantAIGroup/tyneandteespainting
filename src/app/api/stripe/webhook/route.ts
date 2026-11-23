/**
 * STRIPE WEBHOOK – the ONLY place a payment is marked as received.
 *
 * Stripe calls this after a payment. We check the signature (so nobody can fake
 * it), check the amount matches the amount due (100% of the agreed price), then record the payment.
 * - The same event arriving twice is ignored.
 * - A second payment for an already-paid booking is refunded automatically.
 * - Anything unexpected (wrong amount, cancelled booking) is logged for you to
 *   review and NOT marked as paid.
 *
 * Stripe dashboard → Developers → Webhooks → endpoint URL:
 *   https://YOUR-DOMAIN/api/stripe/webhook
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isUuid } from "@/lib/enquiry";
import { decideDepositOutcome, statusAfterVerifiedPayment } from "@/lib/payments/booking";
import { CANCELLATION_SUMMARY } from "@/config/cancellation";
import { paidHeadline, paymentLabel } from "@/lib/payments/deposit";
import { getStripe, verifyStripeWebhook } from "@/lib/payments/stripe";
import { sendCustomerEmail, sendNotification } from "@/lib/notifications";
import { formatPence } from "@/lib/pricing/engine";
import { getBusinessSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE } from "@/config/site";

type Db = NonNullable<ReturnType<typeof createAdminClient>>;

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabase = createAdminClient();
  if (!stripe || !secret || !supabase)
    return NextResponse.json(
      { error: "Payments not configured" },
      { status: 503 },
    );

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(
      stripe,
      rawBody,
      request.headers.get("stripe-signature"),
      secret,
    );
  } catch (err) {
    console.warn(
      "Rejected webhook with invalid signature",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Already handled this exact event? Stripe sometimes sends events more than once.
  const { data: seen } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await handlePaidSession(stripe, supabase, event, event.data.object);
    }
  } catch (err) {
    console.error(`Webhook ${event.id} failed – Stripe will retry`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await supabase
    .from("stripe_events")
    .upsert(
      { id: event.id, type: event.type },
      { onConflict: "id", ignoreDuplicates: true },
    );
  return NextResponse.json({ received: true });
}

async function handlePaidSession(
  stripe: Stripe,
  supabase: Db,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  // Bank-type payments can complete later; card/Apple Pay/Google Pay are "paid" straight away.
  if (session.payment_status !== "paid") return;
  const kind = session.metadata?.kind;
  if (kind !== "deposit" && kind !== "full" && kind !== "custom") return; // not one of our booking payments

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId)
    throw new Error(`Session ${session.id} has no payment intent`);
  const amountPence = session.amount_total ?? 0;
  const currency = session.currency ?? "";
  const enquiryId =
    session.metadata?.enquiry_id ?? session.client_reference_id ?? "";

  const { data: enquiry, error } = isUuid(enquiryId)
    ? await supabase
        .from("enquiries")
        .select(
          "id, reference, status, full_name, email, agreed_service, agreed_price_pence, deposit_pence, payment_type, deposit_percent, deposit_paid_at, stripe_payment_intent_id, payment_token",
        )
        .eq("id", enquiryId)
        .maybeSingle()
    : { data: null, error: null };
  if (error) throw new Error(error.message);

  const decision = decideDepositOutcome(
    enquiry
      ? {
          id: enquiry.id as string,
          status: enquiry.status as string,
          depositPence: enquiry.deposit_pence as number | null,
          depositPaidAt: enquiry.deposit_paid_at as string | null,
          stripePaymentIntentId: enquiry.stripe_payment_intent_id as
            string | null,
          // Only a full payment of the agreed price confirms a booking
          paymentType: (enquiry.payment_type as string | null) ?? null,
          agreedPricePence: enquiry.agreed_price_pence as number | null,
        }
      : null,
    { amountPence, currency, paymentIntentId },
  );

  const logPayment = (outcome: string, notes?: string) =>
    supabase.from("payments").upsert(
      {
        enquiry_id: enquiry?.id ?? null,
        outcome,
        amount_pence: amountPence,
        currency,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_event_id: event.id,
        kind,
        notes: notes ?? null,
      },
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    );

  if (decision.action === "already_recorded") return;

  if (decision.action === "mark_paid" && enquiry) {
    // Atomic: only succeeds if the booking hasn't been paid in the meantime
    const { data: updated, error: updateError } = await supabase
      .from("enquiries")
      .update({
        // Full payment confirms the booking straight away
        status: statusAfterVerifiedPayment(enquiry.payment_type as string),
        ...(enquiry.payment_type === "full" ? { booking_confirmed_at: new Date().toISOString() } : {}),
        deposit_paid_pence: amountPence,
        deposit_paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
        stripe_checkout_session_id: session.id,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
        stripe_receipt_url: await receiptUrl(stripe, paymentIntentId),
      })
      .eq("id", enquiry.id)
      .is("deposit_paid_at", null)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (updated && updated.length === 1) {
      await logPayment("deposit_recorded");
      await sendPaidEmails(enquiry, amountPence, paymentIntentId);
      return;
    }
    // Lost a race with another payment → this one is a duplicate
    return refundDuplicate(
      stripe,
      enquiry,
      amountPence,
      paymentIntentId,
      logPayment,
      "Second payment arrived at the same moment as the first",
    );
  }

  if (decision.action === "refund_duplicate" && enquiry) {
    return refundDuplicate(
      stripe,
      enquiry,
      amountPence,
      paymentIntentId,
      logPayment,
      decision.reason,
    );
  }

  // needs_review – money received but something doesn't match. Not marked as paid.
  const reason =
    decision.action === "needs_review" ? decision.reason : "Unexpected payment";
  const { error: logError } = await logPayment("needs_review", reason);
  if (logError) throw new Error(logError.message);
  await sendNotification(
    `⚠ Payment needs checking – ${enquiry?.reference ?? session.id}`,
    [
      `A payment of ${formatPence(amountPence)} was received but has NOT been marked as paid.`,
      `Reason: ${reason}`,
      `Stripe payment: ${paymentIntentId}`,
      enquiry
        ? `Enquiry: ${SITE.url}/admin/enquiries/${enquiry.id}`
        : "Enquiry: not found",
      "Please check it in Stripe and refund it if needed.",
    ],
  );
}

/** Stripe's receipt link for the payment (shown to you and the customer). */
async function receiptUrl(stripe: Stripe, paymentIntentId: string): Promise<string | null> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge;
    return charge && typeof charge !== "string" ? (charge.receipt_url ?? null) : null;
  } catch {
    return null;
  }
}

async function refundDuplicate(
  stripe: Stripe,
  enquiry: Record<string, unknown>,
  amountPence: number,
  paymentIntentId: string,
  logPayment: (
    outcome: string,
    notes?: string,
  ) => PromiseLike<{ error: { message: string } | null }>,
  reason: string,
) {
  let refunded = false;
  try {
    await stripe.refunds.create(
      { payment_intent: paymentIntentId, reason: "duplicate" },
      { idempotencyKey: `refund-duplicate-${paymentIntentId}` },
    );
    refunded = true;
  } catch (err) {
    console.error("Automatic refund of duplicate payment failed", err);
  }
  await logPayment(
    refunded ? "duplicate_refunded" : "duplicate_refund_failed",
    reason,
  );
  await sendNotification(
    `${refunded ? "Duplicate payment refunded" : "⚠ DUPLICATE PAYMENT – REFUND FAILED"} – ${enquiry.reference}`,
    [
      `${enquiry.full_name} made a second payment of ${formatPence(amountPence)} for a booking that was already paid.`,
      refunded
        ? "It has been refunded automatically."
        : "The automatic refund FAILED – please refund it in your Stripe dashboard.",
      `Stripe payment: ${paymentIntentId}`,
      `Enquiry: ${SITE.url}/admin/enquiries/${enquiry.id}`,
    ],
  );
}

async function sendPaidEmails(enquiry: Record<string, unknown>, amountPence: number, paymentIntentId: string) {
  const business = await getBusinessSettings();
  const agreed = enquiry.agreed_price_pence as number;
  const balance = agreed - amountPence;
  const label = paymentLabel(enquiry.payment_type as string, enquiry.deposit_percent as number | null);
  const full = enquiry.payment_type === "full";
  await sendCustomerEmail(enquiry.email as string, `Payment received – your painting booking is ${full ? "confirmed" : "secured"} (${enquiry.reference})`, [
    `Hi ${String(enquiry.full_name).split(" ")[0]},`,
    paidHeadline(enquiry.payment_type as string, enquiry.deposit_percent as number | null),
    `Your painting booking is now ${full ? "confirmed" : "secured"}. ${business.name} will contact you to confirm the arrangements for your job.`,
    `Work: ${enquiry.agreed_service}`,
    `Agreed job price: ${formatPence(agreed)}`,
    `${label} paid: ${formatPence(amountPence)}`,
    ...(balance > 0 ? [`Remaining balance: ${formatPence(balance)} – payable separately as agreed. It will not be charged automatically.`] : []),
    `Booking reference: ${enquiry.reference}`,
    `Payment reference: ${paymentIntentId}`,
    `Cancellations and refunds:`,
    ...CANCELLATION_SUMMARY.map((l) => `• ${l}`),
    `Your right to cancel and the cancellation form: ${SITE.url}/cancellation`,
    `Questions? Call ${business.phone}.`,
    `Thank you for choosing ${business.name}.`,
  ]);
  await sendNotification(`💷 Payment received – ${enquiry.reference} – ${enquiry.full_name}`, [
    `${enquiry.full_name} has paid ${formatPence(amountPence)} (${label}, verified by Stripe).`,
    full ? `Paid in full – booking confirmed. Agreed price: ${formatPence(agreed)}` : `Agreed price: ${formatPence(agreed)} · Balance to collect: ${formatPence(balance)}`,
    `Stripe payment: ${paymentIntentId}`,
    `Enquiry: ${SITE.url}/admin/enquiries/${enquiry.id}`,
  ]);
}
