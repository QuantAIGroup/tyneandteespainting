import type { Metadata } from "next";
import { Suspense } from "react";
import { getBusinessSettings, getPaymentSettings, getPricingSettings } from "@/lib/settings";
import { QuoteCalculator } from "@/components/calculator/QuoteCalculator";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Instant Painting Price Calculator | Newcastle Room Painters",
  description:
    "Work out your labour price for bedroom painting, living room painting, skirting boards and ceilings in Newcastle. Enter your room measurements for an instant, transparent estimate.",
  alternates: { canonical: "/quote" },
};

/** True when the server has the secret key needed to accept photo uploads. */
function uploadsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export default async function QuotePage() {
  const [pricing, business, payments] = await Promise.all([getPricingSettings(), getBusinessSettings(), getPaymentSettings()]);
  return (
    <div className="bg-white">
      <Container className="py-12 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Instant price calculator</p>
          <h1 className="text-3xl leading-tight sm:text-4xl">Calculate your painting price</h1>
          <p className="mt-4 text-lg text-ink-700">Room-by-room labour prices worked out from your own measurements. No hourly rates, no hidden labour fees – and no need to wait in for a visit. Online estimates are completely free.</p>
        </div>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/60" aria-label="Loading calculator" />}>
          <QuoteCalculator pricing={pricing} uploadsEnabled={uploadsConfigured()} phone={business.phone} depositPercent={payments.defaultDepositPercent} />
        </Suspense>
      </Container>
    </div>
  );
}
