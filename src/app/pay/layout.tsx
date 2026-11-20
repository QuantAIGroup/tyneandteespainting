import type { Metadata } from "next";
import { Lock, Phone } from "lucide-react";
import { getBusinessSettings } from "@/lib/settings";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { telHref } from "@/config/site";

export const metadata: Metadata = {
  title: "Secure your painting booking",
  robots: { index: false, follow: false },
};

/** Branded layout for the customer payment pages (royal blue, black and white). */
export default async function PayLayout({ children }: { children: React.ReactNode }) {
  const business = await getBusinessSettings();
  const tel = telHref(business.phone);
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-ink">
      <header className="border-b border-ink-950/8 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <BrandLogo logoUrl={business.logoUrl} name={business.name} />
          <a href={tel} className="hidden items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 sm:flex">
            <Phone className="size-4" aria-hidden /> {business.phone}
          </a>
        </div>
              </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-6 text-xs text-black/60 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden /> Payments are processed securely by Stripe. We never see your card details.
          </p>
          <p>
            {business.name} · <a href={tel}>{business.phone}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
