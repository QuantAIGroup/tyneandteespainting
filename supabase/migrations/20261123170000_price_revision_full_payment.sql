-- =====================================================================
-- PRICE REVISION, EXTRAS AND 100% PAYMENT  (revision 4, after safety review)
-- Run AFTER the earlier migrations.
--
-- ALL-OR-NOTHING: the whole migration is ONE statement (a single DO block),
-- so PostgreSQL applies every change or none of them – whether or not the
-- tool running it wraps it in a transaction. If any check or step fails,
-- nothing at all is changed.
--
-- SAFE TO RE-RUN: every step checks the current state first; prices changed
-- since (e.g. in the admin area) are never overwritten.
--
-- No tables, columns or rows are deleted.
--
-- Every CHECK rule is written so it can never evaluate to NULL (in PostgreSQL
-- a NULL check result counts as a pass): only IS NULL, IS NOT NULL,
-- IS TRUE/IS FALSE and IS [NOT] DISTINCT FROM, on values already proven present.
--
-- Money limits (all in pence):
--   agreed price        1 .. 5,000,000      (£50,000, same as the admin screen)
--   extra unit price    0 .. 1,000,000      (£10,000 per item)
--   room/extra estimate 0 .. 100,000,000    (£1,000,000 per line)
--   quantity × unit price is calculated in BIGINT, so it can never overflow.
-- =====================================================================

do $migration$
declare
  -- ----- The rules, written once and used for BOTH the pre-flight checks and the constraints
  enquiry_full_type_rule constant text :=
    $r$payment_type is not distinct from 'full'$r$;

  enquiry_full_amount_rule constant text :=
    $r$(agreed_price_pence is null and deposit_pence is null and deposit_percent is null)
       or (agreed_price_pence is not null and agreed_price_pence between 1 and 5000000
           and deposit_pence is not null and deposit_pence = agreed_price_pence
           and deposit_percent is null)$r$;

  enquiry_paid_in_full_rule constant text :=
    $r$(deposit_paid_at is null and deposit_paid_pence is null)
       or (deposit_paid_at is not null and deposit_paid_pence is not null
           and agreed_price_pence is not null and deposit_paid_pence = agreed_price_pence)$r$;

  enquiry_payment_consent_rule constant text :=
    $r$deposit_paid_at is null or cancellation_terms_accepted_at is not null$r$;

  enquiry_early_start_rule constant text :=
    $r$early_start_requested_at is null or cancellation_terms_accepted_at is not null$r$;

  room_shape_rule constant text :=
    $r$(
         -- Measured room or service: coats + condition, no extra-only fields
         item_type is not null
         and item_type in ('bedroom', 'living_room', 'skirting', 'ceiling')
         and extra_kind is null and quantity is null and unit_price_pence is null
         and coats is not null and coats between 1 and 5
         and condition is not null
         and (estimated_labour_pence is null or estimated_labour_pence between 0 and 100000000)
       )
       or (
         -- Fixed-price extra: kind, quantity, unit price and exact total; no measurement fields
         item_type is not distinct from 'extra'
         and extra_kind is not null
         and extra_kind in ('door_frame', 'window_frame', 'radiator_standard', 'radiator_large', 'feature_wall', 'interior_door')
         and quantity is not null and quantity between 1 and 50
         and unit_price_pence is not null and unit_price_pence between 0 and 1000000
         and estimated_labour_pence is not null and estimated_labour_pence between 0 and 100000000
         and estimated_labour_pence::bigint = quantity::bigint * unit_price_pence::bigint
         and requires_manual_quote is false
         and coats is null and condition is null
         and measurement_mode is null and length_m is null and width_m is null and height_m is null
         and walls is null and skirting_length_m is null and wall_area_sqm is null and ceiling_area_sqm is null
         and include_ceiling is false
       )
       or (
         -- Inspection-only extra: kind and quantity, no price, manual quote; no measurement fields
         item_type is not distinct from 'extra'
         and extra_kind is not null
         and extra_kind in ('sash_window', 'decorative_radiator', 'complex_woodwork', 'wallpaper_feature_wall')
         and quantity is not null and quantity between 1 and 50
         and unit_price_pence is null
         and estimated_labour_pence is null
         and requires_manual_quote is true
         and coats is null and condition is null
         and measurement_mode is null and length_m is null and width_m is null and height_m is null
         and walls is null and skirting_length_m is null and wall_area_sqm is null and ceiling_area_sqm is null
         and include_ceiling is false
       )$r$;

  -- ----- Prices
  launch_skirting constant jsonb := '{"ratePerMetre": 5, "minimumCharge": 65}';
  launch_ceiling  constant jsonb := '{"ratePerSqm": 5.5, "minimumCharge": 65}';
  launch_rounding constant jsonb := '5';
  new_skirting    constant jsonb := '{"ratePerMetre": 5.5, "minimumCharge": 0}';
  new_ceiling     constant jsonb := '{"ratePerSqm": 6, "minimumCharge": 55}';
  new_rounding    constant jsonb := '0';
  new_extras      constant jsonb := '{"door_frame": 30, "window_frame": 30, "radiator_standard": 30, "radiator_large": 45, "feature_wall": 55, "interior_door": 65}';
  -- name : required fields : required|optional   (rates and minimums: numbers from 0 to 100,000 pounds)
  price_groups    constant text[] := array[
    'bedroom:ratePerSqm,minimumCharge:required',
    'livingRoom:ratePerSqm,minimumCharge:required',
    'skirting:ratePerMetre,minimumCharge:optional',
    'ceiling:ratePerSqm,minimumCharge:optional'
  ];

  price jsonb;
  new_price jsonb;
  merged_extras jsonb;
  updated text[] := '{}';
  kept text[] := array['bedroom', 'livingRoom', 'standardCoats'];
  n bigint;
  k text;
  f text;
  grp text;
  fields text[];
begin
  -- ===================================================================
  -- 0. PRE-FLIGHT CHECKS (nothing has been changed yet)
  -- ===================================================================

  -- 0a. Price list: exists, is an object, every group well-formed.
  --     (CASE guards every cast, so bad data gives a clear message, never a cast error.)
  select value into price from public.settings where key = 'pricing' for update;
  if price is null then
    raise exception 'Stopped: the pricing settings record is missing. Nothing was changed.';
  end if;
  if jsonb_typeof(price) is distinct from 'object' then
    raise exception 'Stopped: the pricing settings record is not a JSON object. Nothing was changed.';
  end if;

  foreach grp in array price_groups loop
    k := split_part(grp, ':', 1);
    fields := string_to_array(split_part(grp, ':', 2), ',');
    continue when split_part(grp, ':', 3) = 'optional' and price -> k is null;
    if jsonb_typeof(price -> k) is distinct from 'object' then
      raise exception 'Stopped: the saved % price is missing or not a valid object. Nothing was changed.', k;
    end if;
    select count(*) into n from jsonb_object_keys(price -> k) j where j <> all (fields);
    if n > 0 then
      raise exception 'Stopped: the saved % price has unexpected fields. Nothing was changed.', k;
    end if;
    foreach f in array fields loop
      if not (case when jsonb_typeof(price -> k -> f) = 'number' then (price -> k ->> f)::numeric between 0 and 100000 else false end) then
        raise exception 'Stopped: the saved % % is missing, negative, too large or not a number. Nothing was changed.', k, f;
      end if;
    end loop;
  end loop;

  if not (case when jsonb_typeof(price -> 'standardCoats') = 'number' then (price ->> 'standardCoats')::numeric in (1, 2, 3, 4, 5) else false end) then
    raise exception 'Stopped: standardCoats is missing or invalid (must be a whole number from 1 to 5). Nothing was changed.';
  end if;
  if price -> 'roundToNearest' is not null
     and not (case when jsonb_typeof(price -> 'roundToNearest') = 'number' then (price ->> 'roundToNearest')::numeric between 0 and 100 else false end) then
    raise exception 'Stopped: the saved rounding setting is invalid. Nothing was changed.';
  end if;
  if price -> 'extras' is not null then
    if jsonb_typeof(price -> 'extras') is distinct from 'object' then
      raise exception 'Stopped: the saved extras prices are not a valid object. Nothing was changed.';
    end if;
    select count(*) into n from jsonb_each(price -> 'extras') e
    where not (case when jsonb_typeof(e.value) = 'number' then (e.value #>> '{}')::numeric between 0 and 10000 else false end)
       or e.key not in ('door_frame', 'window_frame', 'radiator_standard', 'radiator_large', 'feature_wall', 'interior_door');
    if n > 0 then
      raise exception 'Stopped: % saved extras prices are invalid (unknown, negative, over £10,000 or not a number). Nothing was changed.', n;
    end if;
  end if;

  -- 0b. Existing enquiries satisfy the 100% payment rules
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_full_type_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries have a payment type other than full. Review them first. Nothing was changed.', n;
  end if;
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_full_amount_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries have a payment amount that is not exactly 100%% of a valid agreed price. Nothing was changed.', n;
  end if;
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_paid_in_full_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries have a recorded payment that is not the full agreed price. Nothing was changed.', n;
  end if;

  -- 0c. Existing room records: basic check (full shape check in step 4)
  select count(*) into n from public.quote_rooms
  where item_type is null
     or item_type not in ('bedroom', 'living_room', 'skirting', 'ceiling', 'extra')
     or (item_type is distinct from 'extra' and (coats is null or condition is null));
  if n > 0 then
    raise exception 'Stopped: % room records are invalid. Nothing was changed.', n;
  end if;

  -- ===================================================================
  -- 1. PRICES – only prices still at their launch values are updated;
  --    any valid price changed since (in the admin area) is kept.
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
  -- 2. NEW COLUMNS (all empty; nothing existing changes)
  -- ===================================================================
  alter table public.enquiries add column if not exists cancellation_terms_accepted_at timestamptz;  -- customer confirmed the cancellation policy
  alter table public.enquiries add column if not exists early_start_requested_at timestamptz;        -- customer separately asked for work to start within 14 days
  alter table public.quote_rooms add column if not exists extra_kind text;
  alter table public.quote_rooms add column if not exists quantity integer;
  alter table public.quote_rooms add column if not exists unit_price_pence integer;

  -- 0d. Remaining pre-flight checks, which need the new columns to exist.
  --     If they fail, the columns added above are rolled back too.
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_payment_consent_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % paid enquiries have no recorded cancellation-policy confirmation. Nothing was changed.', n;
  end if;
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_early_start_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries have an early-start request without the cancellation policy being confirmed. Nothing was changed.', n;
  end if;
  execute format('select count(*) from public.quote_rooms where (%s) is not true', room_shape_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % room records would break the new rules. Nothing was changed.', n;
  end if;

  -- ===================================================================
  -- 3. PAYMENTS – 100% of the agreed price only, and only with consent
  --    (our own rules are re-created so their definitions are always exactly these)
  -- ===================================================================
  alter table public.enquiries alter column payment_type set default 'full';

  alter table public.enquiries drop constraint if exists enquiries_full_payment_only;
  execute format('alter table public.enquiries add constraint enquiries_full_payment_only check (%s)', enquiry_full_type_rule);
  alter table public.enquiries drop constraint if exists enquiries_full_payment_amount;
  execute format('alter table public.enquiries add constraint enquiries_full_payment_amount check (%s)', enquiry_full_amount_rule);
  alter table public.enquiries drop constraint if exists enquiries_paid_in_full;
  execute format('alter table public.enquiries add constraint enquiries_paid_in_full check (%s)', enquiry_paid_in_full_rule);
  alter table public.enquiries drop constraint if exists enquiries_payment_needs_consent;
  execute format('alter table public.enquiries add constraint enquiries_payment_needs_consent check (%s)', enquiry_payment_consent_rule);
  alter table public.enquiries drop constraint if exists enquiries_early_start_needs_terms;
  execute format('alter table public.enquiries add constraint enquiries_early_start_needs_terms check (%s)', enquiry_early_start_rule);

  -- ===================================================================
  -- 4. ROOM RECORDS – counted extras, strict shapes
  -- ===================================================================
  alter table public.quote_rooms drop constraint if exists quote_rooms_item_type_check;
  alter table public.quote_rooms add constraint quote_rooms_item_type_check
    check (item_type is not null and item_type in ('bedroom', 'living_room', 'skirting', 'ceiling', 'extra'));

  -- Extras have no coats/condition (measured rooms still must – enforced by the shape rule)
  alter table public.quote_rooms alter column coats drop not null;
  alter table public.quote_rooms alter column condition drop not null;

  alter table public.quote_rooms drop constraint if exists quote_rooms_extra_shape_check;
  execute format('alter table public.quote_rooms add constraint quote_rooms_extra_shape_check check (%s)', room_shape_rule);

  -- ===================================================================
  -- 5. PAYMENT PROTECTION
  --    Same security properties as the existing function: SECURITY INVOKER,
  --    search_path = '', owner postgres, executable only by its owner.
  --    CREATE OR REPLACE keeps the existing owner, permissions and trigger.
  --
  --    Before payment: only the website server (service role) may write the
  --    payment fields – unchanged.
  --    After payment: the payment record is locked for EVERYONE, including
  --    the website server, and the booking can't go back to an unpaid status.
  --    Status can still move forward (confirmed, work completed, cancelled)
  --    and the Stripe receipt/customer link can be filled in once if empty.
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

    -- Once a payment has been received, the payment record is locked for everyone
    if old.deposit_paid_at is not null then
      if new.agreed_price_pence is distinct from old.agreed_price_pence
         or new.deposit_pence is distinct from old.deposit_pence
         or new.payment_type is distinct from old.payment_type
         or new.deposit_percent is distinct from old.deposit_percent
         or new.deposit_paid_at is distinct from old.deposit_paid_at
         or new.deposit_paid_pence is distinct from old.deposit_paid_pence
         or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
         or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
         or new.payment_token is distinct from old.payment_token
         or new.cancellation_terms_accepted_at is distinct from old.cancellation_terms_accepted_at
         or new.early_start_requested_at is distinct from old.early_start_requested_at
         or (old.stripe_customer_id is not null and new.stripe_customer_id is distinct from old.stripe_customer_id)
         or (old.stripe_receipt_url is not null and new.stripe_receipt_url is distinct from old.stripe_receipt_url) then
        raise exception 'The agreed price and payment cannot change after payment is received';
      end if;
      if new.status in ('awaiting_consultation', 'price_agreed', 'deposit_requested') then
        raise exception 'A paid booking cannot go back to an unpaid status';
      end if;
    end if;
    return new;
  end;
  $fn$;
  revoke all on function public.protect_payment_fields() from public, anon, authenticated;

  -- Paid bookings are financial records: they can't be deleted (by anyone).
  create or replace function public.prevent_paid_enquiry_delete()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
  as $fn$
  begin
    if old.deposit_paid_at is not null then
      raise exception 'A paid booking cannot be deleted';
    end if;
    return old;
  end;
  $fn$;
  revoke all on function public.prevent_paid_enquiry_delete() from public, anon, authenticated;

  drop trigger if exists enquiries_prevent_paid_delete on public.enquiries;
  create trigger enquiries_prevent_paid_delete before delete on public.enquiries
    for each row execute function public.prevent_paid_enquiry_delete();
end
$migration$;
