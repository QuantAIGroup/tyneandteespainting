import { Phone } from "lucide-react";
import { telHref } from "@/config/site";

export function freeEstimateMessage(depositPercent: number): string {
  return `Your online estimate is free. Give us a call to discuss your requirements and agree on your final painting price. Once we've agreed on the job, you can secure your booking with a ${depositPercent}% deposit through our secure online payment system.`;
}

/** The "free estimate – call us" message with a big tap-to-call button. */
export function CallToDiscuss({ phone, depositPercent = 50, compact = false }: { phone: string; depositPercent?: number; compact?: boolean }) {
  const tel = telHref(phone);
  return (
    <div className={`rounded-2xl bg-ink text-white ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <p className={`leading-relaxed text-white/90 ${compact ? "text-[15px]" : "text-lg"}`}>{freeEstimateMessage(depositPercent)}</p>
      <a
        href={tel}
        className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-brand-600 px-6 py-3 text-lg font-extrabold uppercase tracking-wide text-white shadow-lg transition hover:bg-brand-500 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto sm:inline-flex"
      >
        <Phone className="size-5" aria-hidden />
        Call us – {phone}
      </a>
      <p className="mt-3 text-xs text-white/60">No payment is taken for an online estimate. We never ask for a deposit until we&rsquo;ve spoken and agreed your price.</p>
    </div>
  );
}
