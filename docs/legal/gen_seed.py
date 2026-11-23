"""Builds the legal document register seed migration from the extracted PDF text.
Usage: python3 gen_seed.py legal.txt out.sql
Line ranges refer to `pdftotext -layout` output of Tyne_Tees_PDF.pdf (33 pages)."""
import hashlib, re, sys

lines = open(sys.argv[1], encoding="utf-8").read().split("\n")

def extract(start, end):
    out = []
    for raw in lines[start - 1:end]:
        s = raw.strip()
        if s.startswith("TYNE & TEES PAINTING |") or s.startswith("\f"):
            continue
        s = s.replace("\f", "")
        s = re.sub(r"\s{3,}", " ", s)
        out.append(s)
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    # Re-join wrapped lines inside paragraphs (a line not ending in sentence punctuation followed by a lowercase start)
    text = re.sub(r"(?<=[a-z,;(\-])\n(?=[a-z(])", " ", text)
    return text

SOLICITOR, ACCOUNTANT, COMPANY, DRAFT = "awaiting_solicitor_review", "awaiting_accountant_review", "awaiting_company_approval", "draft"
NOT_DRAFTED = "NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here."

# (sector, slug, title, category, requires_acceptance, version, status, range or None, source note)
DOCS = [
  # ---------------- SECTOR A – painter ----------------
  ("painter", "painter-business-services-agreement", "Independent Painter Business Services Agreement", "Agreement", True, "3.0-draft", SOLICITOR, (1587, 1765),
   "Master Legal Pack v3.0 sections 1–3 and Schedule A. Replaces the earlier agreements (v2.0 Document 3 and Contract + App Change Pack v3.0). The v3.1 Legal Corrections Addendum (replacement complaint/recovery clauses) and the Liability Limitation Addendum (clauses 20–22, blank cap) have NOT been merged – see docs/legal/RECONCILIATION.md."),
  ("painter", "job-acceptance-record", "Individual Job Subcontract / Job Acceptance Record", "Agreement", False, "3.0-draft", SOLICITOR, (660, 664),
   "Contract + App Change Pack v3.0 Schedule B (minimum job record content) and Master Legal Pack v3.0 clause 3.3. The app generates one immutable record per agreed job from these fields."),
  ("painter", "painter-privacy-notice", "Painter Privacy Notice", "Privacy", False, "2.0-draft", SOLICITOR, (1302, 1329),
   "Revised Legal & Compliance Draft Pack v2.0 Document 12. Must also meet Master Legal Pack v3.0 section 10 (name actual processors: Supabase, Vercel, Stripe, Resend, Sage). Contains placeholders."),
  ("painter", "painter-data-protection-confidentiality", "Painter Data Protection and Confidentiality Terms", "Privacy", False, "0.1", DRAFT, None,
   "Master Legal Pack v3.0 clause 3.15 covers confidentiality in the agreement and says a separate data-processing agreement is needed if the Painter processes data only on the Company's instructions. " + NOT_DRAFTED),
  ("painter", "insurance-requirements", "Insurance Requirements", "Insurance", False, "0.1", DRAFT, None,
   "Schedule A says 'Insurance type, insurer, policy number, expiry and limit: [INSERT]' and Document 20 asks the broker to set requirements. " + NOT_DRAFTED),
  ("painter", "health-safety-customer-property", "Health, Safety and Customer Property Requirements", "Safety", False, "2.0-draft", SOLICITOR, (1330, 1361),
   "Revised Legal & Compliance Draft Pack v2.0 Document 13 (covers health and safety, site safety and customer property)."),
  ("painter", "substitution-team-requirements", "Substitution and Team Requirements", "Operations", False, "0.1", DRAFT, None,
   "The substitution right itself is Master Legal Pack v3.0 clause 3.6 (in the agreement). The objective checks for substitutes are not yet written down. " + NOT_DRAFTED),
  ("painter", "emergency-attendance-procedure", "Emergency and Attendance Procedure", "Operations", False, "3.0-draft", SOLICITOR, (1785, 1793),
   "Master Legal Pack v3.0 section 5 (with clause 3.9–3.10 of the agreement)."),
  ("painter", "quality-standards", "Painter Professional and Quality Standards", "Quality", False, "2.0-draft", SOLICITOR, (1167, 1205),
   "Revised Legal & Compliance Draft Pack v2.0 Document 8. Check against Master v3.0 – no conflict found, but it pre-dates v3.0."),
  ("painter", "complaint-rectification-procedure", "Complaint and Rectification Procedure", "Quality", False, "3.0-draft", SOLICITOR, (1766, 1784),
   "Master Legal Pack v3.0 section 4. The v3.1 addendum (clause 6) has more detailed wording – solicitor to choose which is final."),
  ("painter", "payment-dispute-recovery-procedure", "Payment Dispute and Recovery Procedure", "Payments", False, "2.0-draft", SOLICITOR, (1116, 1166),
   "Revised Legal & Compliance Draft Pack v2.0 Document 7. Superseded in substance by Master v3.0 clause 3.13 and v3.1 addendum clause 8 – solicitor to confirm."),
  ("painter", "payment-invoicing-policy", "Payment and Invoicing Policy", "Payments", False, "0.1", DRAFT, None,
   "Master v3.0 clause 3.8 and the agreement say payment is due within '[X] days of [completion / valid invoice / milestone]' – the timetable is blank and must be completed by a construction solicitor. " + NOT_DRAFTED),
  ("painter", "cis-information", "CIS Information and Deduction Statement Guidance", "Tax", False, "3.0-draft", ACCOUNTANT, (1824, 1837),
   "Master Legal Pack v3.0 section 9. Accountant/CIS adviser must confirm before use."),
  ("painter", "incident-access-ratings-policy", "Incident, Access Restriction and Ratings Policy", "Operations", False, "3.0-draft", SOLICITOR, (1802, 1809),
   "Master Legal Pack v3.0 section 7 (replaces v2.0 Documents 9 and 10 for painters)."),
  ("painter", "photo-evidence-rules", "Photograph and Evidence Upload Rules", "Operations", False, "0.1", DRAFT, None,
   "Master v3.0 section 10 says: limit job photos to relevant work and avoid unnecessary images of people, personal documents or unrelated belongings. " + NOT_DRAFTED),

  # ---------------- SECTOR B – admin / internal ----------------
  ("admin", "master-legal-pack", "Master Legal Pack v3.0 – Independent Painter Subcontractors", "Master", False, "3.0-draft", SOLICITOR, (1576, 1881),
   "Full text of Master Legal Pack v3.0 as supplied (23 Nov 2026). Upload the original PDF to the legal-documents bucket as well."),
  ("admin", "developer-amendment-spec", "Developer Amendment Specification v2.0", "Specification", False, "2.0", COMPANY, (1, 136),
   "Supplied PDF pages 1–2. NOTE: the 'Final App Developer Specification v3.0' named in the build brief was NOT in the supplied PDF."),
  ("admin", "legal-corrections-addendum", "Legal Corrections & Contract Addendum v3.1", "Agreement", False, "3.1-draft", SOLICITOR, (182, 356),
   "Replacement clauses 6 and 8 for the painter agreement. Not merged into the agreement – solicitor to decide."),
  ("admin", "liability-limitation-addendum", "Liability Limitation Addendum (clauses 20–22)", "Agreement", False, "2.0-draft", SOLICITOR, (142, 181),
   "Written for v2.0 Document 3. Cap amount and multiplier are blank. Not in Master v3.0 – solicitor and broker to decide whether to include."),
  ("admin", "app-operating-rules", "App Operating Rules Required for the Contract to Match Reality", "Compliance", False, "2.0-draft", SOLICITOR, (1475, 1508),
   "Revised Pack v2.0 Document 19. The app is built to follow these rules – see docs/COMPLIANCE-DESIGN.md."),
  ("admin", "construction-act-classification", "Construction Act Classification and Payment Notice Procedure", "Payments", False, "3.0-draft", SOLICITOR, (1810, 1823),
   "Master Legal Pack v3.0 section 8. Payment calendar and notice wording must be completed by a construction solicitor."),
  ("admin", "data-retention-security", "Data Protection, Retention and Security Schedule", "Privacy", False, "2.0-draft", SOLICITOR, (1417, 1448),
   "Revised Pack v2.0 Document 17. The app's retention_rules table mirrors this and needs adviser confirmation."),
  ("admin", "publication-checklist", "App & Website Publication Checklist", "Compliance", False, "2.0-draft", COMPANY, (1449, 1474), "Revised Pack v2.0 Document 18."),
  ("admin", "adviser-review-checklist", "Solicitor & Insurance Broker Review Checklist (incl. employment status review)", "Compliance", False, "2.0-draft", COMPANY, (1509, 1574), "Revised Pack v2.0 Document 20."),
  ("admin", "launch-compliance-checklist", "Company Launch Compliance Checklist", "Compliance", False, "3.0-draft", COMPANY, (1856, 1881), "Master Legal Pack v3.0 section 12."),
  ("admin", "quality-control-call", "Customer Quality-Control Call Script", "Quality", False, "2.0-draft", SOLICITOR, (1097, 1115), "Revised Pack v2.0 Document 6."),
  ("admin", "incident-damage-report", "Incident / Property Damage Report", "Operations", False, "2.0-draft", SOLICITOR, (1382, 1395), "Revised Pack v2.0 Document 15."),
  ("admin", "digital-acceptance-signature", "Digital Acceptance & Signature Rules", "Compliance", False, "2.0-draft", SOLICITOR, (1396, 1416), "Revised Pack v2.0 Document 16."),
  ("admin", "internal-complaint-handling", "Internal Complaint Handling Procedure", "Quality", False, "0.1", DRAFT, None, NOT_DRAFTED),
  ("admin", "internal-recovery-claim", "Internal Recovery Claim Procedure", "Payments", False, "0.1", DRAFT, None, "Use Master v3.0 clause 3.13 meanwhile. " + NOT_DRAFTED),
  ("admin", "cis-contractor-compliance", "CIS Contractor Compliance Procedure", "Tax", False, "0.1", DRAFT, None, "Accountant to write. " + NOT_DRAFTED),
  ("admin", "cis-monthly-reconciliation", "CIS Monthly Reconciliation Checklist", "Tax", False, "0.1", DRAFT, None, "Accountant to write; the app's CIS dashboard supports it. " + NOT_DRAFTED),
  ("admin", "data-breach-response", "Data Breach Response Procedure", "Privacy", False, "0.1", DRAFT, None, NOT_DRAFTED),
  ("admin", "insurance-verification-checklist", "Insurance Verification Checklist", "Insurance", False, "0.1", DRAFT, None, NOT_DRAFTED),
  ("admin", "painter-onboarding-checklist", "Painter Onboarding Checklist", "Operations", False, "0.1", DRAFT, None, "The app's onboarding steps follow Master v3.0 Schedule A. " + NOT_DRAFTED),
  ("admin", "refund-approval-procedure", "Refund Approval Procedure", "Payments", False, "0.1", DRAFT, None, NOT_DRAFTED),

  # ---------------- SECTOR C – public website ----------------
  ("public", "customer-terms", "Customer Terms and Conditions", "Customer", False, "2.0-draft", SOLICITOR, (766, 857),
   "Revised Pack v2.0 Document 1 (kept by Master v3.0 section 11). CONFLICT: its booking deposit clause does not match the current website policy of 100% payment after agreeing the price – solicitor and owner to decide."),
  ("public", "cancellation-information", "Cancellation Information and Model Cancellation Form", "Customer", False, "2.0-draft", SOLICITOR, (858, 888), "Revised Pack v2.0 Document 2."),
  ("public", "workmanship-defects-policy", "Workmanship, Defects and Rectification Policy (customers)", "Customer", False, "2.0-draft", SOLICITOR, (1033, 1075), "Revised Pack v2.0 Document 4."),
  ("public", "customer-ratings-policy", "Customer Ratings and Review Policy", "Customer", False, "2.0-draft", SOLICITOR, (1237, 1258), "Revised Pack v2.0 Document 10 (appears twice in the PDF; one copy used)."),
  ("public", "customer-privacy-notice", "Customer Privacy Notice", "Privacy", False, "2.0-draft", SOLICITOR, (1259, 1301),
   "Revised Pack v2.0 Document 11. The website currently shows its own /privacy page – they must be aligned before either is published."),
  ("public", "complaints-information", "Customer Complaints Procedure", "Customer", False, "2.0-draft", SOLICITOR, (1362, 1381), "Revised Pack v2.0 Document 14."),
  ("public", "cookie-policy", "Cookie Policy", "Privacy", False, "0.1", DRAFT, None, NOT_DRAFTED),
  ("public", "refund-policy", "Refund Policy", "Customer", False, "0.1", DRAFT, None, "Refunds are covered in Customer Terms clause 13; a separate policy has not been drafted. " + NOT_DRAFTED),
  ("public", "deposit-payment-policy", "Deposit and Payment Policy", "Customer", False, "0.1", DRAFT, None,
   "Customer Terms clauses 4–5 cover price and deposit, but the website now takes 100% payment after the price is agreed. " + NOT_DRAFTED),
]

def q(s):
    return "null" if s is None else "'" + s.replace("'", "''") + "'"

out = ["""-- =====================================================================
-- LEGAL DOCUMENT REGISTER – initial entries (generated from the supplied
-- PDF "Tyne_Tees_PDF.pdf", 33 pages, 23 Nov 2026, by docs/legal/gen_seed.py)
--
-- Every version is a DRAFT or AWAITING REVIEW. Nothing here is approved.
-- Documents that are not in the supplied pack are registered with no text
-- ("NOT DRAFTED") rather than invented.
-- Run AFTER the painter platform migrations. Safe to run twice.
-- =====================================================================
"""]
for i, (sector, slug, title, cat, acc, ver, status, rng, note) in enumerate(DOCS):
    body = extract(*rng) if rng else None
    sha = hashlib.sha256(body.encode()).hexdigest() if body else None
    out.append(f"""insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ({q(slug)}, {q(title)}, {q(cat)}, {q(sector)}, {'true' if acc else 'false'}, {i})
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, {q(ver)}, $doc${body}$doc$, {q(note)}, {q(status)}, {q(sha)} from public.legal_documents where slug = {q(slug)}
on conflict (document_id, version_label) do nothing;
""".replace("$doc$None$doc$", "null"))
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(out))
print(len(DOCS), "documents")
