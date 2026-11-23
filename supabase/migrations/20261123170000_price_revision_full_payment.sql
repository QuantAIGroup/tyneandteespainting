-- =====================================================================
-- PRICE REVISION, EXTRAS AND 100% PAYMENT  (revised after safety review)
-- Run AFTER the earlier migrations.
--
-- Safe to run more than once: every step checks before it changes anything.
-- No tables, columns or rows are deleted. Existing customer data is kept.
--   0. Pre-flight checks – stop before changing anything if a rule would be broken.
--   1. Price list: new skirting/ceiling prices, the new extras, exact totals.
--      Bedroom, living room and coats settings are left exactly as they are.
--   2. New payment requests default to 100% of the agreed price, and the
--      database refuses any agreed price whose payment isn't 100% of it.
--   3. Record the customer's cancellation-policy confirmation and any
--      request for work to start within the 14-day cooling-off period.
--   4. Room records can also hold counted extras, with strict rules.
--   5. The cancellation confirmation is protected like the payment fields.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. PRE-FLIGHT CHECKS (read-only). If any fails, the migration stops
--    with a clear message and NOTHING is changed.
-- ---------------------------------------------------------------------
do $$
declare n integer;
begin
  if not exists (select 1 from public.settings where key = 'pricing') then
    raise exception 'Stopped: the pricing settings record is missing. Nothing was changed.';
  end if;

  select count(*) into n from public.enquiries
  where agreed_price_pence is not null
    and (payment_type <> 'full' or deposit_pence is distinct from agreed_price_pence);
  if n > 0 then
    raise exception 'Stopped: % enquiries have a payment request that is not 100%% of the agreed price. Review them first. Nothing was changed.', n;
  end if;

  select count(*) into n from public.quote_rooms
  where item_type not in ('bedroom', 'living_room', 'skirting', 'ceiling', 'extra')
     or (item_type <> 'extra' and (coats is null or condition is null));
  if n > 0 then
    raise exception 'Stopped: % room records would break the new rules. Nothing was changed.', n;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Price list. Merges the new prices into the saved list; keys not named
--    here (bedroom, livingRoom, standardCoats) keep their saved values.
--    Only applied once: if the list already has "extras" (this migration ran
--    before, or prices were saved in the new admin screen), it is left alone
--    so later price changes are never overwritten.
-- ---------------------------------------------------------------------
update public.settings
set value = value || jsonb_build_object(
  'skirting', jsonb_build_object('ratePerMetre', 5.5, 'minimumCharge', 0),
  'ceiling',  jsonb_build_object('ratePerSqm', 6, 'minimumCharge', 55),
  'extras',   jsonb_build_object(
    'door_frame', 30,
    'window_frame', 30,
    'radiator_standard', 30,
    'radiator_large', 45,
    'feature_wall', 55,
    'interior_door', 65
  ),
  'roundToNearest', 0
)
where key = 'pricing'
  and value -> 'extras' is null;

-- ---------------------------------------------------------------------
-- 2. 100% payment of the agreed price
-- ---------------------------------------------------------------------
-- New rows default to full payment (no existing row changes)
alter table public.enquiries alter column payment_type set default 'full';

-- Once a price is agreed, the amount requested must be exactly 100% of it
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.enquiries'::regclass and conname = 'enquiries_full_payment_only') then
    alter table public.enquiries
      add constraint enquiries_full_payment_only
      check (agreed_price_pence is null or (payment_type = 'full' and deposit_pence = agreed_price_pence));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Cancellation-policy confirmation (recorded when the customer presses Pay)
-- ---------------------------------------------------------------------
alter table public.enquiries
  add column if not exists cancellation_terms_accepted_at timestamptz,
  add column if not exists early_start_requested_at timestamptz;

-- ---------------------------------------------------------------------
-- 4. Room records: counted extras
-- ---------------------------------------------------------------------
-- Widen the item-type rule to include 'extra' (all existing types still allowed)
alter table public.quote_rooms drop constraint if exists quote_rooms_item_type_check;
alter table public.quote_rooms
  add constraint quote_rooms_item_type_check
  check (item_type in ('bedroom', 'living_room', 'skirting', 'ceiling', 'extra'));

alter table public.quote_rooms
  add column if not exists extra_kind text,
  add column if not exists quantity integer,
  add column if not exists unit_price_pence integer;

-- Extras have no coats or condition (measured rooms still must – see below)
alter table public.quote_rooms alter column coats drop not null;
alter table public.quote_rooms alter column condition drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.quote_rooms'::regclass and conname = 'quote_rooms_extra_kind_check') then
    alter table public.quote_rooms add constraint quote_rooms_extra_kind_check check (
      extra_kind is null or extra_kind in (
        'door_frame', 'window_frame', 'radiator_standard', 'radiator_large', 'feature_wall', 'interior_door',
        'sash_window', 'decorative_radiator', 'complex_woodwork', 'wallpaper_feature_wall'
      )
    );
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.quote_rooms'::regclass and conname = 'quote_rooms_quantity_check') then
    alter table public.quote_rooms add constraint quote_rooms_quantity_check check (quantity is null or quantity between 1 and 50);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.quote_rooms'::regclass and conname = 'quote_rooms_unit_price_check') then
    alter table public.quote_rooms add constraint quote_rooms_unit_price_check check (unit_price_pence is null or unit_price_pence >= 0);
  end if;

  -- The shape of every row:
  --  * measured rooms/services: coats + condition, and no extra fields
  --  * fixed-price extras: kind, quantity and unit price, and the estimate
  --    must be exactly quantity × unit price
  --  * inspection extras: kind and quantity, no price, marked for a manual quote
  if not exists (select 1 from pg_constraint where conrelid = 'public.quote_rooms'::regclass and conname = 'quote_rooms_extra_shape_check') then
    alter table public.quote_rooms add constraint quote_rooms_extra_shape_check check (
      (
        item_type <> 'extra'
        and extra_kind is null and quantity is null and unit_price_pence is null
        and coats is not null and condition is not null
      )
      or (
        item_type = 'extra' and extra_kind is not null and quantity is not null
        and (
          (
            extra_kind in ('door_frame', 'window_frame', 'radiator_standard', 'radiator_large', 'feature_wall', 'interior_door')
            and unit_price_pence is not null
            and estimated_labour_pence = quantity * unit_price_pence
            and requires_manual_quote = false
          )
          or (
            extra_kind in ('sash_window', 'decorative_radiator', 'complex_woodwork', 'wallpaper_feature_wall')
            and unit_price_pence is null
            and estimated_labour_pence is null
            and requires_manual_quote = true
          )
        )
      )
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Protect the cancellation confirmation like the payment fields.
--    Same security properties as the existing function: SECURITY INVOKER,
--    search_path = '', owner postgres, executable only by its owner.
--    (CREATE OR REPLACE keeps the existing owner and permissions.)
-- ---------------------------------------------------------------------
create or replace function public.protect_payment_fields()
returns trigger
language plpgsql
security invoker
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
       or new.deposit_percent is distinct from old.deposit_percent
       or new.cancellation_terms_accepted_at is distinct from old.cancellation_terms_accepted_at
       or new.early_start_requested_at is distinct from old.early_start_requested_at then
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

-- Keep the trigger function private (no change from the current permissions)
revoke all on function public.protect_payment_fields() from public, anon, authenticated;
