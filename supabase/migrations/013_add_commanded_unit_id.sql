-- 013_add_commanded_unit_id.sql
-- Additive migration: adds commanded_unit_id to public.users.
-- This column identifies which unit a user commands, distinct from unit_id which represents membership.
-- Used for platoon-commander hierarchy mapping and future forum RLS policies.
-- Run manually in Supabase SQL Editor. Do not run automatically.

alter table public.users
  add column if not exists commanded_unit_id uuid
  references public.units(id) on delete set null;

create index if not exists idx_users_commanded_unit_id
  on public.users(commanded_unit_id);
