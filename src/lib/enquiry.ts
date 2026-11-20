/**
 * Customer details form rules + enquiry helpers shared by browser and server.
 */
import { z } from "zod";

// UK postcode (lenient – allows with or without the space)
const UK_POSTCODE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
// UK phone number: digits, spaces, +, brackets, hyphens. 10–11 digits (or +44)
const PHONE = /^[+()\d\s-]{10,20}$/;

export const customerDetailsSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.email("Please enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .regex(PHONE, "Please enter a valid UK phone number")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Please enter a valid UK phone number"),
  postcode: z.string().trim().regex(UK_POSTCODE, "Please enter a valid UK postcode, e.g. NE2 1AB"),
  preferredContact: z.enum(["phone", "email", "either"]),
  preferredStartDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Please choose a valid date"),
  comments: z.string().trim().max(2000, "Please keep comments under 2,000 characters").optional(),
});

export type CustomerDetails = z.infer<typeof customerDetailsSchema>;

// Enquiry statuses are the booking statuses (see lib/payments/booking.ts)
export { BOOKING_STATUSES as ENQUIRY_STATUSES, bookingStatusLabel as statusLabel } from "@/lib/payments/booking";
export type { BookingStatus as EnquiryStatus } from "@/lib/payments/booking";

export function normalisePostcode(postcode: string): string {
  const compact = postcode.replace(/\s+/g, "").toUpperCase();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

/** e.g. "NP-261119-K7QD". No 0/O/1/I so it's easy to read over the phone. */
export function generateReference(date = new Date()): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `NP-${yy}${mm}${dd}-${suffix}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
