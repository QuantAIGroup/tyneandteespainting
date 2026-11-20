/**
 * "PAY DEPOSIT" button → sends the customer to Stripe's secure checkout page.
 *
 * The amount is read from the database using the secret link token. Nothing the
 * customer sends (other than which link they're on) is used, so the deposit
 * can't be altered.
 */
import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/payments/booking-server";
import { createDepositCheckout, expireCheckoutSession } from "@/lib/payments/checkout";
import { getStripe, isStripeConfigured, isValidPaymentToken } from "@/lib/payments/stripe";
import { getBusinessSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE } from "@/config/site";

const back = (token: string, query = "") => NextResponse.redirect(`${SITE.url}/pay/${token}${query}`, 303);

export async function POST(_request: Request, ctx: RouteContext<"/api/pay/[token]/checkout">) {
  const { token } = await ctx.params;
  if (!isValidPaymentToken(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stripe = getStripe();
  const supabase = createAdminClient();
  if (!stripe || !supabase || !isStripeConfigured()) return back(token, "?error=unavailable");

  const booking = await getBookingByToken(token);
  if (!booking) return back(token);
  if (booking.depositPaidAt) return NextResponse.redirect(`${SITE.url}/pay/${token}/success`, 303);
  if (booking.status !== "deposit_requested") return back(token);

  try {
    // Re-use an open checkout page if there is one, so the customer can't end up paying twice
    if (booking.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(booking.stripeCheckoutSessionId);
      if (existing.status === "complete") return NextResponse.redirect(`${SITE.url}/pay/${token}/success`, 303);
      if (existing.status === "open" && existing.amount_total === booking.depositPence && existing.url) {
        return NextResponse.redirect(existing.url, 303);
      }
    }

    const business = await getBusinessSettings();
    const session = await createDepositCheckout(stripe, {
      enquiryId: booking.id,
      reference: booking.reference,
      token,
      customerEmail: booking.email,
      agreedService: booking.agreedService,
      agreedPricePence: booking.agreedPricePence,
      depositPence: booking.depositPence,
      businessName: business.name,
      paymentType: booking.paymentType,
      depositPercent: booking.depositPercent,
      requestVersion: String(new Date(booking.depositRequestedAt ?? 0).getTime()),
      previousSessionId: booking.stripeCheckoutSessionId,
    });

    if (session.id !== booking.stripeCheckoutSessionId) {
      // Save it – but only if nobody else saved a different one in the meantime
      let update = supabase.from("enquiries").update({ stripe_checkout_session_id: session.id }).eq("id", booking.id).eq("status", "deposit_requested").is("deposit_paid_at", null);
      update = booking.stripeCheckoutSessionId ? update.eq("stripe_checkout_session_id", booking.stripeCheckoutSessionId) : update.is("stripe_checkout_session_id", null);
      const { data: saved, error } = await update.select("id");
      if (error || !saved || saved.length === 0) {
        // Another click got there first. If it saved this same page, carry on; otherwise close ours.
        const { data: now } = await supabase.from("enquiries").select("stripe_checkout_session_id").eq("id", booking.id).maybeSingle();
        if (now?.stripe_checkout_session_id !== session.id) {
          await expireCheckoutSession(stripe, session.id);
          return back(token, "?error=busy");
        }
      }
    }

    if (!session.url) return back(token, "?error=stripe");
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("Stripe checkout failed", err);
    return back(token, "?error=stripe");
  }
}
