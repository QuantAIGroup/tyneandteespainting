/**
 * Validation rules for calculator input and price settings.
 * Used in the browser (helpful messages) and on the server (security).
 */
import { z } from "zod";

export const LIMITS = {
  roomLength: { min: 0.5, max: 20 },
  wallHeight: { min: 1.5, max: 6 },
  wallWidth: { min: 0.2, max: 20 },
  skirting: { min: 0.5, max: 300 },
  maxWalls: 12,
  maxItems: 15,
  coats: { min: 1, max: 5 },
  maxPhotos: 6,
  maxPhotoBytes: 10 * 1024 * 1024, // 10 MB
  photoTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

const metres = (min: number, max: number, name: string) =>
  z
    .number({ error: `${name} is required` })
    .finite()
    .min(min, `${name} must be at least ${min} m`)
    .max(max, `${name} must be no more than ${max} m`);

const coats = z.number().int().min(LIMITS.coats.min).max(LIMITS.coats.max);
const id = z.string().min(1).max(64);
const label = z.string().trim().min(1).max(60);

const surface = z.enum(["good", "minor_defects", "major_damage"]);

const optionalMetres = z.number().finite().optional();

function checkRange(
  ctx: z.RefinementCtx,
  value: number | undefined,
  path: string,
  name: string,
  range: { min: number; max: number },
) {
  if (value === undefined || Number.isNaN(value)) {
    ctx.addIssue({ code: "custom", path: [path], message: `${name} is required` });
  } else if (value < range.min || value > range.max) {
    ctx.addIssue({ code: "custom", path: [path], message: `${name} must be between ${range.min} m and ${range.max} m` });
  }
}

/**
 * A bedroom or living room.
 * - "simple" mode needs length, width and wall height.
 * - "walls" mode (irregular rooms) needs each wall; length and width are only needed for the ceiling.
 */
export const paintedRoomSchema = z
  .object({
    id,
    type: z.enum(["bedroom", "living_room"]),
    label,
    measurementMode: z.enum(["simple", "walls"]),
    length: optionalMetres,
    width: optionalMetres,
    height: optionalMetres,
    walls: z
      .array(
        z.object({
          width: metres(LIMITS.wallWidth.min, LIMITS.wallWidth.max, "Wall width"),
          height: metres(LIMITS.wallHeight.min, LIMITS.wallHeight.max, "Wall height"),
        }),
      )
      .max(LIMITS.maxWalls),
    includeCeiling: z.boolean(),
    coats,
    condition: z.object({
      surface,
      newlySkimmed: z.boolean(),
      colourChange: z.enum(["similar", "significant"]),
      wallpaperToRemove: z.boolean(),
      dampOrStains: z.boolean(),
    }),
  })
  .superRefine((room, ctx) => {
    if (room.measurementMode === "simple") {
      checkRange(ctx, room.length, "length", "Room length", LIMITS.roomLength);
      checkRange(ctx, room.width, "width", "Room width", LIMITS.roomLength);
      checkRange(ctx, room.height, "height", "Wall height", LIMITS.wallHeight);
    } else {
      if (room.walls.length < 1) ctx.addIssue({ code: "custom", path: ["walls"], message: "Add at least one wall" });
      if (room.includeCeiling) {
        checkRange(ctx, room.length, "length", "Ceiling length", LIMITS.roomLength);
        checkRange(ctx, room.width, "width", "Ceiling width", LIMITS.roomLength);
      }
    }
  })
  .transform((room) => ({
    ...room,
    length: room.length ?? 0,
    width: room.width ?? 0,
    height: room.height ?? 0,
    walls: room.measurementMode === "walls" ? room.walls : [],
  }));

export const skirtingSchema = z.object({
  id,
  type: z.literal("skirting"),
  label,
  linearMetres: metres(LIMITS.skirting.min, LIMITS.skirting.max, "Skirting length"),
  coats,
  condition: z.enum(["good", "minor_defects", "major_damage", "bare_wood"]),
});

export const ceilingSchema = z.object({
  id,
  type: z.literal("ceiling"),
  label,
  length: metres(LIMITS.roomLength.min, LIMITS.roomLength.max, "Ceiling length"),
  width: metres(LIMITS.roomLength.min, LIMITS.roomLength.max, "Ceiling width"),
  coats,
  condition: z.object({
    surface,
    newlySkimmed: z.boolean(),
    dampOrStains: z.boolean(),
  }),
});

export const quoteItemSchema = z.union([paintedRoomSchema, skirtingSchema, ceilingSchema]);
export const quoteItemsSchema = z
  .array(quoteItemSchema)
  .min(1, "Add at least one room or service")
  .max(LIMITS.maxItems, `You can add up to ${LIMITS.maxItems} items to one quotation`);

const money = z.number().finite().min(0).max(100000);
export const pricingSettingsSchema = z.object({
  bedroom: z.object({ ratePerSqm: money, minimumCharge: money }),
  livingRoom: z.object({ ratePerSqm: money, minimumCharge: money }),
  skirting: z.object({ ratePerMetre: money, minimumCharge: money }),
  ceiling: z.object({ ratePerSqm: money, minimumCharge: money }),
  roundToNearest: z.number().finite().min(0).max(100),
  standardCoats: z.number().int().min(1).max(5),
});
