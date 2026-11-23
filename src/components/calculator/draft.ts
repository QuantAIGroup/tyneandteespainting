/**
 * The calculator's working state ("drafts"). Measurements can be empty (null)
 * while the customer is typing; they are converted into proper QuoteItems for
 * the pricing engine once they're valid.
 */
import { EXTRAS } from "@/lib/pricing/extras";
import { ceilingSchema, extraSchema, paintedRoomSchema, skirtingSchema } from "@/lib/pricing/schema";
import type { ExtraKind, QuoteItem, RoomCondition, RoomType, SkirtingCondition, SurfaceCondition } from "@/lib/pricing/types";

export type Num = number | null;
export type Unit = "m" | "cm";

export interface WallDraft {
  key: string;
  width: Num;
  height: Num;
}

export interface RoomDraft {
  id: string;
  type: RoomType;
  label: string;
  measurementMode: "simple" | "walls";
  length: Num;
  width: Num;
  height: Num;
  walls: WallDraft[];
  includeCeiling: boolean;
  coats: number;
  condition: RoomCondition;
}

export interface SkirtingDraft {
  id: string;
  type: "skirting";
  label: string;
  linearMetres: Num;
  coats: number;
  condition: SkirtingCondition;
}

export interface CeilingDraft {
  id: string;
  type: "ceiling";
  label: string;
  length: Num;
  width: Num;
  coats: number;
  condition: { surface: SurfaceCondition; newlySkimmed: boolean; dampOrStains: boolean };
}

/** A counted extra (door frames, radiators…). quantity is null while the box is empty. */
export interface ExtraDraft {
  id: string;
  type: "extra";
  label: string;
  extra: ExtraKind;
  quantity: number | null;
}

/** Items that need measurements and a condition check. */
export type MeasuredDraft = RoomDraft | SkirtingDraft | CeilingDraft;
export type ItemDraft = MeasuredDraft | ExtraDraft;
/** Kinds the customer adds with "+ Add" (extras are chosen separately). */
export type ItemKind = MeasuredDraft["type"];

export const ITEM_NAMES: Record<ItemDraft["type"], string> = {
  bedroom: "Bedroom",
  living_room: "Living room",
  skirting: "Skirting boards",
  ceiling: "Ceiling painting",
  extra: "Extra",
};

export const isMeasured = (d: ItemDraft): d is MeasuredDraft => d.type !== "extra";

export function createExtra(kind: ExtraKind, quantity = 1): ExtraDraft {
  return { id: `extra-${kind}`, type: "extra", label: EXTRAS[kind].name, extra: kind, quantity };
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function newWall(): WallDraft {
  return { key: newId(), width: null, height: null };
}

/** Label like "Bedroom 2" based on how many of that type already exist. */
export function nextLabel(kind: ItemKind, items: ItemDraft[]): string {
  const sameType = items.filter((i) => i.type === kind).length;
  const base = kind === "ceiling" ? "Ceiling" : ITEM_NAMES[kind];
  if (kind === "skirting" || kind === "ceiling") return sameType === 0 ? base : `${base} ${sameType + 1}`;
  if (kind === "living_room" && sameType === 0) return base;
  return `${base} ${sameType + 1}`;
}

export function createItem(kind: ItemKind, items: ItemDraft[], standardCoats: number, fixedId?: string): ItemDraft {
  // fixedId keeps server and browser in sync for an item added from the page link (?add=bedroom)
  const id = fixedId ?? newId();
  const label = nextLabel(kind, items);
  if (kind === "skirting") return { id, type: "skirting", label, linearMetres: null, coats: standardCoats, condition: "good" };
  if (kind === "ceiling") {
    return { id, type: "ceiling", label, length: null, width: null, coats: standardCoats, condition: { surface: "good", newlySkimmed: false, dampOrStains: false } };
  }
  return {
    id,
    type: kind,
    label,
    measurementMode: "simple",
    length: null,
    width: null,
    height: null,
    walls: [1, 2, 3, 4].map((n) => ({ key: `${id}-wall-${n}`, width: null, height: null })),
    includeCeiling: false,
    coats: standardCoats,
    condition: { surface: "good", newlySkimmed: false, colourChange: "similar", wallpaperToRemove: false, dampOrStains: false },
  };
}

const u = (n: Num) => (n === null ? undefined : n);

/** Validate one draft. Returns the clean item, or a map of field → error message. */
export function validateDraft(draft: ItemDraft): { item: QuoteItem | null; errors: Record<string, string> } {
  let result;
  if (draft.type === "extra") {
    result = extraSchema.safeParse({ ...draft, quantity: u(draft.quantity) });
  } else if (draft.type === "skirting") {
    result = skirtingSchema.safeParse({ ...draft, linearMetres: u(draft.linearMetres) });
  } else if (draft.type === "ceiling") {
    result = ceilingSchema.safeParse({ ...draft, length: u(draft.length), width: u(draft.width) });
  } else {
    result = paintedRoomSchema.safeParse({
      ...draft,
      length: u(draft.length),
      width: u(draft.width),
      height: u(draft.height),
      walls: draft.measurementMode === "walls" ? draft.walls.map((w) => ({ width: u(w.width), height: u(w.height) })) : [],
    });
  }
  if (result.success) return { item: result.data as QuoteItem, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) {
      // zod's default "expected number, received undefined" → friendlier wording
      errors[key] = issue.message.startsWith("Invalid input") ? (draft.type === "extra" ? "Please enter a quantity" : "Please enter a measurement") : issue.message;
    }
  }
  return { item: null, errors };
}

/** Only the items that are currently valid – used for the live running total. */
export function validItems(drafts: ItemDraft[]): QuoteItem[] {
  return drafts.map((d) => validateDraft(d).item).filter((i): i is QuoteItem => i !== null);
}
