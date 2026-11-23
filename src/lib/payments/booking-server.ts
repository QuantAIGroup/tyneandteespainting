import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPaymentToken } from "./stripe";

export interface PaymentBooking {
  id: string;
  reference: string;
  status: string;
  fullName: string;
  email: string;
  agreedService: string;
  agreedPricePence: number;
  depositPence: number;
  depositPaidPence: number | null;
  depositPaidAt: string | null;
  depositRequestedAt: string | null;
  stripeCheckoutSessionId: string | null;
  paymentType: "deposit" | "full" | "custom";
  depositPercent: number | null;
  stripePaymentIntentId: string | null;
  stripeReceiptUrl: string | null;
}

/**
 * Looks up a booking from the secret token in the customer's payment link.
 * Uses the server's secret key – the payment page never touches the database directly.
 */
export async function getBookingByToken(token: string): Promise<PaymentBooking | null> {
  if (!isValidPaymentToken(token)) return null;
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("enquiries")
    .select("id, reference, status, full_name, email, agreed_service, agreed_price_pence, deposit_pence, deposit_paid_pence, deposit_paid_at, deposit_requested_at, stripe_checkout_session_id, payment_type, deposit_percent, stripe_payment_intent_id, stripe_receipt_url")
    .eq("payment_token", token)
    .maybeSingle();
  if (!data || data.agreed_price_pence === null || data.deposit_pence === null) return null;
  return {
    id: data.id as string,
    reference: data.reference as string,
    status: data.status as string,
    fullName: data.full_name as string,
    email: data.email as string,
    agreedService: (data.agreed_service as string | null) ?? "Painting work",
    agreedPricePence: data.agreed_price_pence as number,
    depositPence: data.deposit_pence as number,
    depositPaidPence: (data.deposit_paid_pence as number | null) ?? null,
    depositPaidAt: (data.deposit_paid_at as string | null) ?? null,
    depositRequestedAt: (data.deposit_requested_at as string | null) ?? null,
    stripeCheckoutSessionId: (data.stripe_checkout_session_id as string | null) ?? null,
    paymentType: ((data.payment_type as string) ?? "full") as PaymentBooking["paymentType"],
    depositPercent: (data.deposit_percent as number | null) ?? null,
    stripePaymentIntentId: (data.stripe_payment_intent_id as string | null) ?? null,
    stripeReceiptUrl: (data.stripe_receipt_url as string | null) ?? null,
  };
}
