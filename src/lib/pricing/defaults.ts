import type { PricingSettings } from "./types";

/**
 * Current prices (labour only). These are used if the database can't be
 * reached, and fill in any price that hasn't been saved in the admin area yet.
 * Edit prices at /admin/settings – you do not need to change this file.
 */
export const DEFAULT_PRICING: PricingSettings = {
  bedroom: { ratePerSqm: 5.5, minimumCharge: 185 },
  livingRoom: { ratePerSqm: 5.5, minimumCharge: 225 },
  skirting: { ratePerMetre: 5.5, minimumCharge: 0 },
  ceiling: { ratePerSqm: 6, minimumCharge: 55 },
  extras: {
    door_frame: 30,
    window_frame: 30,
    radiator_standard: 30,
    radiator_large: 45,
    feature_wall: 55,
    interior_door: 65,
  },
  roundToNearest: 0,
  standardCoats: 2,
};

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Fills in any missing price from DEFAULT_PRICING. Saved prices always win;
 * defaults only cover keys that don't exist yet (e.g. a newly added extra).
 * Without this, an older saved price list would fail validation and every
 * saved price would be ignored.
 */
export function withPricingDefaults(saved: unknown): unknown {
  if (!isObject(saved)) return saved;
  const merge = (base: Json, over: Json): Json => {
    const out: Json = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = isObject(v) && isObject(base[k]) ? merge(base[k] as Json, v) : v;
    return out;
  };
  return merge(DEFAULT_PRICING as unknown as Json, saved);
}
