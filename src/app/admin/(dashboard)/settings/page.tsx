import { requireAdmin } from "@/lib/auth";
import { parseBusiness, parsePricing } from "@/lib/settings";
import { createSessionClient } from "@/lib/supabase/server";
import { isEmailConfigured } from "@/lib/notifications";
import { BusinessForm, PricingForm } from "./SettingsForms";

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = (await createSessionClient())!;
  const { data } = await supabase.from("settings").select("key, value");
  const pricing = parsePricing(data?.find((r) => r.key === "pricing")?.value);
  const business = parseBusiness(data?.find((r) => r.key === "business")?.value);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl">Prices & business details</h1>
        <p className="mt-1 text-navy-600">Changes go live on the website and calculator as soon as you save.</p>
      </div>
      <PricingForm pricing={pricing} />
      <BusinessForm business={business} />
      <section className="rounded-xl bg-white p-6 ring-1 ring-navy-900/10">
        <h2 className="font-sans text-lg font-semibold">Email notifications</h2>
        <p className="mt-2 text-[15px] text-navy-700">
          {isEmailConfigured()
            ? "Switched on – you'll get an email for every new enquiry and message."
            : "Not switched on yet. Enquiries are still saved here. To get an email for each new enquiry, add RESEND_API_KEY, NOTIFICATION_EMAIL_TO and NOTIFICATION_EMAIL_FROM to your environment variables (see README.md)."}
        </p>
      </section>
    </div>
  );
}
