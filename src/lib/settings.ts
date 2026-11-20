import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DEFAULT_BUSINESS, type BusinessSettings } from "@/config/site";
import { DEFAULT_PRICING } from "@/lib/pricing/defaults";
import { pricingSettingsSchema } from "@/lib/pricing/schema";
import type { PricingSettings } from "@/lib/pricing/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

export const SETTINGS_TAG = "settings";
export const GALLERY_TAG = "gallery";

function parsePricing(value: unknown): PricingSettings {
  const parsed = pricingSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PRICING;
}

function parseBusiness(value: unknown): BusinessSettings {
  if (!value || typeof value !== "object") return DEFAULT_BUSINESS;
  const v = value as Partial<BusinessSettings>;
  return {
    name: typeof v.name === "string" && v.name.trim() ? v.name : DEFAULT_BUSINESS.name,
    phone: typeof v.phone === "string" && v.phone.trim() ? v.phone : DEFAULT_BUSINESS.phone,
    email: typeof v.email === "string" && v.email.trim() ? v.email : DEFAULT_BUSINESS.email,
    address: typeof v.address === "string" ? v.address : "",
    openingHours: typeof v.openingHours === "string" ? v.openingHours : "",
    logoUrl: typeof v.logoUrl === "string" ? v.logoUrl : "",
    verifiedClaims: Array.isArray(v.verifiedClaims) ? v.verifiedClaims.filter((c): c is string => typeof c === "string" && c.trim() !== "") : [],
  };
}

async function readSettingsRow(key: "pricing" | "business" | "payments"): Promise<unknown> {
  const supabase = createPublicClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
    if (error) {
      console.error(`Could not load ${key} settings:`, error.message);
      return null;
    }
    return data?.value ?? null;
  } catch (err) {
    console.error(`Could not load ${key} settings:`, err);
    return null;
  }
}

/** Prices for the public website. Cached, and refreshed instantly when you save in /admin/settings. */
export async function getPricingSettings(): Promise<PricingSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  return parsePricing(await readSettingsRow("pricing"));
}

/** Business details for the public website. Cached, refreshed when you save in /admin/settings. */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  return parseBusiness(await readSettingsRow("business"));
}

export interface PaymentSettings {
  /** Default deposit percentage offered when you request a payment (1–100). */
  defaultDepositPercent: number;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = { defaultDepositPercent: 50 };

function parsePayments(value: unknown): PaymentSettings {
  const v = (value ?? {}) as Partial<PaymentSettings>;
  const pct = Number(v.defaultDepositPercent);
  return { defaultDepositPercent: Number.isInteger(pct) && pct >= 1 && pct <= 100 ? pct : DEFAULT_PAYMENT_SETTINGS.defaultDepositPercent };
}

/** Payment settings (default deposit %). Cached, refreshed when you save in /admin/settings. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");
  return parsePayments(await readSettingsRow("payments"));
}

/**
 * Prices read straight from the database (no cache). Used when saving an enquiry
 * so the saved price always uses the latest prices.
 */
export async function getPricingSettingsUncached(): Promise<PricingSettings> {
  const supabase = createAdminClient();
  if (!supabase) return DEFAULT_PRICING;
  const { data, error } = await supabase.from("settings").select("value").eq("key", "pricing").maybeSingle();
  if (error) throw new Error(`Could not load prices: ${error.message}`);
  return parsePricing(data?.value);
}

export { parseBusiness, parsePayments, parsePricing };
