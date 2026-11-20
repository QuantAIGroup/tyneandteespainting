import "server-only";
import Stripe from "stripe";

/**
 * Stripe connection (server only – the secret key never reaches the browser).
 *   STRIPE_SECRET_KEY      sk_test_… while testing, sk_live_… when you go live
 *   STRIPE_WEBHOOK_SECRET  whsec_… from the Stripe webhook endpoint (or `stripe listen`)
 */
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "Tyne & Tees Painting website" } });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripeMode(): "test" | "live" | "not_configured" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return "not_configured";
}

/** Link to a payment in the Stripe dashboard (test or live). */
export function stripeDashboardPaymentUrl(paymentIntentId: string): string {
  return `https://dashboard.stripe.com/${stripeMode() === "test" ? "test/" : ""}payments/${paymentIntentId}`;
}

/**
 * Checks the webhook really came from Stripe (signature check) and returns the event.
 * Throws if the signature is missing or wrong.
 */
export function verifyStripeWebhook(stripe: Stripe, rawBody: string, signature: string | null, secret: string): Stripe.Event {
  if (!signature) throw new Error("Missing Stripe-Signature header");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Secret, unguessable token for a customer's payment link. */
export function generatePaymentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function isValidPaymentToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(token);
}
