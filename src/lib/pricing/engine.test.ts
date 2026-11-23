import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING } from "./defaults";
import {
  calculateQuote,
  ceilingArea,
  formatPence,
  priceLine,
  roundToNearestPounds,
  simpleWallArea,
  wallsArea,
} from "./engine";
import { quoteItemsSchema } from "./schema";
import type { CeilingItem, PaintedRoomItem, PricingSettings, SkirtingItem } from "./types";

/**
 * The launch price list (Nov 2026), before the Nov 2026 price revision:
 * skirting £5/m (£65 min), ceiling £5.50/m² (£65 min), total rounded to £5.
 * These original tests keep using it so the maths they check (minimums,
 * £5 rounding, per-m² rates) is still tested with exactly the same numbers.
 * The new prices are tested in pricing-v2.test.ts.
 */
const PREVIOUS_PRICING: PricingSettings = {
  ...DEFAULT_PRICING,
  bedroom: { ratePerSqm: 5.5, minimumCharge: 185 },
  livingRoom: { ratePerSqm: 5.5, minimumCharge: 225 },
  skirting: { ratePerMetre: 5, minimumCharge: 65 },
  ceiling: { ratePerSqm: 5.5, minimumCharge: 65 },
  roundToNearest: 5,
  standardCoats: 2,
};

const goodCondition: PaintedRoomItem["condition"] = {
  surface: "good",
  newlySkimmed: false,
  colourChange: "similar",
  wallpaperToRemove: false,
  dampOrStains: false,
};

function room(overrides: Partial<PaintedRoomItem> = {}): PaintedRoomItem {
  return {
    id: "r1",
    type: "bedroom",
    label: "Bedroom 1",
    measurementMode: "simple",
    length: 4,
    width: 3.5,
    height: 2.4,
    walls: [],
    includeCeiling: false,
    coats: 2,
    condition: { ...goodCondition },
    ...overrides,
  };
}

function skirting(overrides: Partial<SkirtingItem> = {}): SkirtingItem {
  return { id: "s1", type: "skirting", label: "Skirting boards", linearMetres: 15, coats: 2, condition: "good", ...overrides };
}

function ceiling(overrides: Partial<CeilingItem> = {}): CeilingItem {
  return {
    id: "c1",
    type: "ceiling",
    label: "Ceiling",
    length: 3,
    width: 3,
    coats: 2,
    condition: { surface: "good", newlySkimmed: false, dampOrStains: false },
    ...overrides,
  };
}

describe("area calculations", () => {
  it("calculates wall area as 2 × (length + width) × height", () => {
    expect(simpleWallArea(4, 3.5, 2.4)).toBe(36);
    expect(simpleWallArea(5, 4, 2.5)).toBe(45);
  });

  it("sums individual walls for irregular rooms", () => {
    expect(wallsArea([{ width: 4, height: 2.4 }, { width: 3.5, height: 2.4 }, { width: 1.2, height: 2.4 }])).toBe(20.88);
  });

  it("calculates ceiling area as length × width", () => {
    expect(ceilingArea(4, 3.5)).toBe(14);
  });

  it("rounds areas to 2 decimal places", () => {
    expect(simpleWallArea(3.33, 3.33, 2.33)).toBe(31.04); // 31.0356
  });
});

describe("priceLine and minimum charges", () => {
  it("multiplies quantity by rate", () => {
    const r = priceLine(36, 5.5, 185);
    expect(r.calculatedPence).toBe(19800);
    expect(r.amountPence).toBe(19800);
    expect(r.minimumApplied).toBe(false);
  });

  it("applies the minimum charge when the calculated price is lower", () => {
    const r = priceLine(20, 5.5, 185); // £110
    expect(r.calculatedPence).toBe(11000);
    expect(r.amountPence).toBe(18500);
    expect(r.minimumApplied).toBe(true);
  });

  it("does not apply the minimum when the price equals it exactly", () => {
    const r = priceLine(37, 5, 185);
    expect(r.amountPence).toBe(18500);
    expect(r.minimumApplied).toBe(false);
  });
});

describe("rounding", () => {
  it("rounds to the nearest £5", () => {
    expect(roundToNearestPounds(19800, 5)).toBe(20000); // £198 → £200
    expect(roundToNearestPounds(19700, 5)).toBe(19500); // £197 → £195
    expect(roundToNearestPounds(19750, 5)).toBe(20000); // £197.50 → £200 (half rounds up)
    expect(roundToNearestPounds(19749, 5)).toBe(19500);
  });

  it("leaves the price alone when rounding is switched off", () => {
    expect(roundToNearestPounds(19812, 0)).toBe(19812);
  });
});

describe("calculateQuote", () => {
  it("prices a single bedroom", () => {
    const q = calculateQuote([room()], PREVIOUS_PRICING);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].quantity).toBe(36);
    expect(q.subtotalPence).toBe(19800);
    expect(q.totalPence).toBe(20000);
    expect(q.roundingAdjustmentPence).toBe(200);
    expect(q.requiresManualQuote).toBe(false);
  });

  it("applies the bedroom minimum of £185 to a small bedroom", () => {
    const q = calculateQuote([room({ length: 2.5, width: 2, height: 2.4 })], PREVIOUS_PRICING); // 21.6 m² = £118.80
    expect(q.lines[0].minimumApplied).toBe(true);
    expect(q.totalPence).toBe(18500);
  });

  it("applies the living room minimum of £225", () => {
    const q = calculateQuote([room({ type: "living_room", label: "Living room", length: 3, width: 3, height: 2.4 })], PREVIOUS_PRICING); // 28.8 m² = £158.40
    expect(q.lines[0].amountPence).toBe(22500);
    expect(q.totalPence).toBe(22500);
  });

  it("prices skirting boards per linear metre with a £65 minimum", () => {
    expect(calculateQuote([skirting({ linearMetres: 15 })], PREVIOUS_PRICING).totalPence).toBe(7500);
    expect(calculateQuote([skirting({ linearMetres: 8 })], PREVIOUS_PRICING).totalPence).toBe(6500);
  });

  it("prices a room ceiling as a separate line with its own minimum", () => {
    const q = calculateQuote([room({ includeCeiling: true })], PREVIOUS_PRICING);
    expect(q.lines).toHaveLength(2);
    const ceilingLine = q.lines.find((l) => l.kind === "ceiling")!;
    expect(ceilingLine.quantity).toBe(14); // 4 × 3.5
    expect(ceilingLine.calculatedPence).toBe(7700); // 14 × £5.50
    expect(ceilingLine.amountPence).toBe(7700);
    expect(q.subtotalPence).toBe(19800 + 7700);
    expect(q.totalPence).toBe(27500);
  });

  it("applies the ceiling minimum to a small standalone ceiling", () => {
    const q = calculateQuote([ceiling({ length: 2, width: 2 })], PREVIOUS_PRICING); // 4 m² = £22
    expect(q.lines[0].amountPence).toBe(6500);
  });

  it("combines multiple rooms and services into one total", () => {
    const items = [
      room({ id: "b1", label: "Bedroom 1" }), // £198
      room({ id: "b2", label: "Bedroom 2", length: 2.5, width: 2, height: 2.4 }), // min £185
      room({ id: "l1", type: "living_room", label: "Living room", length: 5, width: 4, height: 2.5 }), // 45 m² = £247.50
      skirting({ linearMetres: 40 }), // £200
    ];
    const q = calculateQuote(items, PREVIOUS_PRICING);
    expect(q.lines).toHaveLength(4);
    expect(q.subtotalPence).toBe(19800 + 18500 + 24750 + 20000); // £830.50
    expect(q.totalPence).toBe(83000);
    expect(q.roundingAdjustmentPence).toBe(-50);
  });

  it("matches the example in the brief (bedroom £200, skirting £75, ceiling £65 → £340)", () => {
    const q = calculateQuote(
      [room({ length: 4, width: 3.5, height: 2.4 }), skirting({ linearMetres: 15 }), ceiling({ length: 2, width: 2 })],
      PREVIOUS_PRICING,
    );
    // £198 + £75 + £65 = £338 → rounded to £340
    expect(q.totalPence).toBe(34000);
  });

  it("uses individual wall measurements for irregular rooms", () => {
    const q = calculateQuote(
      [room({ measurementMode: "walls", walls: [{ width: 5, height: 2.4 }, { width: 4, height: 2.4 }, { width: 5, height: 2.4 }, { width: 4, height: 2.4 }] })],
      PREVIOUS_PRICING,
    );
    expect(q.lines[0].quantity).toBe(43.2);
    expect(q.subtotalPence).toBe(23760);
    expect(q.totalPence).toBe(24000); // £237.60 → nearest £5 = £240
  });

  it("uses whatever prices are configured in settings", () => {
    const custom: PricingSettings = { ...PREVIOUS_PRICING, bedroom: { ratePerSqm: 6, minimumCharge: 200 }, roundToNearest: 10 };
    const q = calculateQuote([room()], custom); // 36 × £6 = £216 → nearest £10 = £220
    expect(q.totalPence).toBe(22000);
  });

  it("never charges for paint or materials (only labour lines exist)", () => {
    const q = calculateQuote([room({ includeCeiling: true }), skirting()], PREVIOUS_PRICING);
    expect(q.lines.every((l) => ["walls", "ceiling", "skirting"].includes(l.kind))).toBe(true);
  });
});

describe("manual quotations and review flags", () => {
  it("does not auto-price a room with major damage", () => {
    const q = calculateQuote([room({ condition: { ...goodCondition, surface: "major_damage" } })], PREVIOUS_PRICING);
    expect(q.requiresManualQuote).toBe(true);
    expect(q.lines[0].status).toBe("manual");
    expect(q.lines[0].amountPence).toBeNull();
    expect(q.totalPence).toBe(0);
    expect(q.hasPricedItems).toBe(false);
  });

  it("requires a manual quote for wallpaper removal and damp", () => {
    expect(calculateQuote([room({ condition: { ...goodCondition, wallpaperToRemove: true } })], PREVIOUS_PRICING).requiresManualQuote).toBe(true);
    expect(calculateQuote([room({ condition: { ...goodCondition, dampOrStains: true } })], PREVIOUS_PRICING).requiresManualQuote).toBe(true);
  });

  it("also withholds the ceiling price for a room needing a manual quote", () => {
    const q = calculateQuote([room({ includeCeiling: true, condition: { ...goodCondition, wallpaperToRemove: true } })], PREVIOUS_PRICING);
    expect(q.lines.every((l) => l.status === "manual")).toBe(true);
  });

  it("still prices other rooms when one needs a manual quote", () => {
    const q = calculateQuote([room({ id: "a" }), room({ id: "b", condition: { ...goodCondition, surface: "major_damage" } })], PREVIOUS_PRICING);
    expect(q.requiresManualQuote).toBe(true);
    expect(q.hasPricedItems).toBe(true);
    expect(q.totalPence).toBe(20000);
  });

  it("includes minor defects in the standard price with no flag", () => {
    const q = calculateQuote([room({ condition: { ...goodCondition, surface: "minor_defects" } })], PREVIOUS_PRICING);
    expect(q.flags).toHaveLength(0);
    expect(q.totalPence).toBe(20000);
  });

  it("flags extra coats for review but keeps the standard price", () => {
    const q = calculateQuote([room({ coats: 3 })], PREVIOUS_PRICING);
    expect(q.needsReview).toBe(true);
    expect(q.requiresManualQuote).toBe(false);
    expect(q.totalPence).toBe(20000);
  });

  it("flags new plaster and significant colour changes for review", () => {
    expect(calculateQuote([room({ condition: { ...goodCondition, newlySkimmed: true } })], PREVIOUS_PRICING).needsReview).toBe(true);
    expect(calculateQuote([room({ condition: { ...goodCondition, colourChange: "significant" } })], PREVIOUS_PRICING).needsReview).toBe(true);
  });

  it("flags bare-wood skirting for review and damaged skirting for a manual quote", () => {
    expect(calculateQuote([skirting({ condition: "bare_wood" })], PREVIOUS_PRICING).needsReview).toBe(true);
    expect(calculateQuote([skirting({ condition: "major_damage" })], PREVIOUS_PRICING).requiresManualQuote).toBe(true);
  });
});

describe("validation", () => {
  it("accepts valid items", () => {
    expect(quoteItemsSchema.safeParse([room(), skirting(), ceiling()]).success).toBe(true);
  });

  it("rejects impossible measurements", () => {
    expect(quoteItemsSchema.safeParse([room({ height: 25 })]).success).toBe(false);
    expect(quoteItemsSchema.safeParse([room({ length: -1 })]).success).toBe(false);
    expect(quoteItemsSchema.safeParse([skirting({ linearMetres: 0 })]).success).toBe(false);
  });

  it("accepts an irregular room measured wall-by-wall without a ceiling (no length/width needed)", () => {
    const r = quoteItemsSchema.safeParse([
      { ...room({ measurementMode: "walls", walls: [{ width: 3, height: 2.4 }] }), length: undefined, width: undefined, height: undefined },
    ]);
    expect(r.success).toBe(true);
  });

  it("requires ceiling measurements for an irregular room when the ceiling is included", () => {
    const r = quoteItemsSchema.safeParse([
      { ...room({ measurementMode: "walls", includeCeiling: true, walls: [{ width: 3, height: 2.4 }] }), length: undefined, width: undefined },
    ]);
    expect(r.success).toBe(false);
  });

  it("rejects an empty quotation", () => {
    expect(quoteItemsSchema.safeParse([]).success).toBe(false);
  });
});

describe("formatPence", () => {
  it("formats whole pounds without pence and other amounts with pence", () => {
    expect(formatPence(34000)).toBe("£340");
    expect(formatPence(19800)).toBe("£198");
    expect(formatPence(24750)).toBe("£247.50");
    expect(formatPence(123400)).toBe("£1,234");
  });
});
