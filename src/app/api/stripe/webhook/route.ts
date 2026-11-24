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
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *         refund.created, refund.updated, refund.failed
 * Refunds (made from the admin area, automatically for duplicates, or directly
 * in the Stripe dashboard) are recorded in their own refund record – the
 * original payment record is never changed.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isUuid } from "@/lib/enquiry";
import { decideDepositOutcome, statusAfterVerifiedPayment } from "@/lib/payments/booking";
import { CANCELLATION_SUMMARY, CANCELLATION_TERMS_VERSION, CONSENT_STATEMENTS, COOLING_OFF_DAYS } from "@/config/cancellation";
import { paidHeadline, paymentLabel } from "@/lib/payments/deposit";
import { getStripe, verifyStripeWebhook } from "@/lib/payments/stripe";
import { sendCustomerEmail, sendNotification } from "@/lib/notifications";
import { formatPence } from "@/lib/pricing/engine";
import { getBusinessSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordRefund } from "@/lib/payments/refund-record";
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

  // Defence in depth: a live-mode event must never be processed with test keys, or the reverse
  // (each mode also has its own signing secret, so this should never happen).
  const liveKey = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  if (Boolean(event.livemode) !== liveKey) {
    console.warn(`Ignored ${event.livemode ? "live" : "test"}-mode event ${event.id}: this site uses ${liveKey ? "live" : "test"} keys`);
    return NextResponse.json({ received: true, ignored: "mode mismatch" });
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
    } else if (event.type === "refund.created" || event.type === "refund.updated" || event.type === "refund.failed") {
      await handleRefund(supabase, event.data.object);
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
          "id, reference, status, full_name, email, agreed_service, agreed_price_pence, deposit_pence, payment_type, deposit_percent, deposit_paid_at, stripe_payment_intent_id, payment_token, cancellation_terms_accepted_at, stripe_checkout_session_id, consent_id, cancellation_terms_version, early_start_requested_at",
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
          // A booking can only be confirmed if the cancellation policy was confirmed first
          termsAcceptedAt: (enquiry.cancellation_terms_accepted_at as string | null) ?? null,
          // ...and only if it was made on the checkout page saved on this booking
          checkoutSessionId: (enquiry.stripe_checkout_session_id as string | null) ?? null,
          // ...and only with the customer's consent evidence on record
          consentId: (enquiry.consent_id as string | null) ?? null,
        }
      : null,
    { amountPence, currency, paymentIntentId, checkoutSessionId: session.id },
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

  let reviewReason: string | null = decision.action === "needs_review" ? decision.reason : null;

  if (decision.action === "mark_paid" && enquiry) {
    // Ask Stripe directly about the payment itself, rather than relying only on the checkout summary.
    // If Stripe can't be reached this throws → 500 → Stripe retries later; nothing is marked paid.
    const check = await confirmWithStripe(stripe, paymentIntentId, amountPence, enquiry.id as string);
    if (!check.ok) reviewReason = check.reason;
  }

  if (decision.action === "mark_paid" && enquiry && reviewReason === null) {
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
    // Lost a race. If the winner recorded THIS payment (the same event delivered
    // twice at once), there is nothing to do – never refund the customer's real payment.
    const { data: current, error: rereadError } = await supabase
      .from("enquiries")
      .select("stripe_payment_intent_id")
      .eq("id", enquiry.id)
      .maybeSingle();
    if (rereadError) throw new Error(rereadError.message); // Stripe retries; nothing refunded
    if (!current || current.stripe_payment_intent_id === paymentIntentId) return;
    // A DIFFERENT payment was recorded first → this one is a genuine duplicate
    return refundDuplicate(
      stripe,
      supabase,
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
      supabase,
      enquiry,
      amountPence,
      paymentIntentId,
      logPayment,
      decision.reason,
    );
  }

  // needs_review – money received but something doesn't match. Not marked as paid.
  const reason = reviewReason ?? "Unexpected payment";
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

/**
 * A refund was created or changed in Stripe (from the admin area, automatically
 * for a duplicate, or directly in the Stripe dashboard). Record it in the refund
 * record. Never changes the original payment.
 */
async function handleRefund(supabase: Db, refund: Stripe.Refund) {
  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : (refund.payment_intent?.id ?? null);
  if (!paymentIntentId) return; // not a card/PaymentIntent refund we took
  // The ORIGINAL payment in the payment log decides which booking the refund belongs to.
  // A payment this website never took is not ours to record.
  const { data: original, error: e1 } = await supabase.from("payments").select("enquiry_id, currency").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!original) return;
  const enquiryId = (original.enquiry_id as string | null) ?? null;
  const { data: booking } = enquiryId ? await supabase.from("enquiries").select("reference").eq("id", enquiryId).maybeSingle() : { data: null };
  const source = refund.metadata?.source === "admin" ? "admin" : refund.reason === "duplicate" ? "duplicate_payment" : "stripe_dashboard";
  const added = await recordRefund(supabase, refund, { enquiryId, source });
  const ref = (booking?.reference as string | undefined) ?? enquiryId ?? paymentIntentId;
  if (refund.status === "failed" || refund.status === "canceled") {
    await sendNotification(`⚠ REFUND ${refund.status === "failed" ? "FAILED" : "CANCELLED"} – ${ref}`, [
      `A refund of ${formatPence(refund.amount)} did not go through (Stripe ${refund.id}).`,
      `Please check it in your Stripe dashboard.`,
      enquiryId ? `Enquiry: ${SITE.url}/admin/enquiries/${enquiryId}` : `Stripe payment: ${paymentIntentId}`,
    ]);
  } else if (added && source === "stripe_dashboard") {
    await sendNotification(`Refund recorded – ${ref}`, [
      `A refund of ${formatPence(refund.amount)} made in the Stripe dashboard has been recorded (Stripe ${refund.id}, ${refund.status}).`,
      enquiryId ? `Enquiry: ${SITE.url}/admin/enquiries/${enquiryId}` : `Stripe payment: ${paymentIntentId}`,
    ]);
  }
}

/**
 * Confirms the payment with Stripe itself: it must have succeeded, for exactly
 * the amount due, in GBP, and belong to this booking. Throws if Stripe can't be
 * reached (the webhook then fails and Stripe retries).
 */
async function confirmWithStripe(
  stripe: Stripe,
  paymentIntentId: string,
  amountPence: number,
  enquiryId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== "succeeded") return { ok: false, reason: `Stripe reports the payment as "${pi.status}", not succeeded` };
  if (pi.amount_received !== amountPence) return { ok: false, reason: `Stripe received ${pi.amount_received}p, not ${amountPence}p` };
  if ((pi.currency ?? "").toLowerCase() !== "gbp") return { ok: false, reason: `Stripe payment currency is ${pi.currency}, not GBP` };
  if (pi.metadata?.enquiry_id !== enquiryId) return { ok: false, reason: "The Stripe payment does not belong to this booking" };
  return { ok: true };
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
  supabase: Db,
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
  let refund: Stripe.Refund | null = null;
  try {
    refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, reason: "duplicate" },
      { idempotencyKey: `refund-duplicate-${paymentIntentId}` },
    );
    refunded = true;
  } catch (err) {
    console.error("Automatic refund of duplicate payment failed", err);
  }
  // The duplicate payment goes into the payment log FIRST: every refund record
  // must point at its original payment there (the database enforces this).
  const { error: logError } = await logPayment(
    refunded ? "duplicate_refunded" : "duplicate_refund_failed",
    reason,
  );
  if (logError) throw new Error(logError.message); // Stripe retries; the refund itself is idempotent
  if (refund) {
    // Kept in the refund record, separately from the payment
    await recordRefund(
      supabase,
      { id: refund.id, amount: refund.amount ?? amountPence, currency: refund.currency ?? "gbp", status: refund.status ?? "pending", reason: refund.reason ?? "duplicate", payment_intent: paymentIntentId },
      { enquiryId: (enquiry.id as string) ?? null, source: "duplicate_payment", note: reason },
    );
  }
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
    `Cancellations and refunds (terms version ${enquiry.cancellation_terms_version ?? CANCELLATION_TERMS_VERSION}, which you accepted before paying):`,
    ...CANCELLATION_SUMMARY.map((l) => `• ${l}`),
    ...(enquiry.early_start_requested_at
      ? [
          `You asked us to start within your ${COOLING_OFF_DAYS}-day cancellation period, and confirmed:`,
          `• ${CONSENT_STATEMENTS.earlyStart}`,
          `• ${CONSENT_STATEMENTS.ackPayForWork}`,
          `• ${CONSENT_STATEMENTS.ackLosesRight}`,
        ]
      : [`You did not ask us to start within your ${COOLING_OFF_DAYS}-day cancellation period.`]),
    `How to cancel, the full policy and the model cancellation form: ${SITE.url}/cancellation`,
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
