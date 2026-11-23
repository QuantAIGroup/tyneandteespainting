/**
 * Turns a validated quote (items + the server-calculated breakdown) into one
 * database row per room/service for the `quote_rooms` table.
 *
 * This only READS the pricing engine's results – it never changes prices.
 */
import { ceilingArea, roomWallArea, round2 } from "@/lib/pricing/engine";
import type { QuoteItem, QuoteResult } from "@/lib/pricing/types";

export interface QuoteRoomRow {
  enquiry_id: string;
  position: number;
  item_type: QuoteItem["type"];
  label: string;
  measurement_mode: "simple" | "walls" | null;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  walls: { width: number; height: number }[] | null;
  skirting_length_m: number | null;
  include_ceiling: boolean;
  /** null for counted extras (door frames, radiators…) */
  coats: number | null;
  condition: unknown;
  /** Counted extras only: which extra, how many, and the price each (null = inspection needed). */
  extra_kind: string | null;
  quantity: number | null;
  unit_price_pence: number | null;
  wall_area_sqm: number | null;
  ceiling_area_sqm: number | null;
  estimated_labour_pence: number | null;
  requires_manual_quote: boolean;
}

export function buildQuoteRoomRows(enquiryId: string, items: QuoteItem[], quote: QuoteResult): QuoteRoomRow[] {
  return items.map((item, position) => {
    const lines = quote.lines.filter((l) => l.itemId === item.id);
    const manual = lines.some((l) => l.status === "manual");
    const estimated = manual ? null : lines.reduce((sum, l) => sum + (l.amountPence ?? 0), 0);

    const base = {
      enquiry_id: enquiryId,
      position,
      item_type: item.type,
      label: item.label,
      estimated_labour_pence: estimated,
      requires_manual_quote: manual,
    };

    if (item.type === "extra") {
      const line = lines[0];
      return {
        ...base,
        coats: null,
        condition: null,
        extra_kind: item.extra,
        quantity: item.quantity,
        unit_price_pence: line && line.status === "priced" ? line.ratePence : null,
        measurement_mode: null,
        length_m: null,
        width_m: null,
        height_m: null,
        walls: null,
        skirting_length_m: null,
        include_ceiling: false,
        wall_area_sqm: null,
        ceiling_area_sqm: null,
      };
    }
    const measured = { ...base, coats: item.coats, condition: item.condition, extra_kind: null, quantity: null, unit_price_pence: null };

    if (item.type === "bedroom" || item.type === "living_room") {
      const simple = item.measurementMode === "simple";
      const hasFloor = simple || item.includeCeiling;
      return {
        ...measured,
        measurement_mode: item.measurementMode,
        length_m: hasFloor ? item.length : null,
        width_m: hasFloor ? item.width : null,
        height_m: simple ? item.height : null,
        walls: simple ? null : item.walls,
        skirting_length_m: null,
        include_ceiling: item.includeCeiling,
        wall_area_sqm: roomWallArea(item),
        ceiling_area_sqm: item.includeCeiling ? ceilingArea(item.length, item.width) : null,
      };
    }
    if (item.type === "ceiling") {
      return {
        ...measured,
        measurement_mode: null,
        length_m: item.length,
        width_m: item.width,
        height_m: null,
        walls: null,
        skirting_length_m: null,
        include_ceiling: true,
        wall_area_sqm: null,
        ceiling_area_sqm: ceilingArea(item.length, item.width),
      };
    }
    return {
      ...measured,
      measurement_mode: null,
      length_m: null,
      width_m: null,
      height_m: null,
      walls: null,
      skirting_length_m: item.type === "skirting" ? round2(item.linearMetres) : null,
      include_ceiling: false,
      wall_area_sqm: null,
      ceiling_area_sqm: null,
    };
  });
}
