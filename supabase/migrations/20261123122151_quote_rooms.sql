-- =====================================================================
-- One row per room / service in each quote request.
-- Stores the customer's measurements and the estimated labour price for
-- that room, so they are easy to read and search (the full calculator
-- answers are still kept on the enquiry as well).
-- Run AFTER the earlier migrations.
--
-- NOTE (23 Nov 2026): this migration was already applied to the live
-- Supabase project but had not been committed to GitHub. It is copied here
-- verbatim from the live database so the repository matches production.
-- =====================================================================

create table if not exists public.quote_rooms (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  position integer not null check (position >= 0),
  item_type text not null check (item_type in ('bedroom', 'living_room', 'skirting', 'ceiling')),
  label text not null,
  measurement_mode text check (measurement_mode in ('simple', 'walls')),
  -- Measurements in metres (null when not used for this kind of item)
  length_m numeric(6, 2),
  width_m numeric(6, 2),
  height_m numeric(6, 2),
  walls jsonb,
  skirting_length_m numeric(7, 2),
  include_ceiling boolean not null default false,
  coats integer not null check (coats between 1 and 5),
  condition jsonb not null,
  -- Areas worked out by the pricing engine
  wall_area_sqm numeric(8, 2),
  ceiling_area_sqm numeric(8, 2),
  -- Estimated labour for this item, in pence, before the whole-quote rounding.
  -- Null when the item needs a manual quotation.
  estimated_labour_pence integer check (estimated_labour_pence is null or estimated_labour_pence >= 0),
  requires_manual_quote boolean not null default false,
  created_at timestamptz not null default now(),
  unique (enquiry_id, position)
);

create index if not exists quote_rooms_enquiry_idx on public.quote_rooms (enquiry_id);

alter table public.quote_rooms enable row level security;

-- Customers never read this table. Rows are written only by the website
-- server (secret key); only admins can read them.
create policy "Admins can read quote rooms"
  on public.quote_rooms for select to authenticated using (public.is_admin());
