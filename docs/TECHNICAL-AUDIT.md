# Tyne & Tees Painting – Technical audit and implementation plan

_Phase 1 · 23 November 2026_

## 1. What exists today

| Area | Finding |
| --- | --- |
| **Framework** | Next.js 16.4 (App Router, `cacheComponents`, `proxy.ts` instead of middleware), React 19.3, TypeScript, Tailwind CSS 4. |
| **Hosting** | Vercel project `tyneandteespainting`, production deploys from `main` (latest: commit `c1a7458`, status READY). |
| **Database / auth** | Supabase project `Tyne-tees-painting` (eu-central-1, Postgres 17). Supabase Auth with email + password for admins. All tables have Row Level Security. |
| **Customer website** | Home, services, gallery, areas, contact, `/privacy`, `/terms`, `/quote` calculator (server re-prices every enquiry), private photo uploads via one-time signed URLs. |
| **Admin** | `/admin`: enquiries, messages, prices/details, gallery. One role (anyone in `admin_users`). |
| **Stripe** | Stripe Checkout payment links per enquiry (deposit / full / custom amount), verified webhook (`checkout.session.completed` and `async_payment_succeeded`), idempotency via `stripe_events`, duplicate-payment auto-refund, payment fields write-protected by a database trigger. No Stripe Connect. |
| **Tests** | 67 Vitest unit tests (pricing, payments, booking rules, webhook signatures). |
| **Legal pages** | `/privacy` and `/terms` are plain-English starting points with placeholders; not the drafts in the legal pack. |

### Problems found

1. **Database drift (fixed in this phase).** The live database had two migrations that were never committed to GitHub: `quote_rooms` (one row per room in a quote) and `api_grants` (removes default table permissions from the API roles). Both are now in `supabase/migrations/` exactly as applied. ⚠️ Nothing in the current code writes to `quote_rooms` yet – the code that does must exist somewhere uncommitted, or was never finished.
2. **Payment policy mismatch.** The website code still offers "deposit / full / custom", while your stated policy is 100% payment after agreeing the price. The legal pack's Customer Terms (v2.0) still describe a booking deposit. Decide which is correct, then align the website, the settings default and the Customer Terms.
3. **"Final App Developer Specification v3.0"** named in the brief was **not** in the supplied PDF. The PDF contains the Developer Amendment Specification **v2.0**. Built against v2.0 + Master Legal Pack v3.0.
4. **No painter, job, CIS or document data model** existed – everything for the painter platform is new.

## 2. Architecture decision

**Extend the existing Next.js web app** rather than build a separate native iOS app.

- One codebase, one database, one login system, one deployment – the brief says "do not create two disconnected systems".
- The painter portal (`/painter`) is built mobile-first for iPhone and can be added to the home screen (web app manifest + Apple meta tags), so it opens full-screen like an app. Photo upload uses the iPhone camera directly.
- Secret keys (Stripe, Supabase service key, encryption key, future Sage credentials) stay on the server. A native app would have needed a separate API layer to achieve the same.
- If App Store presence is wanted later, the same pages can be wrapped with Capacitor without rewriting.

```
Customer ──► Website (existing) ──► Stripe Checkout ──► verified webhook
                    │                                         │
                    ▼                                         ▼
              enquiries / payments  ◄─────── Supabase ───────►  jobs, offers, painters,
                    │                         (RLS)            complaints, CIS, documents
        Admin "Create painter job"                                   ▲
                    │                                                 │
                    ▼                                                 │
         /admin (roles: owner, operations, finance, compliance)       │
                                                                      │
         /painter (independent painter portal, own data only) ────────┘
```

**Security model.** Reading data uses the logged-in user's session, so Postgres Row Level Security decides what each person sees (a painter can never read another painter's rows, customer addresses before agreement, or anyone's bank details). Workflow steps go through server actions that check identity and role, then save with the server key; database triggers enforce the business rules a second time.

## 3. What was built in this session

| Phase | Status |
| --- | --- |
| 1 – Audit & architecture | ✅ This document, `docs/legal/RECONCILIATION.md`, `docs/COMPLIANCE-DESIGN.md` |
| 2 – Database & permissions | ✅ 3 additive migrations, rollback script, 46 database rule tests |
| 3 – Website → app connection | ✅ "Create painter job" on every enquiry; job keeps the link to the enquiry and customer price |
| 4 – Painter portal | ✅ Register, set password, sign in, reset password, business profile, encrypted tax/bank details, evidence uploads, submit for review |
| 5 – Offers, counteroffers, acceptance | ✅ Admin offers → painter accept / decline / counter → company accept / counter / withdraw; immutable versions; job agreed only on mutual acceptance |
| 6 – Completion, complaints, rectification | 🟡 Emergency reports, job photos, completion submit/review built. **Complaint screens not built yet** (database + rules + tests done) |
| 7 – Legal document centre | 🟡 Register seeded (45 documents, 3 sectors), admin status workflow, painter view + acceptance. Website (sector C) publishing not wired yet |
| 8 – Painter onboarding | ✅ Admin approve / request info / reject, evidence verification, engagement route, insurance expiry warning |
| 9 – Stripe review | 🟡 Reviewed – sound. Fee/refund columns added; webhook not yet extended to record Stripe fees and refunds |
| 10 – Manual painter payments | 🟡 Database workflow + calculations + tests done. **Invoice submission and payment screens not built yet** |
| 11 – CIS ledger & reserve | 🟡 Ledger, reserve, HMRC tables, monthly summary and dashboard built. Screens to record reserve transfers / HMRC payments still to do |
| 12 – Sage | ⬜ Not started (see below) |
| 13 – Reconciliation | 🟡 Rules + tests built; CIS flags shown on dashboard |
| 14 – Admin dashboard | 🟡 Jobs, painters, finance, documents, approvals added to admin |
| 15 – Security, testing, deployment | 🟡 Typecheck, lint, 99 unit tests, 46 DB tests, production build all pass. Not yet deployed |

## 4. Sage – what the API can and can't do

From Sage's developer guide (checked 23 Nov 2026): the Accounting API v3.1 supports CIS on **purchase invoices** (fields such as `is_cis`, `cis_applicable_amount`, `has_cis_labour`, `has_cis_materials`, `withholding_tax_rate`, `withholding_tax_amount`). Supplier CIS details (deduction rate, verification number, UTR) are **read-only** through the API. **HMRC verification, CIS deduction statements and monthly CIS returns are not available through the API** – they are done in Sage's own screens.

So Phase 12 will: create/match painter supplier contacts, post approved painter invoices as CIS purchase invoices, post payments, read back Sage's verified deduction rate to cross-check the app, and log every sync in `sage_sync_records` (unique per record, so nothing is posted twice). Verification, statements and returns stay as admin-reviewed steps in Sage. Needs: a Sage developer app (client ID/secret) and your Sage Accounting subscription with CIS enabled.

## 5. Next steps (in order)

1. **You:** run the three new migrations in Supabase (see README → Painter platform). Add `PAINTER_DATA_ENCRYPTION_KEY` and Resend email settings in Vercel.
2. **Build next:** complaint & rectification screens (admin + painter response/appeal), painter invoice submission, payment approval → bank transfer → reconciliation screens, reserve/HMRC recording, secure photo/document viewing (signed links), CIS deduction statement PDF, audit export.
3. **Then:** Sage integration, Stripe fee/refund recording, website publishing of approved customer documents, admin role management screen.
4. **Before launch:** the approvals listed in `docs/COMPLIANCE-DESIGN.md`.
