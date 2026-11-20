import { AlertTriangle, Info } from "lucide-react";
import { formatPence } from "@/lib/pricing/engine";
import type { QuoteResult } from "@/lib/pricing/types";

export const ESTIMATE_STATEMENT =
  "This is an initial labour-only estimate based on your measurements and selected services. Your photographs will be reviewed before your final fixed quotation is confirmed.";

/**
 * The quotation summary. Used in the calculator and in the admin dashboard,
 * so customers and you always see the same breakdown.
 */
export function QuoteBreakdown({ quote, showWorking = true, title = "Your painting estimate" }: { quote: QuoteResult; showWorking?: boolean; title?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-900/10">
      <div className="bg-ink-950 px-6 py-4">
        <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.16em] text-brand-300">{title}</h3>
      </div>
      <dl className="divide-y divide-ink-900/8 px-6">
        {quote.lines.map((line, i) => (
          <div key={`${line.itemId}-${line.kind}-${i}`} className="flex items-start justify-between gap-4 py-4">
            <dt>
              <span className="block text-[15px] font-medium text-ink-950">
                {line.label}
                {line.kind === "ceiling" && <span className="font-normal text-ink-600"> (optional extra)</span>}
              </span>
              {showWorking && (
                <span className="mt-0.5 block text-sm text-ink-600">
                  {line.quantity.toFixed(2)} {line.unit} × {formatPence(line.ratePence, { alwaysShowPence: true })} = {formatPence(line.calculatedPence, { alwaysShowPence: true })}
                  {line.minimumApplied && line.status === "priced" && <> · minimum charge {formatPence(line.minimumPence)} applies</>}
                </span>
              )}
            </dt>
            <dd className="shrink-0 text-right">
              {line.status === "manual" ? (
                <span className="inline-block rounded bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-900">Manual quote</span>
              ) : (
                <span className="font-semibold text-ink-950">{formatPence(line.amountPence!)}</span>
              )}
            </dd>
          </div>
        ))}
        {quote.roundingAdjustmentPence !== 0 && (
          <div className="flex justify-between gap-4 py-3 text-sm text-ink-600">
            <dt>Rounding adjustment</dt>
            <dd>
              {quote.roundingAdjustmentPence > 0 ? "+" : "−"}
              {formatPence(Math.abs(quote.roundingAdjustmentPence), { alwaysShowPence: true })}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 py-5">
          <dt className="font-semibold uppercase tracking-wide text-ink-950">Total estimated labour</dt>
          <dd className="text-4xl font-extrabold tracking-tight text-brand-600">{quote.hasPricedItems ? formatPence(quote.totalPence) : "To be quoted"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3 text-[15px]">
          <dt className="text-ink-800">Paint and materials</dt>
          <dd className="font-medium text-ink-950">Not included</dd>
        </div>
      </dl>

      {(quote.requiresManualQuote || quote.needsReview) && (
        <div className="space-y-2 border-t border-ink-900/8 bg-brand-50/60 px-6 py-4">
          {quote.requiresManualQuote && (
            <p className="flex gap-2 text-sm text-brand-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>Some items need a manual quotation.</strong> They aren&rsquo;t included in the total above – we&rsquo;ll price them after reviewing your photos.
              </span>
            </p>
          )}
          {quote.flags.map((f, i) => (
            <p key={i} className="flex gap-2 text-sm text-ink-800">
              <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              <span>
                <strong>{f.itemLabel}:</strong> {f.message}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
