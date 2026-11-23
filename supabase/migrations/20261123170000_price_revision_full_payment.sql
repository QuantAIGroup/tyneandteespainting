-- =====================================================================
-- PRICE REVISION, EXTRAS AND 100% PAYMENT
-- Run AFTER the earlier migrations.
--
-- No tables, columns or rows are deleted. Existing customer data is kept.
--   1. Price list: new skirting/ceiling prices, the new extras, exact totals.
--      Bedroom and living room prices are left exactly as they are.
--   2. New payment requests default to 100% of the agreed price.
--   3. Record the customer's cancellation-policy confirmation and any
--      request for work to start within the 14-day cooling-off period.
--   4. Room records can also hold counted extras (door frames, radiators…).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Price list. Merges the new prices into the saved list; any key not
--    named here (bedroom, livingRoom, standardCoats) keeps its saved value.
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
where key = 'pricing';

-- ---------------------------------------------------------------------
-- 2. New payment requests are for 100% of the agreed price.
--    (Only changes the default for future rows – no existing row changes.)
-- ---------------------------------------------------------------------
alter table public.enquiries alter column payment_type set default 'full';

-- ---------------------------------------------------------------------
-- 3. Cancellation-policy confirmation (recorded when the customer presses Pay)
-- ---------------------------------------------------------------------
alter table public.enquiries
  add column if not exists cancellation_terms_accepted_at timestamptz,
  add column if not exists early_start_requested_at timestamptz;

-- ---------------------------------------------------------------------
-- 4. Room records: allow counted extras
--    The item-type rule is replaced by a wider one that still includes every
--    existing type. coats/condition become optional because extras have none.
-- ---------------------------------------------------------------------
alter table public.quote_rooms drop constraint if exists quote_rooms_item_type_check;
alter table public.quote_rooms
  add constraint quote_rooms_item_type_check
  check (item_type in ('bedroom', 'living_room', 'skirting', 'ceiling', 'extra'));

alter table public.quote_rooms
  add column if not exists extra_kind text,
  add column if not exists quantity integer,
  add column if not exists unit_price_pence integer;

alter table public.quote_rooms alter column coats drop not null;
alter table public.quote_rooms alter column condition drop not null;

alter table public.quote_rooms
  add constraint quote_rooms_extra_kind_check check (
    extra_kind is null or extra_kind in (
      'door_frame', 'window_frame', 'radiator_standard', 'radiator_large', 'feature_wall', 'interior_door',
      'sash_window', 'decorative_radiator', 'complex_woodwork', 'wallpaper_feature_wall'
    )
  ),
  add constraint quote_rooms_quantity_check check (quantity is null or quantity between 1 and 50),
  add constraint quote_rooms_unit_price_check check (unit_price_pence is null or unit_price_pence >= 0),
  -- Extras must say what and how many; measured items must have coats and a condition
  add constraint quote_rooms_extra_shape_check check (
    (item_type = 'extra' and extra_kind is not null and quantity is not null)
    or (item_type <> 'extra' and extra_kind is null and quantity is null and coats is not null and condition is not null)
  );

-- ---------------------------------------------------------------------
-- 5. The customer's cancellation confirmation can only be written by the
--    website server, like the other payment fields.
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

-- Keep the trigger function private (as set in the api_grants migration)
revoke all on function public.protect_payment_fields() from public, anon, authenticated;
