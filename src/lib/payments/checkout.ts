import "server-only";
import type Stripe from "stripe";
import { SITE } from "@/config/site";
import { formatPence } from "@/lib/pricing/engine";
import { paymentLabel, type PaymentType } from "./deposit";
import { CANCELLATION_SUMMARY } from "@/config/cancellation";

export function paymentLinkUrl(token: string): string {
  return `${SITE.url}/pay/${token}`;
}

/** Best effort: closes an unpaid Stripe checkout page so it can't be paid any more. */
export async function expireCheckoutSession(stripe: Stripe | null, sessionId: string | null | undefined): Promise<void> {
  if (!stripe || !sessionId) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    console.warn("Could not expire checkout session", sessionId, err);
  }
}

export interface DepositCheckoutInput {
  enquiryId: string;
  reference: string;
  token: string;
  customerEmail: string;
  agreedService: string;
  agreedPricePence: number;
  depositPence: number;
  businessName: string;
  paymentType: PaymentType;
  depositPercent: number | null;
  /** Changes whenever the request is re-issued, so Stripe's duplicate-protection key changes too. */
  requestVersion: string;
  previousSessionId: string | null;
}

/**
 * Creates the Stripe Checkout page for the payment (deposit, full or custom amount). The amount comes ONLY from
 * the database – nothing the customer sends can change it.
 * Card, Apple Pay and Google Pay are shown automatically by Stripe Checkout
 * (turn them on in Stripe → Settings → Payment methods).
 */
export async function createDepositCheckout(stripe: Stripe, input: DepositCheckoutInput): Promise<Stripe.Checkout.Session> {
  const balancePence = input.agreedPricePence - input.depositPence;
  const metadata = {
    enquiry_id: input.enquiryId,
    reference: input.reference,
    agreed_price_pence: String(input.agreedPricePence),
    deposit_pence: String(input.depositPence),
    kind: input.paymentType,
  };
  const label = paymentLabel(input.paymentType, input.depositPercent);
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      currency: "gbp",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: input.depositPence,
            product_data: {
              name: `${label} – ${input.businessName}`,
              description: `${input.agreedService.slice(0, 300)}. Agreed job price ${formatPence(input.agreedPricePence)}.${balancePence > 0 ? ` Remaining balance ${formatPence(balancePence)} is paid separately as agreed.` : ""}`,
            },
          },
        },
      ],
      customer_email: input.customerEmail,
      // Creates a Stripe customer record so payments are easy to find in Stripe
      customer_creation: "always",
      client_reference_id: input.enquiryId,
      metadata,
      payment_intent_data: {
        description: `${input.reference} – ${label}`,
        // Stripe emails the customer a receipt (switch on in Stripe → Settings → Customer emails)
        receipt_email: input.customerEmail,
        metadata,
      },
      // Shown on Stripe's payment page, next to the Pay button
      custom_text: {
        submit: {
          message: `${input.paymentType === "full" ? "Paying confirms your booking. " : ""}Cancellations & refunds: ${CANCELLATION_SUMMARY.join(" ")} Full policy and cancellation form: ${SITE.url}/cancellation`.slice(0, 1200),
        },
      },
      success_url: `${SITE.url}/pay/${input.token}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE.url}/pay/${input.token}/cancelled`,
    },
    {
      // Two clicks at the same moment get the SAME checkout page, not two.
      idempotencyKey: `payment-${input.enquiryId}-${input.requestVersion}-${input.depositPence}-${input.previousSessionId ?? "first"}`,
    },
  );
}
