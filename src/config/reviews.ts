/**
 * CUSTOMER REVIEWS
 *
 * These are DEMONSTRATION placeholders and are labelled as such on the site.
 * When you receive genuine reviews (with the customer's permission), replace
 * this list and set `isDemo: false` on each real review.
 * Never publish invented reviews as if they were real.
 */
export interface Review {
  name: string;
  area: string;
  service: string;
  text: string;
  rating: number;
  isDemo: boolean;
}

export const REVIEWS: Review[] = [
  {
    name: "[Customer name]",
    area: "[Area, e.g. Jesmond]",
    service: "Bedroom painting",
    text: "This space is reserved for a genuine review from one of your first customers. Replace this text once you have their permission to publish it.",
    rating: 5,
    isDemo: true,
  },
  {
    name: "[Customer name]",
    area: "[Area, e.g. Gosforth]",
    service: "Living room painting",
    text: "Placeholder review. Add a real customer's words here – for example what they thought of the preparation, tidiness and finish.",
    rating: 5,
    isDemo: true,
  },
  {
    name: "[Customer name]",
    area: "[Area, e.g. Heaton]",
    service: "Skirting boards",
    text: "Placeholder review. Genuine reviews from Google or Checkatrade can be copied here (with permission) once you have them.",
    rating: 5,
    isDemo: true,
  },
];
