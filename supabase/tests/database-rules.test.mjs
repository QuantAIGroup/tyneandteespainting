// DATABASE RULE TESTS – runs every migration in a throwaway in-memory Postgres
// (PGlite) with minimal Supabase stubs, then checks the business rules the
// database enforces. Run with: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? new URL("../migrations", import.meta.url).pathname;
const db = new PGlite();

const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;
await db.exec(STUB);

for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  try {
    await db.exec(readFileSync(path.join(dir, f), "utf8"));
    console.log("✓ migration", f);
  } catch (e) {
    console.error("✗ migration", f, e.message);
    process.exit(1);
  }
}

let pass = 0, fail = 0;
async function expectOk(name, sql) {
  try { const r = await db.exec(sql); pass++; console.log("  ✓", name); return r; }
  catch (e) { fail++; console.log("  ✗", name, "→", e.message); }
}
async function expectError(name, sql, match) {
  try { await db.exec(sql); fail++; console.log("  ✗", name, "→ expected an error"); }
  catch (e) {
    if (match && !e.message.includes(match)) { fail++; console.log("  ✗", name, "→ wrong error:", e.message); }
    else { pass++; console.log("  ✓", name, "(blocked:", e.message.slice(0, 70) + ")"); }
  }
}
async function q(sql) { const r = await db.query(sql); return r.rows; }
const asUser = (uid) => `set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true); select set_config('request.jwt.claim.role', 'authenticated', true);`;

const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const FIN = "00000000-0000-0000-0000-0000000000a2";
const P1U = "00000000-0000-0000-0000-0000000000b1";
const P2U = "00000000-0000-0000-0000-0000000000b2";
const P1 = "10000000-0000-0000-0000-000000000001";
const P2 = "10000000-0000-0000-0000-000000000002";
const JOB = "20000000-0000-0000-0000-000000000001";

console.log("\nSetup");
await expectOk("seed users, painters and a job", `
insert into auth.users values ('${ADMIN}','owner@x'),('${FIN}','fin@x'),('${P1U}','p1@x'),('${P2U}','p2@x');
insert into public.admin_users (user_id) values ('${ADMIN}');
insert into public.admin_users (user_id, role) values ('${FIN}', 'operations');
insert into public.painter_businesses (id, legal_name) values ('${P1}', 'Painter One Ltd'), ('${P2}', 'Painter Two');
insert into public.painter_users values ('${P1U}', '${P1}', 'Pat One', true, now()), ('${P2U}', '${P2}', 'Sam Two', true, now());
insert into public.jobs (id, reference, title, scope_summary, status) values ('${JOB}', 'TT-J-1', 'Bedroom', 'Walls x2 coats', 'offered');
insert into public.job_site_details (job_id, address_line1, customer_phone) values ('${JOB}', '1 Secret St', '0700');
`);
const existingRole = await q(`select role from public.admin_users where user_id='${ADMIN}'`);
console.log("  existing admin role defaulted to:", existingRole[0].role);

console.log("\nOffers, counteroffers and mutual acceptance");
const v = (offer, n, by, fee, acc) => `insert into public.job_offer_versions (offer_id, version_number, proposed_by, scope, fee_pence, materials_responsibility, proposed_start_date, arrival_window_start, arrival_window_end, payment_terms, payment_due_days, specification_version, content_sha256, ${acc}) values ('${offer}', ${n}, '${by}', 'Walls', ${fee}, 'painter', '2026-12-01', '08:00', '10:00', '14 days from valid invoice', 14, 'SPEC-1', 'h${n}', now())`;
await expectOk("company offers job to both painters", `
insert into public.job_offers (id, job_id, painter_business_id) values ('30000000-0000-0000-0000-000000000001', '${JOB}', '${P1}'), ('30000000-0000-0000-0000-000000000002', '${JOB}', '${P2}');
${v("30000000-0000-0000-0000-000000000001", 1, "company", 20000, "company_accepted_at")};
${v("30000000-0000-0000-0000-000000000002", 1, "company", 20000, "company_accepted_at")};`);
await expectError("offer terms cannot be edited", `update public.job_offer_versions set fee_pence = 1 where version_number = 1 and offer_id = '30000000-0000-0000-0000-000000000001'`, "cannot be edited");
await expectError("version numbers must be consecutive", v("30000000-0000-0000-0000-000000000001", 3, "painter", 25000, "painter_accepted_at"), "consecutively");
await expectError("proposer must accept own proposal", `insert into public.job_offer_versions (offer_id, version_number, proposed_by, scope, fee_pence, materials_responsibility, proposed_start_date, arrival_window_start, arrival_window_end, payment_terms, payment_due_days, specification_version, content_sha256) values ('30000000-0000-0000-0000-000000000001', 2, 'painter', 'x', 1, 'painter', '2026-12-01', '08:00', '10:00', 'x', 14, 'S', 'h')`, "proposer_accepts_own");
await expectOk("painter 1 counteroffers £250", v("30000000-0000-0000-0000-000000000001", 2, "painter", 25000, "painter_accepted_at"));
await expectError("company can't accept a superseded version", `update public.job_offer_versions set painter_accepted_at = now() where offer_id='30000000-0000-0000-0000-000000000001' and version_number = 1`, "latest version");
const st1 = await q(`select status from public.jobs where id='${JOB}'`);
console.log("  job status before company accepts:", st1[0].status);
await expectOk("company accepts the counteroffer", `update public.job_offer_versions set company_accepted_at = now(), company_accepted_by = '${ADMIN}' where offer_id='30000000-0000-0000-0000-000000000001' and version_number = 2`);
const j = await q(`select status, painter_business_id from public.jobs where id='${JOB}'`);
const o2 = await q(`select status from public.job_offers where id='30000000-0000-0000-0000-000000000002'`);
console.log("  job →", j[0].status, "painter", j[0].painter_business_id === P1 ? "P1 ✓" : "WRONG", "| other painter's thread →", o2[0].status);
if (j[0].status !== "agreed" || o2[0].status !== "closed") { fail++; console.log("  ✗ mutual acceptance did not agree job"); } else pass++;
await expectError("acceptance cannot be withdrawn after agreement", `update public.job_offer_versions set painter_accepted_at = null where offer_id='30000000-0000-0000-0000-000000000001' and version_number = 2`, "cannot be changed");
await expectError("offer history can't be deleted", `delete from public.job_offer_versions`, "cannot be deleted");

console.log("\nRow security between painters");
await db.exec("begin;" + asUser(P2U));
const p2jobs = await q(`select * from public.job_site_details`);
const p2other = await q(`select * from public.painter_businesses`);
await db.exec("rollback;");
console.log("  painter 2 sees site address rows:", p2jobs.length, "| painter businesses visible:", p2other.length);
if (p2jobs.length === 0 && p2other.length === 1) pass++; else { fail++; console.log("  ✗ data leak"); }
await db.exec("begin;" + asUser(P1U));
const p1site = await q(`select address_line1 from public.job_site_details`);
const p1priv = await q(`select * from public.painter_private_details`);
await db.exec("rollback;");
console.log("  agreed painter 1 sees site address:", p1site[0]?.address_line1, "| can read bank details:", p1priv.length);
if (p1site.length === 1 && p1priv.length === 0) pass++; else fail++;
await db.exec("begin;" + asUser(FIN));
const opsPriv = await q(`select * from public.painter_private_details`);
const opsAudit = await q(`select * from public.audit_events`);
await db.exec("rollback;");
console.log("  operations admin can read audit log rows:", opsAudit.length, "(expect 0, compliance only)");
if (opsAudit.length === 0) pass++; else fail++;
await expectError("painter cannot write tables directly", "begin;" + asUser(P1U) + `update public.jobs set status='completed'; commit;`, "permission denied");
await db.exec("rollback;").catch(() => {});

console.log("\nComplaints");
await expectError("short response deadline needs urgency reason", `insert into public.complaints (reference, job_id, customer_description, painter_notified_at, painter_response_due_at) values ('C1', '${JOB}', 'Drips on skirting', '2026-12-07 09:00', '2026-12-08 09:00')`, "complaint_short_deadline");
await expectOk("5 working days is fine (Mon→next Mon)", `insert into public.complaints (reference, job_id, customer_description, painter_notified_at, painter_response_due_at) values ('C2', '${JOB}', 'Drips on skirting', '2026-12-07 09:00', '2026-12-14 09:00')`);
await expectOk("short deadline with recorded urgency reason", `insert into public.complaints (reference, job_id, customer_description, painter_notified_at, painter_response_due_at, urgency_reason) values ('C3', '${JOB}', 'Paint on carpet', '2026-12-07 09:00', '2026-12-08 09:00', 'Customer moving in on 9th, carpet risk')`);
await expectError("decision needs reasons", `update public.complaints set decision='upheld_workmanship' where reference='C2'`, "complaint_decision_reasoned");

console.log("\nPainter payments and CIS");
await expectOk("invoice from painter 1", `insert into public.painter_invoices (id, job_id, painter_business_id, invoice_number, invoice_date, labour_pence, materials_pence) values ('40000000-0000-0000-0000-000000000001', '${JOB}', '${P1}', 'INV-1', '2026-12-10', 20001, 5000)`);
await expectError("duplicate live invoice for same job", `insert into public.painter_invoices (job_id, painter_business_id, invoice_number, invoice_date, labour_pence) values ('${JOB}', '${P1}', 'INV-2', '2026-12-10', 100)`, "one_live_per_job");
await expectError("CIS rate must match HMRC status", `insert into public.cis_verifications (painter_business_id, verified_on, hmrc_verification_reference, deduction_status, rate_percent, recorded_by) values ('${P1}', '2026-12-01', 'V1', 'standard', 30, '${ADMIN}')`, "cis_rate_matches_status");
await expectOk("record HMRC verification 20%", `insert into public.cis_verifications (id, painter_business_id, verified_on, hmrc_verification_reference, deduction_status, rate_percent, recorded_by) values ('50000000-0000-0000-0000-000000000001', '${P1}', '2026-12-01', 'V1234567890', 'standard', 20, '${ADMIN}')`);
const pay = (extra = "") => `insert into public.painter_payments (id, invoice_id, job_id, painter_business_id, labour_pence, materials_pence, gross_pence, vat_pence, cis_verification_id, cis_rate_percent, cis_deduction_pence, net_pence, due_date ${extra ? ", status, approved_by, approved_at" : ""}) values ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '${JOB}', '${P1}', 20001, 5000, 25001, 0, '50000000-0000-0000-0000-000000000001', 20, 4000, 21001, '2026-12-24' ${extra})`;
await expectError("wrong CIS maths rejected (rounded up)", pay().replace(", 4000, 21001", ", 4001, 21000"), "pp_cis_calc");
await expectOk("payment awaiting approval (CIS on labour only, rounded down)", pay());
await expectError("approval blocked until accountant signs CIS gate", `update public.painter_payments set status='approved_awaiting_transfer', approved_by='${ADMIN}', approved_at=now()`, "CIS set-up");
await expectError("gate can't be approved without evidence", `update public.compliance_gates set approved = true where key='cis_contractor_setup'`, "gate_approval_recorded");
await db.exec(`update public.compliance_gates set approved=true, approved_by_name='A. Accountant ACCA', approved_at=now(), evidence_note='Letter dated 1 Dec 2026, ref ABC' where key='cis_contractor_setup'`);
await expectError("approval blocked while painter onboarding not approved", `update public.painter_payments set status='approved_awaiting_transfer', approved_by='${ADMIN}', approved_at=now()`, "onboarding");
await db.exec(`update public.painter_businesses set onboarding_status='approved', approved_at=now(), approved_by='${ADMIN}' where id='${P1}'`);
await db.exec(`update public.painter_businesses set engagement_route='status_review_required' where id='${P1}'`);
await expectError("worker/employee review route blocks payment", `update public.painter_payments set status='approved_awaiting_transfer', approved_by='${ADMIN}', approved_at=now()`, "employment-status");
await db.exec(`update public.painter_businesses set engagement_route='independent_business' where id='${P1}'`);
await expectOk("approve payment", `update public.painter_payments set status='approved_awaiting_transfer', approved_by='${ADMIN}', approved_at=now()`);
await expectError("can't mark paid without bank reference", `update public.painter_payments set status='paid_awaiting_reconciliation'`, "pp_paid_fields");
await expectOk("record manual bank transfer", `update public.painter_payments set status='paid_awaiting_reconciliation', bank_payment_reference='TT-J-1 P1', transfer_date='2026-12-05', transfer_recorded_by='${ADMIN}', confirmed_by='${ADMIN}', confirmed_at=now()`);
const led = await q(`select tax_month_start::text, cis_deduction_pence from public.cis_ledger_entries`);
console.log("  CIS ledger line:", JSON.stringify(led), "(5 Dec falls in tax month starting 6 Nov)");
if (led.length === 1 && led[0].tax_month_start === "2026-11-06" && led[0].cis_deduction_pence === 4000) pass++; else fail++;
await expectError("paid amounts frozen", `update public.painter_payments set net_pence = 1`, "cannot be changed");
await expectError("status can't go backwards", `update public.painter_payments set status='approved_awaiting_transfer'`, "backwards");
await expectError("ledger lines are permanent", `update public.cis_ledger_entries set cis_deduction_pence = 0`, "cannot be changed");
await expectOk("record HMRC payment with reference", `insert into public.hmrc_payments (tax_month_start, amount_pence, paid_on, payment_reference, bank_reference, recorded_by) values ('2026-11-06', 4000, '2026-12-20', '123PA00012345', 'HMRC CIS NOV', '${ADMIN}')`);
const sum = await q(`select tax_month_start::text, return_due_date::text, payment_due_date::text, cis_deducted_pence, paid_to_hmrc_pence, outstanding_liability_pence from public.cis_monthly_summary`);
console.log("  monthly summary:", JSON.stringify(sum[0]));
if (sum[0].return_due_date === "2026-12-19" && sum[0].payment_due_date === "2026-12-22" && sum[0].outstanding_liability_pence === 0) pass++; else fail++;

console.log("\nConstruction Act and documents");
await expectError("notices locked until solicitor gate", `insert into public.payment_notices (job_id, kind, sum_considered_due_pence, basis_of_calculation, recipient, service_method, served_at, recorded_by) values ('${JOB}', 'payment_notice', 100, 'Agreed fee per accepted job record v2', 'P1', 'email', now(), '${ADMIN}')`, "construction solicitor");
await expectError("'yes' config needs all dates", `insert into public.construction_act_configs (job_id, part_ii_applies, solicitor_reviewer, reviewed_on) values ('${JOB}', 'yes', 'X Solicitors', '2026-12-01')`, "ca_yes_complete");
await expectOk("draft legal document", `insert into public.legal_documents (id, slug, title, category, sector, requires_acceptance) values ('70000000-0000-0000-0000-000000000001', 'painter-agreement', 'Agreement', 'agreement', 'painter', true); insert into public.legal_document_versions (id, document_id, version_label, body_markdown) values ('70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '3.0', 'Draft text')`);
await expectError("cannot accept a draft", `insert into public.document_acceptances (version_id, painter_business_id, user_id, content_sha256) values ('70000000-0000-0000-0000-000000000002', '${P1}', '${P1U}', 'x')`, "draft");
await expectError("cannot mark approved without approver", `update public.legal_document_versions set status='approved_for_publication' where id='70000000-0000-0000-0000-000000000002'`, "version_approval_recorded");
await expectOk("approve with approver + accept", `update public.legal_document_versions set status='approved_for_publication', approved_by_name='Solicitor X', approved_at=now(), effective_date='2026-12-01' where id='70000000-0000-0000-0000-000000000002'; insert into public.document_acceptances (version_id, painter_business_id, user_id, content_sha256) values ('70000000-0000-0000-0000-000000000002', '${P1}', '${P1U}', 'x')`);
await expectError("approved wording frozen", `update public.legal_document_versions set body_markdown='changed' where id='70000000-0000-0000-0000-000000000002'`, "cannot be edited");

console.log("\nAudit log");
const n = await q(`select count(*)::int as n from public.audit_events`);
console.log("  audit events captured:", n[0].n);
await expectError("audit log append-only", `delete from public.audit_events`, "append-only");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
