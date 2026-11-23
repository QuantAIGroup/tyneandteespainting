"use server";

/**
 * PAINTER PORTAL ACTIONS
 * Every action re-checks who the painter is and that the record belongs to
 * their business before saving anything.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requirePainter } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { audit } from "@/lib/platform/audit";
import { encryptField, isAccountNumber, isEncryptionConfigured, isNino, isSortCode, isUtr, lastChars, normalise } from "@/lib/platform/crypto";
import { parseOfferForm, termsToRow } from "@/lib/platform/forms";
import { termsHash } from "@/lib/platform/offers";
import { isEmailConfigured, sendNotification, sendPainterEmail } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
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
// Registration, sign-in links and passwords
// ---------------------------------------------------------------------
const applySchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email").max(200),
  legalName: z.string().trim().min(2, "Enter your business's legal name").max(200),
  tradingName: z.string().trim().max(200).optional(),
  businessStructure: z.enum(["sole_trader", "partnership", "limited_company", "llp", "other"]),
  phone: z.string().trim().min(7, "Enter a phone number").max(30),
});

/**
 * Creates a painter account + draft business profile and emails a secure link
 * to set a password. Public sign-ups stay switched OFF in Supabase – accounts
 * are only created here, by the server.
 */
export async function applyAsPainter(_prev: FormState, fd: FormData): Promise<FormState> {
  if (str(fd, "website")) return { ok: true, message: "Thanks – check your email." }; // spam trap
  if (!isEmailConfigured()) return fail("Applications aren't open yet (email isn't set up). Please call us instead.");
  const parsed = applySchema.safeParse({
    fullName: str(fd, "fullName"),
    email: str(fd, "email").toLowerCase(),
    legalName: str(fd, "legalName"),
    tradingName: str(fd, "tradingName") || undefined,
    businessStructure: str(fd, "businessStructure"),
    phone: str(fd, "phone"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  if (fd.get("independent") !== "yes") return fail("Please confirm you run your own painting business.");
  const p = parsed.data;
  const supabase = db();
  const generic: FormState = { ok: true, message: "Thanks! If this email can be registered, we've sent a link to set your password. Check your inbox." };

  const { data: link, error } = await supabase.auth.admin.generateLink({ type: "invite", email: p.email, options: { data: { kind: "painter" } } });
  if (error || !link?.user) {
    // Most likely the email already has an account – don't reveal that.
    console.info("[painter apply] invite not created", error?.message);
    return generic;
  }
  const { data: biz, error: bizErr } = await supabase
    .from("painter_businesses")
    .insert({ legal_name: p.legalName, trading_name: p.tradingName ?? null, business_structure: p.businessStructure, phone: p.phone, invoice_email: p.email })
    .select("id")
    .single();
  if (bizErr || !biz) {
    await supabase.auth.admin.deleteUser(link.user.id);
    return fail("Sorry, something went wrong. Please try again.");
  }
  await supabase.from("painter_users").insert({ user_id: link.user.id, painter_business_id: biz.id, full_name: p.fullName });
  await audit({ actorUserId: link.user.id, actorKind: "painter", action: "painter.applied", entityType: "painter_business", entityId: biz.id, painterBusinessId: biz.id });
  await sendPainterEmail(
    p.email,
    "Set your password – Tyne & Tees Painting painter portal",
    [`Hello ${p.fullName},`, "Thanks for registering your painting business. Use the button below to set your password, then complete your business profile."],
    { label: "Set my password", url: `${siteUrl()}/painter/auth/confirm?token_hash=${link.properties.hashed_token}&type=invite` },
  );
  await sendNotification("New painter registration", [`${p.legalName} (${p.fullName}) registered for the painter portal.`]);
  return generic;
}

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const generic: FormState = { ok: true, message: "If that email has a painter account, we've sent a reset link." };
  if (!z.email().safeParse(email).success) return fail("Enter a valid email");
  if (!isEmailConfigured()) return fail("Email isn't set up yet – please call us.");
  const supabase = db();
  const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.user) return generic;
  const { data: pu } = await supabase.from("painter_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!pu) return generic; // admins reset their passwords in Supabase, not here
  await sendPainterEmail(email, "Reset your painter portal password", ["Use the button below to choose a new password. If you didn't ask for this, ignore this email."], {
    label: "Choose a new password",
    url: `${siteUrl()}/painter/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`,
  });
  return generic;
}

export async function setPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 10) return fail("Use at least 10 characters.");
  if (password !== String(fd.get("confirm") ?? "")) return fail("The passwords don't match.");
  const supabase = await createSessionClient();
  if (!supabase) return fail("Not configured");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.message);
  redirect("/painter");
}

export async function signOutPainter() {
  const supabase = await createSessionClient();
  await supabase?.auth.signOut();
  redirect("/painter/login");
}

// ---------------------------------------------------------------------
// Business profile and onboarding
// ---------------------------------------------------------------------
export async function saveBusinessDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  if (["rejected", "ended"].includes(painter.onboardingStatus)) return fail("This account is closed.");
  const vatRegistered = fd.get("vatRegistered") === "yes";
  const patch = {
    legal_name: str(fd, "legalName"),
    trading_name: str(fd, "tradingName") || null,
    business_structure: str(fd, "businessStructure"),
    company_number: str(fd, "companyNumber") || null,
    address_line1: str(fd, "addressLine1") || null,
    address_line2: str(fd, "addressLine2") || null,
    town: str(fd, "town") || null,
    postcode: str(fd, "postcode").toUpperCase() || null,
    phone: str(fd, "phone") || null,
    invoice_email: str(fd, "invoiceEmail") || null,
    vat_registered: vatRegistered,
    vat_number: vatRegistered ? str(fd, "vatNumber") || null : null,
    substitution_arrangements: str(fd, "substitutionArrangements") || null,
    competence_summary: str(fd, "competenceSummary") || null,
    website_or_profile: str(fd, "website") || null,
  };
  if (patch.legal_name.length < 2) return fail("Enter your business's legal name.");
  if (!["sole_trader", "partnership", "limited_company", "llp", "other"].includes(patch.business_structure)) return fail("Choose a business type.");
  if (vatRegistered && !patch.vat_number) return fail("Enter your VAT number.");
  const { error } = await db().from("painter_businesses").update(patch).eq("id", painter.painterBusinessId);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "painter.details_updated", entityType: "painter_business", entityId: painter.painterBusinessId, painterBusinessId: painter.painterBusinessId });
  refresh();
  return { ok: true, message: "Business details saved" };
}

/** Tax and bank details – encrypted before saving; only finance admins can read them. */
export async function savePrivateDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  if (!isEncryptionConfigured()) return fail("Secure storage isn't set up yet – please don't send these details another way; we'll let you know.");
  const utr = str(fd, "utr");
  const nino = str(fd, "nino");
  const companyUtr = str(fd, "companyUtr");
  const accountName = str(fd, "accountName");
  const sortCode = str(fd, "sortCode");
  const accountNumber = str(fd, "accountNumber");
  if (utr && !isUtr(utr)) return fail("A UTR is 10 digits.");
  if (companyUtr && !isUtr(companyUtr)) return fail("A company UTR is 10 digits.");
  if (nino && !isNino(nino)) return fail("That National Insurance number doesn't look right.");
  const bankGiven = Boolean(accountName || sortCode || accountNumber);
  if (bankGiven && (!accountName || !isSortCode(sortCode) || !isAccountNumber(accountNumber))) {
    return fail("Enter the account name, a 6-digit sort code and an 8-digit account number.");
  }
  if (!utr && !companyUtr && !bankGiven) return fail("Nothing to save.");

  const patch: Record<string, unknown> = { painter_business_id: painter.painterBusinessId };
  if (utr) Object.assign(patch, { utr_encrypted: encryptField(normalise(utr)), utr_last3: lastChars(utr, 3) });
  if (nino) patch.nino_encrypted = encryptField(normalise(nino));
  if (companyUtr) patch.company_utr_encrypted = encryptField(normalise(companyUtr));
  if (bankGiven) {
    Object.assign(patch, {
      bank_account_name: accountName,
      bank_sort_code_encrypted: encryptField(normalise(sortCode)),
      bank_account_number_encrypted: encryptField(normalise(accountNumber)),
      bank_account_last4: lastChars(accountNumber, 4),
      // New bank details must be confirmed again by a call-back check (fraud prevention)
      bank_details_confirmed_at: null,
      bank_details_confirmed_by: null,
    });
  }
  const { error } = await db().from("painter_private_details").upsert(patch);
  if (error) return fail(friendly(error.message));
  await audit({
    actorUserId: painter.id,
    actorKind: "painter",
    action: bankGiven ? "painter.bank_details_changed" : "painter.tax_details_changed",
    entityType: "painter_private_details",
    painterBusinessId: painter.painterBusinessId,
  });
  if (bankGiven) await sendNotification("Painter bank details changed", [`${painter.businessName} changed their bank details. Confirm them by phone before the next payment.`]);
  refresh();
  return { ok: true, message: "Saved securely" };
}

export async function registerEvidence(_prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  const path = str(fd, "path");
  const kind = str(fd, "kind");
  const title = str(fd, "title");
  if (!path.startsWith(`${painter.painterBusinessId}/`)) return fail("Upload the file first.");
  const kinds = ["public_liability_insurance", "employers_liability_insurance", "other_insurance", "qualification", "experience_reference", "portfolio", "health_and_safety", "other"];
  if (!kinds.includes(kind)) return fail("Choose the document type.");
  const isInsurance = kind.endsWith("insurance");
  const expires = str(fd, "expiresOn");
  if (isInsurance && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return fail("Enter the insurance expiry date.");
  const limit = str(fd, "coverLimit").replace(/[£,\s]/g, "");
  const { error } = await db()
    .from("painter_evidence")
    .insert({
      painter_business_id: painter.painterBusinessId,
      kind,
      title: title || kind.replace(/_/g, " "),
      storage_path: path,
      insurer: str(fd, "insurer") || null,
      policy_number: str(fd, "policyNumber") || null,
      cover_limit_pence: limit && /^\d+$/.test(limit) ? Number(limit) * 100 : null,
      starts_on: str(fd, "startsOn") || null,
      expires_on: expires || null,
    });
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "evidence.uploaded", entityType: "painter_evidence", painterBusinessId: painter.painterBusinessId, details: { kind } });
  refresh();
  return { ok: true, message: "Document added – we'll check it." };
}

export async function submitForReview(): Promise<FormState> {
  const painter = await requirePainter();
  if (!["draft", "more_information_requested"].includes(painter.onboardingStatus)) return fail("Your profile has already been submitted.");
  const supabase = db();
  const [{ data: biz }, { data: priv }, { data: ev }] = await Promise.all([
    supabase.from("painter_businesses").select("legal_name, address_line1, postcode, invoice_email, phone").eq("id", painter.painterBusinessId).single(),
    supabase.from("painter_private_details").select("utr_last3, company_utr_encrypted, bank_account_last4").eq("painter_business_id", painter.painterBusinessId).maybeSingle(),
    supabase.from("painter_evidence").select("kind").eq("painter_business_id", painter.painterBusinessId),
  ]);
  const missing: string[] = [];
  if (!biz?.address_line1 || !biz?.postcode) missing.push("business address");
  if (!biz?.invoice_email || !biz?.phone) missing.push("contact details");
  if (!priv?.utr_last3 && !priv?.company_utr_encrypted) missing.push("UTR (for CIS)");
  if (!priv?.bank_account_last4) missing.push("bank details");
  if (!(ev ?? []).some((e) => e.kind === "public_liability_insurance")) missing.push("public liability insurance certificate");
  if (missing.length) return fail(`Still needed: ${missing.join(", ")}.`);
  const { error } = await supabase.from("painter_businesses").update({ onboarding_status: "submitted", submitted_at: new Date().toISOString() }).eq("id", painter.painterBusinessId);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "onboarding.submitted", entityType: "painter_business", entityId: painter.painterBusinessId, painterBusinessId: painter.painterBusinessId });
  await sendNotification("Painter onboarding ready for review", [`${painter.businessName} submitted their profile for review.`]);
  refresh();
  return { ok: true, message: "Submitted – we'll review it and let you know." };
}

// ---------------------------------------------------------------------
// Legal documents
// ---------------------------------------------------------------------
export async function acceptDocument(versionId: string): Promise<FormState> {
  const painter = await requirePainter();
  if (!isUuid(versionId)) return fail("Invalid document");
  const supabase = db();
  const { data: v } = await supabase
    .from("legal_document_versions")
    .select("status, body_markdown, content_sha256, legal_documents!inner(sector, requires_acceptance)")
    .eq("id", versionId)
    .single();
  const doc = (v as unknown as { legal_documents: { sector: string; requires_acceptance: boolean } } | null)?.legal_documents;
  if (!v || doc?.sector !== "painter") return fail("Document not found");
  if (!["approved_for_publication", "published"].includes(v.status as string)) return fail("This is a draft and can't be accepted yet.");
  const h = await headers();
  const { error } = await supabase.from("document_acceptances").insert({
    version_id: versionId,
    painter_business_id: painter.painterBusinessId,
    user_id: painter.id,
    content_sha256: (v.content_sha256 as string) ?? createHash("sha256").update(String(v.body_markdown ?? "")).digest("hex"),
    ip_address: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) return fail(error.code === "23505" ? "You've already accepted this version." : friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "document.accepted", entityType: "legal_document_version", entityId: versionId, painterBusinessId: painter.painterBusinessId });
  refresh();
  return { ok: true, message: "Accepted. A record with the date, time and document version has been saved." };
}

/** Painter-sector documents that need acceptance but haven't been accepted in their current approved version. */
async function outstandingAgreements(painterBusinessId: string): Promise<string[]> {
  const supabase = db();
  const { data } = await supabase
    .from("legal_documents")
    .select("title, legal_document_versions(id, status)")
    .eq("sector", "painter")
    .eq("requires_acceptance", true);
  const missing: string[] = [];
  for (const d of (data ?? []) as unknown as { title: string; legal_document_versions: { id: string; status: string }[] }[]) {
    const current = d.legal_document_versions.filter((v) => ["published", "approved_for_publication"].includes(v.status));
    if (current.length === 0) {
      missing.push(`${d.title} (not yet approved by the solicitor)`);
      continue;
    }
    const { data: acc } = await supabase.from("document_acceptances").select("id").eq("painter_business_id", painterBusinessId).in("version_id", current.map((v) => v.id)).limit(1);
    if (!acc?.length) missing.push(d.title);
  }
  return missing;
}

// ---------------------------------------------------------------------
// Offers (painter side)
// ---------------------------------------------------------------------
async function ownOpenOffer(offerId: string, painterBusinessId: string) {
  const { data } = await db().from("job_offers").select("id, status, job_id, painter_business_id").eq("id", offerId).maybeSingle();
  if (!data || data.painter_business_id !== painterBusinessId) return null;
  return data;
}

export async function painterAccept(offerId: string, versionId: string): Promise<FormState> {
  const painter = await requirePainter();
  if (!isUuid(offerId) || !isUuid(versionId)) return fail("Invalid offer");
  if (painter.onboardingStatus !== "approved") return fail("Your onboarding must be approved before you can accept jobs.");
  const offer = await ownOpenOffer(offerId, painter.painterBusinessId);
  if (!offer || offer.status !== "open") return fail("This offer is no longer open.");
  const missing = await outstandingAgreements(painter.painterBusinessId);
  if (missing.length) return fail(`Before accepting jobs, please read and accept: ${missing.join(", ")}.`);
  const { data, error } = await db()
    .from("job_offer_versions")
    .update({ painter_accepted_at: new Date().toISOString(), painter_accepted_by: painter.id })
    .eq("id", versionId)
    .eq("offer_id", offerId)
    .is("painter_accepted_at", null)
    .select("id");
  if (error) return fail(friendly(error.message));
  if (!data?.length) return fail("The offer has changed – refresh the page.");
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "offer.painter_accepted", entityType: "job_offer_version", entityId: versionId, painterBusinessId: painter.painterBusinessId });
  await sendNotification("Painter accepted a job offer", [`${painter.businessName} accepted offer ${offerId}. The job is now agreed.`]);
  refresh();
  return { ok: true, message: "Accepted – the job is agreed. You can now see the full address and details." };
}

export async function painterDecline(offerId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  if (!isUuid(offerId)) return fail("Invalid offer");
  const offer = await ownOpenOffer(offerId, painter.painterBusinessId);
  if (!offer || offer.status !== "open") return fail("This offer is no longer open.");
  const { error } = await db().from("job_offers").update({ status: "declined_by_painter", decline_reason: str(fd, "reason") || null }).eq("id", offerId);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "offer.declined", entityType: "job_offer", entityId: offerId, painterBusinessId: painter.painterBusinessId });
  refresh();
  return { ok: true, message: "Declined. There's no penalty for declining." };
}

export async function painterCounter(offerId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  if (!isUuid(offerId)) return fail("Invalid offer");
  const offer = await ownOpenOffer(offerId, painter.painterBusinessId);
  if (!offer || offer.status !== "open") return fail("This offer is no longer open.");
  const supabase = db();
  const { data: last } = await supabase
    .from("job_offer_versions")
    .select("version_number, proposed_by, specification_version")
    .eq("offer_id", offerId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  if (last?.proposed_by === "painter") return fail("You made the latest proposal – wait for a reply.");
  const parsed = parseOfferForm(fd, `${String(last?.specification_version ?? "spec").replace(/ \(painter counter\)$/, "")} (painter counter)`);
  if (!parsed.ok) return fail(parsed.message);
  const { error } = await supabase.from("job_offer_versions").insert({
    offer_id: offerId,
    version_number: (last?.version_number ?? 0) + 1,
    proposed_by: "painter",
    proposed_by_user: painter.id,
    ...termsToRow(parsed.terms),
    content_sha256: termsHash(parsed.terms),
    painter_accepted_at: new Date().toISOString(),
    painter_accepted_by: painter.id,
  });
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "offer.painter_countered", entityType: "job_offer", entityId: offerId, painterBusinessId: painter.painterBusinessId, details: { feePence: parsed.terms.feePence } });
  await sendNotification("Painter counteroffer", [`${painter.businessName} proposed different terms (fee £${(parsed.terms.feePence / 100).toFixed(2)}).`]);
  refresh();
  return { ok: true, message: "Counteroffer sent" };
}

// ---------------------------------------------------------------------
// Agreed jobs: photos, emergencies, completion
// ---------------------------------------------------------------------
async function ownAgreedJob(jobId: string, painterBusinessId: string) {
  if (!isUuid(jobId)) return null;
  const { data } = await db().from("jobs").select("id, status, painter_business_id, reference").eq("id", jobId).maybeSingle();
  if (!data || data.painter_business_id !== painterBusinessId) return null;
  return data;
}

export async function registerJobPhoto(jobId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  const job = await ownAgreedJob(jobId, painter.painterBusinessId);
  if (!job || !["agreed", "in_progress", "completion_submitted"].includes(job.status as string)) return fail("Photos can only be added to your agreed jobs.");
  const path = str(fd, "path");
  const stage = str(fd, "stage");
  if (!path.startsWith(`${painter.painterBusinessId}/${jobId}/`)) return fail("Upload the photo first.");
  if (!["before", "progress", "after"].includes(stage)) return fail("Choose before, progress or after.");
  const { error } = await db().from("job_photos").insert({ job_id: jobId, painter_business_id: painter.painterBusinessId, stage, storage_path: path, caption: str(fd, "caption") || null, uploaded_by: painter.id });
  if (error) return fail(friendly(error.message));
  if (job.status === "agreed") await db().from("jobs").update({ status: "in_progress" }).eq("id", jobId);
  refresh();
  return { ok: true, message: "Photo added" };
}

export async function reportEmergency(jobId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  const job = await ownAgreedJob(jobId, painter.painterBusinessId);
  if (!job || !["agreed", "in_progress"].includes(job.status as string)) return fail("You can report a problem on your agreed jobs.");
  const category = str(fd, "category");
  const cats = ["sudden_illness", "accident", "family_emergency", "transport_failure", "unsafe_site", "customer_access_failure", "other_emergency"];
  if (!cats.includes(category)) return fail("Choose what has happened.");
  const explanation = str(fd, "explanation");
  if (explanation.length < 5) return fail("Add a short explanation.");
  const delay = str(fd, "delayMinutes");
  const { error } = await db().from("emergency_notices").insert({
    job_id: jobId,
    painter_business_id: painter.painterBusinessId,
    reported_by: painter.id,
    category,
    explanation: explanation.slice(0, 1000),
    expected_delay_minutes: delay && /^\d+$/.test(delay) ? Number(delay) : null,
    reschedule_requested: fd.get("reschedule") === "yes",
    proposed_new_date: str(fd, "newDate") || null,
    substitute_proposed: fd.get("substitute") === "yes",
    callback_permitted: fd.get("callback") !== "no",
    evidence_storage_path: str(fd, "evidencePath") || null,
  });
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "emergency.reported", entityType: "job", entityId: jobId, painterBusinessId: painter.painterBusinessId, details: { category } });
  await sendNotification(`URGENT: painter can't attend as planned – ${job.reference}`, [
    `${painter.businessName} reported: ${category.replace(/_/g, " ")}.`,
    "Open the job in the admin dashboard to respond.",
  ]);
  refresh();
  return { ok: true, message: "Sent. We'll be in touch – thank you for letting us know." };
}

export async function submitCompletion(jobId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const painter = await requirePainter();
  const job = await ownAgreedJob(jobId, painter.painterBusinessId);
  if (!job || !["agreed", "in_progress"].includes(job.status as string)) return fail("This job can't be marked complete.");
  const { count } = await db().from("job_photos").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("stage", "after");
  if (!count) return fail("Add at least one 'after' photo first.");
  const { error } = await db()
    .from("jobs")
    .update({ status: "completion_submitted", completion_submitted_at: new Date().toISOString(), completion_note: str(fd, "note") || null })
    .eq("id", jobId);
  if (error) return fail(friendly(error.message));
  await audit({ actorUserId: painter.id, actorKind: "painter", action: "job.completion_submitted", entityType: "job", entityId: jobId, painterBusinessId: painter.painterBusinessId });
  await sendNotification(`Job completed – ${job.reference}`, [`${painter.businessName} marked the job complete. Review the photos in the admin dashboard.`]);
  refresh();
  return { ok: true, message: "Marked complete – we'll review it." };
}
