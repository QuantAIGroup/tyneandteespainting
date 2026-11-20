/**
 * The services offered. Content for the service cards and the service pages.
 * Prices are NOT stored here – they come from the pricing settings.
 */
import { IMAGES } from "./site";

export type ServiceSlug = "bedroom-painting" | "living-room-painting" | "skirting-board-painting" | "ceiling-painting";

export interface ServiceInfo {
  slug: ServiceSlug;
  name: string;
  shortName: string;
  optional?: boolean;
  image: { src: string; alt: string };
  summary: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  included: string[];
  notIncluded: string[];
  howPriced: string;
  calculatorItem: "bedroom" | "living_room" | "skirting" | "ceiling";
}

export const SERVICES: ServiceInfo[] = [
  {
    slug: "bedroom-painting",
    name: "Bedroom painting",
    shortName: "Bedrooms",
    image: IMAGES.bedroom,
    summary: "Professional bedroom wall painting and preparation.",
    seoTitle: "Bedroom Painters in Newcastle | Fixed Room-by-Room Prices",
    seoDescription:
      "Bedroom painting in Newcastle upon Tyne with straightforward labour prices calculated from your room size. No hourly rates. Get an instant online estimate.",
    intro:
      "A freshly painted bedroom makes a big difference. We prepare the walls properly, protect your floors and furniture, and apply two even coats of your chosen paint – with a labour price you can work out yourself before anyone visits.",
    included: [
      "Moving and covering furniture and floors",
      "Filling small nail holes and minor hairline cracks",
      "Light sanding and dusting down",
      "Two coats of your chosen paint on the walls",
      "Neat cutting-in around ceilings, skirting and sockets",
      "Tidying up and removing protective coverings",
    ],
    notIncluded: ["Paint and materials (you supply these)", "Major plaster repairs", "Wallpaper removal", "Damp or stain treatment"],
    howPriced: "Wall area (m²) × the bedroom labour rate, with a minimum charge per bedroom.",
    calculatorItem: "bedroom",
  },
  {
    slug: "living-room-painting",
    name: "Living room painting",
    shortName: "Living rooms",
    image: IMAGES.livingRoom,
    summary: "Freshen up your living room with a clean, professional finish.",
    seoTitle: "Living Room Painters in Newcastle | Honest Labour Prices",
    seoDescription:
      "Professional living room painting across Newcastle, Gosforth, Jesmond and Gateshead. Transparent labour prices based on wall area – no hourly charges.",
    intro:
      "Living rooms get the most use and the most attention. We take the time to protect your furniture and flooring, prepare the walls and give you a clean, even finish – priced by the size of the room, not the hours on the clock.",
    included: [
      "Moving and covering furniture and floors",
      "Filling small nail holes and minor hairline cracks",
      "Light sanding and dusting down",
      "Two coats of your chosen paint on the walls",
      "Neat cutting-in around ceilings, skirting, sockets and fittings",
      "Tidying up at the end of every day",
    ],
    notIncluded: ["Paint and materials (you supply these)", "Major plaster repairs", "Wallpaper removal", "Damp or stain treatment"],
    howPriced: "Wall area (m²) × the living room labour rate, with a minimum charge per living room.",
    calculatorItem: "living_room",
  },
  {
    slug: "skirting-board-painting",
    name: "Skirting board painting",
    shortName: "Skirting boards",
    image: IMAGES.skirting,
    summary: "Refresh your existing skirting boards with a neat finish.",
    seoTitle: "Skirting Board Painting in Newcastle | Priced per Metre",
    seoDescription:
      "Skirting board painting in Newcastle upon Tyne, priced per linear metre. Sanding, filling and two coats included. Get your instant estimate online.",
    intro:
      "Tired, scuffed skirting boards let a room down. We sand, fill small chips, and apply a smooth finish in your chosen sheen – priced simply by the length of skirting.",
    included: [
      "Protecting floors and carpet edges",
      "Sanding to give the new paint a good key",
      "Filling small chips and dents",
      "Two coats of your chosen finish",
      "Careful cutting-in against walls and flooring",
    ],
    notIncluded: ["Paint and materials (you supply these)", "Replacing damaged skirting", "Stripping heavily built-up paint"],
    howPriced: "Total length (linear metres) × the skirting labour rate, with a minimum charge.",
    calculatorItem: "skirting",
  },
  {
    slug: "ceiling-painting",
    name: "Ceiling painting",
    shortName: "Ceilings",
    optional: true,
    image: IMAGES.ceiling,
    summary: "An optional extra with any room: a smooth, even ceiling finish priced by area.",
    seoTitle: "Ceiling Painting in Newcastle | Optional Extra with Any Room",
    seoDescription:
      "Add ceiling painting to your bedroom or living room in Newcastle. Priced per square metre with a clear minimum charge. Labour only, no hourly rates.",
    intro:
      "A fresh ceiling finishes a room properly. Add it to any bedroom or living room quotation – it's priced separately by area so you can see exactly what it costs.",
    included: ["Protecting the room below", "Filling small hairline cracks", "Two coats of your chosen ceiling paint", "Neat cutting-in along the wall line"],
    notIncluded: ["Paint and materials (you supply these)", "Large cracks or damaged plaster", "Water stain treatment", "Artex or textured ceiling work"],
    howPriced: "Ceiling area (length × width in m²) × the ceiling labour rate, with a minimum charge.",
    calculatorItem: "ceiling",
  },
];

export function getService(slug: string): ServiceInfo | undefined {
  return SERVICES.find((s) => s.slug === slug);
}
