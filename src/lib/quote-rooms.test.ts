import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING } from "./pricing/defaults";
import { calculateQuote } from "./pricing/engine";
import type { CeilingItem, PaintedRoomItem, QuoteItem, SkirtingItem } from "./pricing/types";
import { buildQuoteRoomRows } from "./quote-rooms";

const good: PaintedRoomItem["condition"] = {
  surface: "good",
  newlySkimmed: false,
  colourChange: "similar",
  wallpaperToRemove: false,
  dampOrStains: false,
};

const bedroom: PaintedRoomItem = {
  id: "r1", type: "bedroom", label: "Bedroom 1", measurementMode: "simple",
  length: 4, width: 3.5, height: 2.4, walls: [], includeCeiling: true, coats: 2, condition: good,
};
const lounge: PaintedRoomItem = {
  id: "r2", type: "living_room", label: "Lounge", measurementMode: "walls",
  length: 0, width: 0, height: 0, walls: [{ width: 4, height: 2.5 }, { width: 3, height: 2.5 }],
  includeCeiling: false, coats: 2, condition: { ...good, wallpaperToRemove: true },
};
const skirting: SkirtingItem = { id: "s1", type: "skirting", label: "Skirting", linearMetres: 15, coats: 2, condition: "good" };
const ceiling: CeilingItem = {
  id: "c1", type: "ceiling", label: "Hall ceiling", length: 3, width: 2, coats: 2,
  condition: { surface: "good", newlySkimmed: false, dampOrStains: false },
};

describe("buildQuoteRoomRows", () => {
  const items: QuoteItem[] = [bedroom, lounge, skirting, ceiling];
  const quote = calculateQuote(items, DEFAULT_PRICING);
  const rows = buildQuoteRoomRows("enq-1", items, quote);

  it("makes one row per item, in order", () => {
    expect(rows.map((r) => [r.position, r.item_type, r.label])).toEqual([
      [0, "bedroom", "Bedroom 1"],
      [1, "living_room", "Lounge"],
      [2, "skirting", "Skirting"],
      [3, "ceiling", "Hall ceiling"],
    ]);
    expect(rows.every((r) => r.enquiry_id === "enq-1")).toBe(true);
  });

  it("stores measurements and areas", () => {
    expect(rows[0]).toMatchObject({ length_m: 4, width_m: 3.5, height_m: 2.4, wall_area_sqm: 36, ceiling_area_sqm: 14, walls: null });
    expect(rows[1]).toMatchObject({ measurement_mode: "walls", height_m: null, length_m: null, walls: lounge.walls, wall_area_sqm: 17.5 });
    expect(rows[2]).toMatchObject({ skirting_length_m: 15, wall_area_sqm: null });
    expect(rows[3]).toMatchObject({ length_m: 3, width_m: 2, ceiling_area_sqm: 6 });
  });

  it("uses exactly the engine's line prices (walls + ceiling for a room)", () => {
    const sumFor = (id: string) => quote.lines.filter((l) => l.itemId === id).reduce((s, l) => s + (l.amountPence ?? 0), 0);
    expect(rows[0].estimated_labour_pence).toBe(sumFor("r1"));
    expect(rows[2].estimated_labour_pence).toBe(sumFor("s1"));
    expect(rows[3].estimated_labour_pence).toBe(sumFor("c1"));
    // Priced rows add up to the engine's subtotal (before rounding)
    const total = rows.reduce((s, r) => s + (r.estimated_labour_pence ?? 0), 0);
    expect(total).toBe(quote.subtotalPence);
  });

  it("leaves the price empty when a room needs a manual quote", () => {
    expect(rows[1]).toMatchObject({ requires_manual_quote: true, estimated_labour_pence: null });
    expect(rows[0].requires_manual_quote).toBe(false);
  });
});
