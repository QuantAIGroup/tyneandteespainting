"use server";

/**
 * ADMIN ACTIONS FOR THE PAINTER PLATFORM
 * Each action: (1) checks you're an admin with the right role, (2) validates
 * the input, (3) saves it with the server key, (4) writes an audit entry.
 * The database rules (triggers/constraints) check everything again.
 */
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { audit, makeReference } from "@/lib/platform/audit";
import { CIS_RATES, type CisStatus } from "@/lib/platform/cis";
import { parseOfferForm, termsToRow } from "@/lib/platform/forms";
import { termsHash } from "@/lib/platform/offers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPainterEmail } from "@/lib/notifications";
import type { FormState } from "@/components/platform/ActionForm";

function db() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}
const fail = (message: string): FormState => ({ ok: false, message });
const friendly = (msg: string) => msg.replace(/^.*?ERROR:\s*/, "");
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "";

// ---------------------------------------------------------------------
// Website enquiry → internal job
// ---------------------------------------------------------------------
export async function createJobFromEnquiry(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  const enquiryId = str(fd, "enquiryId");
  const title = str(fd, "title");
  const scope = str(fd, "scope");
  if (enquiryId && !isUuid(enquiryId)) return fail("Invalid enquiry");
  if (title.length < 3 || scope.length < 10) return fail("Add a title and a scope summary (at least 10 characters).");

  const supabase = db();
  let customerPrice: number | null = null;
  if (enquiryId) {
    const { data: enq } = await supabase.from("enquiries").select("agreed_price_pence").eq("id", enquiryId).maybeSingle();
    if (!enq) return fail("Enquiry not found");
    customerPrice = (enq.agreed_price_pence as number | null) ?? null;
  }
  const postcode = str(fd, "postcode").toUpperCase();
  const reference = makeReference("J");
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      reference,
      enquiry_id: enquiryId || null,
      title,
      scope_summary: scope,
      site_town: str(fd, "town") || null,
      site_postcode_district: postcode ? postcode.split(" ")[0] : null,
      customer_price_pence: customerPrice,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !job) return fail(friendly(error?.message ?? "Could not create the job"));

  await supabase.from("job_site_details").insert({
    job_id: job.id,
    customer_contact_name: str(fd, "customerName") || null,
    customer_phone: str(fd, "customerPhone") || null,
    address_line1: str(fd, "addressLine1") || null,
    address_line2: str(fd, "addressLine2") || null,
    town: str(fd, "town") || null,
    postcode: postcode || null,
    access_notes: str(fd, "accessNotes") || null,
  });
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "job.created", entityType: "job", entityId: job.id, details: { reference, enquiryId } });
  redirect(`/admin/jobs/${job.id}`);
}

export async function saveSiteDetails(jobId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  if (!isUuid(jobId)) return fail("Invalid job");
  const { error } = await db()
    .from("job_site_details")
    .upsert({
      job_id: jobId,
      customer_contact_name: str(fd, "customerName") || null,
      customer_phone: str(fd, "customerPhone") || null,
      address_line1: str(fd, "addressLine1") || null,
      address_line2: str(fd, "addressLine2") || null,
      town: str(fd, "town") || null,
      postcode: str(fd, "postcode").toUpperCase() || null,
      access_notes: str(fd, "accessNotes") || null,
      parking_notes: str(fd, "parkingNotes") || null,
    });
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "job.site_details_updated", entityType: "job", entityId: jobId });
  refresh();
  return { ok: true, message: "Site details saved" };
}

// ---------------------------------------------------------------------
// Offers (company side)
// ---------------------------------------------------------------------
async function nextSpecVersion(jobId: string): Promise<string> {
  const supabase = db();
  const { data: job } = await supabase.from("jobs").select("reference").eq("id", jobId).single();
  const { count } = await supabase
    .from("job_offer_versions")
    .select("id, job_offers!inner(job_id)", { count: "exact", head: true })
    .eq("job_offers.job_id", jobId);
  return `${job?.reference ?? "JOB"} spec ${(count ?? 0) + 1}`;
}

export async function sendOffer(jobId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  if (!isUuid(jobId)) return fail("Invalid job");
  const painterId = str(fd, "painterBusinessId");
  if (!isUuid(painterId)) return fail("Choose a painter");
  const supabase = db();

  const { data: job } = await supabase.from("jobs").select("id, status, reference, title").eq("id", jobId).single();
  if (!job || !["draft", "offered"].includes(job.status as string)) return fail("This job can no longer be offered.");
  const { data: painter } = await supabase.from("painter_businesses").select("onboarding_status, invoice_email").eq("id", painterId).single();
  if (painter?.onboarding_status !== "approved") return fail("Only painters with approved onboarding can receive offers.");
  const { data: restriction } = await supabase
    .from("access_restrictions")
    .select("id")
    .eq("painter_business_id", painterId)
    .is("lifted_at", null)
    .limit(1);
  if (restriction?.length) return fail("This painter has an active protective access restriction.");

  const parsed = parseOfferForm(fd, await nextSpecVersion(jobId));
  if (!parsed.ok) return fail(parsed.message);

  // One negotiation thread per job + painter. Re-open a closed thread for a fresh offer.
  const { data: existing } = await supabase.from("job_offers").select("id, status").eq("job_id", jobId).eq("painter_business_id", painterId).maybeSingle();
  let offerId = existing?.id as string | undefined;
  if (existing && existing.status === "open") return fail("This painter already has an open offer for this job – respond to it instead.");
  if (existing && existing.status === "agreed") return fail("This job is already agreed with this painter.");
  if (existing) {
    await supabase.from("job_offers").update({ status: "open", decline_reason: null }).eq("id", existing.id);
  } else {
    const { data: created, error } = await supabase
      .from("job_offers")
      .insert({ job_id: jobId, painter_business_id: painterId, created_by: admin.id })
      .select("id")
      .single();
    if (error || !created) return fail(friendly(error?.message ?? "Could not create the offer"));
    offerId = created.id as string;
  }
  const { count } = await supabase.from("job_offer_versions").select("id", { count: "exact", head: true }).eq("offer_id", offerId!);
  const { error: vErr } = await supabase.from("job_offer_versions").insert({
    offer_id: offerId,
    version_number: (count ?? 0) + 1,
    proposed_by: "company",
    proposed_by_user: admin.id,
    ...termsToRow(parsed.terms),
    content_sha256: termsHash(parsed.terms),
    company_accepted_at: new Date().toISOString(),
    company_accepted_by: admin.id,
  });
  if (vErr) return fail(friendly(vErr.message));
  if (job.status === "draft") await supabase.from("jobs").update({ status: "offered" }).eq("id", jobId);
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "offer.sent", entityType: "job_offer", entityId: offerId, painterBusinessId: painterId, details: { feePence: parsed.terms.feePence } });
  if (painter.invoice_email) {
    await sendPainterEmail(
      painter.invoice_email as string,
      `New job offer ${job.reference}`,
      [
        `You have a new job offer: ${job.title}.`,
        "You are free to accept, decline or propose different terms. Declining has no consequences.",
      ],
      { label: "View offer", url: `${siteUrl()}/painter/offers/${offerId}` },
    );
  }
  refresh();
  return { ok: true, message: "Offer sent" };
}

export async function companyAcceptLatest(offerId: string, versionId: string): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  if (!isUuid(offerId) || !isUuid(versionId)) return fail("Invalid offer");
  const { data, error } = await db()
    .from("job_offer_versions")
    .update({ company_accepted_at: new Date().toISOString(), company_accepted_by: admin.id })
    .eq("id", versionId)
    .eq("offer_id", offerId)
    .is("company_accepted_at", null)
    .select("id");
  if (error) return fail(friendly(error.message));
  if (!data?.length) return fail("Nothing to accept – the offer may have changed. Refresh the page.");
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "offer.company_accepted", entityType: "job_offer_version", entityId: versionId });
  refresh();
  return { ok: true, message: "Accepted – the job is now agreed with this painter." };
}

export async function companyCounter(offerId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  if (!isUuid(offerId)) return fail("Invalid offer");
  const supabase = db();
  const { data: offer } = await supabase.from("job_offers").select("job_id, status, painter_business_id").eq("id", offerId).single();
  if (offer?.status !== "open") return fail("This offer is no longer open.");
  const parsed = parseOfferForm(fd, await nextSpecVersion(offer.job_id as string));
  if (!parsed.ok) return fail(parsed.message);
  const { data: last } = await supabase.from("job_offer_versions").select("version_number, proposed_by").eq("offer_id", offerId).order("version_number", { ascending: false }).limit(1).single();
  if (last?.proposed_by === "company") return fail("You made the latest proposal – wait for the painter to respond.");
  const { error } = await supabase.from("job_offer_versions").insert({
    offer_id: offerId,
    version_number: (last?.version_number ?? 0) + 1,
    proposed_by: "company",
    proposed_by_user: admin.id,
    ...termsToRow(parsed.terms),
    content_sha256: termsHash(parsed.terms),
    company_accepted_at: new Date().toISOString(),
    company_accepted_by: admin.id,
  });
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "offer.company_countered", entityType: "job_offer", entityId: offerId, painterBusinessId: offer.painter_business_id as string });
  refresh();
  return { ok: true, message: "Revised offer sent" };
}

export async function withdrawOffer(offerId: string): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  if (!isUuid(offerId)) return fail("Invalid offer");
  const { data, error } = await db().from("job_offers").update({ status: "withdrawn_by_company" }).eq("id", offerId).eq("status", "open").select("id");
  if (error) return fail(friendly(error.message));
  if (!data?.length) return fail("The offer is no longer open.");
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "offer.withdrawn", entityType: "job_offer", entityId: offerId });
  refresh();
  return { ok: true, message: "Offer withdrawn" };
}

export async function reviewCompletion(jobId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  if (!isUuid(jobId)) return fail("Invalid job");
  const decision = str(fd, "decision");
  const supabase = db();
  if (decision === "accept") {
    const { data, error } = await supabase
      .from("jobs")
      .update({ status: "completed", completion_reviewed_at: new Date().toISOString(), completion_reviewed_by: admin.id })
      .eq("id", jobId)
      .eq("status", "completion_submitted")
      .select("id");
    if (error) return fail(friendly(error.message));
    if (!data?.length) return fail("The painter hasn't submitted completion yet.");
  } else if (decision === "return") {
    const note = str(fd, "note");
    if (note.length < 10) return fail("Explain what is outstanding (at least 10 characters).");
    const { error } = await supabase.from("jobs").update({ status: "in_progress", completion_note: `Returned: ${note}` }).eq("id", jobId).eq("status", "completion_submitted");
    if (error) return fail(friendly(error.message));
  } else return fail("Choose an option");
  await audit({ actorUserId: admin.id, actorKind: "admin", action: `job.completion_${decision}`, entityType: "job", entityId: jobId });
  refresh();
  return { ok: true, message: decision === "accept" ? "Completion accepted – the painter can now invoice." : "Returned to the painter." };
}

export async function cancelJob(jobId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("jobs.manage");
  if (!isUuid(jobId)) return fail("Invalid job");
  const reason = str(fd, "reason");
  if (reason.length < 10) return fail("Give a reason (at least 10 characters).");
  const supabase = db();
  const { data, error } = await supabase.from("jobs").update({ status: "cancelled", cancelled_reason: reason }).eq("id", jobId).in("status", ["draft", "offered"]).select("id");
  if (error) return fail(friendly(error.message));
  if (!data?.length) return fail("Agreed jobs can't simply be cancelled – the accepted job record binds both sides. Record a variation or follow the agreement's termination clause.");
  await supabase.from("job_offers").update({ status: "withdrawn_by_company" }).eq("job_id", jobId).eq("status", "open");
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "job.cancelled", entityType: "job", entityId: jobId, details: { reason } });
  refresh();
  return { ok: true, message: "Job cancelled" };
}

export async function handleEmergency(noticeId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("emergencies.view");
  if (!isUuid(noticeId)) return fail("Invalid notice");
  const outcome = str(fd, "outcome");
  const note = str(fd, "note");
  const allowed = ["rescheduled", "substitute_approved", "job_cancelled_no_fault", "job_reassigned", "resolved_other", ""];
  if (!allowed.includes(outcome)) return fail("Choose an outcome");
  const { error } = await db()
    .from("emergency_notices")
    .update({ status: outcome ? "resolved" : "acknowledged", outcome: outcome || null, outcome_note: note || null, handled_by: admin.id, handled_at: new Date().toISOString() })
    .eq("id", noticeId);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "emergency.handled", entityType: "emergency_notice", entityId: noticeId, details: { outcome } });
  refresh();
  return { ok: true, message: outcome ? "Recorded" : "Acknowledged" };
}

// ---------------------------------------------------------------------
// Painter onboarding decisions
// ---------------------------------------------------------------------
export async function decideOnboarding(painterId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("painters.approve");
  if (!isUuid(painterId)) return fail("Invalid painter");
  const decision = str(fd, "decision");
  const note = str(fd, "note");
  const supabase = db();
  const { data: p } = await supabase.from("painter_businesses").select("onboarding_status, invoice_email, legal_name").eq("id", painterId).single();
  if (!p) return fail("Painter not found");
  let patch: Record<string, unknown>;
  if (decision === "approve") {
    const { data: ev } = await supabase.from("painter_evidence").select("kind, verification_status, expires_on").eq("painter_business_id", painterId);
    const today = new Date().toISOString().slice(0, 10);
    const insured = (ev ?? []).some((e) => e.kind === "public_liability_insurance" && e.verification_status === "verified" && (!e.expires_on || e.expires_on >= today));
    if (!insured) return fail("Verify a current public liability insurance document before approving.");
    patch = { onboarding_status: "approved", approved_at: new Date().toISOString(), approved_by: admin.id, onboarding_admin_note: note || null };
  } else if (decision === "more_info") {
    if (note.length < 10) return fail("Say what information is needed.");
    patch = { onboarding_status: "more_information_requested", onboarding_admin_note: note };
  } else if (decision === "reject") {
    if (note.length < 10) return fail("Give the reason (it will be shown to the applicant).");
    patch = { onboarding_status: "rejected", onboarding_admin_note: note };
  } else return fail("Choose a decision");
  const { error } = await supabase.from("painter_businesses").update(patch).eq("id", painterId);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: `onboarding.${decision}`, entityType: "painter_business", entityId: painterId, painterBusinessId: painterId, details: { note } });
  if (p.invoice_email) {
    const subject = decision === "approve" ? "Your Tyne & Tees Painting account is approved" : "Update on your Tyne & Tees Painting application";
    await sendPainterEmail(p.invoice_email as string, subject, [note || "Your onboarding has been approved. You can now receive job offers. You are never obliged to accept them."], {
      label: "Open painter portal",
      url: `${siteUrl()}/painter`,
    });
  }
  refresh();
  return { ok: true, message: "Decision saved" };
}

export async function setEngagementRoute(painterId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("painters.approve");
  const route = str(fd, "route");
  const reason = str(fd, "reason");
  if (!isUuid(painterId) || !["independent_business", "status_review_required", "worker_or_employee"].includes(route)) return fail("Invalid request");
  if (reason.length < 10) return fail("Record why (at least 10 characters).");
  const { error } = await db().from("painter_businesses").update({ engagement_route: route }).eq("id", painterId);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "painter.engagement_route_changed", entityType: "painter_business", entityId: painterId, painterBusinessId: painterId, details: { route, reason } });
  refresh();
  return { ok: true, message: "Saved. Note: this setting does not decide legal status – get employment-status advice." };
}

export async function verifyEvidence(evidenceId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("evidence.verify");
  if (!isUuid(evidenceId)) return fail("Invalid document");
  const status = str(fd, "status");
  if (!["verified", "rejected"].includes(status)) return fail("Choose verified or rejected");
  const note = str(fd, "note");
  if (status === "rejected" && note.length < 5) return fail("Say why it was rejected.");
  const { data, error } = await db()
    .from("painter_evidence")
    .update({ verification_status: status, verification_note: note || null, verified_by: admin.id, verified_at: new Date().toISOString() })
    .eq("id", evidenceId)
    .select("painter_business_id")
    .single();
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: `evidence.${status}`, entityType: "painter_evidence", entityId: evidenceId, painterBusinessId: data?.painter_business_id as string });
  refresh();
  return { ok: true, message: status === "verified" ? "Marked as verified" : "Marked as rejected" };
}

export async function recordCisVerification(painterId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("cis.manage");
  if (!isUuid(painterId)) return fail("Invalid painter");
  const schema = z.object({
    status: z.enum(["gross", "standard", "higher"]),
    reference: z.string().trim().min(4, "Enter the HMRC verification reference"),
    verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the verification date"),
    via: z.enum(["sage", "hmrc_online", "hmrc_phone", "other_software"]),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse({ status: str(fd, "status"), reference: str(fd, "reference"), verifiedOn: str(fd, "verifiedOn"), via: str(fd, "via"), note: str(fd, "note") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (fd.get("confirm") !== "yes") return fail("Confirm the status and rate were taken from HMRC's verification result.");
  const supabase = db();
  await supabase.from("cis_verifications").update({ is_current: false }).eq("painter_business_id", painterId).eq("is_current", true);
  const status = parsed.data.status as CisStatus;
  const { error } = await supabase.from("cis_verifications").insert({
    painter_business_id: painterId,
    verified_on: parsed.data.verifiedOn,
    hmrc_verification_reference: parsed.data.reference,
    deduction_status: status,
    rate_percent: CIS_RATES[status],
    verified_via: parsed.data.via,
    evidence_note: parsed.data.note || null,
    recorded_by: admin.id,
  });
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "cis.verification_recorded", entityType: "painter_business", entityId: painterId, painterBusinessId: painterId, details: { status } });
  refresh();
  return { ok: true, message: `Recorded: ${CIS_RATES[status]}% deduction rate` };
}

// ---------------------------------------------------------------------
// Approval gates (owner only)
// ---------------------------------------------------------------------
export async function approveGate(key: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("gates.approve");
  const approver = str(fd, "approvedBy");
  const evidence = str(fd, "evidence");
  const revoke = fd.get("revoke") === "yes";
  if (!revoke && (approver.length < 3 || evidence.length < 10))
    return fail("Enter who approved it (name and firm) and the evidence (e.g. 'Email from X dated 1 Dec 2026').");
  if (!revoke && fd.get("confirm") !== "yes") return fail("Confirm you have this approval in writing.");
  const patch = revoke
    ? { approved: false, approved_by_name: null, approved_at: null, evidence_note: evidence || null, recorded_by: admin.id }
    : { approved: true, approved_by_name: approver, approved_at: new Date().toISOString(), evidence_note: evidence, recorded_by: admin.id };
  const { error } = await db().from("compliance_gates").update(patch).eq("key", key);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: revoke ? "gate.revoked" : "gate.approved", entityType: "compliance_gate", entityId: key, details: { approver, evidence } });
  refresh();
  return { ok: true, message: revoke ? "Approval withdrawn" : "Approval recorded" };
}

// ---------------------------------------------------------------------
// Legal documents
// ---------------------------------------------------------------------
const DOC_FLOW: Record<string, string[]> = {
  draft: ["awaiting_solicitor_review", "awaiting_accountant_review", "awaiting_company_approval", "archived"],
  awaiting_solicitor_review: ["draft", "awaiting_accountant_review", "awaiting_company_approval", "archived"],
  awaiting_accountant_review: ["draft", "awaiting_solicitor_review", "awaiting_company_approval", "archived"],
  awaiting_company_approval: ["draft", "approved_for_publication", "archived"],
  approved_for_publication: ["published", "superseded", "archived"],
  published: ["superseded", "archived"],
  superseded: ["archived"],
  archived: [],
};

export async function setDocumentStatus(versionId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("documents.manage");
  if (!isUuid(versionId)) return fail("Invalid version");
  const next = str(fd, "status");
  const supabase = db();
  const { data: v } = await supabase.from("legal_document_versions").select("status, document_id, body_markdown, file_storage_path").eq("id", versionId).single();
  if (!v) return fail("Version not found");
  if (!DOC_FLOW[v.status as string]?.includes(next)) return fail("That status change isn't allowed from here.");
  const patch: Record<string, unknown> = { status: next };
  if (next === "approved_for_publication") {
    if (!v.body_markdown && !v.file_storage_path) return fail("This document has no text yet – it can't be approved.");
    const approver = str(fd, "approvedBy");
    const effective = str(fd, "effectiveDate");
    if (approver.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(effective)) return fail("Enter the approving person (and firm) and the effective date.");
    if (fd.get("confirm") !== "yes") return fail("Confirm the approver has approved this exact version in writing.");
    if ((v.body_markdown as string | null)?.includes("[INSERT")) return fail("The text still contains [INSERT] placeholders. Complete them in a new version first.");
    Object.assign(patch, { approved_by_name: approver, approved_at: new Date().toISOString(), effective_date: effective, review_date: str(fd, "reviewDate") || null });
  }
  const { error } = await supabase.from("legal_document_versions").update(patch).eq("id", versionId);
  if (error) return fail(friendly(error.message));
  // Publishing supersedes any older published/approved version of the same document
  if (next === "published") {
    await supabase
      .from("legal_document_versions")
      .update({ status: "superseded" })
      .eq("document_id", v.document_id)
      .neq("id", versionId)
      .in("status", ["published", "approved_for_publication"]);
  }
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "document.status_changed", entityType: "legal_document_version", entityId: versionId, details: { from: v.status, to: next } });
  refresh();
  return { ok: true, message: "Status updated" };
}

export async function createDocumentVersion(documentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin("documents.manage");
  if (!isUuid(documentId)) return fail("Invalid document");
  const label = str(fd, "versionLabel");
  const body = String(fd.get("body") ?? "").trim();
  const source = str(fd, "sourceNote");
  if (!label || body.length < 20) return fail("Enter a version label and the document text.");
  const { createHash } = await import("node:crypto");
  const { error } = await db().from("legal_document_versions").insert({
    document_id: documentId,
    version_label: label,
    body_markdown: body,
    source_note: source || null,
    status: "draft",
    recorded_by: admin.id,
    content_sha256: createHash("sha256").update(body).digest("hex"),
  });
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: admin.id, actorKind: "admin", action: "document.version_created", entityType: "legal_document", entityId: documentId, details: { label } });
  refresh();
  return { ok: true, message: "New draft version saved" };
}
