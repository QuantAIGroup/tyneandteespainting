import { INSPECTION_MESSAGE } from "@/lib/pricing/extras";
import type { QuoteLine } from "@/lib/pricing/types";
import { lineWorking, money } from "./prices";

/**
 * The live price for one room or service, shown right under its measurements.
 * Always shows a price, an "inspection required" message, or what's missing –
 * never a blank.
 */
export function ItemPrice({ lines, valid }: { lines: QuoteLine[]; valid: boolean }) {
  if (!valid || lines.length === 0) {
    return (
      <div className="mt-5 rounded-lg bg-grey-50 px-4 py-3 text-sm text-ink-700 ring-1 ring-grey-200" aria-live="polite">
        Enter the measurements above to see the price for this item.
      </div>
    );
  }
  const manual = lines.some((l) => l.status === "manual");
  const total = lines.reduce((s, l) => s + (l.amountPence ?? 0), 0);
  return (
    <div className="mt-5 rounded-lg bg-brand-50/60 px-4 py-3 ring-1 ring-brand-600/20" aria-live="polite">
      <ul className="space-y-1 text-sm text-ink-800">
        {lines.map((l, i) => (
          <li key={i}>
            <span className="font-medium text-ink-950">{l.kind === "ceiling" ? "Ceiling" : l.kind === "skirting" ? "Skirting" : "Walls"}:</span> {lineWorking(l)}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-baseline justify-between gap-3 border-t border-brand-600/15 pt-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink-950">Price for this item</span>
        <span className="text-lg font-extrabold text-brand-600">{manual ? INSPECTION_MESSAGE : money(total)}</span>
      </p>
    </div>
  );
}
