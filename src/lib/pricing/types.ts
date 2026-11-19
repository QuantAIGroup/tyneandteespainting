/**
 * Types for the pricing engine.
 *
 * All money inside the engine is handled in PENCE (whole numbers) to avoid
 * floating-point rounding problems. Settings are stored in POUNDS because that
 * is easier to edit in the admin area. Measurements are always in METRES.
 */

export type RoomType = "bedroom" | "living_room";
export type ItemType = RoomType | "skirting" | "ceiling";

/** Labour prices. Every value is editable from /admin/settings. */
export interface PricingSettings {
  bedroom: { ratePerSqm: number; minimumCharge: number };
  livingRoom: { ratePerSqm: number; minimumCharge: number };
  skirting: { ratePerMetre: number; minimumCharge: number };
  ceiling: { ratePerSqm: number; minimumCharge: number };
  /** Final total is rounded to the nearest multiple of this many pounds (e.g. 5). 0 = no rounding. */
  roundToNearest: number;
  /** Number of coats included in the standard price (normally 2). */
  standardCoats: number;
}

export type SurfaceCondition = "good" | "minor_defects" | "major_damage";

export interface RoomCondition {
  /** good = no work needed, minor_defects = small nail holes / hairline cracks (included), major_damage = manual quote */
  surface: SurfaceCondition;
  /** Newly skimmed plaster needs a mist coat, so it is flagged for review. */
  newlySkimmed: boolean;
  /** A big colour change can need extra coats, so it is flagged for review. */
  colourChange: "similar" | "significant";
  /** Wallpaper removal is not part of the service – manual quote. */
  wallpaperToRemove: boolean;
  /** Damp, mould, smoke or water stains need specialist treatment – manual quote. */
  dampOrStains: boolean;
}

export interface WallMeasurement {
  width: number;
  height: number;
}

export interface PaintedRoomItem {
  id: string;
  type: RoomType;
  label: string;
  /** "simple" = length × width × height. "walls" = each wall measured separately (irregular rooms). */
  measurementMode: "simple" | "walls";
  /** Floor length (m). Used for wall area in simple mode and for the ceiling. */
  length: number;
  /** Floor width (m). Used for wall area in simple mode and for the ceiling. */
  width: number;
  /** Wall height (m). Used in simple mode. */
  height: number;
  walls: WallMeasurement[];
  includeCeiling: boolean;
  coats: number;
  condition: RoomCondition;
}

export type SkirtingCondition = "good" | "minor_defects" | "major_damage" | "bare_wood";

export interface SkirtingItem {
  id: string;
  type: "skirting";
  label: string;
  linearMetres: number;
  coats: number;
  condition: SkirtingCondition;
}

export interface CeilingItem {
  id: string;
  type: "ceiling";
  label: string;
  length: number;
  width: number;
  coats: number;
  condition: {
    surface: SurfaceCondition;
    newlySkimmed: boolean;
    dampOrStains: boolean;
  };
}

export type QuoteItem = PaintedRoomItem | SkirtingItem | CeilingItem;

export type LineKind = "walls" | "ceiling" | "skirting";

export interface QuoteLine {
  itemId: string;
  label: string;
  kind: LineKind;
  /** Area (m²) or length (m), rounded to 2 decimal places. */
  quantity: number;
  unit: "m²" | "m";
  ratePence: number;
  /** quantity × rate, before the minimum charge. */
  calculatedPence: number;
  minimumPence: number;
  minimumApplied: boolean;
  /** Final line price. null when the item needs a manual quotation. */
  amountPence: number | null;
  status: "priced" | "manual";
}

export interface QuoteFlag {
  itemId: string;
  itemLabel: string;
  /** review = price shown but will be checked; manual = no automatic price for this item */
  severity: "review" | "manual";
  message: string;
}

export interface QuoteResult {
  lines: QuoteLine[];
  flags: QuoteFlag[];
  /** Sum of priced lines, before rounding. */
  subtotalPence: number;
  /** Difference added (or removed) by rounding. */
  roundingAdjustmentPence: number;
  /** Rounded total of all automatically priced items. */
  totalPence: number;
  requiresManualQuote: boolean;
  needsReview: boolean;
  hasPricedItems: boolean;
}
