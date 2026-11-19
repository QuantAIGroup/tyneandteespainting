"use server";

/**
 * ADMIN ACTIONS
 * Every action checks you're a logged-in admin first, then uses your own
 * login for the database change – so the database security rules apply too.
 */
import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { ENQUIRY_STATUSES, isUuid } from "@/lib/enquiry";
import { pricingSettingsSchema } from "@/lib/pricing/schema";
import { GALLERY_TAG, SETTINGS_TAG } from "@/lib/settings";
import { createSessionClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

async function db() {
  await requireAdmin();
  const supabase = await createSessionClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

// ---------------- Enquiries ----------------

const statusIds = ENQUIRY_STATUSES.map((s) => s.id) as [string, ...string[]];

export async function setEnquiryStatus(id: string, status: string): Promise<ActionState> {
  if (!isUuid(id) || !statusIds.includes(status)) return { ok: false, message: "Invalid request" };
  const supabase = await db();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "contacted") patch.contacted_at = now;
  if (status === "accepted") patch.accepted_at = now;
  if (status === "completed") patch.completed_at = now;
  const { error } = await supabase.from("enquiries").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Status updated" };
}

export async function saveEnquiryNotes(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isUuid(id)) return { ok: false, message: "Invalid request" };
  const notes = String(formData.get("notes") ?? "").slice(0, 5000);
  const supabase = await db();
  const { error } = await supabase.from("enquiries").update({ admin_notes: notes || null }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Notes saved" };
}

// ---------------- Contact messages ----------------

export async function setMessageStatus(id: string, status: "new" | "replied" | "archived"): Promise<ActionState> {
  if (!isUuid(id) || !["new", "replied", "archived"].includes(status)) return { ok: false, message: "Invalid request" };
  const supabase = await db();
  const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  refresh();
  return { ok: true, message: "Updated" };
}

// ---------------- Settings ----------------

const num = (fd: FormData, key: string) => {
  const raw = String(fd.get(key) ?? "").trim();
  return raw === "" ? NaN : Number(raw);
};

export async function savePricing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = pricingSettingsSchema.safeParse({
    bedroom: { ratePerSqm: num(formData, "bedroom.ratePerSqm"), minimumCharge: num(formData, "bedroom.minimumCharge") },
    livingRoom: { ratePerSqm: num(formData, "livingRoom.ratePerSqm"), minimumCharge: num(formData, "livingRoom.minimumCharge") },
    skirting: { ratePerMetre: num(formData, "skirting.ratePerMetre"), minimumCharge: num(formData, "skirting.minimumCharge") },
    ceiling: { ratePerSqm: num(formData, "ceiling.ratePerSqm"), minimumCharge: num(formData, "ceiling.minimumCharge") },
    roundToNearest: num(formData, "roundToNearest"),
    standardCoats: num(formData, "standardCoats"),
  });
  if (!parsed.success) return { ok: false, message: "Please check the prices – every box needs a number (0 or more)." };
  const supabase = await db();
  const { error } = await supabase.from("settings").upsert({ key: "pricing", value: parsed.data });
  if (error) return { ok: false, message: error.message };
  updateTag(SETTINGS_TAG);
  return { ok: true, message: "Prices saved. The website and calculator are now using the new prices." };
}

const businessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(100),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(200),
  address: z.string().trim().max(300),
  openingHours: z.string().trim().max(200),
  logoUrl: z.union([z.literal(""), z.url("Logo must be a full web address starting with https://")]),
  verifiedClaims: z.array(z.string().trim().min(1).max(200)).max(10),
});

export async function saveBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = businessSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    openingHours: String(formData.get("openingHours") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
    verifiedClaims: String(formData.get("verifiedClaims") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the details" };
  const supabase = await db();
  const { error } = await supabase.from("settings").upsert({ key: "business", value: parsed.data });
  if (error) return { ok: false, message: error.message };
  updateTag(SETTINGS_TAG);
  return { ok: true, message: "Business details saved and updated across the website." };
}

// ---------------- Gallery ----------------

const galleryItemSchema = z.object({
  category: z.enum(["bedrooms", "living_rooms", "skirting_boards"]),
  title: z.string().trim().min(2, "Please add a short title").max(100),
  location: z.string().trim().max(60).optional(),
  beforePath: z.string().max(300).optional(),
  afterPath: z.string().min(1).max(300),
});

export async function createGalleryItem(input: z.input<typeof galleryItemSchema>): Promise<ActionState> {
  const parsed = galleryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid details" };
  const { category, title, location, beforePath, afterPath } = parsed.data;
  if (!afterPath.startsWith(`${category}/`) || (beforePath && !beforePath.startsWith(`${category}/`))) return { ok: false, message: "Invalid file" };
  const supabase = await db();
  const { error } = await supabase.from("gallery_items").insert({ category, title, location: location || null, before_path: beforePath || null, after_path: afterPath });
  if (error) return { ok: false, message: error.message };
  updateTag(GALLERY_TAG);
  refresh();
  return { ok: true, message: "Added to the gallery" };
}

export async function setGalleryPublished(id: string, published: boolean): Promise<ActionState> {
  if (!isUuid(id)) return { ok: false, message: "Invalid request" };
  const supabase = await db();
  const { error } = await supabase.from("gallery_items").update({ published }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  updateTag(GALLERY_TAG);
  refresh();
  return { ok: true, message: published ? "Published" : "Hidden" };
}

export async function deleteGalleryItem(id: string): Promise<ActionState> {
  if (!isUuid(id)) return { ok: false, message: "Invalid request" };
  const supabase = await db();
  const { data: row } = await supabase.from("gallery_items").select("before_path, after_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("gallery_items").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  const paths = [row?.before_path, row?.after_path].filter((p): p is string => typeof p === "string" && p.length > 0);
  if (paths.length) await supabase.storage.from("gallery").remove(paths);
  updateTag(GALLERY_TAG);
  refresh();
  return { ok: true, message: "Deleted" };
}

// ---------------- Session ----------------

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}
