/** Gallery types and categories (safe to use in browser components). */
export type GalleryCategory = "bedrooms" | "living_rooms" | "skirting_boards" | "wall_preparation";

export const GALLERY_CATEGORIES: { id: GalleryCategory; label: string }[] = [
  { id: "bedrooms", label: "Bedrooms" },
  { id: "living_rooms", label: "Living rooms" },
  { id: "skirting_boards", label: "Skirting boards" },
  { id: "wall_preparation", label: "Wall preparation" },
];

export interface GalleryEntry {
  id: string;
  categories: GalleryCategory[];
  title: string;
  description: string | null;
  location: string | null;
  beforeUrl: string | null;
  afterUrl: string;
  featured: boolean;
}
