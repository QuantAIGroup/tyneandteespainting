import type { ItemDraft } from "./draft";
import { ITEM_NAMES } from "./draft";

const m = (n: number | null) => (n === null ? "–" : `${(Math.round(n * 100) / 100).toFixed(2)} m`);

function describe(item: ItemDraft): string {
  if (item.type === "skirting") return `${m(item.linearMetres)} of skirting`;
  if (item.type === "ceiling") return `${m(item.length)} × ${m(item.width)}`;
  const walls = item.measurementMode === "walls" ? `${item.walls.length} walls measured individually` : `${m(item.length)} × ${m(item.width)}, walls ${m(item.height)} high`;
  return item.includeCeiling ? `${walls} · plus ceiling (optional extra)` : walls;
}

/** "Selected service" and "room measurements" shown with the estimate. */
export function RoomSummary({ items }: { items: ItemDraft[] }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-ink-950/10">
      <h3 className="border-b border-ink-950/8 px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink-700">Your rooms &amp; measurements</h3>
      <ul className="divide-y divide-ink-950/8">
        {items.map((item) => (
          <li key={item.id} className="px-5 py-3">
            <p className="font-semibold text-ink-950">
              {item.label} <span className="font-normal text-ink-600">· {ITEM_NAMES[item.type]}</span>
            </p>
            <p className="text-sm text-ink-700">{describe(item)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
