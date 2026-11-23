/**
 * One-time upload links for LOGGED-IN painters.
 *
 * Files go straight into a PRIVATE bucket, inside a folder named after the
 * painter's own business, so one painter can never write into another's
 * folder. The server then records the file (with its details) in a separate
 * step that checks the path belongs to the painter.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPainterUser } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { createAdminClient } from "@/lib/supabase/admin";

const TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
} as const;

const PURPOSES = {
  evidence: { bucket: "painter-documents", types: ["application/pdf", "image/jpeg", "image/png", "image/webp"] },
  "job-photo": { bucket: "job-photos", types: ["image/jpeg", "image/png", "image/webp", "image/heic"] },
  "case-evidence": { bucket: "case-evidence", types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"] },
} as const;

const bodySchema = z.object({
  purpose: z.enum(["evidence", "job-photo", "case-evidence"]),
  contentType: z.string(),
  size: z.number().int().positive().max(15 * 1024 * 1024, "Files must be under 15 MB"),
  jobId: z.string().optional(),
});

export async function POST(request: Request) {
  const painter = await getPainterUser();
  if (!painter) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Uploads aren't set up yet." }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid upload" }, { status: 400 });
  const { purpose, contentType, jobId } = parsed.data;
  const config = PURPOSES[purpose];
  if (!(config.types as readonly string[]).includes(contentType)) {
    return NextResponse.json({ error: "That file type isn't allowed here." }, { status: 400 });
  }

  let folder = `${painter.painterBusinessId}`;
  if (purpose !== "evidence") {
    if (!jobId || !isUuid(jobId)) return NextResponse.json({ error: "Missing job" }, { status: 400 });
    const { data: job } = await supabase.from("jobs").select("painter_business_id").eq("id", jobId).maybeSingle();
    if (job?.painter_business_id !== painter.painterBusinessId) return NextResponse.json({ error: "Not your job" }, { status: 403 });
    folder += `/${jobId}`;
  }

  const ext = TYPES[contentType as keyof typeof TYPES];
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(config.bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Painter signed upload failed", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ signedUrl: data.signedUrl, path: data.path });
}
