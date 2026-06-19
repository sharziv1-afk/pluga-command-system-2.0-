-- 014_reference_data_read_policies.sql
-- Reference data read policies for client-side role/unit selectors.
-- Applied manually in live Supabase on 2026-06-19 and recorded here for repo/DB sync.
-- These tables contain non-sensitive app metadata: unit names and role names.
--
-- Root cause: RLS was enabled on public.units / public.roles in the live database
-- without a SELECT policy, so the anon/authenticated client received zero rows.
-- This left the registration role/unit selectors and the Admin "מסגרת" / "יחידה בפיקוד"
-- dropdowns empty, blocking unit assignment during approval.
--
-- Run manually in Supabase SQL Editor. Do not run automatically. Idempotent.

alter table public.units enable row level security;

drop policy if exists "units: public read" on public.units;

create policy "units: public read"
  on public.units
  for select
  to anon, authenticated
  using (true);


alter table public.roles enable row level security;

drop policy if exists "roles: public read" on public.roles;

create policy "roles: public read"
  on public.roles
  for select
  to anon, authenticated
  using (true);
