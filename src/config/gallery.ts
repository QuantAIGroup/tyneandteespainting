/**
 * BEFORE & AFTER PHOTOS shown on the website.
 *
 * The photo files live in /public/gallery. To add another pair:
 *   1. Save the two photos as public/gallery/<name>-before.jpg and <name>-after.jpg
 *   2. Copy one of the entries below and change the details.
 * Photos you upload in /admin/gallery are shown as well (newest first).
 *
 * Only include photos of work Tyne & Tees Painting has genuinely carried out.
 */
import type { GalleryCategory } from "@/lib/gallery-types";

export interface PhotoPair {
  id: string;
  title: string;
  description: string;
  /** A pair can appear under more than one tab, e.g. a bedroom that also shows wall preparation. */
  categories: GalleryCategory[];
  before: string;
  after: string;
  /** Shown on the homepage */
  featured?: boolean;
}

export const PHOTO_PAIRS: PhotoPair[] = [
  {
    id: "bedroom-2",
    title: "Double bedroom refresh",
    description: "Tired yellow walls transformed into a calm, modern grey.",
    categories: ["bedrooms"],
    before: "/gallery/bedroom-2-before.jpg",
    after: "/gallery/bedroom-2-after.jpg",
    featured: true,
  },
  {
    id: "living-room-1",
    title: "Living room transformation",
    description: "Patchy, stripped walls prepared and repainted in a rich charcoal.",
    categories: ["living_rooms", "wall_preparation"],
    before: "/gallery/living-room-1-before.jpg",
    after: "/gallery/living-room-1-after.jpg",
    featured: true,
  },
  {
    id: "skirting-1",
    title: "Skirting board restoration",
    description: "Chipped, flaking skirting sanded, filled and finished in crisp white gloss.",
    categories: ["skirting_boards"],
    before: "/gallery/skirting-1-before.jpg",
    after: "/gallery/skirting-1-after.jpg",
    featured: true,
  },
  {
    id: "bedroom-1",
    title: "Single bedroom – full preparation and repaint",
    description: "Damaged plaster and patchy walls filled, sanded and painted a soft grey.",
    categories: ["bedrooms", "wall_preparation"],
    before: "/gallery/bedroom-1-before.jpg",
    after: "/gallery/bedroom-1-after.jpg",
    featured: true,
  },

  {
    id: "skirting-2",
    title: "Skirting boards made good",
    description: "Worn, dented skirting repaired and repainted for a neat, smooth finish.",
    categories: ["skirting_boards"],
    before: "/gallery/skirting-2-before.jpg",
    after: "/gallery/skirting-2-after.jpg",
  },
];
