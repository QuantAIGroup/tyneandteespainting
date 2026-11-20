import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PHOTO_PAIRS } from "@/config/gallery";
import { createPublicClient } from "@/lib/supabase/public";
import { GALLERY_TAG } from "@/lib/settings";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { GalleryCategory, GalleryEntry } from "@/lib/gallery-types";

export { GALLERY_CATEGORIES } from "@/lib/gallery-types";
export type { GalleryCategory, GalleryEntry } from "@/lib/gallery-types";

/** The before & after photos listed in src/config/gallery.ts */
export const CONFIG_GALLERY: GalleryEntry[] = PHOTO_PAIRS.map((p) => ({
  id: p.id,
  categories: p.categories,
  title: p.title,
  description: p.description,
  location: null,
  beforeUrl: p.before,
  afterUrl: p.after,
  featured: Boolean(p.featured),
}));

export function galleryPublicUrl(path: string): string {
  const env = getSupabasePublicEnv();
  if (!env) return path;
  return `${env.url}/storage/v1/object/public/gallery/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Photos uploaded in /admin/gallery (newest first), followed by the photos in src/config/gallery.ts. */
export async function getGallery(): Promise<GalleryEntry[]> {
  "use cache";
  cacheTag(GALLERY_TAG);
  cacheLife("hours");
  const supabase = createPublicClient();
  if (!supabase) return CONFIG_GALLERY;
  try {
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, category, title, location, before_path, after_path")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error || !data) return CONFIG_GALLERY;
    const uploaded: GalleryEntry[] = data.map((row) => ({
      id: row.id as string,
      categories: [row.category as GalleryCategory],
      title: row.title as string,
      description: null,
      location: (row.location as string | null) ?? null,
      beforeUrl: row.before_path ? galleryPublicUrl(row.before_path as string) : null,
      afterUrl: galleryPublicUrl(row.after_path as string),
      featured: false,
    }));
    return [...uploaded, ...CONFIG_GALLERY];
  } catch {
    return CONFIG_GALLERY;
  }
}
