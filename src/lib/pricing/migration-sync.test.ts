/**
 * The database rules (in the migration) and the website's own validation
 * must agree on the extras, the quantity limits and the approved prices.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING } from "./defaults";
import { EXTRA_QUANTITY, FIXED_EXTRAS, INSPECTION_EXTRAS } from "./extras";

const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/20261123170000_price_revision_full_payment.sql"), "utf8");
const shapeRule = /room_shape_rule constant text :=\s*\$r\$([\s\S]*?)\$r\$;/.exec(sql)![1];
const list = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const json = (name: string) => JSON.parse(new RegExp(`${name}\\s+constant jsonb := '([^']*)'`).exec(sql)![1]);

describe("migration and website agree", () => {
  it("fixed-price extras: same kinds, and price + total required", () => {
    const fixed = /extra_kind in \(('door_frame'[^)]*)\)/.exec(shapeRule)![1];
    expect(list(fixed)).toEqual([...FIXED_EXTRAS]);
    const branch = shapeRule.slice(shapeRule.indexOf("'door_frame'"), shapeRule.indexOf("'sash_window'"));
    expect(branch).toContain("unit_price_pence is not null and unit_price_pence >= 0");
    expect(branch).toContain("estimated_labour_pence is not null");
    expect(branch).toContain("estimated_labour_pence = quantity * unit_price_pence");
    expect(branch).toContain("requires_manual_quote is false");
  });

  it("inspection extras: same kinds, no price, manual quote required", () => {
    const inspection = /extra_kind in \(('sash_window'[^)]*)\)/.exec(shapeRule)![1];
    expect(list(inspection)).toEqual([...INSPECTION_EXTRAS]);
    const branch = shapeRule.slice(shapeRule.indexOf("'sash_window'"));
    expect(branch).toContain("unit_price_pence is null");
    expect(branch).toContain("estimated_labour_pence is null");
    expect(branch).toContain("requires_manual_quote is true");
  });

  it("use the same quantity limits", () => {
    expect(shapeRule.match(new RegExp(`quantity is not null and quantity between ${EXTRA_QUANTITY.min} and ${EXTRA_QUANTITY.max}`, "g"))).toHaveLength(2);
  });

  it("set the approved prices, matching the website defaults", () => {
    expect(json("new_skirting")).toEqual(DEFAULT_PRICING.skirting);
    expect(json("new_ceiling")).toEqual(DEFAULT_PRICING.ceiling);
    expect(json("new_extras")).toEqual(DEFAULT_PRICING.extras);
    expect(Number(/new_rounding\s+constant jsonb := '(\d+)'/.exec(sql)![1])).toBe(DEFAULT_PRICING.roundToNearest);
  });

  it("only replaces launch prices (so later admin changes are kept)", () => {
    expect(json("launch_skirting")).toEqual({ ratePerMetre: 5, minimumCharge: 65 });
    expect(json("launch_ceiling")).toEqual({ ratePerSqm: 5.5, minimumCharge: 65 });
  });

  it("never writes bedroom, living room or coats prices", () => {
    const step1 = sql.slice(sql.indexOf("-- 1. PRICES"), sql.indexOf("-- 2. PAYMENTS"));
    expect(step1).not.toMatch(/'bedroom'|'livingRoom'|'standardCoats'/);
  });

  it("uses NULL-safe payment rules", () => {
    expect(sql).toContain("payment_type is not distinct from 'full'");
    expect(sql).toContain("deposit_pence is not null and deposit_pence = agreed_price_pence");
    expect(sql).toContain("deposit_paid_pence is not null");
  });

  it("is a single all-or-nothing statement with no row deletes, truncates or table drops", () => {
    const code = sql.replace(/--.*$/gm, "").trim();
    expect(code.startsWith("do $migration$")).toBe(true);
    expect(code.endsWith("$migration$;")).toBe(true);
    expect(code).not.toMatch(/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b|\bdrop\s+column\b/i);
    expect(code).not.toContain("?");
  });
});
