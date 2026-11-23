/**
 * Saves a quotation enquiry.
 *
 * Security: the price is RECALCULATED here on the server using the current
 * prices from the database. Whatever price the browser showed is ignored, so
 * nobody can tamper with it.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { customerDetailsSchema, generateReference, isUuid, normalisePostcode } from "@/lib/enquiry";
import { sendNotification } from "@/lib/notifications";
import { calculateQuote, formatPence } from "@/lib/pricing/engine";
import { LIMITS, quoteItemsSchema } from "@/lib/pricing/schema";
import { buildQuoteRoomRows } from "@/lib/quote-rooms";
import { getPricingSettingsUncached } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE } from "@/config/site";

/** Largest estimate for a single room or extra (£1,000,000) – the database limit. */
const MAX_LINE_PENCE = 100_000_000;

const bodySchema = z.object({
  draftId: z.string().refine(isUuid),
  items: quoteItemsSchema,
  customer: customerDetailsSchema,
  photos: z
    .array(
      z.object({
        path: z.string().max(300),
        fileName: z.string().max(200).optional(),
        contentType: z.enum(LIMITS.photoTypes),
        size: z.number().int().positive().max(LIMITS.maxPhotoBytes),
      }),
    )
    .max(LIMITS.maxPhotos),
  /** Hidden "honeypot" field – real people leave it empty, spam bots fill it in. */
  website: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Online enquiries aren't connected yet. Please contact us by phone or email for now." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Please check your details and try again." }, { status: 400 });
  }
  const { draftId, items, customer, photos, website } = parsed.data;

  // Bot filled in the hidden field: pretend success, save nothing.
  if (website && website.trim() !== "") {
    return NextResponse.json({ reference: generateReference() });
  }

  // Photos must belong to this enquiry's private upload folder and actually exist
  const folder = `pending/${draftId}`;
  if (photos.some((p) => !p.path.startsWith(`${folder}/`) || p.path.includes(".."))) {
    return NextResponse.json({ error: "Invalid photo upload. Please re-add your photos." }, { status: 400 });
  }
  if (photos.length > 0) {
    const { data: stored, error } = await supabase.storage.from("enquiry-photos").list(folder, { limit: 100 });
    if (error) {
      console.error("Could not verify photos", error);
      return NextResponse.json({ error: "We couldn't check your photos. Please try again." }, { status: 500 });
    }
    const names = new Set((stored ?? []).map((f) => `${folder}/${f.name}`));
    if (photos.some((p) => !names.has(p.path))) {
      return NextResponse.json({ error: "One of your photos didn't finish uploading. Please remove it and try again." }, { status: 400 });
    }
  }

  let pricing;
  try {
    pricing = await getPricingSettingsUncached();
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again in a moment." }, { status: 500 });
  }
  const quote = calculateQuote(items, pricing);
  // The database stores up to £1,000,000 per room or extra – anything bigger needs a conversation, not an online form
  const perItem = new Map<string, number>();
  for (const l of quote.lines) perItem.set(l.itemId, (perItem.get(l.itemId) ?? 0) + (l.amountPence ?? 0));
  if ([...perItem.values()].some((pence) => pence > MAX_LINE_PENCE)) {
    return NextResponse.json({ error: "That's a very large job – please call us so we can quote it properly." }, { status: 400 });
  }

  // Insert, retrying in the very unlikely event of a duplicate reference
  let reference = "";
  let enquiryId = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    reference = generateReference();
    const { data, error } = await supabase
      .from("enquiries")
      .insert({
        reference,
        full_name: customer.fullName,
        email: customer.email.toLowerCase(),
        phone: customer.phone,
        postcode: normalisePostcode(customer.postcode),
        preferred_contact: customer.preferredContact,
        preferred_start_date: customer.preferredStartDate || null,
        comments: customer.comments || null,
        items,
        breakdown: quote,
        pricing_snapshot: pricing,
        estimated_total_pence: quote.totalPence,
        requires_manual_quote: quote.requiresManualQuote,
        needs_review: quote.needsReview,
      })
      .select("id")
      .single();
    if (!error && data) {
      enquiryId = data.id as string;
      break;
    }
    if (error && error.code !== "23505") {
      console.error("Enquiry insert failed", error);
      return NextResponse.json({ error: "We couldn't save your enquiry. Please try again or contact us directly." }, { status: 500 });
    }
  }
  if (!enquiryId) {
    return NextResponse.json({ error: "We couldn't save your enquiry. Please try again." }, { status: 500 });
  }

  // One row per room with its measurements and estimated labour price.
  // If this fails, remove the half-saved enquiry so the records always match.
  const { error: roomsError } = await supabase.from("quote_rooms").insert(buildQuoteRoomRows(enquiryId, items, quote));
  if (roomsError) {
    console.error("Room records insert failed", roomsError);
    await supabase.from("enquiries").delete().eq("id", enquiryId);
    return NextResponse.json({ error: "We couldn't save your enquiry. Please try again or contact us directly." }, { status: 500 });
  }

  if (photos.length > 0) {
    const { error } = await supabase.from("enquiry_photos").insert(
      photos.map((p) => ({
        enquiry_id: enquiryId,
        storage_path: p.path,
        file_name: p.fileName ?? null,
        content_type: p.contentType,
        size_bytes: p.size,
      })),
    );
    if (error) console.error("Photo records insert failed (enquiry still saved)", error);
  }

  await sendNotification(`New painting enquiry ${reference} – ${customer.fullName}`, [
    `Reference: ${reference}`,
    `Name: ${customer.fullName}`,
    `Phone: ${customer.phone}`,
    `Email: ${customer.email}`,
    `Postcode: ${normalisePostcode(customer.postcode)}`,
    `Preferred contact: ${customer.preferredContact}`,
    `Preferred start: ${customer.preferredStartDate || "Not given"}`,
    `Estimated labour: ${quote.hasPricedItems ? formatPence(quote.totalPence) : "Manual quote needed"}`,
    quote.requiresManualQuote ? "⚠ Some items need a manual quotation" : "",
    quote.needsReview ? "⚠ Some items are flagged for review" : "",
    `Photos: ${photos.length}`,
    `View: ${SITE.url}/admin/enquiries/${enquiryId}`,
  ].filter(Boolean));

  return NextResponse.json({ reference });
}
