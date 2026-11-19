/**
 * Creates a one-time upload link for a customer photo.
 *
 * The browser asks for a link, then uploads the photo straight to the PRIVATE
 * "enquiry-photos" storage bucket (this avoids server upload size limits and
 * lets us show a progress bar). Photos are never publicly visible.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { isUuid } from "@/lib/enquiry";
import { LIMITS } from "@/lib/pricing/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const bodySchema = z.object({
  draftId: z.string().refine(isUuid, "Invalid upload session"),
  contentType: z.enum(LIMITS.photoTypes, { error: "Only JPG, PNG and WEBP photos are allowed" }),
  size: z
    .number()
    .int()
    .positive()
    .max(LIMITS.maxPhotoBytes, `Each photo must be under ${LIMITS.maxPhotoBytes / 1024 / 1024} MB`),
});

export async function POST(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Photo uploads aren't set up yet. You can still send your enquiry without photos." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid photo" }, { status: 400 });
  }
  const { draftId, contentType } = parsed.data;
  const folder = `pending/${draftId}`;

  // Limit the number of photos per enquiry
  const { data: existing, error: listError } = await supabase.storage.from("enquiry-photos").list(folder, { limit: 50 });
  if (listError) {
    console.error("Photo list failed", listError);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
  // Allow a few extra for photos the customer removed and replaced
  if ((existing?.length ?? 0) >= LIMITS.maxPhotos * 2) {
    return NextResponse.json({ error: `You can upload up to ${LIMITS.maxPhotos} photos.` }, { status: 400 });
  }

  const path = `${folder}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
  const { data, error } = await supabase.storage.from("enquiry-photos").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Signed upload URL failed", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path: data.path });
}
