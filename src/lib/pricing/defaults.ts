import type { PricingSettings } from "./types";

/**
 * Launch prices. These are only used until you save prices in the admin area
 * (or if the database can't be reached). Edit prices at /admin/settings –
 * you do not need to change this file.
 */
export const DEFAULT_PRICING: PricingSettings = {
  bedroom: { ratePerSqm: 5.5, minimumCharge: 185 },
  livingRoom: { ratePerSqm: 5.5, minimumCharge: 225 },
  skirting: { ratePerMetre: 5, minimumCharge: 65 },
  ceiling: { ratePerSqm: 5.5, minimumCharge: 65 },
  roundToNearest: 5,
  standardCoats: 2,
};
