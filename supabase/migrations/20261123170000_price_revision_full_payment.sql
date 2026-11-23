-- =====================================================================
-- PRICE REVISION, EXTRAS AND 100% PAYMENT  (revision 3, after safety review)
-- Run AFTER the earlier migrations.
--
-- ALL-OR-NOTHING: the whole migration is ONE statement (a single DO block),
-- so PostgreSQL applies every change or none of them – whether or not the
-- tool running it wraps it in a transaction. If any check or step fails,
-- nothing at all is changed.
--
-- SAFE TO RE-RUN: every step checks the current state first, and prices you
-- have changed since (e.g. in the admin area) are never overwritten.
--
-- No tables, columns or rows are deleted.
--
--   0. Pre-flight checks – stop before changing anything if any existing
--      record or price setting would break the new rules.
--   1. Prices: update ONLY prices still at their original launch values; add
--      any missing extras. Bedroom, living room and coats are never touched.
--   2. Payments: 100% of the agreed price only, enforced by the database.
--   3. Record the customer's cancellation-policy confirmation.
--   4. Room records: counted extras, with strict NULL-proof rules.
--   5. Protect the cancellation confirmation like the payment fields.
--
-- Every CHECK rule below is written so that it can never evaluate to NULL
-- (in PostgreSQL a NULL check result counts as a pass), using IS NULL,
-- IS NOT NULL, IS TRUE/IS FALSE and IS [NOT] DISTINCT FROM.
-- =====================================================================

do $migration$
declare
  -- ----- The new rules, written once and used for BOTH the pre-flight checks and the constraints
  enquiry_full_type_rule constant text :=
    $r$payment_type is not distinct from 'full'$r$;

  enquiry_full_amount_rule constant text :=
    $r$(agreed_price_pence is null and deposit_pence is null and deposit_percent is null)
       or (agreed_price_pence is not null and agreed_price_pence > 0
           and deposit_pence is not null and deposit_pence = agreed_price_pence
           and deposit_percent is null)$r$;

  enquiry_paid_in_full_rule constant text :=
    $r$(deposit_paid_at is null and deposit_paid_pence is null)
       or (deposit_paid_at is not null and deposit_paid_pence is not null
           and agreed_price_pence is not null and deposit_paid_pence = agreed_price_pence)$r$;

  room_shape_rule constant text :=
    $r$(
         item_type is not null
         and item_type in ('bedroom', 'living_room', 'skirting', 'ceiling')
         and extra_kind is null and quantity is null and unit_price_pence is null
         and coats is not null and condition is not null
       )
       or (
         item_type is not distinct from 'extra'
         and extra_kind is not null
         and extra_kind in ('door_frame', 'window_frame', 'radiator_standard', 'radiator_large', 'feature_wall', 'interior_door')
         and quantity is not null and quantity between 1 and 50
         and unit_price_pence is not null and unit_price_pence >= 0
         and estimated_labour_pence is not null
         and estimated_labour_pence = quantity * unit_price_pence
         and requires_manual_quote is false
       )
       or (
         item_type is not distinct from 'extra'
         and extra_kind is not null
         and extra_kind in ('sash_window', 'decorative_radiator', 'complex_woodwork', 'wallpaper_feature_wall')
         and quantity is not null and quantity between 1 and 50
         and unit_price_pence is null
         and estimated_labour_pence is null
         and requires_manual_quote is true
       )$r$;

  -- ----- Prices
  launch_skirting constant jsonb := '{"ratePerMetre": 5, "minimumCharge": 65}';
  launch_ceiling  constant jsonb := '{"ratePerSqm": 5.5, "minimumCharge": 65}';
  launch_rounding constant jsonb := '5';
  new_skirting    constant jsonb := '{"ratePerMetre": 5.5, "minimumCharge": 0}';
  new_ceiling     constant jsonb := '{"ratePerSqm": 6, "minimumCharge": 55}';
  new_rounding    constant jsonb := '0';
  new_extras      constant jsonb := '{"door_frame": 30, "window_frame": 30, "radiator_standard": 30, "radiator_large": 45, "feature_wall": 55, "interior_door": 65}';

  price jsonb;
  new_price jsonb;
  merged_extras jsonb;
  updated text[] := '{}';
  kept text[] := array['bedroom', 'livingRoom', 'standardCoats'];
  n bigint;
  k text;
begin
  -- ===================================================================
  -- 0. PRE-FLIGHT CHECKS (nothing has been changed yet)
  -- ===================================================================

  -- 0a. The price list exists and has every field the website needs.
  --     (CASE is used so a non-number can never cause a confusing cast error.)
  select value into price from public.settings where key = 'pricing' for update;
  if price is null then
    raise exception 'Stopped: the pricing settings record is missing. Nothing was changed.';
  end if;
  if jsonb_typeof(price) is distinct from 'object' then
    raise exception 'Stopped: the pricing settings record is not a JSON object. Nothing was changed.';
  end if;
  foreach k in array array['bedroom', 'livingRoom'] loop
    if not (case when jsonb_typeof(price -> k -> 'ratePerSqm') = 'number' then (price -> k ->> 'ratePerSqm')::numeric >= 0 else false end)
       or not (case when jsonb_typeof(price -> k -> 'minimumCharge') = 'number' then (price -> k ->> 'minimumCharge')::numeric >= 0 else false end) then
      raise exception 'Stopped: the % price (ratePerSqm/minimumCharge) is missing or invalid. Nothing was changed.', k;
    end if;
  end loop;
  if not (case when jsonb_typeof(price -> 'standardCoats') = 'number' then (price ->> 'standardCoats')::numeric between 1 and 5 else false end) then
    raise exception 'Stopped: standardCoats is missing or invalid. Nothing was changed.';
  end if;
  -- Optional fields must be valid if present
  if price -> 'skirting' is not null
     and not (jsonb_typeof(price -> 'skirting' -> 'ratePerMetre') = 'number' and jsonb_typeof(price -> 'skirting' -> 'minimumCharge') = 'number') then
    raise exception 'Stopped: the saved skirting price is invalid. Nothing was changed.';
  end if;
  if price -> 'ceiling' is not null
     and not (jsonb_typeof(price -> 'ceiling' -> 'ratePerSqm') = 'number' and jsonb_typeof(price -> 'ceiling' -> 'minimumCharge') = 'number') then
    raise exception 'Stopped: the saved ceiling price is invalid. Nothing was changed.';
  end if;
  if price -> 'roundToNearest' is not null and jsonb_typeof(price -> 'roundToNearest') is distinct from 'number' then
    raise exception 'Stopped: the saved rounding setting is invalid. Nothing was changed.';
  end if;
  if price -> 'extras' is not null then
    if jsonb_typeof(price -> 'extras') is distinct from 'object' then
      raise exception 'Stopped: the saved extras prices are invalid. Nothing was changed.';
    end if;
    select count(*) into n from jsonb_each(price -> 'extras') e
    where not (case when jsonb_typeof(e.value) = 'number' then (e.value #>> '{}')::numeric >= 0 else false end)
       or e.key not in ('door_frame', 'window_frame', 'radiator_standard', 'radiator_large', 'feature_wall', 'interior_door');
    if n > 0 then
      raise exception 'Stopped: % saved extras prices are invalid. Nothing was changed.', n;
    end if;
  end if;

  -- 0b. Existing enquiries already satisfy the 100% payment rules
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_full_type_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries have a payment type other than full. Review them first. Nothing was changed.', n;
  end if;
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_full_amount_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries have a payment amount that is not exactly 100%% of the agreed price. Nothing was changed.', n;
  end if;
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_paid_in_full_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries have a recorded payment that is not the full agreed price. Nothing was changed.', n;
  end if;

  -- 0c. Existing room records (checked again with the full rule in step 4)
  select count(*) into n from public.quote_rooms
  where item_type is null
     or item_type not in ('bedroom', 'living_room', 'skirting', 'ceiling', 'extra')
     or (item_type is distinct from 'extra' and (coats is null or condition is null));
  if n > 0 then
    raise exception 'Stopped: % room records are invalid. Nothing was changed.', n;
  end if;

  -- ===================================================================
  -- 1. PRICES – only prices still at their launch values are updated;
  --    any price changed since (in the admin area) is kept.
  -- ===================================================================
  new_price := price;

  if price -> 'skirting' is null or price -> 'skirting' = launch_skirting then
    new_price := new_price || jsonb_build_object('skirting', new_skirting);
    if price -> 'skirting' is distinct from new_skirting then updated := updated || 'skirting'::text; end if;
  else
    kept := kept || 'skirting'::text;
  end if;

  if price -> 'ceiling' is null or price -> 'ceiling' = launch_ceiling then
    new_price := new_price || jsonb_build_object('ceiling', new_ceiling);
    if price -> 'ceiling' is distinct from new_ceiling then updated := updated || 'ceiling'::text; end if;
  else
    kept := kept || 'ceiling'::text;
  end if;

  if price -> 'roundToNearest' is null or price -> 'roundToNearest' = launch_rounding then
    new_price := new_price || jsonb_build_object('roundToNearest', new_rounding);
    if price -> 'roundToNearest' is distinct from new_rounding then updated := updated || 'roundToNearest'::text; end if;
  else
    kept := kept || 'roundToNearest'::text;
  end if;

  -- Extras: add any that are missing; saved extras prices always win
  merged_extras := new_extras || coalesce(price -> 'extras', '{}'::jsonb);
  if merged_extras is distinct from price -> 'extras' then
    new_price := new_price || jsonb_build_object('extras', merged_extras);
    updated := updated || 'extras (added missing)'::text;
  end if;

  if new_price is distinct from price then
    update public.settings set value = new_price where key = 'pricing';
  end if;
  raise notice 'Prices updated: %', coalesce(nullif(array_to_string(updated, ', '), ''), 'none');
  raise notice 'Prices kept as saved: %', array_to_string(kept, ', ');

  -- ===================================================================
  -- 2. PAYMENTS – 100% of the agreed price only
  -- ===================================================================
  alter table public.enquiries alter column payment_type set default 'full';

  -- Our own rules are (re)created so their definitions are always exactly these
  alter table public.enquiries drop constraint if exists enquiries_full_payment_only;
  execute format('alter table public.enquiries add constraint enquiries_full_payment_only check (%s)', enquiry_full_type_rule);

  alter table public.enquiries drop constraint if exists enquiries_full_payment_amount;
  execute format('alter table public.enquiries add constraint enquiries_full_payment_amount check (%s)', enquiry_full_amount_rule);

  alter table public.enquiries drop constraint if exists enquiries_paid_in_full;
  execute format('alter table public.enquiries add constraint enquiries_paid_in_full check (%s)', enquiry_paid_in_full_rule);

  -- ===================================================================
  -- 3. CANCELLATION-POLICY CONFIRMATION
  -- ===================================================================
  alter table public.enquiries add column if not exists cancellation_terms_accepted_at timestamptz;
  alter table public.enquiries add column if not exists early_start_requested_at timestamptz;

  -- ===================================================================
  -- 4. ROOM RECORDS – counted extras
  -- ===================================================================
  alter table public.quote_rooms add column if not exists extra_kind text;
  alter table public.quote_rooms add column if not exists quantity integer;
  alter table public.quote_rooms add column if not exists unit_price_pence integer;

  -- Full pre-flight check of existing room records against the new rule
  execute format('select count(*) from public.quote_rooms where (%s) is not true', room_shape_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % room records would break the new rules. Nothing was changed.', n;
  end if;

  -- Widen the item-type rule (all existing types still allowed, NULL never allowed)
  alter table public.quote_rooms drop constraint if exists quote_rooms_item_type_check;
  alter table public.quote_rooms add constraint quote_rooms_item_type_check
    check (item_type is not null and item_type in ('bedroom', 'living_room', 'skirting', 'ceiling', 'extra'));

  -- Extras have no coats/condition (measured rooms still must – enforced by the shape rule)
  alter table public.quote_rooms alter column coats drop not null;
  alter table public.quote_rooms alter column condition drop not null;

  alter table public.quote_rooms drop constraint if exists quote_rooms_extra_shape_check;
  execute format('alter table public.quote_rooms add constraint quote_rooms_extra_shape_check check (%s)', room_shape_rule);

  -- ===================================================================
  -- 5. PROTECT THE CANCELLATION CONFIRMATION
  --    Same security properties as the existing function: SECURITY INVOKER,
  --    search_path = '', owner postgres, executable only by its owner.
  --    CREATE OR REPLACE keeps the existing owner, permissions and trigger.
  -- ===================================================================
  create or replace function public.protect_payment_fields()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
  as $fn$
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
  $fn$;

  -- Keep the trigger function private (no change from the current permissions)
  revoke all on function public.protect_payment_fields() from public, anon, authenticated;
end
$migration$;
