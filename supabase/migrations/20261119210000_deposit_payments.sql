-- =====================================================================
-- 50% BOOKING DEPOSIT SYSTEM
-- Run this AFTER the initial schema: Supabase → SQL Editor → paste → Run.
--
-- Rules enforced by the database itself (not just the website):
--   * A deposit can only be requested after a final price has been agreed
--     and you have confirmed you spoke to the customer.
--   * Deposit = 50% of the agreed price, stored in whole pence.
--   * A booking can never be marked "deposit paid", "booking confirmed",
--     "work completed" or "balance paid" unless a verified deposit exists.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Replace the old enquiry statuses with the booking statuses
-- ---------------------------------------------------------------------
alter table public.enquiries drop constraint if exists enquiries_status_check;

update public.enquiries set status = case status
  when 'new' then 'awaiting_consultation'
  when 'contacted' then 'awaiting_consultation'
  when 'quote_sent' then 'awaiting_consultation'
  when 'accepted' then 'awaiting_consultation'
  when 'scheduled' then 'awaiting_consultation'
  when 'completed' then 'awaiting_consultation'
  else status
end;

alter table public.enquiries alter column status set default 'awaiting_consultation';

-- ---------------------------------------------------------------------
-- 2. Agreed price, deposit and payment tracking
-- ---------------------------------------------------------------------
alter table public.enquiries
  add column if not exists agreed_service text,
  add column if not exists agreed_price_pence integer,
  add column if not exists deposit_pence integer,
  add column if not exists price_agreed_at timestamptz,
  add column if not exists consultation_confirmed_at timestamptz,
  -- Secret token used in the customer's payment link (/pay/<token>)
  add column if not exists payment_token text unique,
  add column if not exists deposit_requested_at timestamptz,
  add column if not exists payment_link_last_sent_at timestamptz,
  add column if not exists payment_link_send_count integer not null default 0,
  add column if not exists stripe_checkout_session_id text,
  -- Filled in ONLY by the verified Stripe webhook
  add column if not exists deposit_paid_pence integer,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists stripe_payment_intent_id text unique,
  add column if not exists booking_confirmed_at timestamptz,
  -- Remaining balance is collected separately (cash, bank transfer, etc.)
  add column if not exists balance_paid_pence integer,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists balance_payment_note text;

alter table public.enquiries
  add constraint enquiries_status_check check (status in (
    'awaiting_consultation', 'price_agreed', 'deposit_requested', 'deposit_paid',
    'booking_confirmed', 'work_completed', 'balance_paid', 'declined', 'cancelled'
  )),
  add constraint enquiries_price_positive check (agreed_price_pence is null or agreed_price_pence > 0),
  -- Deposit is always exactly half the agreed price (odd penny rounded up)
  add constraint enquiries_deposit_is_half check (
    (agreed_price_pence is null and deposit_pence is null)
    or (agreed_price_pence is not null and deposit_pence = (agreed_price_pence + 1) / 2)
  ),
  -- Price can only be agreed after speaking to the customer
  add constraint enquiries_price_needs_consultation check (agreed_price_pence is null or consultation_confirmed_at is not null),
  -- A deposit can only be requested once a price is agreed
  add constraint enquiries_request_needs_price check (status <> 'deposit_requested' or (agreed_price_pence is not null and payment_token is not null)),
  -- Never "paid/confirmed/completed" without a verified deposit
  add constraint enquiries_paid_needs_deposit check (
    status not in ('deposit_paid', 'booking_confirmed', 'work_completed', 'balance_paid')
    or (deposit_paid_at is not null and stripe_payment_intent_id is not null)
  ),
  add constraint enquiries_balance_needs_deposit check (balance_paid_at is null or deposit_paid_at is not null);

create index if not exists enquiries_payment_token_idx on public.enquiries (payment_token);

-- ---------------------------------------------------------------------
-- 3. Payment log (every Stripe payment received, including duplicates)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.enquiries (id) on delete set null,  -- null if the payment couldn't be matched to an enquiry
  kind text not null default 'deposit' check (kind in ('deposit')),
  outcome text not null check (outcome in ('deposit_recorded', 'duplicate_refunded', 'duplicate_refund_failed', 'needs_review')),
  amount_pence integer not null,
  currency text not null,
  stripe_checkout_session_id text not null,
  stripe_payment_intent_id text not null unique,
  stripe_event_id text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;
create policy "Admins can read payments" on public.payments for select to authenticated using (public.is_admin());

-- Webhook events already processed (Stripe can send the same event more than once)
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- No policies: only the server (secret key) uses this table.

-- ---------------------------------------------------------------------
-- 4. Stop admins from writing payment fields directly.
--    Deposit fields can only be changed by the server's secret key
--    (used by the verified Stripe webhook), never from a browser login.
-- ---------------------------------------------------------------------
create or replace function public.protect_payment_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.deposit_paid_pence is distinct from old.deposit_paid_pence
       or new.deposit_paid_at is distinct from old.deposit_paid_at
       or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
       or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
       or new.payment_token is distinct from old.payment_token
       or new.agreed_price_pence is distinct from old.agreed_price_pence
       or new.deposit_pence is distinct from old.deposit_pence then
      raise exception 'Payment fields can only be changed by the website server';
    end if;
  end if;
  -- Once a deposit is paid, the agreed price and deposit are locked forever
  if old.deposit_paid_at is not null and (
       new.agreed_price_pence is distinct from old.agreed_price_pence
       or new.deposit_pence is distinct from old.deposit_pence
       or new.deposit_paid_at is distinct from old.deposit_paid_at) then
    raise exception 'The agreed price and deposit cannot change after the deposit is paid';
  end if;
  return new;
end;
$$;

drop trigger if exists enquiries_protect_payment on public.enquiries;
create trigger enquiries_protect_payment before update on public.enquiries
  for each row execute function public.protect_payment_fields();
