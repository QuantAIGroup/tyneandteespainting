import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { GALLERY_TAG } from "@/lib/settings";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type GalleryCategory = "bedrooms" | "living_rooms" | "skirting_boards";

export const GALLERY_CATEGORIES: { id: GalleryCategory; label: string }[] = [
  { id: "bedrooms", label: "Bedrooms" },
  { id: "living_rooms", label: "Living rooms" },
  { id: "skirting_boards", label: "Skirting boards" },
];

export interface GalleryEntry {
  id: string;
  category: GalleryCategory;
  title: string;
  location: string | null;
  beforeUrl: string | null;
  afterUrl: string;
  /** true = illustration for demonstration only, NOT a real completed job */
  isDemo: boolean;
}

/** Demonstration illustrations shown until you upload your own genuine work in /admin/gallery. */
export const DEMO_GALLERY: GalleryEntry[] = [
  { id: "demo-bed", category: "bedrooms", title: "Bedroom refresh (illustration)", location: null, beforeUrl: "/images/demo-bedroom-before.svg", afterUrl: "/images/demo-bedroom-after.svg", isDemo: true },
  { id: "demo-living", category: "living_rooms", title: "Living room repaint (illustration)", location: null, beforeUrl: "/images/demo-living-before.svg", afterUrl: "/images/demo-living-after.svg", isDemo: true },
  { id: "demo-skirting", category: "skirting_boards", title: "Skirting boards (illustration)", location: null, beforeUrl: "/images/demo-skirting-before.svg", afterUrl: "/images/demo-skirting-after.svg", isDemo: true },
];

export function galleryPublicUrl(path: string): string {
  const env = getSupabasePublicEnv();
  if (!env) return path;
  return `${env.url}/storage/v1/object/public/gallery/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Your published gallery items. Falls back to clearly-labelled demonstration illustrations when there are none. */
export async function getGallery(): Promise<GalleryEntry[]> {
  "use cache";
  cacheTag(GALLERY_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return DEMO_GALLERY;
  try {
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, category, title, location, before_path, after_path")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return DEMO_GALLERY;
    return data.map((row) => ({
      id: row.id as string,
      category: row.category as GalleryCategory,
      title: row.title as string,
      location: (row.location as string | null) ?? null,
      beforeUrl: row.before_path ? galleryPublicUrl(row.before_path as string) : null,
      afterUrl: galleryPublicUrl(row.after_path as string),
      isDemo: false,
    }));
  } catch {
    return DEMO_GALLERY;
  }
}
