/**
 * The extra services customers can add with a quantity (door frames,
 * radiators, etc.). Shared by the calculator, the server and the admin area.
 *
 * - Fixed-price extras use the price saved in settings (`pricing.extras`).
 * - Inspection extras never get an automatic price: they always show
 *   "Inspection and separate quotation required".
 */
import type { ExtraKind, FixedExtraKind, InspectionExtraKind, LineCategory } from "./types";

export interface ExtraDefinition {
  kind: ExtraKind;
  /** Name shown to customers. */
  name: string;
  /** Singular / plural unit, e.g. "door frame" / "door frames". */
  unit: [string, string];
  /** Short explanation shown under the option. */
  note: string;
  category: LineCategory;
  /** true = always needs an inspection and a separate quotation. */
  inspection: boolean;
}

export const FIXED_EXTRAS: readonly FixedExtraKind[] = [
  "door_frame",
  "window_frame",
  "radiator_standard",
  "radiator_large",
  "feature_wall",
  "interior_door",
] as const;

export const INSPECTION_EXTRAS: readonly InspectionExtraKind[] = [
  "sash_window",
  "decorative_radiator",
  "complex_woodwork",
  "wallpaper_feature_wall",
] as const;

export const EXTRA_KINDS: readonly ExtraKind[] = [...FIXED_EXTRAS, ...INSPECTION_EXTRAS];

export const EXTRAS: Record<ExtraKind, ExtraDefinition> = {
  door_frame: {
    kind: "door_frame",
    name: "Door frames",
    unit: ["door frame", "door frames"],
    note: "Frame and architrave around one doorway",
    category: "door_frames",
    inspection: false,
  },
  window_frame: {
    kind: "window_frame",
    name: "Window sill/frame",
    unit: ["window sill/frame", "window sills/frames"],
    note: "One standard window: frame and sill",
    category: "windows",
    inspection: false,
  },
  radiator_standard: {
    kind: "radiator_standard",
    name: "Standard radiators",
    unit: ["standard radiator", "standard radiators"],
    note: "Single or double panel radiator",
    category: "radiators",
    inspection: false,
  },
  radiator_large: {
    kind: "radiator_large",
    name: "Large radiators",
    unit: ["large radiator", "large radiators"],
    note: "Wider than about 1.2 m or a tall radiator",
    category: "radiators",
    inspection: false,
  },
  feature_wall: {
    kind: "feature_wall",
    name: "Painted feature walls",
    unit: ["painted feature wall", "painted feature walls"],
    note: "One wall painted in a different colour. Painting only – wallpaper hanging is not included",
    category: "feature_walls",
    inspection: false,
  },
  interior_door: {
    kind: "interior_door",
    name: "Interior doors (both sides)",
    unit: ["interior door", "interior doors"],
    note: "Both faces and edges of one standard internal door",
    category: "interior_doors",
    inspection: false,
  },
  sash_window: {
    kind: "sash_window",
    name: "Sash or unusual windows",
    unit: ["sash/unusual window", "sash/unusual windows"],
    note: "Sash, bay or specialist windows",
    category: "windows",
    inspection: true,
  },
  decorative_radiator: {
    kind: "decorative_radiator",
    name: "Decorative or column radiators",
    unit: ["decorative radiator", "decorative radiators"],
    note: "Column, cast-iron or ornate radiators",
    category: "radiators",
    inspection: true,
  },
  complex_woodwork: {
    kind: "complex_woodwork",
    name: "Complex woodwork",
    unit: ["area of complex woodwork", "areas of complex woodwork"],
    note: "Staircase spindles, panelling, ornate mouldings",
    category: "woodwork",
    inspection: true,
  },
  wallpaper_feature_wall: {
    kind: "wallpaper_feature_wall",
    name: "Wallpapered feature walls",
    unit: ["wallpapered feature wall", "wallpapered feature walls"],
    note: "Hanging wallpaper on a feature wall – not the same as a painted feature wall",
    category: "feature_walls",
    inspection: true,
  },
};

export const INSPECTION_MESSAGE = "Inspection and separate quotation required";

export const EXTRA_QUANTITY = { min: 1, max: 50 } as const;

/** "3 door frames", "1 large radiator" */
export function describeQuantity(kind: ExtraKind, quantity: number): string {
  const [one, many] = EXTRAS[kind].unit;
  return `${quantity} ${quantity === 1 ? one : many}`;
}

export function isFixedExtra(kind: ExtraKind): kind is FixedExtraKind {
  return !EXTRAS[kind].inspection;
}
