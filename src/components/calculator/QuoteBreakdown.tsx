import { AlertTriangle, Info } from "lucide-react";
import { INSPECTION_MESSAGE } from "@/lib/pricing/extras";
import type { LineCategory, QuoteLine, QuoteResult } from "@/lib/pricing/types";
import { lineWorking, money } from "./prices";

/** Breakdown sections, in the order customers see them. */
export const CATEGORY_LABELS: [LineCategory, string][] = [
  ["rooms", "Main room painting"],
  ["ceilings", "Ceiling painting"],
  ["skirting", "Skirting boards"],
  ["door_frames", "Door frames"],
  ["windows", "Window frames/sills"],
  ["radiators", "Radiators"],
  ["feature_walls", "Feature walls"],
  ["interior_doors", "Interior doors"],
  ["woodwork", "Other woodwork"],
];

export function groupLines(lines: QuoteLine[]): { category: LineCategory; label: string; lines: QuoteLine[]; subtotalPence: number; hasManual: boolean }[] {
  return CATEGORY_LABELS.map(([category, label]) => {
    const group = lines.filter((l) => l.category === category);
    return {
      category,
      label,
      lines: group,
      subtotalPence: group.reduce((s, l) => s + (l.amountPence ?? 0), 0),
      hasManual: group.some((l) => l.status === "manual"),
    };
  }).filter((g) => g.lines.length > 0);
}

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
      <dl className="px-6">
        {groupLines(quote.lines).map((group) => (
          <div key={group.category} className="border-b border-ink-900/8 py-3">
            <div className="flex items-baseline justify-between gap-4 pb-1">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-700">{group.label}</dt>
              {group.lines.length > 1 && group.subtotalPence > 0 && <dd className="text-xs font-semibold text-ink-700">Subtotal {money(group.subtotalPence)}</dd>}
            </div>
            {group.lines.map((line, i) => (
              <div key={`${line.itemId}-${line.kind}-${i}`} className="flex items-start justify-between gap-4 py-2">
                <dt>
                  <span className="block text-[15px] font-medium text-ink-950">{line.label}</span>
                  {showWorking && line.status === "priced" && <span className="mt-0.5 block text-sm text-ink-600">{lineWorking(line)}</span>}
                </dt>
                <dd className="shrink-0 text-right">
                  {line.status === "manual" ? (
                    <span className="inline-block max-w-[11rem] rounded bg-brand-50 px-2 py-1 text-xs font-semibold leading-snug text-brand-900">{INSPECTION_MESSAGE}</span>
                  ) : (
                    <span className="font-semibold text-ink-950">{money(line.amountPence!)}</span>
                  )}
                </dd>
              </div>
            ))}
          </div>
        ))}
        {quote.roundingAdjustmentPence !== 0 && (
          <div className="flex justify-between gap-4 py-3 text-sm text-ink-600">
            <dt>Rounding adjustment</dt>
            <dd>
              {quote.roundingAdjustmentPence > 0 ? "+" : "−"}
              {money(Math.abs(quote.roundingAdjustmentPence))}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 py-5">
          <dt className="font-semibold uppercase tracking-wide text-ink-950">Total estimated labour</dt>
          <dd className="text-right text-4xl font-extrabold tracking-tight text-brand-600">{quote.hasPricedItems ? money(quote.totalPence) : <span className="text-xl">{INSPECTION_MESSAGE}</span>}</dd>
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
                <strong>Some items need an inspection and a separate quotation.</strong> They aren&rsquo;t included in the total above – we&rsquo;ll price them after reviewing your photos or visiting.
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
