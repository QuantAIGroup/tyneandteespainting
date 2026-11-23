-- =====================================================================
-- PAINTER PLATFORM – PART 2: FINANCE, CIS AND COMPLIANCE GATES
-- Painter invoices, manual bank-transfer payments, CIS verification and
-- deductions, CIS tax reserve ledger, HMRC returns/payments, Sage sync
-- records, Stripe fee/refund records, reconciliation flags, Construction
-- Act configuration + immutable payment notices, approval gates and
-- retention rules.
--
-- Run AFTER 20261124000000_painter_platform_operations.sql. ADDITIVE ONLY.
--
-- Key rules enforced by the database:
--   * CIS rate always comes from a recorded HMRC verification – never typed in.
--   * CIS deduction = labour portion × verified rate (materials and VAT excluded).
--   * net = gross + VAT − CIS. There is NO column for commercial deductions:
--     set-off from painter pay is impossible in this release.
--   * A painter payment can't be approved until the "CIS set-up" approval
--     gate has been signed off by your accountant, the painter is approved,
--     and the painter is on the independent-business route.
--   * "Paid" needs a bank reference, transfer date and a confirming admin.
--   * HMRC can't be marked paid without an evidence reference.
--   * Payment notices / Pay Less Notices are immutable once recorded and
--     need the Construction Act configuration completed by a solicitor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Approval gates (legal / accounting sign-off switches)
-- ---------------------------------------------------------------------
create table if not exists public.compliance_gates (
  key text primary key,
  title text not null,
  description text not null,
  required_adviser text not null,
  approved boolean not null default false,
  approved_by_name text,
  approved_at timestamptz,
  evidence_note text,
  recorded_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint gate_approval_recorded check (not approved or (approved_by_name is not null and approved_at is not null and length(coalesce(evidence_note, '')) >= 10))
);

insert into public.compliance_gates (key, title, description, required_adviser) values
  ('painter_engagement_model', 'Independent painter (Model A) operating model',
   'Employment-status solicitor has reviewed the real working arrangements, substitution, fee negotiation and platform rules and approved the independent-business model.',
   'UK employment-status solicitor'),
  ('cis_contractor_setup', 'CIS contractor registration and deductions',
   'Accountant/CIS adviser has confirmed whether the Company is a CIS contractor, it is registered with HMRC, and the deduction method (labour/materials split, VAT, rounding) is correct. Required before any painter payment is approved.',
   'Accountant / CIS tax adviser'),
  ('painter_payment_terms', 'Painter payment terms',
   'Solicitor has approved payment due dates, final date for payment and invoice rules used in job offers.',
   'Construction solicitor'),
  ('construction_act_notices', 'Construction Act payment notices',
   'Construction solicitor has approved the payment calendar and Payment Notice / Pay Less Notice wording for the actual subcontract. Required before any notice is recorded as served.',
   'Construction solicitor'),
  ('commercial_set_off', 'Commercial deductions and set-off',
   'Solicitor has approved any set-off mechanism. NOTE: this release has no set-off feature at all; approving this gate does not switch one on.',
   'UK commercial solicitor'),
  ('insurance_confirmed', 'Company and painter insurance',
   'Insurance broker has confirmed in writing that the Company policy covers subcontracted painting work and set painter insurance requirements.',
   'Insurance broker'),
  ('privacy_review', 'Privacy notices, DPIA and retention',
   'Privacy notices, processor list, retention periods and any DPIA (emergency/health evidence) have been reviewed.',
   'Data protection adviser')
on conflict (key) do nothing;

create or replace function public.gate_approved(gate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select approved from public.compliance_gates where key = gate), false);
$$;

-- ---------------------------------------------------------------------
-- 2. CIS verifications (entered from HMRC/Sage – never invented)
-- ---------------------------------------------------------------------
create table if not exists public.cis_verifications (
  id uuid primary key default gen_random_uuid(),
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  verified_on date not null,
  hmrc_verification_reference text not null,
  deduction_status text not null check (deduction_status in ('gross', 'standard', 'higher')),
  rate_percent smallint not null,
  verified_via text not null default 'sage' check (verified_via in ('sage', 'hmrc_online', 'hmrc_phone', 'other_software')),
  evidence_note text,
  is_current boolean not null default true,
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (painter_business_id, hmrc_verification_reference),
  constraint cis_rate_matches_status check (
    (deduction_status = 'gross' and rate_percent = 0)
    or (deduction_status = 'standard' and rate_percent = 20)
    or (deduction_status = 'higher' and rate_percent = 30))
);
create unique index if not exists cis_one_current_per_painter on public.cis_verifications (painter_business_id) where is_current;

-- ---------------------------------------------------------------------
-- 3. Painter invoices and payments (manual bank transfer)
-- ---------------------------------------------------------------------
create table if not exists public.painter_invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  invoice_number text not null,
  invoice_date date not null,
  labour_pence integer not null check (labour_pence >= 0),
  materials_pence integer not null default 0 check (materials_pence >= 0),   -- eligible materials (excluded from CIS)
  vat_pence integer not null default 0 check (vat_pence >= 0),
  vat_treatment text not null default 'not_vat_registered'
    check (vat_treatment in ('not_vat_registered', 'standard_rated', 'domestic_reverse_charge', 'zero_rated', 'accountant_to_confirm')),
  storage_path text,
  notes text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'returned_for_correction', 'cancelled')),
  return_reason text,
  submitted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (painter_business_id, invoice_number),
  constraint invoice_total_positive check (labour_pence + materials_pence > 0),
  constraint invoice_return_reason check (status <> 'returned_for_correction' or length(coalesce(return_reason, '')) >= 5)
);
-- Only one live invoice per job (prevents duplicates)
create unique index if not exists painter_invoices_one_live_per_job on public.painter_invoices (job_id) where status in ('submitted', 'approved');

create table if not exists public.painter_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.painter_invoices (id) on delete restrict,
  job_id uuid not null references public.jobs (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  status text not null default 'awaiting_admin_approval' check (status in (
    'awaiting_admin_approval', 'approved_awaiting_transfer', 'paid_awaiting_reconciliation', 'paid_confirmed', 'cancelled')),
  -- Amounts (pence)
  labour_pence integer not null check (labour_pence >= 0),
  materials_pence integer not null check (materials_pence >= 0),
  gross_pence integer not null,
  vat_pence integer not null check (vat_pence >= 0),
  cis_verification_id uuid references public.cis_verifications (id),
  cis_rate_percent smallint check (cis_rate_percent in (0, 20, 30)),
  cis_deduction_pence integer not null default 0 check (cis_deduction_pence >= 0),
  net_pence integer not null check (net_pence >= 0),
  -- Dates and references
  due_date date not null,
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  bank_payment_reference text,
  transfer_date date,
  transfer_recorded_by uuid references auth.users (id),
  confirmed_by uuid references auth.users (id),
  confirmed_at timestamptz,
  reconciled_at timestamptz,
  sage_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pp_gross check (gross_pence = labour_pence + materials_pence),
  -- Statutory CIS only: rounded DOWN to the penny (accountant to confirm)
  constraint pp_cis_calc check (
    (cis_rate_percent is null and cis_deduction_pence = 0)
    or (cis_rate_percent is not null and cis_deduction_pence = (labour_pence * cis_rate_percent) / 100)),
  constraint pp_net check (net_pence = gross_pence + vat_pence - cis_deduction_pence),
  constraint pp_approved_fields check (
    status in ('awaiting_admin_approval', 'cancelled')
    or (approved_by is not null and approved_at is not null and cis_verification_id is not null and cis_rate_percent is not null)),
  constraint pp_paid_fields check (
    status not in ('paid_awaiting_reconciliation', 'paid_confirmed')
    or (bank_payment_reference is not null and length(bank_payment_reference) >= 3 and transfer_date is not null
        and transfer_recorded_by is not null and confirmed_by is not null and confirmed_at is not null)),
  constraint pp_reconciled_fields check (status <> 'paid_confirmed' or reconciled_at is not null)
);
create index if not exists painter_payments_painter_idx on public.painter_payments (painter_business_id);
create index if not exists painter_payments_status_idx on public.painter_payments (status);

-- Business rules that need other tables
create or replace function public.check_painter_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_route text; v_onboarding text; v_ver record; v_order text[] :=
    array['awaiting_admin_approval', 'approved_awaiting_transfer', 'paid_awaiting_reconciliation', 'paid_confirmed'];
begin
  if tg_op = 'UPDATE' then
    if old.status in ('paid_awaiting_reconciliation', 'paid_confirmed') and (
         new.labour_pence, new.materials_pence, new.vat_pence, new.cis_rate_percent, new.cis_deduction_pence,
         new.net_pence, new.bank_payment_reference, new.transfer_date)
       is distinct from (
         old.labour_pence, old.materials_pence, old.vat_pence, old.cis_rate_percent, old.cis_deduction_pence,
         old.net_pence, old.bank_payment_reference, old.transfer_date) then
      raise exception 'A paid painter payment cannot be changed. Record a correction instead.';
    end if;
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'A cancelled payment cannot be reopened';
    end if;
    if new.status <> 'cancelled' and old.status <> 'cancelled'
       and array_position(v_order, new.status) < array_position(v_order, old.status) then
      raise exception 'Payment status cannot move backwards';
    end if;
    if old.status in ('paid_awaiting_reconciliation', 'paid_confirmed') and new.status = 'cancelled' then
      raise exception 'A paid payment cannot be cancelled';
    end if;
  end if;

  if new.status in ('approved_awaiting_transfer', 'paid_awaiting_reconciliation', 'paid_confirmed') then
    if not public.gate_approved('cis_contractor_setup') then
      raise exception 'Painter payments are locked until your accountant signs off the CIS set-up approval gate';
    end if;
    select engagement_route, onboarding_status into v_route, v_onboarding
      from public.painter_businesses where id = new.painter_business_id;
    if v_onboarding <> 'approved' then
      raise exception 'The painter''s onboarding has not been approved';
    end if;
    if v_route <> 'independent_business' then
      raise exception 'This engagement needs an employment-status / wage-compliance review before payment';
    end if;
    select * into v_ver from public.cis_verifications where id = new.cis_verification_id;
    if v_ver.id is null or v_ver.painter_business_id <> new.painter_business_id or v_ver.rate_percent <> new.cis_rate_percent then
      raise exception 'The CIS rate must match a recorded HMRC verification for this painter';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists painter_payments_check on public.painter_payments;
create trigger painter_payments_check before insert or update on public.painter_payments
  for each row execute function public.check_painter_payment();

-- ---------------------------------------------------------------------
-- 4. CIS ledger, reserve account, HMRC returns and payments
-- ---------------------------------------------------------------------
-- Tax month runs from the 6th to the 5th. tax_month_start is always the 6th.
create or replace function public.cis_tax_month_start(d date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case when extract(day from d) >= 6
    then make_date(extract(year from d)::int, extract(month from d)::int, 6)
    else (make_date(extract(year from d)::int, extract(month from d)::int, 6) - interval '1 month')::date
  end;
$$;

create table if not exists public.cis_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  painter_payment_id uuid not null unique references public.painter_payments (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  tax_month_start date not null check (extract(day from tax_month_start) = 6),
  payment_date date not null,
  gross_pence integer not null,
  labour_pence integer not null,
  materials_pence integer not null,
  cis_rate_percent smallint not null,
  cis_deduction_pence integer not null,
  net_pence integer not null,
  statement_issued_at timestamptz,
  statement_storage_path text,
  created_at timestamptz not null default now(),
  constraint cis_ledger_month_matches check (tax_month_start = public.cis_tax_month_start(payment_date))
);
create index if not exists cis_ledger_month_idx on public.cis_ledger_entries (tax_month_start);

-- When a payment is confirmed as transferred, write its CIS ledger line once.
create or replace function public.write_cis_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('paid_awaiting_reconciliation', 'paid_confirmed')
     and (tg_op = 'INSERT' or old.status not in ('paid_awaiting_reconciliation', 'paid_confirmed')) then
    insert into public.cis_ledger_entries (
      painter_payment_id, painter_business_id, tax_month_start, payment_date, gross_pence, labour_pence,
      materials_pence, cis_rate_percent, cis_deduction_pence, net_pence)
    values (
      new.id, new.painter_business_id, public.cis_tax_month_start(new.transfer_date), new.transfer_date, new.gross_pence,
      new.labour_pence, new.materials_pence, new.cis_rate_percent, new.cis_deduction_pence, new.net_pence)
    on conflict (painter_payment_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists painter_payments_cis_ledger on public.painter_payments;
create trigger painter_payments_cis_ledger after insert or update on public.painter_payments
  for each row execute function public.write_cis_ledger_entry();

-- Ledger lines are permanent (corrections are separate adjustments)
create or replace function public.cis_ledger_protect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'CIS ledger entries cannot be deleted'; end if;
  if (new.painter_payment_id, new.tax_month_start, new.payment_date, new.gross_pence, new.labour_pence,
      new.materials_pence, new.cis_rate_percent, new.cis_deduction_pence, new.net_pence)
     is distinct from (old.painter_payment_id, old.tax_month_start, old.payment_date, old.gross_pence, old.labour_pence,
      old.materials_pence, old.cis_rate_percent, old.cis_deduction_pence, old.net_pence) then
    raise exception 'CIS ledger amounts cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists cis_ledger_protect on public.cis_ledger_entries;
create trigger cis_ledger_protect before update or delete on public.cis_ledger_entries
  for each row execute function public.cis_ledger_protect();

-- Movements in the single pooled "CIS Tax Reserve" savings account
create table if not exists public.cis_reserve_movements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('transfer_into_reserve', 'payment_to_hmrc', 'correction')),
  amount_pence integer not null check (amount_pence <> 0),
  occurred_on date not null,
  tax_month_start date check (tax_month_start is null or extract(day from tax_month_start) = 6),
  bank_reference text not null,
  note text,
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint reserve_sign check (
    (kind = 'transfer_into_reserve' and amount_pence > 0)
    or (kind = 'payment_to_hmrc' and amount_pence < 0)
    or (kind = 'correction' and length(coalesce(note, '')) >= 10))
);

create table if not exists public.hmrc_cis_returns (
  id uuid primary key default gen_random_uuid(),
  tax_month_start date not null unique check (extract(day from tax_month_start) = 6),
  status text not null default 'not_started' check (status in ('not_started', 'prepared_in_sage', 'submitted', 'accepted_by_hmrc', 'nil_return_submitted')),
  total_deductions_reported_pence integer,
  submitted_at timestamptz,
  hmrc_submission_reference text,
  submitted_by_name text,
  note text,
  recorded_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint return_submitted_evidence check (status in ('not_started', 'prepared_in_sage') or (submitted_at is not null and hmrc_submission_reference is not null))
);

create table if not exists public.hmrc_payments (
  id uuid primary key default gen_random_uuid(),
  tax_month_start date not null check (extract(day from tax_month_start) = 6),
  amount_pence integer not null check (amount_pence > 0),
  paid_on date not null,
  payment_reference text not null,       -- HMRC accounts office reference used
  bank_reference text not null,
  evidence_storage_path text,
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (tax_month_start, bank_reference)
);

-- Monthly CIS summary used by the reserve dashboard
create or replace view public.cis_monthly_summary
with (security_invoker = true) as
select
  m.tax_month_start,
  (m.tax_month_start + interval '1 month' - interval '1 day')::date as tax_month_end,
  (m.tax_month_start + interval '1 month' + interval '13 days')::date as return_due_date,      -- 19th
  (m.tax_month_start + interval '1 month' + interval '16 days')::date as payment_due_date,     -- 22nd (electronic)
  coalesce(l.deducted, 0) as cis_deducted_pence,
  coalesce(r.reserved, 0) as reserved_pence,
  coalesce(h.paid, 0) as paid_to_hmrc_pence,
  coalesce(l.deducted, 0) - coalesce(h.paid, 0) as outstanding_liability_pence,
  coalesce(ret.status, 'not_started') as return_status
from (
  select tax_month_start from public.cis_ledger_entries
  union select tax_month_start from public.hmrc_payments
  union select tax_month_start from public.hmrc_cis_returns
  union select tax_month_start from public.cis_reserve_movements where tax_month_start is not null
) m
left join (select tax_month_start, sum(cis_deduction_pence) as deducted from public.cis_ledger_entries group by 1) l using (tax_month_start)
left join (select tax_month_start, sum(amount_pence) as reserved from public.cis_reserve_movements where kind = 'transfer_into_reserve' group by 1) r using (tax_month_start)
left join (select tax_month_start, sum(amount_pence) as paid from public.hmrc_payments group by 1) h using (tax_month_start)
left join public.hmrc_cis_returns ret using (tax_month_start);

-- ---------------------------------------------------------------------
-- 5. Stripe records (additive columns on the existing payments log) and
--    customer refunds (ledger I)
-- ---------------------------------------------------------------------
alter table public.payments
  add column if not exists stripe_fee_pence integer,
  add column if not exists stripe_balance_transaction_id text,
  add column if not exists net_received_pence integer;

create table if not exists public.stripe_refunds (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.enquiries (id) on delete set null,
  customer_remedy_id uuid references public.customer_remedies (id),
  stripe_refund_id text not null unique,
  stripe_payment_intent_id text not null,
  amount_pence integer not null check (amount_pence > 0),
  status text not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Sage sync records and reconciliation flags
-- ---------------------------------------------------------------------
create table if not exists public.sage_sync_records (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('painter_business', 'painter_invoice', 'painter_payment', 'customer_payment', 'customer_refund')),
  entity_id uuid not null,
  sage_object_type text not null,       -- e.g. 'contact', 'purchase_invoice', 'contact_payment'
  sage_id text,
  status text not null default 'pending' check (status in ('pending', 'synced', 'failed', 'manual_in_sage')),
  payload_sha256 text,
  last_error text,
  attempts integer not null default 0,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, sage_object_type)    -- prevents duplicate Sage records
);

create table if not exists public.reconciliation_flags (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('stripe', 'painter_payment', 'cis', 'cis_reserve', 'hmrc', 'sage', 'refund', 'recovery_claim')),
  entity_type text,
  entity_id text,
  description text not null,
  expected_pence integer,
  found_pence integer,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored_with_reason')),
  resolution_note text,
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint flag_resolution check (status = 'open' or (length(coalesce(resolution_note, '')) >= 10 and resolved_by is not null))
);
create unique index if not exists reconciliation_flags_open_unique on public.reconciliation_flags (area, entity_type, entity_id, description) where status = 'open';

-- ---------------------------------------------------------------------
-- 7. Construction Act (HGCRA 1996 Part II) – solicitor-configured
-- ---------------------------------------------------------------------
create table if not exists public.construction_act_configs (
  job_id uuid primary key references public.jobs (id) on delete restrict,
  part_ii_applies text not null default 'review_required' check (part_ii_applies in ('review_required', 'yes', 'no')),
  solicitor_reviewer text,
  reviewed_on date,
  payment_due_date date,
  final_date_for_payment date,
  payment_notice_deadline date,
  pay_less_notice_deadline date,
  payer text,
  payee text,
  notice_recipient text,
  permitted_service_method text,
  notes text,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint ca_reviewed check (part_ii_applies = 'review_required' or (solicitor_reviewer is not null and reviewed_on is not null)),
  constraint ca_yes_complete check (
    part_ii_applies <> 'yes' or (
      payment_due_date is not null and final_date_for_payment is not null and payment_notice_deadline is not null
      and pay_less_notice_deadline is not null and payer is not null and payee is not null
      and notice_recipient is not null and permitted_service_method is not null)),
  constraint ca_date_order check (final_date_for_payment is null or payment_due_date is null or final_date_for_payment >= payment_due_date)
);

create table if not exists public.payment_notices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  kind text not null check (kind in ('payment_notice', 'pay_less_notice')),
  notified_sum_pence integer,
  sum_considered_due_pence integer not null check (sum_considered_due_pence >= 0),
  basis_of_calculation text not null check (length(basis_of_calculation) >= 20),
  recipient text not null,
  service_method text not null,
  served_at timestamptz not null,
  proof_storage_path text,
  recorded_by uuid not null references auth.users (id),
  recorded_at timestamptz not null default now(),
  constraint notice_not_backdated check (served_at <= recorded_at + interval '5 minutes')
);

create or replace function public.check_payment_notice()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_cfg record;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Served notices are permanent records and cannot be changed or deleted';
  end if;
  if not public.gate_approved('construction_act_notices') then
    raise exception 'Construction Act notices are locked until a construction solicitor signs off the approval gate';
  end if;
  select * into v_cfg from public.construction_act_configs where job_id = new.job_id;
  if v_cfg.job_id is null or v_cfg.part_ii_applies <> 'yes' then
    raise exception 'Complete the Construction Act configuration (Part II applies = yes) for this job first';
  end if;
  return new;
end;
$$;
drop trigger if exists payment_notices_check on public.payment_notices;
create trigger payment_notices_check before insert or update or delete on public.payment_notices
  for each row execute function public.check_payment_notice();

-- ---------------------------------------------------------------------
-- 8. Data retention rules (reviewed by your data-protection adviser)
-- ---------------------------------------------------------------------
create table if not exists public.retention_rules (
  entity_type text primary key,
  retain_for text not null,
  basis text not null,
  action_after text not null check (action_after in ('delete', 'anonymise', 'review')),
  adviser_confirmed boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.retention_rules (entity_type, retain_for, basis, action_after) values
  ('emergency_notice_evidence', '90 days after the job closes', 'Health/emergency evidence – minimum necessary (UK GDPR Art. 9)', 'delete'),
  ('cis_records', '3 years after the end of the tax year (minimum)', 'CIS record-keeping rules – accountant to confirm', 'review'),
  ('painter_invoices_and_payments', '6 years after the end of the financial year', 'Accounting records – accountant to confirm', 'review'),
  ('job_records_and_acceptances', '6 years after job completion', 'Limitation period for contract claims – solicitor to confirm', 'review'),
  ('complaints_and_claims', '6 years after closure', 'Limitation period – solicitor to confirm', 'review'),
  ('painter_bank_details', 'Until 6 years after last payment, or earlier on request where lawful', 'Payment administration', 'delete'),
  ('rejected_painter_applications', '12 months', 'Legitimate interests – adviser to confirm', 'delete'),
  ('audit_events', '6 years', 'Accountability (UK GDPR Art. 5(2))', 'review')
on conflict (entity_type) do nothing;

-- ---------------------------------------------------------------------
-- 9. Audit triggers, updated_at, RLS and grants
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['compliance_gates', 'cis_verifications', 'painter_invoices', 'painter_payments',
    'cis_reserve_movements', 'hmrc_cis_returns', 'hmrc_payments', 'construction_act_configs', 'payment_notices',
    'reconciliation_flags', 'stripe_refunds', 'retention_rules']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t || '_audit', t);
  end loop;
  foreach t in array array['compliance_gates', 'painter_payments', 'hmrc_cis_returns', 'construction_act_configs', 'sage_sync_records', 'retention_rules']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- compliance_gates and retention_rules have no "id" column – the generic
-- audit function stores entity_id as null for them; the row data is kept.

do $$
declare t text;
begin
  foreach t in array array['compliance_gates', 'cis_verifications', 'painter_invoices', 'painter_payments',
    'cis_ledger_entries', 'cis_reserve_movements', 'hmrc_cis_returns', 'hmrc_payments', 'stripe_refunds',
    'sage_sync_records', 'reconciliation_flags', 'construction_act_configs', 'payment_notices', 'retention_rules']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
revoke all on table public.cis_monthly_summary from public, anon, authenticated, service_role;
grant select on table public.cis_monthly_summary to authenticated, service_role;

create policy "Admins read gates" on public.compliance_gates for select to authenticated
  using (public.is_admin());
create policy "Own CIS status" on public.cis_verifications for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('finance'));
create policy "Own invoices" on public.painter_invoices for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('finance', 'operations'));
create policy "Own payments" on public.painter_payments for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('finance'));
create policy "Own CIS ledger" on public.cis_ledger_entries for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('finance'));
create policy "Finance reads reserve" on public.cis_reserve_movements for select to authenticated using (public.has_admin_role('finance'));
create policy "Finance reads returns" on public.hmrc_cis_returns for select to authenticated using (public.has_admin_role('finance'));
create policy "Finance reads HMRC payments" on public.hmrc_payments for select to authenticated using (public.has_admin_role('finance'));
create policy "Finance reads refunds" on public.stripe_refunds for select to authenticated using (public.has_admin_role('finance', 'operations'));
create policy "Finance reads Sage sync" on public.sage_sync_records for select to authenticated using (public.has_admin_role('finance'));
create policy "Finance reads flags" on public.reconciliation_flags for select to authenticated using (public.has_admin_role('finance'));
create policy "Construction config" on public.construction_act_configs for select to authenticated
  using (public.has_admin_role('finance', 'operations') or exists (select 1 from public.jobs j where j.id = job_id and j.painter_business_id = public.current_painter_business_id()));
create policy "Notices to painter" on public.payment_notices for select to authenticated
  using (public.has_admin_role('finance', 'operations') or exists (select 1 from public.jobs j where j.id = job_id and j.painter_business_id = public.current_painter_business_id()));
create policy "Admins read retention" on public.retention_rules for select to authenticated using (public.is_admin());

-- Ledger and notices: server can append/read, never rewrite (triggers also block it)
revoke delete on table public.cis_ledger_entries, public.payment_notices, public.hmrc_payments from service_role;

revoke all on function public.gate_approved(text) from public;
grant execute on function public.gate_approved(text) to authenticated, service_role;
revoke all on function public.cis_tax_month_start(date) from public;
grant execute on function public.cis_tax_month_start(date) to authenticated, service_role;
do $$
declare f text;
begin
  foreach f in array array['check_painter_payment', 'write_cis_ledger_entry', 'cis_ledger_protect', 'check_payment_notice']
  loop
    execute format('revoke all on function public.%I() from public, anon, authenticated', f);
  end loop;
end $$;
