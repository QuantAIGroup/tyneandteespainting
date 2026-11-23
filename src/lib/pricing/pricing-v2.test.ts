/**
 * Tests for the November 2026 price revision:
 * skirting £5.50/m (no minimum), ceiling £6/m² (£55 minimum), fixed-price
 * extras, inspection-only extras, exact totals and large rooms.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, withPricingDefaults } from "./defaults";
import { calculateQuote } from "./engine";
import { EXTRAS, EXTRA_KINDS, FIXED_EXTRAS, INSPECTION_EXTRAS, INSPECTION_MESSAGE } from "./extras";
import { LIMITS, pricingSettingsSchema, quoteItemsSchema } from "./schema";
import type { CeilingItem, ExtraItem, ExtraKind, PaintedRoomItem, QuoteItem, SkirtingItem } from "./types";
import { createExtra, validItems, validateDraft, type ItemDraft } from "@/components/calculator/draft";
import { extraUnitPrice, extraWorking, lineWorking, money, optionPrice } from "@/components/calculator/prices";
import { groupLines } from "@/components/calculator/QuoteBreakdown";

const P = DEFAULT_PRICING;
const good: PaintedRoomItem["condition"] = { surface: "good", newlySkimmed: false, colourChange: "similar", wallpaperToRemove: false, dampOrStains: false };

const room = (o: Partial<PaintedRoomItem> = {}): PaintedRoomItem => ({
  id: "r1", type: "bedroom", label: "Bedroom 1", measurementMode: "simple", length: 4, width: 3.5, height: 2.4, walls: [], includeCeiling: false, coats: 2, condition: good, ...o,
});
const skirting = (linearMetres: number, o: Partial<SkirtingItem> = {}): SkirtingItem => ({ id: "s1", type: "skirting", label: "Skirting boards", linearMetres, coats: 2, condition: "good", ...o });
const ceiling = (length: number, width: number, o: Partial<CeilingItem> = {}): CeilingItem => ({
  id: "c1", type: "ceiling", label: "Ceiling", length, width, coats: 2, condition: { surface: "good", newlySkimmed: false, dampOrStains: false }, ...o,
});
const extra = (kind: ExtraKind, quantity: number): ExtraItem => ({ id: `extra-${kind}`, type: "extra", label: EXTRAS[kind].name, extra: kind, quantity });
const total = (items: QuoteItem[]) => calculateQuote(items, P).totalPence;

describe("price list", () => {
  it("has the new labour prices", () => {
    expect(P.skirting).toEqual({ ratePerMetre: 5.5, minimumCharge: 0 });
    expect(P.ceiling).toEqual({ ratePerSqm: 6, minimumCharge: 55 });
    expect(P.extras).toEqual({ door_frame: 30, window_frame: 30, radiator_standard: 30, radiator_large: 45, feature_wall: 55, interior_door: 65 });
    expect(P.roundToNearest).toBe(0);
  });

  it("keeps the existing bedroom and living room prices", () => {
    expect(P.bedroom).toEqual({ ratePerSqm: 5.5, minimumCharge: 185 });
    expect(P.livingRoom).toEqual({ ratePerSqm: 5.5, minimumCharge: 225 });
  });
});

describe("skirting boards – £5.50 per linear metre", () => {
  it("8.5 m = £46.75 (the example in the brief)", () => {
    const q = calculateQuote([skirting(8.5)], P);
    expect(q.totalPence).toBe(4675);
    expect(q.lines[0]).toMatchObject({ quantity: 8.5, unit: "m", ratePence: 550, minimumApplied: false, category: "skirting" });
  });

  it("uses linear metres only (never floor area) and has no minimum charge", () => {
    expect(total([skirting(1)])).toBe(550);
    expect(total([skirting(14)])).toBe(7700);
    expect(total([skirting(0.5)])).toBe(275);
  });

  it("handles decimal measurements", () => {
    expect(total([skirting(12.35)])).toBe(6793); // 12.35 × £5.50 = £67.925 → £67.93
    expect(total([skirting(3.3)])).toBe(1815);
  });
});

describe("ceiling painting – length × width × £6, £55 minimum", () => {
  it("calculates area and price", () => {
    const q = calculateQuote([ceiling(4, 3.5)], P);
    expect(q.lines[0]).toMatchObject({ quantity: 14, unit: "m²", calculatedPence: 8400, amountPence: 8400, minimumApplied: false, category: "ceilings" });
    expect(lineWorking(q.lines[0])).toBe("14.00 m² × £6.00 = £84.00");
  });

  it("applies the £55 minimum to small ceilings", () => {
    const q = calculateQuote([ceiling(3, 2)], P); // 6 m² = £36
    expect(q.lines[0]).toMatchObject({ calculatedPence: 3600, amountPence: 5500, minimumApplied: true });
    expect(lineWorking(q.lines[0])).toBe("6.00 m² × £6.00 = £36.00 · £55.00 minimum charge applies");
  });

  it("does not apply the minimum when the price is above it", () => {
    expect(total([ceiling(3.4, 2.75)])).toBe(5610); // 9.35 m² = £56.10
    expect(total([ceiling(3.25, 2.8)])).toBe(5500); // 9.10 m² = £54.60 → £55 minimum
  });

  it("prices a ceiling added to a room with the same rate and minimum, independently of the walls", () => {
    const q = calculateQuote([room({ includeCeiling: true })], P);
    const c = q.lines.find((l) => l.kind === "ceiling")!;
    expect(c).toMatchObject({ quantity: 14, ratePence: 600, amountPence: 8400, category: "ceilings" });
  });
});

describe("fixed-price extras with quantities", () => {
  const cases: [ExtraKind, number, number][] = [
    ["door_frame", 3, 9000],
    ["window_frame", 2, 6000],
    ["radiator_standard", 2, 6000],
    ["radiator_large", 1, 4500],
    ["radiator_large", 3, 13500],
    ["feature_wall", 2, 11000],
    ["interior_door", 4, 26000],
  ];
  it.each(cases)("%s × %i = %i pence", (kind, qty, expected) => {
    const q = calculateQuote([extra(kind, qty)], P);
    expect(q.totalPence).toBe(expected);
    expect(q.lines[0]).toMatchObject({ unit: "each", quantity: qty, status: "priced", amountPence: expected, minimumApplied: false });
  });

  it("shows the working, e.g. 3 door frames × £30 = £90", () => {
    expect(extraWorking("door_frame", 3, P)).toBe("3 × £30.00 = £90.00");
    const q = calculateQuote([extra("door_frame", 3)], P);
    expect(lineWorking(q.lines[0])).toBe("3 × £30.00 = £90.00");
    expect(q.lines[0].label).toBe("Door frames (3 door frames)");
  });

  it("uses singular wording for one item", () => {
    expect(calculateQuote([extra("radiator_large", 1)], P).lines[0].label).toBe("Large radiators (1 large radiator)");
  });

  it("a painted feature wall is painting only – wallpapering needs a separate quote", () => {
    expect(EXTRAS.feature_wall.inspection).toBe(false);
    expect(EXTRAS.feature_wall.note).toMatch(/wallpaper hanging is not included/i);
    expect(EXTRAS.wallpaper_feature_wall.inspection).toBe(true);
    expect(total([extra("feature_wall", 1)])).toBe(5500);
    expect(total([extra("wallpaper_feature_wall", 1)])).toBe(0);
  });

  it("radiators: standard £30, large £45", () => {
    expect(total([extra("radiator_standard", 1)])).toBe(3000);
    expect(total([extra("radiator_large", 1)])).toBe(4500);
  });
});

describe("inspection-required options", () => {
  it.each(INSPECTION_EXTRAS.map((k) => [k]))("%s needs an inspection and is never auto-priced", (kind) => {
    const q = calculateQuote([extra(kind, 2)], P);
    expect(q.lines[0]).toMatchObject({ status: "manual", amountPence: null });
    expect(q.totalPence).toBe(0);
    expect(q.requiresManualQuote).toBe(true);
    expect(q.flags[0].message).toContain(INSPECTION_MESSAGE);
    expect(extraUnitPrice(kind, P)).toBe(INSPECTION_MESSAGE);
  });

  it("covers unusual sash windows, decorative radiators and complex woodwork", () => {
    expect(INSPECTION_EXTRAS).toEqual(expect.arrayContaining(["sash_window", "decorative_radiator", "complex_woodwork"]));
  });

  it("doesn't stop the other items being priced", () => {
    const q = calculateQuote([extra("door_frame", 2), extra("sash_window", 1)], P);
    expect(q.totalPence).toBe(6000);
    expect(q.hasPricedItems).toBe(true);
  });
});

describe("every option shows a price or an inspection message – never blank", () => {
  it("every extra has a fixed price or the inspection message", () => {
    for (const kind of EXTRA_KINDS) {
      const text = extraUnitPrice(kind, P);
      expect(text).toMatch(/^£\d+\.\d{2} each$|^Inspection and separate quotation required$/);
    }
  });

  it("every line is either priced (a whole number of pence) or marked for inspection", () => {
    const items: QuoteItem[] = [room({ includeCeiling: true }), skirting(10), ceiling(3, 3), ...EXTRA_KINDS.map((k) => extra(k, 2))];
    for (const line of calculateQuote(items, P).lines) {
      if (line.status === "priced") expect(Number.isInteger(line.amountPence)).toBe(true);
      else expect(line).toMatchObject({ status: "manual", amountPence: null });
    }
  });

  it("every room option shows its rate (and minimum where there is one)", () => {
    expect(optionPrice("ceiling", P)).toBe("£6.00 per m² · £55.00 minimum");
    expect(optionPrice("skirting", P)).toBe("£5.50 per linear metre");
    expect(optionPrice("bedroom", P)).toBe("£5.50 per m² of wall · £185.00 minimum");
    expect(optionPrice("living_room", P)).toBe("£5.50 per m² of wall · £225.00 minimum");
  });

  it("formats GBP to two decimal places", () => {
    expect(money(4675)).toBe("£46.75");
    expect(money(9000)).toBe("£90.00");
    expect(money(123456)).toBe("£1,234.56");
  });
});

describe("combined room and extras totals", () => {
  const items: QuoteItem[] = [
    room({ includeCeiling: true }), // walls 36 m² × £5.50 = £198.00; ceiling 14 m² × £6 = £84.00
    skirting(14.5), // £79.75
    extra("door_frame", 3), // £90.00
    extra("radiator_large", 1), // £45.00
    extra("interior_door", 2), // £130.00
    extra("complex_woodwork", 1), // inspection – not in total
  ];
  const q = calculateQuote(items, P);

  it("adds everything up exactly – no rounding", () => {
    expect(q.subtotalPence).toBe(19800 + 8400 + 7975 + 9000 + 4500 + 13000);
    expect(q.totalPence).toBe(62675); // £626.75
    expect(q.roundingAdjustmentPence).toBe(0);
    expect(q.requiresManualQuote).toBe(true);
  });

  it("groups the itemised breakdown by service", () => {
    const groups = groupLines(q.lines);
    expect(groups.map((g) => g.label)).toEqual(["Main room painting", "Ceiling painting", "Skirting boards", "Door frames", "Radiators", "Interior doors", "Other woodwork"]);
    expect(groups.find((g) => g.category === "door_frames")!.subtotalPence).toBe(9000);
    expect(groups.find((g) => g.category === "woodwork")!.hasManual).toBe(true);
  });

  it("can still round to £5 if switched on in the admin area", () => {
    expect(calculateQuote(items, { ...P, roundToNearest: 5 }).totalPence).toBe(62500);
  });
});

describe("large rooms", () => {
  it("prices a very large room at the normal rate instead of failing", () => {
    const big = room({ type: "living_room", length: 30, width: 20, height: 3 }); // 300 m² of wall
    expect(quoteItemsSchema.safeParse([big]).success).toBe(true);
    const q = calculateQuote([big], P);
    expect(q.totalPence).toBe(165000); // 300 × £5.50
    expect(q.needsReview).toBe(true); // flagged so you can check the measurements
    expect(q.flags[0].message).toMatch(/large area/i);
  });

  it("accepts rooms far bigger than the old 20 m limit", () => {
    expect(quoteItemsSchema.safeParse([room({ length: 45, width: 25 })]).success).toBe(true);
    expect(quoteItemsSchema.safeParse([ceiling(60, 40)]).success).toBe(true);
    expect(quoteItemsSchema.safeParse([skirting(800)]).success).toBe(true);
    expect(total([ceiling(60, 40)])).toBe(1440000); // 2,400 m² × £6
  });

  it("only rejects obvious typing mistakes, with a clear message", () => {
    const r = validateDraft({ ...room(), length: 40000, walls: [] } as unknown as ItemDraft);
    expect(r.item).toBeNull();
    expect(r.errors.length).toBe(`Room length must be between ${LIMITS.roomLength.min} m and ${LIMITS.roomLength.max} m`);
  });
});

describe("empty and invalid measurement fields", () => {
  it("an empty skirting length asks for a measurement instead of pricing at £0", () => {
    const r = validateDraft({ id: "s", type: "skirting", label: "Skirting", linearMetres: null, coats: 2, condition: "good" });
    expect(r.item).toBeNull();
    expect(r.errors.linearMetres).toBe("Skirting length is required");
  });

  it("an empty ceiling dimension is flagged", () => {
    const r = validateDraft({ id: "c", type: "ceiling", label: "Ceiling", length: null, width: 3, coats: 2, condition: { surface: "good", newlySkimmed: false, dampOrStains: false } });
    expect(r.errors.length).toBe("Ceiling length is required");
  });

  it("rejects zero, negative and non-numbers", () => {
    expect(quoteItemsSchema.safeParse([skirting(0)]).success).toBe(false);
    expect(quoteItemsSchema.safeParse([ceiling(-2, 3)]).success).toBe(false);
    expect(quoteItemsSchema.safeParse([ceiling(Number.NaN, 3)]).success).toBe(false);
    expect(quoteItemsSchema.safeParse([skirting(Number.POSITIVE_INFINITY)]).success).toBe(false);
  });

  it("an empty or invalid quantity is flagged", () => {
    expect(validateDraft({ ...createExtra("door_frame"), quantity: null }).errors.quantity).toBe("Quantity is required");
    expect(validateDraft({ ...createExtra("door_frame"), quantity: 0 }).item).toBeNull();
    expect(validateDraft({ ...createExtra("door_frame"), quantity: 2.5 }).errors.quantity).toBe("Quantity must be a whole number");
    expect(validateDraft({ ...createExtra("door_frame"), quantity: 51 }).item).toBeNull();
  });

  it("never returns undefined or NaN totals while fields are empty", () => {
    const drafts: ItemDraft[] = [{ id: "s", type: "skirting", label: "Skirting", linearMetres: null, coats: 2, condition: "good" }, { ...createExtra("door_frame"), quantity: null }];
    const q = calculateQuote(validItems(drafts), P);
    expect(q.totalPence).toBe(0);
    expect(Number.isInteger(q.totalPence)).toBe(true);
    expect(q.hasPricedItems).toBe(false);
  });
});

describe("selecting and deselecting options", () => {
  it("adding an extra adds its price; removing it takes the price away", () => {
    let drafts: ItemDraft[] = [{ id: "s", type: "skirting", label: "Skirting", linearMetres: 10, coats: 2, condition: "good" }];
    const priced = () => calculateQuote(validItems(drafts), P).totalPence;
    expect(priced()).toBe(5500);
    drafts = [...drafts, createExtra("radiator_standard")];
    expect(priced()).toBe(5500 + 3000);
    drafts = drafts.map((d) => (d.type === "extra" ? { ...d, quantity: 3 } : d));
    expect(priced()).toBe(5500 + 9000);
    drafts = drafts.filter((d) => d.type !== "extra");
    expect(priced()).toBe(5500);
  });

  it("each extra is one selectable option (quantity covers multiples)", () => {
    expect(createExtra("door_frame").id).toBe(createExtra("door_frame").id);
    expect(createExtra("door_frame").quantity).toBe(1);
  });
});

describe("saved price list compatibility", () => {
  it("an older saved price list keeps its saved prices and gains the new extras", () => {
    const older = { bedroom: { ratePerSqm: 6, minimumCharge: 190 }, livingRoom: { ratePerSqm: 5.5, minimumCharge: 225 }, skirting: { ratePerMetre: 5, minimumCharge: 65 }, ceiling: { ratePerSqm: 5.5, minimumCharge: 65 }, roundToNearest: 5, standardCoats: 2 };
    const parsed = pricingSettingsSchema.parse(withPricingDefaults(older));
    expect(parsed.bedroom.ratePerSqm).toBe(6); // saved value kept
    expect(parsed.skirting.ratePerMetre).toBe(5); // saved value kept until the database is updated
    expect(parsed.extras).toEqual(P.extras); // new extras filled in
  });

  it("a saved price for an extra overrides the default", () => {
    const parsed = pricingSettingsSchema.parse(withPricingDefaults({ ...P, extras: { ...P.extras, door_frame: 35 } }));
    expect(parsed.extras.door_frame).toBe(35);
    expect(parsed.extras.radiator_large).toBe(45);
  });

  it("every fixed extra has a price setting", () => {
    expect(Object.keys(P.extras).sort()).toEqual([...FIXED_EXTRAS].sort());
  });
});
