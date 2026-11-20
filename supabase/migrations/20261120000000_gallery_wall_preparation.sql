-- Adds a "Wall preparation" category to the gallery.
-- Run AFTER the earlier migrations: Supabase → SQL Editor → paste → Run.
alter table public.gallery_items drop constraint if exists gallery_items_category_check;
alter table public.gallery_items add constraint gallery_items_category_check
  check (category in ('bedrooms', 'living_rooms', 'skirting_boards', 'wall_preparation'));
