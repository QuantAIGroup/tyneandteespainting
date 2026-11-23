-- =====================================================================
-- Table and function permissions for the Supabase API roles.
--
-- NOTE (23 Nov 2026): this migration was already applied to the live
-- Supabase project but had not been committed to GitHub. It is copied here
-- verbatim from the live database so the repository matches production.
--
-- Newer Supabase projects no longer give the API roles automatic read/write
-- access to new tables, but they DO give them TRUNCATE, TRIGGER, REFERENCES
-- and MAINTAIN by default. This file removes everything, then grants back
-- only what the website needs. Row Level Security policies still apply on
-- top of these grants (e.g. "authenticated" only sees enquiries if is_admin()).
--
--   PUBLIC        = every database role. Gets no table access at all.
--   anon          = website visitors (publishable key): read the price list
--                   and published gallery items only.
--   authenticated = logged-in users: only admins get rows back, via RLS.
--   service_role  = the website server (secret key): saves enquiries,
--                   room details and photo records.
--
-- Changes permissions only. No rows are changed or deleted.
-- =====================================================================

-- 1. Remove every table permission from PUBLIC, anon, authenticated and
--    service_role (includes TRUNCATE, TRIGGER, REFERENCES and MAINTAIN).
revoke all on table
  public.admin_users, public.settings, public.enquiries, public.enquiry_photos,
  public.contact_messages, public.gallery_items, public.payments,
  public.stripe_events, public.quote_rooms
from public, anon, authenticated, service_role;

-- 2. Visitors: the public price list and gallery, read-only
grant select on table public.settings, public.gallery_items to anon;

-- 3. Logged-in users (RLS limits every row to admins only)
grant select on table
  public.admin_users, public.settings, public.enquiries, public.enquiry_photos,
  public.contact_messages, public.gallery_items, public.payments, public.quote_rooms
to authenticated;
grant insert, update on table public.settings to authenticated;
grant update, delete on table public.enquiries to authenticated;
grant update on table public.contact_messages to authenticated;
grant insert, update, delete on table public.gallery_items to authenticated;

-- 4. Website server: read and write rows (no TRUNCATE)
grant select, insert, update, delete on table
  public.admin_users, public.settings, public.enquiries, public.enquiry_photos,
  public.contact_messages, public.gallery_items, public.payments,
  public.stripe_events, public.quote_rooms
to service_role;

-- 5. Functions
--    is_admin() is used inside the security policies, so the API roles
--    must be able to run it. It only answers "is the caller an admin?".
--    The two trigger functions run automatically on updates and should
--    not be callable by anyone directly.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.protect_payment_fields() from public, anon, authenticated;

-- 6. Future tables created by this project (role "postgres") will no
--    longer give TRUNCATE/TRIGGER/REFERENCES/MAINTAIN to PUBLIC, visitors
--    or logged-in users automatically.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from public, anon, authenticated;
