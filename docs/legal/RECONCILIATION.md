# Legal pack reconciliation

_Supplied file: `Tyne_Tees_PDF.pdf` (33 pages, created 23 Nov 2026). Prepared for your solicitor and accountant. This is a list of what is where and what conflicts – not legal advice._

## What the PDF contains (in order)

| Pages | Document | Version | Status in the app |
| --- | --- | --- | --- |
| 1–2 | Developer Amendment Specification | 2.0 | Admin sector – reference |
| 2 | Liability Limitation Addendum (clauses 20–22, written for v2.0 Document 3) | 2.0 | Admin sector – **not merged** |
| 3–5 | Legal Corrections & Contract Addendum (replacement clauses 6 and 8) | 3.1 | Admin sector – **not merged** |
| 6–11 | Painter Independent Business Services Agreement ("Contract + App Change Pack") | 3.0 | Superseded by Master Pack §3; Schedule B used for the Job Acceptance Record |
| 12–27 | Revised Legal & Compliance Draft Pack (Documents 1–20) | 2.0 | Customer documents → website sector; some painter/admin documents kept where Master v3.0 has no replacement |
| 28–33 | **Master Legal Pack – Independent Painter Subcontractors (Model A)** | **3.0** | **Primary source** |

## Conflicts and gaps your solicitor must decide

1. **Which complaint/recovery wording is final.** Master v3.0 clauses 3.12–3.13 and the v3.1 addendum clauses 6 and 8 cover the same ground. v3.1 is more detailed (e.g. a 5-working-day response period for recovery claims and Construction Act notice wording). Both say the same in substance; neither has been merged into the other. The app follows the stricter combination (5 working days, itemised claims, no set-off).
2. **Liability cap.** The cap addendum (clauses 20–22) has blank amounts and was written for v2.0. Master v3.0 has **no** liability cap clause. Decide whether to include one (with broker advice).
3. **Customer payment model.** v2.0 Customer Terms (Document 1) and Document 5 describe a booking deposit. Your current website policy is 100% payment after the price is agreed. Align before publishing either.
4. **Website legal pages.** `/terms` and `/privacy` on the live site are separate plain-English drafts, not v2.0 Documents 1 and 11. They need to become one approved version.
5. **Payment timetable.** "[X] days of [completion / valid invoice / milestone]" is blank everywhere. The app uses a per-offer "payment due days" field defaulting to 14 and labelled "solicitor to confirm".
6. **Construction Act.** Master v3.0 §8: a construction solicitor must classify the painter subcontract. The app defaults every job to "review required" and locks notices.
7. **Employment Rights Act 2025 / 200% penalty** (v3.1 section D) – stated as context only; your solicitor should confirm the current position. Not used by the app.
8. **Duplicate Document 10** (Customer Ratings & Review Policy appears twice in the PDF) – one copy used.

## Documents in the brief that are NOT in the pack (registered as "not written")

Painter: Data Protection & Confidentiality Terms, Insurance Requirements, Substitution & Team Requirements, Payment & Invoicing Policy, Photograph & Evidence Upload Rules.
Admin: Internal Complaint Handling Procedure, Internal Recovery Claim Procedure, CIS Contractor Compliance Procedure, CIS Monthly Reconciliation Checklist, Data Breach Response Procedure, Insurance Verification Checklist, Painter Onboarding Checklist, Refund Approval Procedure.
Website: Cookie Policy, Refund Policy (separate), Deposit & Payment Policy.

## Placeholders still in the text

Every drafted document still contains `[INSERT]`-style placeholders (legal entity name, address, company number, insurance limits, notice period, payment days, privacy contact). The admin screen refuses to mark a version "approved for publication" while `[INSERT` remains in its text.

## How the register was generated

`docs/legal/gen_seed.py` extracts each document from the PDF text by page/line range and writes `supabase/migrations/20261124000200_legal_document_register.sql`. Each version stores a SHA-256 fingerprint of its text and a source note naming the exact document and section it came from.
