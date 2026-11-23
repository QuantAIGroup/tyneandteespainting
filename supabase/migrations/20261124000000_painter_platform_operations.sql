-- =====================================================================
-- PAINTER PLATFORM – PART 1: OPERATIONS
-- Roles, independent painter businesses, onboarding evidence, legal
-- document centre, jobs, job offers / counteroffers / mutual acceptance,
-- substitutes, emergencies, completion, complaints, rectification,
-- recovery claims (kept separate from customer remedies), appeals,
-- feedback, protective restrictions and an append-only audit log.
--
-- Run AFTER all earlier migrations. ADDITIVE ONLY: no existing table,
-- column or row is dropped or changed (existing admins become "owner").
-- Rollback: supabase/rollback/20261124_painter_platform_rollback.sql
--
-- Based on Master Legal Pack v3.0 (Model A – independent painter
-- businesses). Legal design rules enforced here, not just in the app:
--   * No minimum work / availability fields, no strike counters, no
--     acceptance-rate penalties, no fines (none of these columns exist).
--   * A job subcontract exists ONLY when the Company and the Painter have
--     both accepted the SAME immutable offer version.
--   * Accepted job records can never be edited; changes are variations
--     that both parties must accept.
--   * Customer remedies (refunds) and painter recovery claims are separate
--     tables with no automatic link.
--   * Emergency reports never ask for diagnoses; evidence is optional.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Admin roles (existing admin_users rows become 'owner')
--    owner       – everything
--    operations  – painters, jobs, offers, complaints, documents (read)
--    finance     – invoices, payments, bank details, CIS, Sage, HMRC
--    compliance  – onboarding verification, legal documents, audit log
-- ---------------------------------------------------------------------
alter table public.admin_users
  add column if not exists role text not null default 'owner',
  add column if not exists display_name text;

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check check (role in ('owner', 'operations', 'finance', 'compliance'));

create or replace function public.has_admin_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and (role = 'owner' or role = any (roles))
  );
$$;

-- ---------------------------------------------------------------------
-- 1. Independent painter businesses and their logins
-- ---------------------------------------------------------------------
create table if not exists public.painter_businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  business_structure text not null default 'sole_trader'
    check (business_structure in ('sole_trader', 'partnership', 'limited_company', 'llp', 'other')),
  company_number text,
  address_line1 text,
  address_line2 text,
  town text,
  postcode text,
  phone text,
  invoice_email text,
  vat_registered boolean not null default false,
  vat_number text,
  -- How the business delivers work: own staff, subcontractors, substitutes.
  substitution_arrangements text,
  competence_summary text,
  website_or_profile text,
  -- Engagement route. Changing this label does NOT decide legal status;
  -- 'status_review_required' and 'worker_or_employee' block every
  -- commercial deduction/set-off control (see finance migration).
  engagement_route text not null default 'independent_business'
    check (engagement_route in ('independent_business', 'status_review_required', 'worker_or_employee')),
  onboarding_status text not null default 'draft'
    check (onboarding_status in ('draft', 'submitted', 'more_information_requested', 'approved', 'rejected', 'ended')),
  onboarding_admin_note text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint painter_vat_number_needed check (not vat_registered or vat_number is not null),
  constraint painter_approved_has_approver check (onboarding_status <> 'approved' or (approved_at is not null and approved_by is not null))
);

create table if not exists public.painter_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  painter_business_id uuid not null references public.painter_businesses (id) on delete cascade,
  full_name text not null,
  is_primary_contact boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists painter_users_business_idx on public.painter_users (painter_business_id);

create or replace function public.current_painter_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select painter_business_id from public.painter_users where user_id = auth.uid() limit 1;
$$;

-- Restricted tax and bank details. Values are ENCRYPTED by the website
-- server (AES-256-GCM) before they are stored; the database only ever
-- holds ciphertext plus the last few characters for display.
-- Painters write these through the server; only finance admins read them.
create table if not exists public.painter_private_details (
  painter_business_id uuid primary key references public.painter_businesses (id) on delete cascade,
  utr_encrypted text,
  utr_last3 text,
  nino_encrypted text,          -- only where HMRC verification needs it (sole traders)
  company_utr_encrypted text,
  bank_account_name text,
  bank_sort_code_encrypted text,
  bank_account_number_encrypted text,
  bank_account_last4 text,
  bank_details_confirmed_at timestamptz,  -- admin confirmed by a call-back check (fraud prevention)
  bank_details_confirmed_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- Insurance, competence and other onboarding evidence (files in the
-- private "painter-documents" storage bucket).
create table if not exists public.painter_evidence (
  id uuid primary key default gen_random_uuid(),
  painter_business_id uuid not null references public.painter_businesses (id) on delete cascade,
  kind text not null check (kind in (
    'public_liability_insurance', 'employers_liability_insurance', 'other_insurance',
    'qualification', 'experience_reference', 'portfolio', 'health_and_safety', 'other')),
  title text not null,
  storage_path text,
  insurer text,
  policy_number text,
  cover_limit_pence bigint check (cover_limit_pence is null or cover_limit_pence >= 0),
  starts_on date,
  expires_on date,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired', 'superseded')),
  verification_note text,
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint evidence_verified_has_verifier check (verification_status not in ('verified', 'rejected') or (verified_by is not null and verified_at is not null)),
  constraint evidence_dates check (starts_on is null or expires_on is null or expires_on >= starts_on)
);
create index if not exists painter_evidence_business_idx on public.painter_evidence (painter_business_id);
create index if not exists painter_evidence_expiry_idx on public.painter_evidence (expires_on) where verification_status = 'verified';

-- Protective platform restrictions (NOT disciplinary sanctions).
-- Master Legal Pack v3.0 cl. 3.16: documented material risk only.
create table if not exists public.access_restrictions (
  id uuid primary key default gen_random_uuid(),
  painter_business_id uuid not null references public.painter_businesses (id) on delete cascade,
  reason_category text not null check (reason_category in ('safety', 'suspected_fraud', 'data_security', 'insurance_lapse', 'property_risk')),
  reason_detail text not null check (length(reason_detail) >= 20),
  scope text not null default 'new_offers' check (scope in ('new_offers', 'all_platform_access')),
  started_at timestamptz not null default now(),
  review_by date not null,
  painter_informed_at timestamptz,
  painter_response text,
  lifted_at timestamptz,
  lifted_reason text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Legal document centre (three sectors) with versions + acceptances
-- ---------------------------------------------------------------------
create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  sector text not null check (sector in ('painter', 'admin', 'public')),
  requires_acceptance boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents (id) on delete restrict,
  version_label text not null,
  body_markdown text,
  file_storage_path text,
  source_note text,               -- e.g. "Master Legal Pack v3.0 section 3"
  status text not null default 'draft' check (status in (
    'draft', 'awaiting_solicitor_review', 'awaiting_accountant_review', 'awaiting_company_approval',
    'approved_for_publication', 'published', 'superseded', 'archived')),
  effective_date date,
  review_date date,
  approved_by_name text,          -- the human approver (e.g. solicitor / director)
  approved_at timestamptz,
  recorded_by uuid references auth.users (id),
  content_sha256 text,
  created_at timestamptz not null default now(),
  unique (document_id, version_label),
  constraint version_approval_recorded check (
    status not in ('approved_for_publication', 'published')
    or (approved_by_name is not null and approved_at is not null and effective_date is not null))
);

-- Approved/published wording is frozen: only the status may move on
-- (to superseded/archived). Body text can't be changed silently.
create or replace function public.freeze_approved_document_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved_for_publication', 'published', 'superseded') then
      raise exception 'Approved document versions are kept permanently';
    end if;
    return old;
  end if;
  if old.status in ('approved_for_publication', 'published', 'superseded', 'archived') and (
       new.body_markdown is distinct from old.body_markdown
       or new.file_storage_path is distinct from old.file_storage_path
       or new.version_label is distinct from old.version_label
       or new.approved_by_name is distinct from old.approved_by_name
       or new.approved_at is distinct from old.approved_at
       or new.content_sha256 is distinct from old.content_sha256) then
    raise exception 'Approved document wording cannot be edited. Create a new version instead.';
  end if;
  return new;
end;
$$;
drop trigger if exists legal_versions_freeze on public.legal_document_versions;
create trigger legal_versions_freeze before update or delete on public.legal_document_versions
  for each row execute function public.freeze_approved_document_versions();

create table if not exists public.document_acceptances (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.legal_document_versions (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  user_id uuid not null references auth.users (id),
  accepted_at timestamptz not null default now(),
  content_sha256 text not null,
  ip_address text,
  user_agent text,
  unique (version_id, painter_business_id)
);

-- Binding acceptance is only possible for approved/published versions.
create or replace function public.only_accept_approved_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_status text;
begin
  select status into v_status from public.legal_document_versions where id = new.version_id;
  if v_status not in ('approved_for_publication', 'published') then
    raise exception 'This document is a draft and cannot be accepted until it is approved for publication';
  end if;
  return new;
end;
$$;
drop trigger if exists acceptances_only_approved on public.document_acceptances;
create trigger acceptances_only_approved before insert on public.document_acceptances
  for each row execute function public.only_accept_approved_versions();

-- ---------------------------------------------------------------------
-- 3. Jobs (internal record linked to the website enquiry)
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  enquiry_id uuid references public.enquiries (id) on delete restrict,
  title text not null,
  scope_summary text not null,
  site_town text,
  site_postcode_district text,     -- e.g. "NE3" – safe to show in offers
  customer_price_pence integer check (customer_price_pence is null or customer_price_pence > 0),
  status text not null default 'draft' check (status in (
    'draft', 'offered', 'agreed', 'in_progress', 'completion_submitted', 'completed', 'cancelled', 'closed')),
  agreed_offer_version_id uuid,    -- set when both parties accept (FK added below)
  painter_business_id uuid references public.painter_businesses (id),
  completion_submitted_at timestamptz,
  completion_note text,
  completion_reviewed_at timestamptz,
  completion_reviewed_by uuid references auth.users (id),
  cancelled_reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_agreed_has_painter check (
    status in ('draft', 'offered', 'cancelled') or (agreed_offer_version_id is not null and painter_business_id is not null))
);
create index if not exists jobs_enquiry_idx on public.jobs (enquiry_id);
create index if not exists jobs_painter_idx on public.jobs (painter_business_id);
create index if not exists jobs_status_idx on public.jobs (status);

-- Full site address and customer contact: only revealed to the painter
-- AFTER the job has been mutually agreed (data minimisation).
create table if not exists public.job_site_details (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  customer_contact_name text,
  customer_phone text,
  address_line1 text,
  address_line2 text,
  town text,
  postcode text,
  access_notes text,
  parking_notes text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Offers, counteroffers and mutual acceptance
--    One negotiation thread (job_offers) per job + painter; every proposal
--    from either side is an immutable job_offer_versions row.
-- ---------------------------------------------------------------------
create table if not exists public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'agreed', 'declined_by_painter', 'withdrawn_by_company', 'closed')),
  decline_reason text,             -- optional; never used to penalise
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, painter_business_id)
);
create index if not exists job_offers_painter_idx on public.job_offers (painter_business_id);

create table if not exists public.job_offer_versions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.job_offers (id) on delete restrict,
  version_number integer not null check (version_number >= 1),
  proposed_by text not null check (proposed_by in ('company', 'painter')),
  proposed_by_user uuid references auth.users (id),
  -- Schedule B minimum content
  scope text not null,
  surfaces_and_preparation text,
  exclusions text,
  fee_pence integer not null check (fee_pence > 0),
  materials_responsibility text not null check (materials_responsibility in ('company', 'painter', 'customer', 'split')),
  materials_notes text,
  proposed_start_date date not null,
  arrival_window_start time not null,
  arrival_window_end time not null,
  estimated_duration_hours numeric(5, 1),
  access_requirements text,
  known_hazards text,
  customer_requirements text,
  payment_terms text not null,
  payment_due_days integer not null check (payment_due_days between 0 and 60),
  specification_version text not null,
  message text,
  content_sha256 text not null,
  company_accepted_at timestamptz,
  company_accepted_by uuid references auth.users (id),
  painter_accepted_at timestamptz,
  painter_accepted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (offer_id, version_number),
  constraint arrival_window_order check (arrival_window_end > arrival_window_start),
  -- The proposing party accepts its own proposal by making it
  constraint proposer_accepts_own check (
    (proposed_by = 'company' and company_accepted_at is not null)
    or (proposed_by = 'painter' and painter_accepted_at is not null))
);

alter table public.jobs drop constraint if exists jobs_agreed_version_fk;
alter table public.jobs
  add constraint jobs_agreed_version_fk foreign key (agreed_offer_version_id) references public.job_offer_versions (id);

-- Offer versions are immutable. The only permitted change is the OTHER
-- party recording its acceptance once, on the latest version of an open
-- offer. When both have accepted, the job is agreed atomically.
create or replace function public.guard_offer_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_latest integer;
  v_offer_status text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Offer history cannot be deleted';
  end if;

  if (new.offer_id, new.version_number, new.proposed_by, new.scope, new.surfaces_and_preparation, new.exclusions,
      new.fee_pence, new.materials_responsibility, new.materials_notes, new.proposed_start_date,
      new.arrival_window_start, new.arrival_window_end, new.estimated_duration_hours, new.access_requirements,
      new.known_hazards, new.customer_requirements, new.payment_terms, new.payment_due_days,
      new.specification_version, new.message, new.content_sha256, new.created_at)
     is distinct from
     (old.offer_id, old.version_number, old.proposed_by, old.scope, old.surfaces_and_preparation, old.exclusions,
      old.fee_pence, old.materials_responsibility, old.materials_notes, old.proposed_start_date,
      old.arrival_window_start, old.arrival_window_end, old.estimated_duration_hours, old.access_requirements,
      old.known_hazards, old.customer_requirements, old.payment_terms, old.payment_due_days,
      old.specification_version, old.message, old.content_sha256, old.created_at) then
    raise exception 'Offer terms cannot be edited. Make a counteroffer (new version) instead.';
  end if;

  if (old.company_accepted_at is not null and new.company_accepted_at is distinct from old.company_accepted_at)
     or (old.painter_accepted_at is not null and new.painter_accepted_at is distinct from old.painter_accepted_at) then
    raise exception 'An acceptance cannot be changed once recorded';
  end if;

  select max(version_number) into v_latest from public.job_offer_versions where offer_id = new.offer_id;
  select status into v_offer_status from public.job_offers where id = new.offer_id;
  if new.version_number <> v_latest or v_offer_status <> 'open' then
    raise exception 'Only the latest version of an open offer can be accepted';
  end if;
  return new;
end;
$$;
drop trigger if exists offer_versions_guard on public.job_offer_versions;
create trigger offer_versions_guard before update or delete on public.job_offer_versions
  for each row execute function public.guard_offer_versions();

-- A new proposal must be the next number on an open offer.
create or replace function public.check_new_offer_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_latest integer; v_status text;
begin
  select status into v_status from public.job_offers where id = new.offer_id;
  if v_status is distinct from 'open' then
    raise exception 'This offer is no longer open';
  end if;
  select coalesce(max(version_number), 0) into v_latest from public.job_offer_versions where offer_id = new.offer_id;
  if new.version_number <> v_latest + 1 then
    raise exception 'Offer versions must be numbered consecutively';
  end if;
  return new;
end;
$$;
drop trigger if exists offer_versions_insert_check on public.job_offer_versions;
create trigger offer_versions_insert_check before insert on public.job_offer_versions
  for each row execute function public.check_new_offer_version();

-- When both sides have accepted the same version: agree the job.
create or replace function public.agree_job_on_mutual_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_job uuid; v_painter uuid; v_job_status text;
begin
  if new.company_accepted_at is not null and new.painter_accepted_at is not null
     and (old.company_accepted_at is null or old.painter_accepted_at is null) then
    select o.job_id, o.painter_business_id into v_job, v_painter from public.job_offers o where o.id = new.offer_id;
    select status into v_job_status from public.jobs where id = v_job for update;
    if v_job_status not in ('draft', 'offered') then
      raise exception 'This job has already been agreed with another painter or cancelled';
    end if;
    update public.job_offers set status = 'agreed', updated_at = now() where id = new.offer_id;
    -- Other open threads for the same job close (no penalty, just closed).
    update public.job_offers set status = 'closed', updated_at = now()
      where job_id = v_job and id <> new.offer_id and status = 'open';
    update public.jobs
      set status = 'agreed', agreed_offer_version_id = new.id, painter_business_id = v_painter, updated_at = now()
      where id = v_job;
  end if;
  return new;
end;
$$;
drop trigger if exists offer_versions_agree on public.job_offer_versions;
create trigger offer_versions_agree after update on public.job_offer_versions
  for each row execute function public.agree_job_on_mutual_acceptance();

-- Variations after acceptance (cl. 2.5): both parties must accept.
create table if not exists public.job_variations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  proposed_by text not null check (proposed_by in ('company', 'painter')),
  description text not null,
  fee_change_pence integer not null default 0,
  new_start_date date,
  new_arrival_window_start time,
  new_arrival_window_end time,
  company_accepted_at timestamptz,
  company_accepted_by uuid references auth.users (id),
  painter_accepted_at timestamptz,
  painter_accepted_by uuid references auth.users (id),
  status text not null default 'proposed' check (status in ('proposed', 'agreed', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  constraint variation_agreed_needs_both check (status <> 'agreed' or (company_accepted_at is not null and painter_accepted_at is not null))
);

-- ---------------------------------------------------------------------
-- 5. Substitutes / team members (genuine substitution right, cl. 3.6)
-- ---------------------------------------------------------------------
create table if not exists public.substitutes (
  id uuid primary key default gen_random_uuid(),
  painter_business_id uuid not null references public.painter_businesses (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,   -- null = general team member
  person_name text not null,
  relationship text not null check (relationship in ('employee_of_painter', 'subcontractor_of_painter', 'business_partner', 'other')),
  competence_summary text,
  insurance_summary text,
  evidence_storage_path text,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'refused', 'withdrawn')),
  -- Refusal only for a documented objective reason
  refusal_category text check (refusal_category in ('competence', 'safety', 'legal_eligibility', 'customer_security', 'insurance')),
  refusal_reason text,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint substitute_refusal_documented check (
    status <> 'refused' or (refusal_category is not null and length(coalesce(refusal_reason, '')) >= 20 and decided_by is not null))
);

-- ---------------------------------------------------------------------
-- 6. Emergencies, non-attendance and job updates
-- ---------------------------------------------------------------------
create table if not exists public.emergency_notices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  reported_by uuid not null references auth.users (id),
  category text not null check (category in (
    'sudden_illness', 'accident', 'family_emergency', 'transport_failure', 'unsafe_site', 'customer_access_failure', 'other_emergency')),
  -- Short explanation only. The app tells painters NOT to include diagnoses.
  explanation text not null check (length(explanation) between 5 and 1000),
  expected_delay_minutes integer check (expected_delay_minutes is null or expected_delay_minutes >= 0),
  updated_arrival_at timestamptz,
  reschedule_requested boolean not null default false,
  proposed_new_date date,
  substitute_proposed boolean not null default false,
  substitute_id uuid references public.substitutes (id),
  callback_permitted boolean not null default true,
  evidence_storage_path text,   -- optional; restricted bucket; short retention
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  outcome text check (outcome in ('rescheduled', 'substitute_approved', 'job_cancelled_no_fault', 'job_reassigned', 'resolved_other')),
  outcome_note text,
  handled_by uuid references auth.users (id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists emergency_notices_job_idx on public.emergency_notices (job_id);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id),
  stage text not null check (stage in ('before', 'progress', 'after', 'rectification')),
  storage_path text not null,
  caption text,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists job_photos_job_idx on public.job_photos (job_id);

-- Customer inspection / completion record (Master Pack v3.0 §6 wording)
create table if not exists public.customer_inspections (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  outcome text not null check (outcome in ('satisfied', 'concerns_listed', 'declined_to_sign', 'feedback_by_phone_or_email')),
  customer_comments text,
  channel text not null default 'phone' check (channel in ('on_site', 'phone', 'email', 'website', 'other')),
  recorded_by uuid not null references auth.users (id),
  recorded_at timestamptz not null default now()
);

-- Customer feedback (fair review system; painter can respond)
create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id),
  workmanship smallint check (workmanship between 1 and 5),
  communication smallint check (communication between 1 and 5),
  tidiness smallint check (tidiness between 1 and 5),
  professional_conduct smallint check (professional_conduct between 1 and 5),
  agreed_scope_completed boolean,
  comments text,
  painter_response text,
  painter_responded_at timestamptz,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'under_review', 'removed_false_or_abusive', 'misattributed')),
  moderation_note text,
  moderated_by uuid references auth.users (id),
  moderated_at timestamptz,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint moderation_documented check (moderation_status = 'visible' or (moderation_note is not null and moderated_by is not null))
);

-- ---------------------------------------------------------------------
-- 7. Complaints, rectification and independent assessment
-- ---------------------------------------------------------------------
-- Working-day helper (Mon–Fri; England & Wales bank holidays are NOT
-- excluded automatically – the app shows a warning near holidays).
create or replace function public.add_working_days(start_at timestamptz, days integer)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare d timestamptz := start_at; added integer := 0;
begin
  while added < days loop
    d := d + interval '1 day';
    if extract(isodow from d) < 6 then added := added + 1; end if;
  end loop;
  return d;
end;
$$;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  job_id uuid not null references public.jobs (id) on delete restrict,
  specification_version_id uuid references public.job_offer_versions (id),
  received_at timestamptz not null default now(),
  received_via text not null default 'phone' check (received_via in ('phone', 'email', 'website', 'in_person', 'other')),
  customer_description text not null,
  customer_remedy_requested text,
  category text not null default 'undetermined' check (category in (
    'undetermined', 'workmanship', 'incomplete_work', 'pre_existing_damage', 'damp_or_leak', 'substrate_failure',
    'product_failure', 'customer_change', 'excluded_work', 'normal_wear', 'access_problem', 'property_damage', 'conduct', 'other')),
  suspected_cause text,
  status text not null default 'open' check (status in (
    'open', 'awaiting_painter_response', 'painter_responded', 'rectification_offered', 'rectification_scheduled',
    'rectification_completed', 'independent_assessment', 'decided', 'appealed', 'closed')),
  painter_notified_at timestamptz,
  painter_response_due_at timestamptz,
  urgency_reason text,             -- required when the response period is shorter than 5 working days
  painter_response text,
  painter_responded_at timestamptz,
  -- Alternative contractor without first offering rectification (Dev Spec v2.0 §4)
  alternative_contractor_reason text check (alternative_contractor_reason in (
    'urgent_safety', 'risk_of_further_damage', 'abandonment', 'refusal', 'no_response_after_notice', 'other_documented')),
  alternative_contractor_explanation text,
  decision text check (decision in ('upheld_workmanship', 'not_upheld', 'partly_upheld', 'not_painter_related', 'resolved_by_agreement')),
  decision_reason text,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaint_short_deadline_needs_reason check (
    painter_notified_at is null or painter_response_due_at is null
    or painter_response_due_at >= public.add_working_days(painter_notified_at, 5)
    or length(coalesce(urgency_reason, '')) >= 10),
  constraint complaint_alt_contractor_explained check (
    alternative_contractor_reason is null or length(coalesce(alternative_contractor_explanation, '')) >= 20),
  constraint complaint_decision_reasoned check (decision is null or (length(coalesce(decision_reason, '')) >= 20 and decided_by is not null and decided_at is not null))
);
create index if not exists complaints_job_idx on public.complaints (job_id);

create table if not exists public.complaint_evidence (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete restrict,
  submitted_by_party text not null check (submitted_by_party in ('company', 'painter', 'customer_via_company', 'independent_assessor')),
  submitted_by uuid references auth.users (id),
  note text,
  storage_path text,
  visible_to_painter boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rectifications (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete restrict,
  proposed_by text not null check (proposed_by in ('company', 'painter')),
  scope text not null,
  deadline date not null,
  appointment_at timestamptz,
  access_confirmed_at timestamptz,
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'scheduled', 'completed', 'not_completed', 'withdrawn')),
  completion_note text,
  completed_at timestamptz,
  customer_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.independent_assessments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete restrict,
  assessor_name text not null,
  assessor_independence_note text,
  inspected_on date,
  report_storage_path text,
  alleged_breach text,
  causal_link text,
  reasonable_repair_scope text,
  pre_existing_conditions text,
  alternative_causes text,
  customer_changes text,
  betterment text,
  itemised_quote_pence integer,   -- a quote alone never creates a debt
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- Ledger (a): customer remedies. Deliberately NOT linked to painter pay.
create table if not exists public.customer_remedies (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  complaint_id uuid references public.complaints (id),
  kind text not null check (kind in ('repeat_performance', 'price_reduction', 'partial_refund', 'full_refund', 'goodwill')),
  amount_pence integer not null default 0 check (amount_pence >= 0),
  reason text not null,
  stripe_refund_id text unique,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'refund_issued', 'completed', 'cancelled')),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ledger (c)/(d): proposed recovery claims against a painter + settlement.
create table if not exists public.recovery_claims (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  job_id uuid not null references public.jobs (id) on delete restrict,
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  complaint_id uuid references public.complaints (id),
  alleged_breach text not null,
  contractual_basis text not null,
  causation_explanation text not null,
  mitigation_steps text,
  itemised_loss jsonb not null default '[]'::jsonb,
  claimed_pence integer not null check (claimed_pence > 0),
  status text not null default 'draft' check (status in (
    'draft', 'notified_to_painter', 'painter_responded', 'agreed_settlement', 'disputed', 'withdrawn', 'referred_for_legal_advice', 'closed')),
  notified_at timestamptz,
  response_due_at timestamptz,
  painter_response text,
  painter_responded_at timestamptz,
  agreed_settlement_pence integer check (agreed_settlement_pence is null or agreed_settlement_pence >= 0),
  settlement_agreed_by_painter_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claim_itemised check (jsonb_typeof(itemised_loss) = 'array' and jsonb_array_length(itemised_loss) >= 1),
  constraint claim_settlement_needs_painter check (status <> 'agreed_settlement' or (agreed_settlement_pence is not null and settlement_agreed_by_painter_at is not null))
);

-- Appeals / internal review (10 calendar days, different reviewer)
create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  painter_business_id uuid not null references public.painter_businesses (id) on delete restrict,
  subject_type text not null check (subject_type in ('complaint', 'recovery_claim', 'access_restriction', 'substitute_refusal', 'feedback', 'emergency_outcome', 'onboarding')),
  subject_id uuid not null,
  grounds text not null check (length(grounds) >= 10),
  submitted_by uuid not null references auth.users (id),
  submitted_at timestamptz not null default now(),
  original_decision_at timestamptz,
  reviewer uuid references auth.users (id),
  outcome text check (outcome in ('upheld', 'partly_upheld', 'dismissed')),
  outcome_reason text,
  decided_at timestamptz,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'decided', 'withdrawn')),
  constraint appeal_decision_reasoned check (status <> 'decided' or (outcome is not null and length(coalesce(outcome_reason, '')) >= 20 and reviewer is not null))
);

-- ---------------------------------------------------------------------
-- 8. Append-only audit log
-- ---------------------------------------------------------------------
create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('admin', 'painter', 'system', 'database')),
  action text not null,
  entity_type text not null,
  entity_id text,
  painter_business_id uuid,
  details jsonb not null default '{}'::jsonb
);
create index if not exists audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index if not exists audit_events_time_idx on public.audit_events (occurred_at desc);

create or replace function public.audit_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The audit log is append-only';
end;
$$;
drop trigger if exists audit_events_no_change on public.audit_events;
create trigger audit_events_no_change before update or delete on public.audit_events
  for each row execute function public.audit_events_append_only();

-- Generic database-level change log for sensitive tables (captures changes
-- even if made outside the app, e.g. in the Supabase table editor).
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_row jsonb; v_old jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  insert into public.audit_events (actor_user_id, actor_kind, action, entity_type, entity_id, details)
  values (auth.uid(), 'database', lower(tg_op), tg_table_name, v_row ->> 'id',
          jsonb_build_object('new', case when tg_op = 'DELETE' then null else v_row end, 'old', v_old));
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'painter_businesses', 'painter_evidence', 'access_restrictions', 'legal_document_versions', 'document_acceptances',
    'jobs', 'job_offers', 'job_offer_versions', 'job_variations', 'substitutes', 'emergency_notices',
    'complaints', 'rectifications', 'customer_remedies', 'recovery_claims', 'appeals', 'customer_feedback']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t || '_audit', t);
  end loop;
end $$;

-- painter_private_details: log THAT something changed, never the values
create or replace function public.audit_private_details_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_user_id, actor_kind, action, entity_type, entity_id, painter_business_id, details)
  values (auth.uid(), 'database', lower(tg_op), 'painter_private_details', null,
          coalesce(new.painter_business_id, old.painter_business_id), '{"values":"redacted"}'::jsonb);
  return null;
end;
$$;
drop trigger if exists painter_private_details_audit on public.painter_private_details;
create trigger painter_private_details_audit after insert or update or delete on public.painter_private_details
  for each row execute function public.audit_private_details_change();

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['painter_businesses', 'jobs', 'job_offers', 'complaints', 'recovery_claims', 'job_site_details', 'painter_private_details']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Row Level Security
--    Reads: painters see only their own business's rows. Admin access is
--    split by role. Writes for workflow steps go through the website
--    server, which checks identity and rules first (and the triggers
--    above enforce the rules again).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'painter_businesses', 'painter_users', 'painter_private_details', 'painter_evidence', 'access_restrictions',
    'legal_documents', 'legal_document_versions', 'document_acceptances', 'jobs', 'job_site_details',
    'job_offers', 'job_offer_versions', 'job_variations', 'substitutes', 'emergency_notices', 'job_photos',
    'customer_inspections', 'customer_feedback', 'complaints', 'complaint_evidence', 'rectifications',
    'independent_assessments', 'customer_remedies', 'recovery_claims', 'appeals', 'audit_events']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Painter businesses
create policy "Painters see their own business" on public.painter_businesses for select to authenticated
  using (id = public.current_painter_business_id() or public.has_admin_role('operations', 'finance', 'compliance'));
create policy "Painters see their own login" on public.painter_users for select to authenticated
  using (user_id = auth.uid() or public.has_admin_role('operations', 'finance', 'compliance'));
-- Bank/tax: finance admins only. Painters never read them back.
create policy "Finance admins read private details" on public.painter_private_details for select to authenticated
  using (public.has_admin_role('finance'));
create policy "Painters and admins see evidence" on public.painter_evidence for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations', 'compliance'));
create policy "Painters and admins see restrictions" on public.access_restrictions for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations', 'compliance'));

-- Documents: sector-based
create policy "Documents by sector" on public.legal_documents for select to authenticated
  using (
    public.has_admin_role('operations', 'compliance', 'finance')
    or (sector in ('painter', 'public') and public.current_painter_business_id() is not null));
create policy "Public documents for visitors" on public.legal_documents for select to anon
  using (sector = 'public');
create policy "Document versions by sector" on public.legal_document_versions for select to authenticated
  using (
    public.has_admin_role('operations', 'compliance', 'finance')
    or (public.current_painter_business_id() is not null
        and status in ('draft', 'awaiting_solicitor_review', 'awaiting_accountant_review', 'awaiting_company_approval',
                       'approved_for_publication', 'published', 'superseded')
        and exists (select 1 from public.legal_documents d where d.id = document_id and d.sector in ('painter', 'public'))));
create policy "Published public versions for visitors" on public.legal_document_versions for select to anon
  using (status = 'published' and exists (select 1 from public.legal_documents d where d.id = document_id and d.sector = 'public'));
create policy "Own acceptances" on public.document_acceptances for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations', 'compliance'));

-- Jobs: painter sees jobs they were offered or agreed
create policy "Jobs visible to offered painter" on public.jobs for select to authenticated
  using (
    public.has_admin_role('operations', 'finance', 'compliance')
    or painter_business_id = public.current_painter_business_id()
    or exists (select 1 from public.job_offers o where o.job_id = jobs.id and o.painter_business_id = public.current_painter_business_id()));
-- Site address only after mutual agreement, and only for the agreed painter
create policy "Site details after agreement" on public.job_site_details for select to authenticated
  using (
    public.has_admin_role('operations')
    or exists (select 1 from public.jobs j where j.id = job_id and j.painter_business_id = public.current_painter_business_id()
               and j.status in ('agreed', 'in_progress', 'completion_submitted')));
create policy "Own offers" on public.job_offers for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations', 'finance', 'compliance'));
create policy "Own offer versions" on public.job_offer_versions for select to authenticated
  using (
    public.has_admin_role('operations', 'finance', 'compliance')
    or exists (select 1 from public.job_offers o where o.id = offer_id and o.painter_business_id = public.current_painter_business_id()));
create policy "Own variations" on public.job_variations for select to authenticated
  using (public.has_admin_role('operations', 'finance') or exists (select 1 from public.jobs j where j.id = job_id and j.painter_business_id = public.current_painter_business_id()));
create policy "Own substitutes" on public.substitutes for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations', 'compliance'));
-- Emergency info: the reporting painter, operations and owner only
create policy "Own emergency notices" on public.emergency_notices for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations'));
create policy "Own job photos" on public.job_photos for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations', 'compliance'));
create policy "Admins see inspections" on public.customer_inspections for select to authenticated
  using (public.has_admin_role('operations') or exists (select 1 from public.jobs j where j.id = job_id and j.painter_business_id = public.current_painter_business_id()));
create policy "Own feedback" on public.customer_feedback for select to authenticated
  using (public.has_admin_role('operations', 'compliance')
         or (painter_business_id = public.current_painter_business_id() and moderation_status in ('visible', 'under_review')));
create policy "Own complaints" on public.complaints for select to authenticated
  using (public.has_admin_role('operations', 'compliance') or exists (select 1 from public.jobs j where j.id = job_id and j.painter_business_id = public.current_painter_business_id()));
create policy "Own complaint evidence" on public.complaint_evidence for select to authenticated
  using (
    public.has_admin_role('operations', 'compliance')
    or (visible_to_painter and exists (
      select 1 from public.complaints c join public.jobs j on j.id = c.job_id
      where c.id = complaint_id and j.painter_business_id = public.current_painter_business_id())));
create policy "Own rectifications" on public.rectifications for select to authenticated
  using (public.has_admin_role('operations', 'compliance') or exists (
    select 1 from public.complaints c join public.jobs j on j.id = c.job_id
    where c.id = complaint_id and j.painter_business_id = public.current_painter_business_id()));
create policy "Own assessments" on public.independent_assessments for select to authenticated
  using (public.has_admin_role('operations', 'compliance') or exists (
    select 1 from public.complaints c join public.jobs j on j.id = c.job_id
    where c.id = complaint_id and j.painter_business_id = public.current_painter_business_id()));
-- Customer remedies are a company matter (customer data) – admins only
create policy "Admins see customer remedies" on public.customer_remedies for select to authenticated
  using (public.has_admin_role('operations', 'finance'));
create policy "Own recovery claims" on public.recovery_claims for select to authenticated
  using (public.has_admin_role('operations', 'finance', 'compliance')
         or (painter_business_id = public.current_painter_business_id() and status <> 'draft'));
create policy "Own appeals" on public.appeals for select to authenticated
  using (painter_business_id = public.current_painter_business_id() or public.has_admin_role('operations', 'compliance'));
create policy "Compliance admins read audit log" on public.audit_events for select to authenticated
  using (public.has_admin_role('compliance'));

-- ---------------------------------------------------------------------
-- 10. Grants (same strict pattern as 20261123122811_api_grants.sql)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'painter_businesses', 'painter_users', 'painter_private_details', 'painter_evidence', 'access_restrictions',
    'legal_documents', 'legal_document_versions', 'document_acceptances', 'jobs', 'job_site_details',
    'job_offers', 'job_offer_versions', 'job_variations', 'substitutes', 'emergency_notices', 'job_photos',
    'customer_inspections', 'customer_feedback', 'complaints', 'complaint_evidence', 'rectifications',
    'independent_assessments', 'customer_remedies', 'recovery_claims', 'appeals', 'audit_events']
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;
grant select on table public.legal_documents, public.legal_document_versions to anon;
-- audit log: server may only append and read
revoke update, delete on table public.audit_events from service_role;

revoke all on function public.has_admin_role(text[]) from public;
grant execute on function public.has_admin_role(text[]) to authenticated, service_role;
revoke all on function public.current_painter_business_id() from public;
grant execute on function public.current_painter_business_id() to authenticated, service_role;
revoke all on function public.add_working_days(timestamptz, integer) from public;
grant execute on function public.add_working_days(timestamptz, integer) to authenticated, service_role;
do $$
declare f text;
begin
  foreach f in array array['freeze_approved_document_versions', 'only_accept_approved_versions', 'guard_offer_versions',
    'check_new_offer_version', 'agree_job_on_mutual_acceptance', 'audit_events_append_only', 'audit_row_change',
    'audit_private_details_change']
  loop
    execute format('revoke all on function public.%I() from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. Private storage buckets
--   painter-documents : insurance, qualifications, substitute evidence
--   job-photos        : before/progress/after/rectification photos
--   case-evidence     : complaint, emergency and assessment evidence
--   legal-documents   : approved PDFs of legal documents
-- All PRIVATE. Uploads go through server-created one-time signed URLs;
-- viewing uses short-lived signed links created after a permission check.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('painter-documents', 'painter-documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('job-photos', 'job-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('case-evidence', 'case-evidence', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('legal-documents', 'legal-documents', false, 15728640, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
