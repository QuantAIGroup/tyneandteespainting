-- =====================================================================
-- PRICE REVISION, EXTRAS AND 100% PAYMENT  (revision 7, after safety review)
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
         -- Either priced normally (manual flag off) or withheld for a manual quote
         -- because of its condition (manual flag on, no price) – never a mix
         and (
           (requires_manual_quote is false and estimated_labour_pence is not null and estimated_labour_pence between 0 and 100000000)
           or (requires_manual_quote is true and estimated_labour_pence is null)
         )
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

  -- Every column the new rules use, with the type they must have ("table.column:type")
  column_specs    constant text[] := array[
    'quote_rooms.item_type:text', 'quote_rooms.label:text', 'quote_rooms.extra_kind:text', 'quote_rooms.quantity:int4',
    'quote_rooms.unit_price_pence:int4', 'quote_rooms.coats:int4', 'quote_rooms.condition:jsonb',
    'quote_rooms.estimated_labour_pence:int4', 'quote_rooms.requires_manual_quote:bool', 'quote_rooms.include_ceiling:bool',
    'quote_rooms.measurement_mode:text', 'quote_rooms.length_m:numeric', 'quote_rooms.width_m:numeric', 'quote_rooms.height_m:numeric',
    'quote_rooms.walls:jsonb', 'quote_rooms.skirting_length_m:numeric', 'quote_rooms.wall_area_sqm:numeric', 'quote_rooms.ceiling_area_sqm:numeric',
    'enquiries.status:text', 'enquiries.payment_type:text', 'enquiries.agreed_price_pence:int4', 'enquiries.deposit_pence:int4',
    'enquiries.deposit_percent:int4', 'enquiries.deposit_paid_pence:int4', 'enquiries.deposit_paid_at:timestamptz',
    'enquiries.stripe_payment_intent_id:text', 'enquiries.stripe_checkout_session_id:text', 'enquiries.stripe_customer_id:text',
    'enquiries.stripe_receipt_url:text', 'enquiries.payment_token:text',
    'enquiries.cancellation_terms_accepted_at:timestamptz', 'enquiries.early_start_requested_at:timestamptz',
    'payments.enquiry_id:uuid'
  ];
  -- Columns this migration adds (may be missing before it runs)
  new_columns     constant text[] := array[
    'quote_rooms.extra_kind', 'quote_rooms.quantity', 'quote_rooms.unit_price_pence',
    'enquiries.cancellation_terms_accepted_at', 'enquiries.early_start_requested_at'
  ];
  col text;
  col_type text;
  fn_secdef boolean;
  fn_owner text;
  fn_config text[];
  fn_public_exec bigint;

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

  -- 0-. Every column the rules use exists with the right type
  --     (new columns may be missing, but if present they must have the right type,
  --     because "add column if not exists" would otherwise silently keep a wrong one)
  foreach grp in array column_specs loop
    col := split_part(grp, ':', 1);
    select c.udt_name into col_type from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = split_part(col, '.', 1) and c.column_name = split_part(col, '.', 2);
    if col_type is null and not (col = any (new_columns)) then
      raise exception 'Stopped: column % is missing. Nothing was changed.', col;
    end if;
    if col_type is not null and col_type is distinct from split_part(grp, ':', 2) then
      raise exception 'Stopped: column % has type % (expected %). Nothing was changed.', col, col_type, split_part(grp, ':', 2);
    end if;
  end loop;

  -- 0s. Booking statuses. Existing records are never changed: anything
  --     unexpected stops the migration and is reported.
  --     (i) every status must be one of the nine permitted statuses (NULL included in the check)
  select count(*), string_agg(format('%s (%s)', coalesce(quote_literal(st), 'NULL'), cnt), ', ' order by st)
    into n, k
  from (select status as st, count(*) as cnt from public.enquiries
        where status is null or status not in ('awaiting_consultation', 'price_agreed', 'deposit_requested', 'deposit_paid',
                                               'booking_confirmed', 'work_completed', 'balance_paid', 'declined', 'cancelled')
        group by status) x;
  if n > 0 then
    select string_agg(reference, ', ' order by reference) into f from (
      select reference from public.enquiries
      where status is null or status not in ('awaiting_consultation', 'price_agreed', 'deposit_requested', 'deposit_paid',
                                             'booking_confirmed', 'work_completed', 'balance_paid', 'declined', 'cancelled')
      order by reference limit 20) r;
    raise exception 'Stopped: existing enquiries have unexpected statuses: % – references: %. Nothing was changed.', k, f;
  end if;
  --     (ii) a paid booking must be in a paid (or cancelled) status, or it could never move again
  select count(*), string_agg(reference || ' (' || status || ')', ', ' order by reference) into n, k
  from (select reference, status from public.enquiries
        where deposit_paid_at is not null
          and status not in ('deposit_paid', 'booking_confirmed', 'work_completed', 'balance_paid', 'cancelled')
        order by reference limit 20) x;
  if n > 0 then
    raise exception 'Stopped: paid bookings have an unpaid status: %. Nothing was changed.', k;
  end if;
  --     (iii) the two old deposit-era statuses are still recognised, but can no longer be entered – report any in use
  select count(*) into n from public.enquiries where status in ('deposit_paid', 'balance_paid');
  if n > 0 then
    raise notice 'Note: % existing booking(s) use the old deposit-era statuses (deposit_paid / balance_paid). They are kept as they are.', n;
  end if;

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

  foreach grp in array column_specs loop
    col := split_part(grp, ':', 1);
    select c.udt_name into col_type from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = split_part(col, '.', 1) and c.column_name = split_part(col, '.', 2);
    if col_type is distinct from split_part(grp, ':', 2) then
      raise exception 'Stopped: column % is missing or has the wrong type after adding columns. Nothing was changed.', col;
    end if;
  end loop;

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
  -- 5. PAYMENT AND STATUS PROTECTION  (trigger: BEFORE INSERT OR UPDATE)
  --    SECURITY INVOKER, search_path = '', owner postgres, executable
  --    only by its owner (checked in step 8).
  --
  --    New enquiries: must start as "Awaiting phone consultation" with no
  --    price, payment or Stripe details – a booking can't be created
  --    already agreed, requested or paid.
  --
  --    Status: must be one of the nine known statuses, and every change must
  --    be on the explicit allowlist below (kept in step with
  --    src/lib/payments/status-transitions.ts – a test fails if they differ).
  --    A payment can only be recorded on a "Payment requested" booking and
  --    must move it to "Booking confirmed" in the same update.
  --
  --    Before payment: only the website server (service role) may write the
  --    payment fields. After payment: the payment record is locked for
  --    EVERYONE, including the website server.
  -- ===================================================================
  create or replace function public.protect_payment_fields()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
  as $fn$
  declare
    known_statuses constant text[] := array[
      'awaiting_consultation', 'price_agreed', 'deposit_requested', 'deposit_paid',
      'booking_confirmed', 'work_completed', 'balance_paid', 'declined', 'cancelled'];
    -- ALLOWED STATUS CHANGES  (kind:from>to)
    allowed_transitions constant text[] := array[
      'unpaid:awaiting_consultation>price_agreed',
      'unpaid:awaiting_consultation>declined',
      'unpaid:awaiting_consultation>cancelled',
      'unpaid:price_agreed>awaiting_consultation',
      'unpaid:price_agreed>deposit_requested',
      'unpaid:price_agreed>declined',
      'unpaid:price_agreed>cancelled',
      'unpaid:deposit_requested>awaiting_consultation',
      'unpaid:deposit_requested>price_agreed',
      'unpaid:deposit_requested>declined',
      'unpaid:deposit_requested>cancelled',
      'unpaid:declined>awaiting_consultation',
      'unpaid:declined>cancelled',
      'unpaid:cancelled>awaiting_consultation',
      'unpaid:cancelled>declined',
      'payment:deposit_requested>booking_confirmed',
      'paid:deposit_paid>booking_confirmed',
      'paid:deposit_paid>work_completed',
      'paid:deposit_paid>cancelled',
      'paid:booking_confirmed>work_completed',
      'paid:booking_confirmed>cancelled',
      'paid:work_completed>booking_confirmed',
      'paid:work_completed>cancelled'
    ];
    change_kind text;
  begin
    if new.status is null or not (new.status = any (known_statuses)) then
      raise exception 'Unknown booking status: %', coalesce(new.status, 'NULL');
    end if;

    -- ---------- New enquiries
    if tg_op = 'INSERT' then
      if new.status is distinct from 'awaiting_consultation'
         or new.agreed_price_pence is not null or new.deposit_pence is not null
         or new.deposit_paid_at is not null or new.deposit_paid_pence is not null
         or new.stripe_payment_intent_id is not null or new.stripe_checkout_session_id is not null
         or new.stripe_customer_id is not null or new.stripe_receipt_url is not null
         or new.payment_token is not null
         or new.cancellation_terms_accepted_at is not null or new.early_start_requested_at is not null then
        raise exception 'A new enquiry must start as awaiting consultation, with no price or payment details';
      end if;
      return new;
    end if;

    -- ---------- Payment fields: only the website server, before payment
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

    -- ---------- Once a payment has been received, the payment record is locked for everyone
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
    end if;

    -- ---------- Status changes: explicit allowlist
    change_kind := case
      when old.deposit_paid_at is not null then 'paid'
      when new.deposit_paid_at is not null then 'payment'
      else 'unpaid'
    end;

    -- ---------- A payment must come from this booking's own Stripe checkout page
    --            (the one the payment page saved), with its Stripe payment reference
    if change_kind = 'payment' then
      if old.stripe_checkout_session_id is null
         or new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id
         or new.stripe_payment_intent_id is null then
        raise exception 'A payment can only be recorded against this booking''s own Stripe checkout, with its Stripe payment reference';
      end if;
    end if;
    if change_kind = 'payment' or new.status is distinct from old.status then
      if not ((change_kind || ':' || old.status || '>' || new.status) = any (allowed_transitions)) then
        raise exception 'Booking status cannot change from % to % (%)', old.status, new.status,
          case change_kind
            when 'paid' then 'payment already received'
            when 'payment' then 'a payment can only confirm a booking that is awaiting payment'
            else 'not paid'
          end;
      end if;
    end if;
    return new;
  end;
  $fn$;
  revoke all on function public.protect_payment_fields() from public, anon, authenticated;

  -- ===================================================================
  -- 6. PAID BOOKINGS AND THE PAYMENT LOG CAN'T BE REMOVED
  --    Row deletes are refused for paid bookings. TRUNCATE is refused on
  --    enquiries, quote_rooms and enquiry_photos while any paid booking
  --    exists, and on the payments log while it has any entries.
  --    Triggers apply to every role that holds TRUNCATE or DELETE, however
  --    it got it (the owner, the superuser, or any role granted it now or
  --    later). They cannot stop a role that owns the table or is a superuser
  --    from deliberately disabling or dropping the triggers.
  --
  --    The payments log becomes append-only: rows can't be edited or
  --    deleted. The only update allowed is the database's own "set the
  --    enquiry link to empty" when an unpaid enquiry is deleted.
  -- ===================================================================
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

  -- SECURITY DEFINER (runs as the owner, postgres, which bypasses row-level
  -- security) so the check sees EVERY row: a role granted TRUNCATE that is
  -- subject to row-level security would otherwise see no paid bookings and
  -- get through. It reads one table, takes no input and has search_path ''.
  create or replace function public.prevent_paid_enquiry_truncate()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
  begin
    if exists (select 1 from public.enquiries where deposit_paid_at is not null) then
      raise exception 'Table % holds data for paid bookings and cannot be truncated', tg_table_name;
    end if;
    return null;
  end;
  $fn$;
  revoke all on function public.prevent_paid_enquiry_truncate() from public, anon, authenticated;

  -- SECURITY DEFINER for the same reason (the TRUNCATE check must see every entry).
  create or replace function public.protect_payment_log()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
  begin
    if tg_op = 'TRUNCATE' then
      if exists (select 1 from public.payments) then
        raise exception 'The payment log cannot be truncated';
      end if;
      return null;
    end if;
    if tg_op = 'DELETE' then
      raise exception 'Payment log entries cannot be deleted';
    end if;
    -- UPDATE: only the automatic unlinking when an (unpaid) enquiry is deleted
    if new.enquiry_id is null and old.enquiry_id is not null
       and (to_jsonb(new) - 'enquiry_id') = (to_jsonb(old) - 'enquiry_id') then
      return new;
    end if;
    raise exception 'Payment log entries cannot be changed';
  end;
  $fn$;
  revoke all on function public.protect_payment_log() from public, anon, authenticated;

  -- Room and extra records of a paid booking are what the customer paid for:
  -- they can't be added to, changed or removed afterwards. SECURITY DEFINER so
  -- the check always sees the booking, whatever the caller's row-level access.
  create or replace function public.protect_paid_quote_rooms()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
  begin
    if tg_op in ('UPDATE', 'DELETE')
       and exists (select 1 from public.enquiries where id = old.enquiry_id and deposit_paid_at is not null) then
      raise exception 'Room records of a paid booking cannot be changed or removed';
    end if;
    if tg_op in ('INSERT', 'UPDATE')
       and exists (select 1 from public.enquiries where id = new.enquiry_id and deposit_paid_at is not null) then
      raise exception 'Room records cannot be added to a paid booking';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end;
  $fn$;
  revoke all on function public.protect_paid_quote_rooms() from public, anon, authenticated;

  -- New tables created by postgres in this schema would otherwise give the
  -- website server TRUNCATE/TRIGGER/REFERENCES/MAINTAIN automatically
  -- (existing tables were already corrected by the api_grants migration).
  execute 'alter default privileges for role postgres in schema public revoke truncate, trigger, references, maintain on tables from service_role';

  -- ===================================================================
  -- 7. ATTACH THE TRIGGERS EXPLICITLY (not relying on existing set-up)
  -- ===================================================================
  drop trigger if exists enquiries_protect_payment on public.enquiries;
  create trigger enquiries_protect_payment before insert or update on public.enquiries
    for each row execute function public.protect_payment_fields();

  drop trigger if exists enquiries_prevent_paid_delete on public.enquiries;
  create trigger enquiries_prevent_paid_delete before delete on public.enquiries
    for each row execute function public.prevent_paid_enquiry_delete();

  drop trigger if exists enquiries_prevent_paid_truncate on public.enquiries;
  create trigger enquiries_prevent_paid_truncate before truncate on public.enquiries
    for each statement execute function public.prevent_paid_enquiry_truncate();

  drop trigger if exists quote_rooms_prevent_paid_truncate on public.quote_rooms;
  create trigger quote_rooms_prevent_paid_truncate before truncate on public.quote_rooms
    for each statement execute function public.prevent_paid_enquiry_truncate();

  drop trigger if exists enquiry_photos_prevent_paid_truncate on public.enquiry_photos;
  create trigger enquiry_photos_prevent_paid_truncate before truncate on public.enquiry_photos
    for each statement execute function public.prevent_paid_enquiry_truncate();

  drop trigger if exists quote_rooms_protect_paid on public.quote_rooms;
  create trigger quote_rooms_protect_paid before insert or update or delete on public.quote_rooms
    for each row execute function public.protect_paid_quote_rooms();

  drop trigger if exists payments_append_only on public.payments;
  create trigger payments_append_only before update or delete on public.payments
    for each row execute function public.protect_payment_log();

  drop trigger if exists payments_prevent_truncate on public.payments;
  create trigger payments_prevent_truncate before truncate on public.payments
    for each statement execute function public.protect_payment_log();

  -- ===================================================================
  -- 8. FINAL VERIFICATION – if anything below is wrong, the whole
  --    migration is rolled back.
  -- ===================================================================
  -- name:expected SECURITY DEFINER
  foreach grp in array array['protect_payment_fields:false', 'prevent_paid_enquiry_delete:false', 'prevent_paid_enquiry_truncate:true', 'protect_payment_log:true', 'protect_paid_quote_rooms:true'] loop
    k := split_part(grp, ':', 1);
    select p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig,
           (select count(*) from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
            where a.privilege_type = 'EXECUTE' and (a.grantee = 0 or a.grantee in ('anon'::regrole, 'authenticated'::regrole)))
      into fn_secdef, fn_owner, fn_config, fn_public_exec
    from pg_proc p where p.oid = format('public.%I()', k)::regprocedure;
    if fn_secdef is distinct from split_part(grp, ':', 2)::boolean then
      raise exception 'Verification failed: % SECURITY DEFINER is % (expected %)', k, fn_secdef, split_part(grp, ':', 2);
    end if;
    if fn_owner is distinct from 'postgres' then
      raise exception 'Verification failed: % is owned by % (expected postgres)', k, fn_owner;
    end if;
    if fn_config is distinct from array['search_path=""'] then
      raise exception 'Verification failed: % search_path is %', k, fn_config;
    end if;
    if fn_public_exec > 0 then
      raise exception 'Verification failed: % can be executed by PUBLIC, anon or authenticated', k;
    end if;
  end loop;
  -- The definer functions only see every row if their owner bypasses row-level security
  if not exists (select 1 from pg_roles where rolname = 'postgres' and (rolsuper or rolbypassrls)) then
    raise exception 'Verification failed: postgres does not bypass row-level security, so the truncate guards could miss paid bookings';
  end if;

  -- table:trigger:function:tgtype   (tgtype bits: 1 row, 2 before, 4 insert, 8 delete, 16 update, 32 truncate)
  foreach grp in array array[
    'enquiries:enquiries_protect_payment:protect_payment_fields:23',            -- BEFORE INSERT OR UPDATE, FOR EACH ROW
    'enquiries:enquiries_prevent_paid_delete:prevent_paid_enquiry_delete:11',   -- BEFORE DELETE, FOR EACH ROW
    'enquiries:enquiries_prevent_paid_truncate:prevent_paid_enquiry_truncate:34',        -- BEFORE TRUNCATE, FOR EACH STATEMENT
    'quote_rooms:quote_rooms_prevent_paid_truncate:prevent_paid_enquiry_truncate:34',
    'enquiry_photos:enquiry_photos_prevent_paid_truncate:prevent_paid_enquiry_truncate:34',
    'quote_rooms:quote_rooms_protect_paid:protect_paid_quote_rooms:31',              -- BEFORE INSERT OR UPDATE OR DELETE, FOR EACH ROW
    'payments:payments_append_only:protect_payment_log:27',                     -- BEFORE UPDATE OR DELETE, FOR EACH ROW
    'payments:payments_prevent_truncate:protect_payment_log:34'
  ] loop
    select count(*) into n from pg_trigger t
    where t.tgrelid = format('public.%I', split_part(grp, ':', 1))::regclass and not t.tgisinternal
      and t.tgname = split_part(grp, ':', 2)
      and t.tgfoid = format('public.%I()', split_part(grp, ':', 3))::regprocedure
      and t.tgtype = split_part(grp, ':', 4)::int2
      and t.tgenabled = 'O';
    if n is distinct from 1 then
      raise exception 'Verification failed: trigger % is not attached as expected', split_part(grp, ':', 2);
    end if;
  end loop;

  -- The payment function must not be attached anywhere else in a different way
  select count(*) into n from pg_trigger t
  where t.tgfoid = 'public.protect_payment_fields()'::regprocedure and not t.tgisinternal;
  if n is distinct from 1 then
    raise exception 'Verification failed: protect_payment_fields is attached % times (expected 1)', n;
  end if;

  -- Exact table permissions for PUBLIC and the three API roles on the four
  -- booking tables. Anything different stops the migration (permissions are
  -- verified, not silently changed).
  --   anon:          nothing
  --   authenticated: enquiries SELECT/UPDATE/DELETE; others SELECT only (admin access, still limited by row-level security)
  --   service_role:  SELECT/INSERT/UPDATE/DELETE (the website server)
  --   nobody:        TRUNCATE, REFERENCES, TRIGGER (and MAINTAIN on PostgreSQL 17+)
  foreach grp in array array[
    'anon:enquiries:', 'anon:quote_rooms:', 'anon:enquiry_photos:', 'anon:payments:',
    'authenticated:enquiries:SELECT,UPDATE,DELETE', 'authenticated:quote_rooms:SELECT',
    'authenticated:enquiry_photos:SELECT', 'authenticated:payments:SELECT',
    'service_role:enquiries:SELECT,INSERT,UPDATE,DELETE', 'service_role:quote_rooms:SELECT,INSERT,UPDATE,DELETE',
    'service_role:enquiry_photos:SELECT,INSERT,UPDATE,DELETE', 'service_role:payments:SELECT,INSERT,UPDATE,DELETE'
  ] loop
    fields := array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
    if current_setting('server_version_num')::int >= 170000 then
      fields := fields || 'MAINTAIN';
    end if;
    foreach f in array fields loop
      if has_table_privilege(split_part(grp, ':', 1), format('public.%I', split_part(grp, ':', 2)), f)
         is distinct from coalesce(f = any (string_to_array(nullif(split_part(grp, ':', 3), ''), ',')), false) then
        raise exception 'Verification failed: % % on % is not as intended', split_part(grp, ':', 1), f, split_part(grp, ':', 2);
      end if;
    end loop;
  end loop;
  select count(*) into n
  from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
  where c.oid in ('public.enquiries'::regclass, 'public.quote_rooms'::regclass, 'public.enquiry_photos'::regclass, 'public.payments'::regclass)
    and a.grantee = 0;
  if n > 0 then
    raise exception 'Verification failed: PUBLIC has privileges on a booking table';
  end if;

  -- Roles that CAN truncate (owner/superuser or any later grant) are all subject to the guards above
  select string_agg(distinct r.rolname, ', ' order by r.rolname) into k
  from pg_roles r
  cross join (values ('public.enquiries'), ('public.quote_rooms'), ('public.enquiry_photos'), ('public.payments')) t(tbl)
  where has_table_privilege(r.oid, t.tbl::regclass, 'TRUNCATE');
  raise notice 'Roles able to TRUNCATE booking tables (all subject to the truncate guards): %', coalesce(k, 'none');
end
$migration$;
