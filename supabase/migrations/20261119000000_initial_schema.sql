-- =====================================================================
-- Painting & decorating website – initial database schema
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run
-- (or `supabase db push` if you use the Supabase CLI).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin users: only people listed here can use /admin.
-- After creating your login in Authentication → Users, run:
--   insert into public.admin_users (user_id) values ('<your user id>');
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Helper used by security policies. SECURITY DEFINER so it can read admin_users.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create policy "Admins can see the admin list"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- Settings: labour prices + business contact details (editable in /admin)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key check (key in ('pricing', 'business')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "Anyone can read public settings"
  on public.settings for select
  to anon, authenticated
  using (true);

create policy "Admins can insert settings"
  on public.settings for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update settings"
  on public.settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.settings (key, value) values
  ('pricing', '{
    "bedroom": {"ratePerSqm": 5.5, "minimumCharge": 185},
    "livingRoom": {"ratePerSqm": 5.5, "minimumCharge": 225},
    "skirting": {"ratePerMetre": 5, "minimumCharge": 65},
    "ceiling": {"ratePerSqm": 5.5, "minimumCharge": 65},
    "roundToNearest": 5,
    "standardCoats": 2
  }'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Customer enquiries from the quotation calculator
-- ---------------------------------------------------------------------
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quote_sent', 'accepted', 'scheduled', 'completed', 'declined', 'cancelled')),
  full_name text not null,
  email text not null,
  phone text not null,
  postcode text not null,
  preferred_contact text not null check (preferred_contact in ('phone', 'email', 'either')),
  preferred_start_date date,
  comments text,
  -- Everything the customer entered (rooms, measurements, condition answers)
  items jsonb not null,
  -- The server-calculated breakdown (lines, flags, totals)
  breakdown jsonb not null,
  -- The prices in force when the enquiry was made
  pricing_snapshot jsonb not null,
  estimated_total_pence integer not null,
  requires_manual_quote boolean not null default false,
  needs_review boolean not null default false,
  admin_notes text,
  contacted_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);
create index if not exists enquiries_status_idx on public.enquiries (status);

alter table public.enquiries enable row level security;

-- No public policies: customers submit through the website's server,
-- which uses the secret service-role key. Only admins can read/update.
create policy "Admins can read enquiries"
  on public.enquiries for select to authenticated using (public.is_admin());

create policy "Admins can update enquiries"
  on public.enquiries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete enquiries"
  on public.enquiries for delete to authenticated using (public.is_admin());

create table if not exists public.enquiry_photos (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  storage_path text not null,
  file_name text,
  content_type text,
  size_bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists enquiry_photos_enquiry_idx on public.enquiry_photos (enquiry_id);

alter table public.enquiry_photos enable row level security;

create policy "Admins can read enquiry photos"
  on public.enquiry_photos for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- General contact form messages
-- ---------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'replied', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "Admins can read contact messages"
  on public.contact_messages for select to authenticated using (public.is_admin());

create policy "Admins can update contact messages"
  on public.contact_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Gallery of completed work (your genuine before/after photos)
-- ---------------------------------------------------------------------
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bedrooms', 'living_rooms', 'skirting_boards')),
  title text not null,
  location text,
  before_path text,
  after_path text not null,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gallery_items enable row level security;

create policy "Anyone can see published gallery items"
  on public.gallery_items for select to anon, authenticated
  using (published or public.is_admin());

create policy "Admins can add gallery items"
  on public.gallery_items for insert to authenticated with check (public.is_admin());

create policy "Admins can update gallery items"
  on public.gallery_items for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete gallery items"
  on public.gallery_items for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Keep updated_at current
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists enquiries_touch on public.enquiries;
create trigger enquiries_touch before update on public.enquiries
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Storage buckets
--   enquiry-photos: PRIVATE. Customers upload via one-time signed URLs
--                   created by the server; only admins view them (via
--                   short-lived signed links).
--   gallery:        PUBLIC read (your portfolio). Only admins upload.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('enquiry-photos', 'enquiry-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('gallery', 'gallery', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read enquiry photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'enquiry-photos' and public.is_admin());

create policy "Admins can delete enquiry photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'enquiry-photos' and public.is_admin());

create policy "Admins can upload gallery files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_admin());

create policy "Admins can update gallery files"
  on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and public.is_admin());

create policy "Admins can delete gallery files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_admin());
