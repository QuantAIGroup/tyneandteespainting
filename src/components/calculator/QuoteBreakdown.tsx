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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-navy-900/10">
      <div className="bg-navy-950 px-6 py-4">
        <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.16em] text-gold-300">{title}</h3>
      </div>
      <dl className="divide-y divide-navy-900/8 px-6">
        {quote.lines.map((line, i) => (
          <div key={`${line.itemId}-${line.kind}-${i}`} className="flex items-start justify-between gap-4 py-4">
            <dt>
              <span className="block text-[15px] font-medium text-navy-950">{line.label}</span>
              {showWorking && (
                <span className="mt-0.5 block text-sm text-navy-600">
                  {line.quantity.toFixed(2)} {line.unit} × {formatPence(line.ratePence, { alwaysShowPence: true })} = {formatPence(line.calculatedPence, { alwaysShowPence: true })}
                  {line.minimumApplied && line.status === "priced" && <> · minimum charge {formatPence(line.minimumPence)} applies</>}
                </span>
              )}
            </dt>
            <dd className="shrink-0 text-right">
              {line.status === "manual" ? (
                <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Manual quote</span>
              ) : (
                <span className="font-semibold text-navy-950">{formatPence(line.amountPence!)}</span>
              )}
            </dd>
          </div>
        ))}
        {quote.roundingAdjustmentPence !== 0 && (
          <div className="flex justify-between gap-4 py-3 text-sm text-navy-600">
            <dt>Rounding adjustment</dt>
            <dd>
              {quote.roundingAdjustmentPence > 0 ? "+" : "−"}
              {formatPence(Math.abs(quote.roundingAdjustmentPence), { alwaysShowPence: true })}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 py-5">
          <dt className="font-semibold uppercase tracking-wide text-navy-950">Total labour</dt>
          <dd className="font-serif text-3xl text-navy-950">{quote.hasPricedItems ? formatPence(quote.totalPence) : "To be quoted"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3 text-[15px]">
          <dt className="text-navy-800">Paint and materials</dt>
          <dd className="font-medium text-navy-950">Not included</dd>
        </div>
      </dl>

      {(quote.requiresManualQuote || quote.needsReview) && (
        <div className="space-y-2 border-t border-navy-900/8 bg-amber-50/60 px-6 py-4">
          {quote.requiresManualQuote && (
            <p className="flex gap-2 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>Some items need a manual quotation.</strong> They aren&rsquo;t included in the total above – we&rsquo;ll price them after reviewing your photos.
              </span>
            </p>
          )}
          {quote.flags.map((f, i) => (
            <p key={i} className="flex gap-2 text-sm text-navy-800">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
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
