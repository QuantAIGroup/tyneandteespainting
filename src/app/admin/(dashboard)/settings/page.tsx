import { requireAdmin } from "@/lib/auth";
import { parseBusiness, parsePayments, parsePricing } from "@/lib/settings";
import { createSessionClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/notifications";
import { isStripeConfigured, stripeMode } from "@/lib/payments/stripe";
import { BusinessForm, PaymentSettingsForm, PricingForm } from "./SettingsForms";

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = (await createSessionClient())!;
  const { data } = await supabase.from("settings").select("key, value");
  const pricing = parsePricing(data?.find((r) => r.key === "pricing")?.value);
  const business = parseBusiness(data?.find((r) => r.key === "business")?.value);
  const payments = parsePayments(data?.find((r) => r.key === "payments")?.value);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl">Prices & business details</h1>
        <p className="mt-1 text-ink-600">Changes go live on the website and calculator as soon as you save.</p>
      </div>
      <PricingForm pricing={pricing} />
      <BusinessForm business={business} />
      <PaymentSettingsForm defaultDepositPercent={payments.defaultDepositPercent} />
      <section className="rounded-xl bg-white p-6 ring-1 ring-ink-900/10">
        <h2 className="font-sans text-lg font-semibold">Online deposit payments (Stripe)</h2>
        <p className="mt-2 text-[15px] text-ink-700">
          {!isStripeConfigured()
            ? "Not connected yet. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to your environment variables (see README.md)."
            : stripeMode() === "test"
              ? "Connected in TEST MODE – no real money is taken. Use Stripe's test card 4242 4242 4242 4242. Switch to live keys when you're ready."
              : "Connected in LIVE MODE – real payments are being taken."}
        </p>
      </section>
      <section className="rounded-xl bg-white p-6 ring-1 ring-ink-900/10">
        <h2 className="font-sans text-lg font-semibold">Email notifications</h2>
        <p className="mt-2 text-[15px] text-ink-700">
          {isEmailConfigured()
            ? "Switched on – you'll get an email for every new enquiry and message."
            : "Not switched on yet. Enquiries are still saved here. To get an email for each new enquiry, add RESEND_API_KEY, NOTIFICATION_EMAIL_TO and NOTIFICATION_EMAIL_FROM to your environment variables (see README.md)."}
        </p>
      </section>
    </div>
  );
}
