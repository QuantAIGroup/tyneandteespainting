"use server";

/**
 * PAYMENT ACTIONS (admin only)
 *
 * Customers pay 100% of the final agreed price. A payment link is only ever
 * created after you've confirmed you spoke to the customer and agreed the price.
 *
 * Payment fields are protected in the database so they can't be changed from a
 * browser login. These actions first check you are a logged-in admin, then use
 * the server's secret key to make the change.
 */
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { sendCustomerEmail } from "@/lib/notifications";
import { NEW_PAYMENT_TYPE, fullPaymentRequest, parsePoundsToPence } from "@/lib/payments/deposit";
import { CANCELLATION_SUMMARY } from "@/config/cancellation";
import { SITE } from "@/config/site";
import { expireCheckoutSession, paymentLinkUrl } from "@/lib/payments/checkout";
import { generatePaymentToken, getStripe } from "@/lib/payments/stripe";
import { formatPence } from "@/lib/pricing/engine";
import { getBusinessSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentActionState = { ok: boolean; message: string; link?: string } | null;

async function serverDb() {
  await requireAdmin();
  const supabase = createAdminClient();
  if (!supabase) throw new Error("SUPABASE_SECRET_KEY is not configured");
  return supabase;
}

async function loadEnquiry(supabase: NonNullable<ReturnType<typeof createAdminClient>>, id: string) {
  const { data, error } = await supabase
    .from("enquiries")
    .select("id, reference, status, full_name, email, agreed_service, agreed_price_pence, deposit_pence, payment_type, deposit_percent, payment_token, deposit_requested_at, payment_link_send_count, stripe_checkout_session_id, deposit_paid_at, deposit_paid_pence")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Step 1: after your phone call, approve the quotation – record the final
 * agreed price. The customer will pay 100% of this agreed price (never the
 * online estimate). The amount is worked out here on the server, in whole pence.
 */
export async function agreeFinalPrice(id: string, _prev: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  if (!isUuid(id)) return { ok: false, message: "Invalid request" };
  if (formData.get("spokeToCustomer") !== "on") {
    return { ok: false, message: "Please confirm you have spoken to the customer and agreed this price." };
  }
  const agreedService = String(formData.get("agreedService") ?? "").trim();
  if (agreedService.length < 3 || agreedService.length > 500) return { ok: false, message: "Please describe the agreed painting work (3–500 characters)." };
  const pricePence = parsePoundsToPence(String(formData.get("agreedPrice") ?? ""));
  if (pricePence === null) return { ok: false, message: "Please enter a valid price, e.g. 400 or 425.50 (maximum £50,000)." };

  // Always 100% of the agreed price – any payment type sent from the browser is ignored
  const paymentType = NEW_PAYMENT_TYPE;
  const request = fullPaymentRequest(pricePence);
  if (!request) return { ok: false, message: "Please enter a valid price, e.g. 400 or 425.50 (maximum £50,000)." };

  const supabase = await serverDb();
  const enquiry = await loadEnquiry(supabase, id);
  if (!enquiry) return { ok: false, message: "Enquiry not found" };
  if (enquiry.deposit_paid_at) return { ok: false, message: "Payment has already been received, so the agreed price is locked." };

  const changed =
    enquiry.agreed_price_pence !== pricePence || enquiry.deposit_pence !== request.amountPence || enquiry.payment_type !== paymentType;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    agreed_service: agreedService,
    agreed_price_pence: pricePence,
    deposit_pence: request.amountPence,
    payment_type: paymentType,
    deposit_percent: request.depositPercent,
    price_agreed_at: now,
    consultation_confirmed_at: now,
  };

  if (changed || enquiry.status !== "deposit_requested") {
    // A new price or amount makes any existing payment link invalid
    await expireCheckoutSession(getStripe(), enquiry.stripe_checkout_session_id as string | null);
    Object.assign(patch, { status: "price_agreed", payment_token: null, stripe_checkout_session_id: null, deposit_requested_at: null });
  }

  const { error } = await supabase.from("enquiries").update(patch).eq("id", id).is("deposit_paid_at", null);
  if (error) return { ok: false, message: error.message };
  refresh();
  return {
    ok: true,
    message:
      changed && enquiry.status === "deposit_requested"
        ? `Updated – ${formatPence(pricePence)} agreed (customer pays 100%). The old payment link no longer works, so send the new one below.`
        : `Quotation approved: ${formatPence(pricePence)} agreed. The customer will pay the full ${formatPence(pricePence)}.`,
  };
}

/** Step 2: create (or resend) the secure payment link for the full agreed price. */
export async function sendPaymentLink(id: string): Promise<PaymentActionState> {
  if (!isUuid(id)) return { ok: false, message: "Invalid request" };
  const supabase = await serverDb();
  const enquiry = await loadEnquiry(supabase, id);
  if (!enquiry) return { ok: false, message: "Enquiry not found" };
  if (enquiry.deposit_paid_at) return { ok: false, message: "Payment has already been received – no payment link is needed." };
  if (!enquiry.agreed_price_pence || !enquiry.deposit_pence) return { ok: false, message: "Agree the final price with the customer first." };
  if (!["price_agreed", "deposit_requested"].includes(enquiry.status as string)) {
    return { ok: false, message: "A payment can only be requested once the price has been agreed." };
  }

  const token = (enquiry.payment_token as string | null) ?? generatePaymentToken();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("enquiries")
    .update({
      status: "deposit_requested",
      payment_token: token,
      deposit_requested_at: enquiry.deposit_requested_at ?? now,
      payment_link_last_sent_at: now,
      payment_link_send_count: ((enquiry.payment_link_send_count as number) ?? 0) + 1,
    })
    .eq("id", id)
    .is("deposit_paid_at", null);
  if (error) return { ok: false, message: error.message };

  const link = paymentLinkUrl(token);
  const business = await getBusinessSettings();
  const balance = (enquiry.agreed_price_pence as number) - (enquiry.deposit_pence as number);
  const email = await sendCustomerEmail(
    enquiry.email as string,
    `Your confirmed painting price – ${business.name} (${enquiry.reference})`,
    [
      `Hi ${(enquiry.full_name as string).split(" ")[0]},`,
      `Thank you for speaking with us. Here is your confirmed fixed labour price:`,
      `Work: ${enquiry.agreed_service}`,
      `Agreed job price: ${formatPence(enquiry.agreed_price_pence as number)}`,
      `Amount to pay: ${formatPence(enquiry.deposit_pence as number)}${balance === 0 ? " (100% of the agreed price)" : ""}`,
      ...(balance > 0 ? [`Remaining balance: ${formatPence(balance)} (paid separately, as agreed – it is never charged automatically)`] : []),
      `Your booking is confirmed as soon as your payment has been received.`,
      `Cancellations and refunds:`,
      ...CANCELLATION_SUMMARY.map((l) => `• ${l}`),
      `Full details and the cancellation form: ${SITE.url}/cancellation`,
      process.env.STRIPE_WALLETS_ENABLED === "true"
        ? `You can pay securely by debit or credit card – or Apple Pay / Google Pay where your device supports it – using the button below.`
        : `You can pay securely by debit or credit card using the button below.`,
      `Any questions? Call us on ${business.phone}.`,
      `${business.name}`,
    ],
    { label: `Pay ${formatPence(enquiry.deposit_pence as number)}`, url: link },
  );
  refresh();
  return {
    ok: true,
    link,
    message: email.sent
      ? `Payment link emailed to ${enquiry.email}. You can also copy or text it below.`
      : "Payment link ready. Email isn't set up, so copy it or text it to the customer below.",
  };
}

/** Withdraw a payment link that hasn't been paid (e.g. the job was postponed). */
export async function cancelPaymentRequest(id: string): Promise<PaymentActionState> {
  if (!isUuid(id)) return { ok: false, message: "Invalid request" };
  const supabase = await serverDb();
  const enquiry = await loadEnquiry(supabase, id);
  if (!enquiry) return { ok: false, message: "Enquiry not found" };
  if (enquiry.deposit_paid_at) return { ok: false, message: "Payment has already been received." };
  await expireCheckoutSession(getStripe(), enquiry.stripe_checkout_session_id as string | null);
  const { error } = await supabase
    .from("enquiries")
    .update({ status: "price_agreed", payment_token: null, stripe_checkout_session_id: null, deposit_requested_at: null })
    .eq("id", id)
    .is("deposit_paid_at", null);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Payment link withdrawn. The old link no longer works." };
}

/**
 * Older deposit bookings only: the remaining balance is collected separately
 * (never charged automatically). Record it here once received. Not used for
 * full payments, where nothing remains to pay.
 */
export async function recordBalancePaid(id: string, _prev: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  if (!isUuid(id)) return { ok: false, message: "Invalid request" };
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 2) return { ok: false, message: "Please note how the balance was paid (e.g. bank transfer, 21 Nov)." };
  const supabase = await serverDb();
  const enquiry = await loadEnquiry(supabase, id);
  if (!enquiry) return { ok: false, message: "Enquiry not found" };
  if (!enquiry.deposit_paid_at) return { ok: false, message: "No online payment has been received yet." };
  const balance = (enquiry.agreed_price_pence as number) - (enquiry.deposit_paid_pence as number);
  const { error } = await supabase
    .from("enquiries")
    .update({ balance_paid_pence: balance, balance_paid_at: new Date().toISOString(), balance_payment_note: note.slice(0, 300), status: "balance_paid" })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: `Balance of ${formatPence(balance)} recorded as paid.` };
}
