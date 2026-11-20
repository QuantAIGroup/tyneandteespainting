-- =====================================================================
-- PAYMENT OPTIONS (deposit %, full payment or custom amount) + redesign
-- Run AFTER the two earlier migrations: Supabase → SQL Editor → paste → Run.
-- =====================================================================

-- 1. Payment settings (default deposit %) editable in /admin/settings
alter table public.settings drop constraint if exists settings_key_check;
alter table public.settings add constraint settings_key_check check (key in ('pricing', 'business', 'payments'));
insert into public.settings (key, value) values ('payments', '{"defaultDepositPercent": 50}'::jsonb)
on conflict (key) do nothing;

-- 2. Contact form now asks which service is required
alter table public.contact_messages add column if not exists service text;

-- 3. Payment request type for each booking
alter table public.enquiries
  add column if not exists payment_type text not null default 'deposit',
  add column if not exists deposit_percent integer,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_receipt_url text;

-- Existing requests were all 50% deposits
update public.enquiries set deposit_percent = 50 where agreed_price_pence is not null and deposit_percent is null;

alter table public.enquiries drop constraint if exists enquiries_deposit_is_half;
alter table public.enquiries drop constraint if exists enquiries_payment_type_check;
alter table public.enquiries drop constraint if exists enquiries_payment_amount_valid;

alter table public.enquiries
  add constraint enquiries_payment_type_check check (payment_type in ('deposit', 'full', 'custom')),
  -- "deposit_pence" is the amount requested from the customer now
  add constraint enquiries_payment_amount_valid check (
    (agreed_price_pence is null and deposit_pence is null)
    or (
      agreed_price_pence is not null
      and deposit_pence between 1 and agreed_price_pence
      and (payment_type <> 'full' or deposit_pence = agreed_price_pence)
      and (payment_type <> 'deposit' or (
        deposit_percent between 1 and 100
        and deposit_pence = (agreed_price_pence * deposit_percent + 99) / 100
      ))
    )
  );

-- 4. Payment log can now hold deposits, full payments and custom amounts
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('deposit', 'full', 'custom'));

-- 5. Payment type and percentage are protected like the other payment fields
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
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_receipt_url is distinct from old.stripe_receipt_url
       or new.payment_token is distinct from old.payment_token
       or new.agreed_price_pence is distinct from old.agreed_price_pence
       or new.deposit_pence is distinct from old.deposit_pence
       or new.payment_type is distinct from old.payment_type
       or new.deposit_percent is distinct from old.deposit_percent then
      raise exception 'Payment fields can only be changed by the website server';
    end if;
  end if;
  -- Once a payment has been received, the agreed price and amount are locked
  if old.deposit_paid_at is not null and (
       new.agreed_price_pence is distinct from old.agreed_price_pence
       or new.deposit_pence is distinct from old.deposit_pence
       or new.payment_type is distinct from old.payment_type
       or new.deposit_paid_at is distinct from old.deposit_paid_at) then
    raise exception 'The agreed price and payment cannot change after payment is received';
  end if;
  return new;
end;
$$;
