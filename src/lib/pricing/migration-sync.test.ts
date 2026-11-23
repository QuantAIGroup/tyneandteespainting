/**
 * The database rules (in the migration) and the website's own validation
 * must agree on the extras and the approved prices.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING } from "./defaults";
import { EXTRA_KINDS, EXTRA_QUANTITY, FIXED_EXTRAS, INSPECTION_EXTRAS } from "./extras";

const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/20261123170000_price_revision_full_payment.sql"), "utf8");
const list = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe("migration and website agree", () => {
  it("allow the same extra kinds", () => {
    const kindsCheck = /quote_rooms_extra_kind_check check \(\s*extra_kind is null or extra_kind in \(([^)]*)\)/.exec(sql)![1];
    expect(list(kindsCheck).sort()).toEqual([...EXTRA_KINDS].sort());
  });

  it("agree which extras are fixed-price and which need an inspection", () => {
    const fixed = /extra_kind in \(('door_frame'[^)]*)\)\s*and unit_price_pence is not null/.exec(sql)![1];
    const inspection = /extra_kind in \(('sash_window'[^)]*)\)\s*and unit_price_pence is null/.exec(sql)![1];
    expect(list(fixed)).toEqual([...FIXED_EXTRAS]);
    expect(list(inspection)).toEqual([...INSPECTION_EXTRAS]);
  });

  it("use the same quantity limits", () => {
    expect(sql).toContain(`quantity between ${EXTRA_QUANTITY.min} and ${EXTRA_QUANTITY.max}`);
  });

  it("set the approved prices, matching the website defaults", () => {
    expect(sql).toContain(`'skirting', jsonb_build_object('ratePerMetre', ${DEFAULT_PRICING.skirting.ratePerMetre}, 'minimumCharge', ${DEFAULT_PRICING.skirting.minimumCharge})`);
    expect(sql).toContain(`'ceiling',  jsonb_build_object('ratePerSqm', ${DEFAULT_PRICING.ceiling.ratePerSqm}, 'minimumCharge', ${DEFAULT_PRICING.ceiling.minimumCharge})`);
    for (const [kind, price] of Object.entries(DEFAULT_PRICING.extras)) expect(sql).toContain(`'${kind}', ${price}`);
    expect(sql).toContain(`'roundToNearest', ${DEFAULT_PRICING.roundToNearest}`);
  });

  it("never touches the bedroom or living room prices", () => {
    const priceUpdate = /update public\.settings[\s\S]*?;/.exec(sql)![0];
    expect(priceUpdate).toContain("value || jsonb_build_object(");
    expect(priceUpdate).not.toMatch(/bedroom|livingRoom|standardCoats/);
  });

  it("contains no row deletes, truncates or table drops", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b|\bdrop\s+column\b/i);
  });
});
