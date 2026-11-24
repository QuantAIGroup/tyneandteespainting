-- =====================================================================
-- PRICE REVISION, EXTRAS AND 100% PAYMENT  (revision 10, after concurrency and payment audit)
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

  -- A payment needs the customer's recorded consent (an evidence record in
  -- booking_consents, the terms version and the time). A timestamp alone is not enough.
  enquiry_payment_consent_rule constant text :=
    $r$deposit_paid_at is null
       or (consent_id is not null and cancellation_terms_accepted_at is not null and cancellation_terms_version is not null)$r$;

  enquiry_early_start_rule constant text :=
    $r$early_start_requested_at is null or consent_id is not null$r$;

  -- The consent link, version and time are recorded together or not at all
  enquiry_consent_link_rule constant text :=
    $r$consent_id is null or (cancellation_terms_accepted_at is not null and cancellation_terms_version is not null)$r$;

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
    'enquiries.consent_id:uuid', 'enquiries.cancellation_terms_version:text',
    'payments.enquiry_id:uuid', 'payments.stripe_payment_intent_id:text', 'payments.amount_pence:int4', 'payments.currency:text',
    'enquiry_photos.enquiry_id:uuid',
    'refunds.id:uuid', 'refunds.enquiry_id:uuid', 'refunds.stripe_refund_id:text', 'refunds.stripe_payment_intent_id:text',
    'refunds.amount_pence:int4', 'refunds.currency:text', 'refunds.status:text', 'refunds.stripe_reason:text',
    'refunds.source:text', 'refunds.note:text', 'refunds.created_at:timestamptz', 'refunds.updated_at:timestamptz',
    'booking_consents.id:uuid', 'booking_consents.enquiry_id:uuid', 'booking_consents.terms_version:text',
    'booking_consents.terms_sha256:text', 'booking_consents.statements:jsonb', 'booking_consents.accepted_terms:bool',
    'booking_consents.early_start_requested:bool', 'booking_consents.early_start_ack_pay_for_work:bool',
    'booking_consents.early_start_ack_loses_right:bool', 'booking_consents.amount_pence:int4',
    'booking_consents.user_agent:text', 'booking_consents.created_at:timestamptz'
  ];
  -- Columns this migration adds (may be missing before it runs)
  new_columns     constant text[] := array[
    'quote_rooms.extra_kind', 'quote_rooms.quantity', 'quote_rooms.unit_price_pence',
    'enquiries.cancellation_terms_accepted_at', 'enquiries.early_start_requested_at',
    'enquiries.consent_id', 'enquiries.cancellation_terms_version',
    'refunds.id', 'refunds.enquiry_id', 'refunds.stripe_refund_id', 'refunds.stripe_payment_intent_id',
    'refunds.amount_pence', 'refunds.currency', 'refunds.status', 'refunds.stripe_reason',
    'refunds.source', 'refunds.note', 'refunds.created_at', 'refunds.updated_at',
    'booking_consents.id', 'booking_consents.enquiry_id', 'booking_consents.terms_version', 'booking_consents.terms_sha256',
    'booking_consents.statements', 'booking_consents.accepted_terms', 'booking_consents.early_start_requested',
    'booking_consents.early_start_ack_pay_for_work', 'booking_consents.early_start_ack_loses_right',
    'booking_consents.amount_pence', 'booking_consents.user_agent', 'booking_consents.created_at'
  ];
  -- Exact shape of the two new tables ("table|column|type|not null"). A table that
  -- already exists (created earlier, by this or anything else) must match exactly,
  -- because CREATE TABLE IF NOT EXISTS never changes an existing table.
  new_table_columns constant text[] := array[
    'refunds|id|uuid|t', 'refunds|enquiry_id|uuid|f', 'refunds|stripe_refund_id|text|t', 'refunds|stripe_payment_intent_id|text|t',
    'refunds|amount_pence|int4|t', 'refunds|currency|text|t', 'refunds|status|text|t', 'refunds|stripe_reason|text|f',
    'refunds|source|text|t', 'refunds|note|text|f', 'refunds|created_at|timestamptz|t', 'refunds|updated_at|timestamptz|t',
    'booking_consents|id|uuid|t', 'booking_consents|enquiry_id|uuid|t', 'booking_consents|terms_version|text|t',
    'booking_consents|terms_sha256|text|t', 'booking_consents|statements|jsonb|t', 'booking_consents|accepted_terms|bool|t',
    'booking_consents|early_start_requested|bool|t', 'booking_consents|early_start_ack_pay_for_work|bool|t',
    'booking_consents|early_start_ack_loses_right|bool|t', 'booking_consents|amount_pence|int4|t',
    'booking_consents|user_agent|text|f', 'booking_consents|created_at|timestamptz|t'
  ];
  -- Exact constraints and indexes of the two new tables ("table|name|type|definition",
  -- as PostgreSQL 16 and 17 both print them, schema prefix removed)
  new_table_constraints constant text[] := array[
    $c$booking_consents|booking_consents_amount|c|CHECK (((amount_pence >= 1) AND (amount_pence <= 5000000)))$c$,
    $c$booking_consents|booking_consents_early_start_acks|c|CHECK (((early_start_requested AND early_start_ack_pay_for_work AND early_start_ack_loses_right) OR ((NOT early_start_requested) AND (NOT early_start_ack_pay_for_work) AND (NOT early_start_ack_loses_right))))$c$,
    $c$booking_consents|booking_consents_enquiry_fkey|f|FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE RESTRICT$c$,
    $c$booking_consents|booking_consents_id_enquiry_key|u|UNIQUE (id, enquiry_id)$c$,
    $c$booking_consents|booking_consents_pkey|p|PRIMARY KEY (id)$c$,
    $c$booking_consents|booking_consents_sha256_format|c|CHECK ((terms_sha256 ~ '^[0-9a-f]{64}$'::text))$c$,
    $c$booking_consents|booking_consents_statements_object|c|CHECK ((jsonb_typeof(statements) = 'object'::text))$c$,
    $c$booking_consents|booking_consents_terms_accepted|c|CHECK ((accepted_terms IS TRUE))$c$,
    $c$booking_consents|booking_consents_user_agent|c|CHECK (((user_agent IS NULL) OR (length(user_agent) <= 500)))$c$,
    $c$booking_consents|booking_consents_version_format|c|CHECK ((terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]{1,3}){0,1}$'::text))$c$,
    $c$refunds|refunds_admin_needs_booking|c|CHECK (((source <> 'admin'::text) OR (enquiry_id IS NOT NULL)))$c$,
    $c$refunds|refunds_amount|c|CHECK (((amount_pence >= 1) AND (amount_pence <= 5000000)))$c$,
    $c$refunds|refunds_currency|c|CHECK ((currency ~ '^[a-z]{3}$'::text))$c$,
    $c$refunds|refunds_enquiry_fkey|f|FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE RESTRICT$c$,
    $c$refunds|refunds_note|c|CHECK (((note IS NULL) OR (length(note) <= 500)))$c$,
    $c$refunds|refunds_payment_fkey|f|FOREIGN KEY (stripe_payment_intent_id) REFERENCES payments(stripe_payment_intent_id) ON DELETE RESTRICT$c$,
    $c$refunds|refunds_pkey|p|PRIMARY KEY (id)$c$,
    $c$refunds|refunds_source|c|CHECK ((source = ANY (ARRAY['admin'::text, 'duplicate_payment'::text, 'stripe_dashboard'::text])))$c$,
    $c$refunds|refunds_status|c|CHECK ((status = ANY (ARRAY['pending'::text, 'requires_action'::text, 'succeeded'::text, 'failed'::text, 'canceled'::text])))$c$,
    $c$refunds|refunds_stripe_refund_id_key|u|UNIQUE (stripe_refund_id)$c$
  ];
  new_table_indexes constant text[] := array[
    'booking_consents|booking_consents_enquiry_idx|CREATE INDEX booking_consents_enquiry_idx ON booking_consents USING btree (enquiry_id)',
    'booking_consents|booking_consents_id_enquiry_key|CREATE UNIQUE INDEX booking_consents_id_enquiry_key ON booking_consents USING btree (id, enquiry_id)',
    'booking_consents|booking_consents_pkey|CREATE UNIQUE INDEX booking_consents_pkey ON booking_consents USING btree (id)',
    'refunds|refunds_enquiry_idx|CREATE INDEX refunds_enquiry_idx ON refunds USING btree (enquiry_id)',
    'refunds|refunds_payment_idx|CREATE INDEX refunds_payment_idx ON refunds USING btree (stripe_payment_intent_id)',
    'refunds|refunds_pkey|CREATE UNIQUE INDEX refunds_pkey ON refunds USING btree (id)',
    'refunds|refunds_stripe_refund_id_key|CREATE UNIQUE INDEX refunds_stripe_refund_id_key ON refunds USING btree (stripe_refund_id)'
  ];
  -- Exact row-level security policies on every booking table ("table|policy|command|roles|using|with check").
  -- Admins only; nothing for visitors.
  booking_policies constant text[] := array[
    'booking_consents|Admins can read booking consents|SELECT|authenticated|is_admin()|',
    'enquiries|Admins can delete enquiries|DELETE|authenticated|is_admin()|',
    'enquiries|Admins can read enquiries|SELECT|authenticated|is_admin()|',
    'enquiries|Admins can update enquiries|UPDATE|authenticated|is_admin()|is_admin()',
    'enquiry_photos|Admins can read enquiry photos|SELECT|authenticated|is_admin()|',
    'payments|Admins can read payments|SELECT|authenticated|is_admin()|',
    'quote_rooms|Admins can read quote rooms|SELECT|authenticated|is_admin()|',
    'refunds|Admins can read refunds|SELECT|authenticated|is_admin()|'
  ];
  -- Rules this migration adds to existing tables: must exist and be validated
  our_constraints constant text[] := array[
    'enquiries:enquiries_full_payment_only', 'enquiries:enquiries_full_payment_amount', 'enquiries:enquiries_paid_in_full',
    'enquiries:enquiries_payment_needs_consent', 'enquiries:enquiries_early_start_needs_terms', 'enquiries:enquiries_consent_complete',
    'enquiries:enquiries_consent_fkey', 'quote_rooms:quote_rooms_item_type_check', 'quote_rooms:quote_rooms_extra_shape_check',
    'payments:payments_stripe_payment_intent_id_key', 'payments:payments_outcome_check'
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
  --     (iii) the two old deposit-era statuses (deposit_paid, balance_paid) stay in the
  --           allowed-values list for compatibility, but no booking may enter or leave
  --           them under full payment. Any booking already in one stops the migration.
  select count(*), string_agg(reference || ' (' || status || ')', ', ' order by reference) into n, k
  from (select reference, status from public.enquiries where status in ('deposit_paid', 'balance_paid') order by reference limit 20) x;
  if n > 0 then
    raise exception 'Stopped: bookings use the old deposit-era statuses: %. Review them before migrating. Nothing was changed.', k;
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

  alter table public.enquiries add column if not exists consent_id uuid;                 -- the consent evidence record (booking_consents)
  alter table public.enquiries add column if not exists cancellation_terms_version text; -- version of the cancellation terms accepted

  -- CONSENT EVIDENCE: one record each time a customer confirms on the payment
  -- page – which terms (version and a SHA-256 fingerprint of the exact text),
  -- the exact wording of every box they ticked, the price shown, and, if they
  -- asked for work to start within 14 days, that request and the two
  -- acknowledgements the law requires. Append-only (step 6).
  create table if not exists public.booking_consents (
    id uuid not null default gen_random_uuid(),
    enquiry_id uuid not null,
    terms_version text not null,
    terms_sha256 text not null,
    statements jsonb not null,
    accepted_terms boolean not null,
    early_start_requested boolean not null,
    early_start_ack_pay_for_work boolean not null,
    early_start_ack_loses_right boolean not null,
    amount_pence integer not null,
    user_agent text,
    created_at timestamptz not null default now(),
    constraint booking_consents_pkey primary key (id),
    constraint booking_consents_id_enquiry_key unique (id, enquiry_id),
    constraint booking_consents_enquiry_fkey foreign key (enquiry_id) references public.enquiries (id) on delete restrict,
    constraint booking_consents_terms_accepted check (accepted_terms is true),
    constraint booking_consents_version_format check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]{1,3}){0,1}$'),
    constraint booking_consents_sha256_format check (terms_sha256 ~ '^[0-9a-f]{64}$'),
    constraint booking_consents_statements_object check (jsonb_typeof(statements) = 'object'),
    constraint booking_consents_early_start_acks check (
      (early_start_requested and early_start_ack_pay_for_work and early_start_ack_loses_right)
      or (not early_start_requested and not early_start_ack_pay_for_work and not early_start_ack_loses_right)),
    constraint booking_consents_amount check (amount_pence between 1 and 5000000),
    constraint booking_consents_user_agent check (user_agent is null or length(user_agent) <= 500)
  );
  create index if not exists booking_consents_enquiry_idx on public.booking_consents (enquiry_id);

  -- REFUND RECORD: every refund made through Stripe, kept SEPARATELY from the
  -- original payment (which is never altered or deleted). Each refund points at
  -- the original payment in the payment log, and can never be moved to another
  -- booking. Append-only: only Stripe's genuine status changes can be recorded (step 6).
  create table if not exists public.refunds (
    id uuid not null default gen_random_uuid(),
    enquiry_id uuid,                                  -- null only if the original payment isn't linked to a booking
    stripe_refund_id text not null,
    stripe_payment_intent_id text not null,           -- the original payment that was refunded
    amount_pence integer not null,
    currency text not null,
    status text not null,
    stripe_reason text,                               -- Stripe's reason code, if any
    source text not null,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint refunds_pkey primary key (id),
    constraint refunds_stripe_refund_id_key unique (stripe_refund_id),
    constraint refunds_enquiry_fkey foreign key (enquiry_id) references public.enquiries (id) on delete restrict,
    constraint refunds_payment_fkey foreign key (stripe_payment_intent_id) references public.payments (stripe_payment_intent_id) on delete restrict,
    constraint refunds_amount check (amount_pence between 1 and 5000000),
    constraint refunds_currency check (currency ~ '^[a-z]{3}$'),
    constraint refunds_status check (status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')),
    constraint refunds_source check (source in ('admin', 'duplicate_payment', 'stripe_dashboard')),
    constraint refunds_note check (note is null or length(note) <= 500),
    constraint refunds_admin_needs_booking check (source <> 'admin' or enquiry_id is not null)
  );
  create index if not exists refunds_enquiry_idx on public.refunds (enquiry_id);
  create index if not exists refunds_payment_idx on public.refunds (stripe_payment_intent_id);

  -- The two tables must now be EXACTLY as defined above. If either existed
  -- before (CREATE TABLE IF NOT EXISTS leaves an existing table untouched)
  -- and differs in any column, NOT NULL setting, constraint or index, stop.
  select string_agg(x, '; ' order by x) into k from (
    (select 'unexpected/different column ' || c.table_name || '.' || c.column_name || ' ' || c.udt_name
            || case when c.is_nullable = 'NO' then ' not null' else ' nullable' end as x
     from information_schema.columns c
     where c.table_schema = 'public' and c.table_name in ('refunds', 'booking_consents')
       and (c.table_name || '|' || c.column_name || '|' || c.udt_name || '|' || case when c.is_nullable = 'NO' then 't' else 'f' end)
           <> all (new_table_columns))
    union all
    (select 'missing column ' || split_part(e, '|', 1) || '.' || split_part(e, '|', 2)
     from unnest(new_table_columns) e
     where not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = split_part(e, '|', 1) and c.column_name = split_part(e, '|', 2)
                         and c.udt_name = split_part(e, '|', 3) and (c.is_nullable = 'NO') = (split_part(e, '|', 4) = 't')))
    union all
    (select 'unexpected/different constraint ' || con.conrelid::regclass::text || '.' || con.conname
     from pg_constraint con
     where con.conrelid in ('public.refunds'::regclass, 'public.booking_consents'::regclass) and con.contype <> 'n'
       and (replace(con.conrelid::regclass::text, 'public.', '') || '|' || con.conname || '|' || con.contype::text || '|'
            || replace(pg_get_constraintdef(con.oid), 'public.', '')) <> all (new_table_constraints))
    union all
    (select 'missing constraint ' || split_part(e, '|', 2)
     from unnest(new_table_constraints) e
     where not exists (select 1 from pg_constraint con
                       where con.conrelid = format('public.%I', split_part(e, '|', 1))::regclass and con.conname = split_part(e, '|', 2)
                         and con.convalidated
                         and (replace(con.conrelid::regclass::text, 'public.', '') || '|' || con.conname || '|' || con.contype::text || '|'
                              || replace(pg_get_constraintdef(con.oid), 'public.', '')) = e))
    union all
    (select 'unexpected/different index ' || i.indexname
     from pg_indexes i where i.schemaname = 'public' and i.tablename in ('refunds', 'booking_consents')
       and (i.tablename || '|' || i.indexname || '|' || replace(i.indexdef, 'public.', '')) <> all (new_table_indexes))
    union all
    (select 'missing index ' || split_part(e, '|', 2)
     from unnest(new_table_indexes) e
     where not exists (select 1 from pg_indexes i where i.schemaname = 'public'
                       and (i.tablename || '|' || i.indexname || '|' || replace(i.indexdef, 'public.', '')) = e))
  ) d;
  if k is not null then
    raise exception 'Stopped: the refunds / booking_consents tables are not exactly as required (%). Nothing was changed.', k;
  end if;

  -- A booking can only point at ITS OWN consent record (two-column link)
  alter table public.enquiries drop constraint if exists enquiries_consent_fkey;
  alter table public.enquiries add constraint enquiries_consent_fkey
    foreign key (consent_id, id) references public.booking_consents (id, enquiry_id) on delete restrict;

  -- Access (both tables): visitors nothing; admin login read-only (row-level
  -- security: admins only); website server read and add (refunds: also update
  -- the Stripe status). Nobody can delete.
  alter table public.booking_consents enable row level security;
  drop policy if exists "Admins can read booking consents" on public.booking_consents;
  create policy "Admins can read booking consents" on public.booking_consents for select to authenticated using (public.is_admin());
  revoke all on public.booking_consents from public, anon, authenticated, service_role;
  grant select on public.booking_consents to authenticated;
  grant select, insert on public.booking_consents to service_role;

  alter table public.refunds enable row level security;
  drop policy if exists "Admins can read refunds" on public.refunds;
  create policy "Admins can read refunds" on public.refunds for select to authenticated using (public.is_admin());
  revoke all on public.refunds from public, anon, authenticated, service_role;
  grant select on public.refunds to authenticated;
  grant select, insert, update on public.refunds to service_role;

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
  execute format('select count(*) from public.enquiries where (%s) is not true', enquiry_consent_link_rule) into n;
  if n > 0 then
    raise exception 'Stopped: % enquiries link to a consent record without its terms version or time. Nothing was changed.', n;
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
  alter table public.enquiries drop constraint if exists enquiries_consent_complete;
  execute format('alter table public.enquiries add constraint enquiries_consent_complete check (%s)', enquiry_consent_link_rule);

  -- PAYMENT LOG LABEL: new verified payments are logged as 'payment_recorded'
  -- (100% of the agreed price). 'deposit_recorded' was the label used before
  -- full payment; it stays valid so any historical entries remain readable.
  -- The log is append-only, so existing entries are never relabelled.
  alter table public.payments drop constraint if exists payments_outcome_check;
  alter table public.payments add constraint payments_outcome_check
    check (outcome in ('payment_recorded', 'deposit_recorded', 'duplicate_refunded', 'duplicate_refund_failed', 'needs_review'));

  -- Column names from the deposit era are kept (renaming would break the
  -- application and history); these notes record what they mean now.
  comment on column public.enquiries.deposit_pence is 'Amount requested online. Under full payment always equals agreed_price_pence (100%).';
  comment on column public.enquiries.deposit_paid_pence is 'Amount received through Stripe. Under full payment always equals agreed_price_pence.';
  comment on column public.enquiries.deposit_paid_at is 'When the verified Stripe payment was recorded (full payment).';
  comment on column public.payments.outcome is 'payment_recorded = verified full payment; deposit_recorded = the same, logged before full payment (historical label); duplicate_refunded / duplicate_refund_failed; needs_review.';

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
      'paid:booking_confirmed>work_completed',
      'paid:booking_confirmed>cancelled',
      'paid:work_completed>cancelled'
    ];
    change_kind text;
    consent record;
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
         or new.cancellation_terms_accepted_at is not null or new.early_start_requested_at is not null
         or new.consent_id is not null or new.cancellation_terms_version is not null then
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
         or new.early_start_requested_at is distinct from old.early_start_requested_at
         or new.consent_id is distinct from old.consent_id
         or new.cancellation_terms_version is distinct from old.cancellation_terms_version then
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
         or new.consent_id is distinct from old.consent_id
         or new.cancellation_terms_version is distinct from old.cancellation_terms_version
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
      -- ...and with the customer's consent evidence for exactly this booking, price and terms
      select c.* into consent from public.booking_consents c where c.id = new.consent_id and c.enquiry_id = new.id;
      if not found
         or consent.amount_pence is distinct from new.agreed_price_pence
         or consent.terms_version is distinct from new.cancellation_terms_version
         or consent.early_start_requested is distinct from (new.early_start_requested_at is not null)
         or consent.created_at > new.deposit_paid_at then
        raise exception 'A payment can only be recorded with the customer''s consent record for this booking, price and terms';
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
    -- CONCURRENCY: when emptying room or photo records, first block changes to
    -- bookings (SHARE lock) so a payment being recorded right now finishes
    -- before the check. (TRUNCATE of enquiries itself already holds an
    -- exclusive lock on it.)
    if tg_table_name <> 'enquiries' then
      lock table public.enquiries in share mode;
    end if;
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

  -- Room/extra records and photo records of a paid booking are part of what
  -- the customer paid for: they can't be added to, changed or removed
  -- afterwards – by anyone, including the website server. Reading them is
  -- unaffected. SECURITY DEFINER so the check always sees the booking,
  -- whatever the caller's row-level access.
  --
  -- CONCURRENCY: the check first LOCKS the booking row(s) (FOR SHARE). A
  -- payment being recorded at the same moment holds an update lock on that
  -- row, so this change waits until the payment commits or rolls back, then
  -- re-reads the booking and is refused if it is now paid. In the other order,
  -- the payment waits for this change to finish. Either way one clear order.
  create or replace function public.protect_paid_booking_records()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
  begin
    perform 1 from public.enquiries e
    where e.id in (case when tg_op <> 'INSERT' then old.enquiry_id end, case when tg_op <> 'DELETE' then new.enquiry_id end)
    order by e.id
    for share of e;
    if tg_op in ('UPDATE', 'DELETE')
       and exists (select 1 from public.enquiries where id = old.enquiry_id and deposit_paid_at is not null) then
      raise exception '% of a paid booking cannot be changed or removed', case tg_table_name when 'quote_rooms' then 'Room records' else 'Photo records' end;
    end if;
    if tg_op in ('INSERT', 'UPDATE')
       and exists (select 1 from public.enquiries where id = new.enquiry_id and deposit_paid_at is not null) then
      raise exception '% cannot be added to a paid booking', case tg_table_name when 'quote_rooms' then 'Room records' else 'Photo records' end;
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end;
  $fn$;
  revoke all on function public.protect_paid_booking_records() from public, anon, authenticated;
  -- (an earlier draft used a quote_rooms-only function; never applied to production)
  drop trigger if exists quote_rooms_protect_paid on public.quote_rooms;
  drop function if exists public.protect_paid_quote_rooms();

  -- Refund record rules (SECURITY DEFINER: the checks must see every row):
  --  * a new refund must match its ORIGINAL payment in the payment log: same
  --    booking and same currency, and all refunds of that payment together
  --    (except failed/cancelled ones) can never exceed it. The payment row is
  --    locked while checking, so two refunds at once can't both slip through;
  --  * afterwards only Stripe's real status changes can be recorded:
  --    pending/requires action -> any outcome, succeeded -> failed (Stripe can
  --    report a refund failing after it succeeded); failed and cancelled are final;
  --  * nothing else can change – including the booking link – and refunds
  --    can't be deleted or truncated.
  create or replace function public.protect_refund_log()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
  declare
    pay record;
    already bigint;
    allowed_status_changes constant text[] := array[
      'pending>requires_action', 'pending>succeeded', 'pending>failed', 'pending>canceled',
      'requires_action>pending', 'requires_action>succeeded', 'requires_action>failed', 'requires_action>canceled',
      'succeeded>failed'];
  begin
    if tg_op = 'TRUNCATE' then
      if exists (select 1 from public.refunds) then
        raise exception 'The refund record cannot be truncated';
      end if;
      return null;
    end if;
    if tg_op = 'DELETE' then
      raise exception 'Refund records cannot be deleted';
    end if;
    if tg_op = 'INSERT' then
      select p.amount_pence, p.currency, p.enquiry_id into pay
      from public.payments p where p.stripe_payment_intent_id = new.stripe_payment_intent_id
      for update;
      if not found then
        raise exception 'A refund must refer to a payment in the payment log';
      end if;
      if new.enquiry_id is distinct from pay.enquiry_id then
        raise exception 'A refund must belong to the same booking as the original payment';
      end if;
      if new.currency is distinct from lower(pay.currency) then
        raise exception 'A refund must be in the currency of the original payment (%)', pay.currency;
      end if;
      if new.status in ('pending', 'requires_action', 'succeeded') then
        select coalesce(sum(r.amount_pence), 0) into already from public.refunds r
        where r.stripe_payment_intent_id = new.stripe_payment_intent_id and r.status in ('pending', 'requires_action', 'succeeded');
        if already + new.amount_pence > pay.amount_pence then
          raise exception 'Refunds would exceed the original payment (% already refunded of %)', already, pay.amount_pence;
        end if;
      end if;
      return new;
    end if;
    -- UPDATE
    if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception 'Refund records cannot be changed (only the Stripe status can be updated)';
    end if;
    if new.status is distinct from old.status and not ((old.status || '>' || new.status) = any (allowed_status_changes)) then
      raise exception 'Refund status cannot change from % to %', old.status, new.status;
    end if;
    return new;
  end;
  $fn$;
  revoke all on function public.protect_refund_log() from public, anon, authenticated;

  -- Consent evidence rules (SECURITY DEFINER: the checks must see every row;
  -- the booking row is locked before checking, see protect_paid_booking_records):
  -- a consent can only be recorded for a booking that is awaiting payment,
  -- for exactly its agreed price; afterwards it can never be changed,
  -- deleted or truncated.
  create or replace function public.protect_consent_log()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
  begin
    if tg_op = 'TRUNCATE' then
      if exists (select 1 from public.booking_consents) then
        raise exception 'The consent record cannot be truncated';
      end if;
      return null;
    end if;
    if tg_op = 'INSERT' then
      -- Lock the booking first (FOR SHARE): a concurrent price change, withdrawal
      -- or payment finishes before this check reads it
      perform 1 from public.enquiries e where e.id = new.enquiry_id for share of e;
      if not exists (select 1 from public.enquiries e
                     where e.id = new.enquiry_id and e.status = 'deposit_requested' and e.deposit_paid_at is null
                       and e.agreed_price_pence = new.amount_pence) then
        raise exception 'Consent can only be recorded for a booking awaiting payment, for its agreed price';
      end if;
      return new;
    end if;
    raise exception 'Consent records cannot be changed or deleted';
  end;
  $fn$;
  revoke all on function public.protect_consent_log() from public, anon, authenticated;

  -- New tables created by postgres in this schema would otherwise give the
  -- website server TRUNCATE/TRIGGER/REFERENCES/MAINTAIN automatically
  -- (existing tables were already corrected by the api_grants migration).
  -- MAINTAIN only exists from PostgreSQL 17 (Supabase runs 17); on 16 the keyword would be a syntax error.
  if current_setting('server_version_num')::int >= 170000 then
    execute 'alter default privileges for role postgres in schema public revoke truncate, trigger, references, maintain on tables from service_role';
  else
    execute 'alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from service_role';
  end if;

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
    for each row execute function public.protect_paid_booking_records();

  drop trigger if exists enquiry_photos_protect_paid on public.enquiry_photos;
  create trigger enquiry_photos_protect_paid before insert or update or delete on public.enquiry_photos
    for each row execute function public.protect_paid_booking_records();

  drop trigger if exists booking_consents_append_only on public.booking_consents;
  create trigger booking_consents_append_only before insert or update or delete on public.booking_consents
    for each row execute function public.protect_consent_log();

  drop trigger if exists booking_consents_prevent_truncate on public.booking_consents;
  create trigger booking_consents_prevent_truncate before truncate on public.booking_consents
    for each statement execute function public.protect_consent_log();

  drop trigger if exists refunds_append_only on public.refunds;
  create trigger refunds_append_only before insert or update or delete on public.refunds
    for each row execute function public.protect_refund_log();

  drop trigger if exists refunds_prevent_truncate on public.refunds;
  create trigger refunds_prevent_truncate before truncate on public.refunds
    for each statement execute function public.protect_refund_log();

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
  foreach grp in array array['protect_payment_fields:false', 'prevent_paid_enquiry_delete:false', 'prevent_paid_enquiry_truncate:true', 'protect_payment_log:true', 'protect_paid_booking_records:true', 'protect_refund_log:true', 'protect_consent_log:true'] loop
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
    'quote_rooms:quote_rooms_protect_paid:protect_paid_booking_records:31',              -- BEFORE INSERT OR UPDATE OR DELETE, FOR EACH ROW
    'enquiry_photos:enquiry_photos_protect_paid:protect_paid_booking_records:31',
    'booking_consents:booking_consents_append_only:protect_consent_log:31',
    'booking_consents:booking_consents_prevent_truncate:protect_consent_log:34',
    'payments:payments_append_only:protect_payment_log:27',                     -- BEFORE UPDATE OR DELETE, FOR EACH ROW
    'payments:payments_prevent_truncate:protect_payment_log:34',
    'refunds:refunds_append_only:protect_refund_log:31',
    'refunds:refunds_prevent_truncate:protect_refund_log:34'
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
    'service_role:enquiry_photos:SELECT,INSERT,UPDATE,DELETE', 'service_role:payments:SELECT,INSERT,UPDATE,DELETE',
    'anon:refunds:', 'authenticated:refunds:SELECT', 'service_role:refunds:SELECT,INSERT,UPDATE',
    'anon:booking_consents:', 'authenticated:booking_consents:SELECT', 'service_role:booking_consents:SELECT,INSERT'
  ] loop
    fields := array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
    if current_setting('server_version_num')::int >= 170000 then
      fields := array_append(fields, 'MAINTAIN'::text);
    end if;
    foreach f in array fields loop
      if has_table_privilege(split_part(grp, ':', 1), format('public.%I', split_part(grp, ':', 2)), f)
         is distinct from coalesce(f = any (string_to_array(nullif(split_part(grp, ':', 3), ''), ',')), false) then
        raise exception 'Verification failed: % % on % is not as intended', split_part(grp, ':', 1), f, split_part(grp, ':', 2);
      end if;
      -- A column-level grant would give access that the table-level check above can't see
      if f in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
         and has_any_column_privilege(split_part(grp, ':', 1), format('public.%I', split_part(grp, ':', 2)), f)
             is distinct from coalesce(f = any (string_to_array(nullif(split_part(grp, ':', 3), ''), ',')), false) then
        raise exception 'Verification failed: % has column-level % on % that is not intended', split_part(grp, ':', 1), f, split_part(grp, ':', 2);
      end if;
    end loop;
  end loop;

  -- Row-level security policies on every booking table must be exactly the admin-only set
  select string_agg(x, '; ' order by x) into k from (
    (select 'unexpected policy ' || p.tablename || ': ' || p.policyname as x from pg_policies p
     where p.schemaname = 'public' and p.tablename in ('enquiries', 'quote_rooms', 'enquiry_photos', 'payments', 'refunds', 'booking_consents')
       and (p.tablename || '|' || p.policyname || '|' || p.cmd || '|' || array_to_string(p.roles, ',') || '|'
            || replace(coalesce(p.qual, ''), 'public.', '') || '|' || replace(coalesce(p.with_check, ''), 'public.', '')) <> all (booking_policies))
    union all
    (select 'missing policy ' || split_part(e, '|', 1) || ': ' || split_part(e, '|', 2) from unnest(booking_policies) e
     where not exists (select 1 from pg_policies p where p.schemaname = 'public'
       and (p.tablename || '|' || p.policyname || '|' || p.cmd || '|' || array_to_string(p.roles, ',') || '|'
            || replace(coalesce(p.qual, ''), 'public.', '') || '|' || replace(coalesce(p.with_check, ''), 'public.', '')) = e))
  ) d;
  if k is not null then
    raise exception 'Verification failed: row-level security policies are not as intended (%)', k;
  end if;

  -- Every rule this migration relies on exists and is validated (applies to all existing rows)
  select string_agg(e, ', ') into k from unnest(our_constraints) e
  where not exists (select 1 from pg_constraint con
                    where con.conrelid = format('public.%I', split_part(e, ':', 1))::regclass
                      and con.conname = split_part(e, ':', 2) and con.convalidated);
  if k is not null then
    raise exception 'Verification failed: rules missing or not validated: %', k;
  end if;

  -- Row-level security must be on for every booking table
  select string_agg(c.relname, ', ') into k from pg_class c
  where c.oid in ('public.enquiries'::regclass, 'public.quote_rooms'::regclass, 'public.enquiry_photos'::regclass,
                  'public.payments'::regclass, 'public.refunds'::regclass, 'public.booking_consents'::regclass)
    and not c.relrowsecurity;
  if k is not null then
    raise exception 'Verification failed: row-level security is off for %', k;
  end if;

  -- No role other than each table's OWNER and superusers may TRUNCATE, add
  -- triggers to, or (apart from the two application roles checked above) write
  -- to the booking tables – whatever the roles are called, and including rights
  -- gained through role membership (e.g. a role granted the owner role or
  -- pg_write_all_data). Built-in pg_* roles themselves are skipped; any role
  -- given their rights is still checked.
  select string_agg(distinct r.rolname || ' (' || c.relname || ' ' || p.priv || ')', ', ') into k
  from pg_roles r
  cross join pg_class c
  cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('TRIGGER')) p(priv)
  where c.oid in ('public.enquiries'::regclass, 'public.quote_rooms'::regclass, 'public.enquiry_photos'::regclass,
                  'public.payments'::regclass, 'public.refunds'::regclass, 'public.booking_consents'::regclass)
    and r.oid <> c.relowner
    and not r.rolsuper
    and r.rolname !~ '^pg_'
    and not (r.rolname in ('service_role', 'authenticated') and p.priv in ('INSERT', 'UPDATE', 'DELETE'))
    and (has_table_privilege(r.oid, c.oid, p.priv)
         or (p.priv in ('INSERT', 'UPDATE') and has_any_column_privilege(r.oid, c.oid, p.priv)));
  if k is not null then
    raise exception 'Verification failed: unexpected roles can change booking data: %', k;
  end if;
  select count(*) into n
  from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
  where c.oid in ('public.enquiries'::regclass, 'public.quote_rooms'::regclass, 'public.enquiry_photos'::regclass, 'public.payments'::regclass, 'public.refunds'::regclass, 'public.booking_consents'::regclass)
    and a.grantee = 0;
  if n > 0 then
    raise exception 'Verification failed: PUBLIC has privileges on a booking table';
  end if;

  -- Roles that CAN truncate (owner/superuser or any later grant) are all subject to the guards above
  select string_agg(distinct r.rolname, ', ' order by r.rolname) into k
  from pg_roles r
  cross join (values ('public.enquiries'), ('public.quote_rooms'), ('public.enquiry_photos'), ('public.payments'), ('public.refunds'), ('public.booking_consents')) t(tbl)
  where has_table_privilege(r.oid, t.tbl::regclass, 'TRUNCATE');
  raise notice 'For information – roles able to TRUNCATE booking tables (only the owner and superusers are allowed; all are subject to the truncate guards): %', coalesce(k, 'none');
end
$migration$;
