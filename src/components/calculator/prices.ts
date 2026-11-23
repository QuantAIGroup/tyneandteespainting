/**
 * Price wording for the calculator options, so every option always shows a
 * price (or clearly says an inspection is needed) – never a blank.
 */
import { formatPence, poundsToPence } from "@/lib/pricing/engine";
import { EXTRAS, INSPECTION_MESSAGE, isFixedExtra } from "@/lib/pricing/extras";
import type { ExtraKind, PricingSettings, QuoteLine } from "@/lib/pricing/types";
import type { ItemKind } from "./draft";

/** £30.00 – always two decimal places in the calculator. */
export const money = (pence: number) => formatPence(pence, { alwaysShowPence: true });
export const moneyPounds = (pounds: number) => money(poundsToPence(pounds));

const withMinimum = (base: string, minimum: number) => (minimum > 0 ? `${base} · ${moneyPounds(minimum)} minimum` : base);

/** e.g. "£6.00 per m² · £55.00 minimum" */
export function optionPrice(kind: ItemKind, pricing: PricingSettings): string {
  switch (kind) {
    case "bedroom":
      return withMinimum(`${moneyPounds(pricing.bedroom.ratePerSqm)} per m² of wall`, pricing.bedroom.minimumCharge);
    case "living_room":
      return withMinimum(`${moneyPounds(pricing.livingRoom.ratePerSqm)} per m² of wall`, pricing.livingRoom.minimumCharge);
    case "ceiling":
      return withMinimum(`${moneyPounds(pricing.ceiling.ratePerSqm)} per m²`, pricing.ceiling.minimumCharge);
    case "skirting":
      return withMinimum(`${moneyPounds(pricing.skirting.ratePerMetre)} per linear metre`, pricing.skirting.minimumCharge);
  }
}

/** "£30.00 each" or the inspection message. */
export function extraUnitPrice(kind: ExtraKind, pricing: PricingSettings): string {
  return isFixedExtra(kind) ? `${moneyPounds(pricing.extras[kind])} each` : INSPECTION_MESSAGE;
}

/** "3 × £30.00 = £90.00" for a counted extra. */
export function extraWorking(kind: ExtraKind, quantity: number, pricing: PricingSettings): string {
  if (!isFixedExtra(kind)) return INSPECTION_MESSAGE;
  const each = poundsToPence(pricing.extras[kind]);
  return `${quantity} × ${money(each)} = ${money(quantity * each)}`;
}

/** The working for one breakdown line, e.g. "14.00 m² × £6.00 = £84.00 · £55.00 minimum applies". */
export function lineWorking(line: QuoteLine): string {
  if (line.unit === "each") {
    return line.status === "manual" ? INSPECTION_MESSAGE : `${line.quantity} × ${money(line.ratePence)} = ${money(line.calculatedPence)}`;
  }
  const base = `${line.quantity.toFixed(2)} ${line.unit} × ${money(line.ratePence)} = ${money(line.calculatedPence)}`;
  return line.minimumApplied && line.status === "priced" ? `${base} · ${money(line.minimumPence)} minimum charge applies` : base;
}

export const extraName = (kind: ExtraKind) => EXTRAS[kind].name;
