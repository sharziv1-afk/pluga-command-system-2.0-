-- 018_gaps.sql
-- Gaps (פערים) — logistical / training / scheduling gaps that are not
-- necessarily tasks yet; a logistical gap can be converted to a formal
-- request (public.requests) from the UI. Ported from the thepluton
-- reference project, which was the one feature it had that this app
-- lacked entirely.
--
-- Policies follow the same shape already established for `requests` in
-- 002/006/007/017 — own / own-unit / commander-all / creator-update /
-- delete-closed — with auth.uid() wrapped in (select ...) from the start.

create table if not exists public.gaps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in ('לוגיסטי', 'הדרכתי', 'לו"זי')),
  reported_by uuid references public.users(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  urgency text not null default 'רגיל' check (urgency in ('רגיל', 'חשוב', 'דחוף', 'קריטי')),
  status text not null default 'פתוח' check (status in ('פתוח', 'בטיפול', 'ממתין לאישור', 'נסגר')),
  handler_id uuid references public.users(id) on delete set null,
  requires_commander_decision boolean not null default false,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gaps_unit_id on public.gaps(unit_id);
create index if not exists idx_gaps_status on public.gaps(status);
create index if not exists idx_gaps_category on public.gaps(category);
create index if not exists idx_gaps_created_by on public.gaps(created_by);

drop trigger if exists set_gaps_updated_at on public.gaps;
create trigger set_gaps_updated_at
  before update on public.gaps
  for each row execute function public.set_updated_at();

alter table public.gaps enable row level security;

drop policy if exists "gaps: insert own" on public.gaps;
create policy "gaps: insert own"
  on public.gaps for insert to authenticated
  with check ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

drop policy if exists "gaps: select own" on public.gaps;
create policy "gaps: select own"
  on public.gaps for select to authenticated
  using ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

drop policy if exists "gaps: select own unit" on public.gaps;
create policy "gaps: select own unit"
  on public.gaps for select to authenticated
  using (
    unit_id is not null
    and unit_id = (select unit_id from public.users where auth_user_id = (select auth.uid()) and unit_id is not null limit 1)
  );

drop policy if exists "gaps: commander select all" on public.gaps;
create policy "gaps: commander select all"
  on public.gaps for select to authenticated
  using ( public.is_commander((select auth.uid())) );

drop policy if exists "gaps: commander update all" on public.gaps;
create policy "gaps: commander update all"
  on public.gaps for update to authenticated
  using ( public.is_commander((select auth.uid())) )
  with check ( public.is_commander((select auth.uid())) );

drop policy if exists "gaps: creator update own" on public.gaps;
create policy "gaps: creator update own"
  on public.gaps for update to authenticated
  using ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) )
  with check ( created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1) );

drop policy if exists "gaps: delete closed" on public.gaps;
create policy "gaps: delete closed"
  on public.gaps for delete to authenticated
  using (
    status = 'נסגר'
    and (
      public.is_commander((select auth.uid()))
      or created_by = (select id from public.users where auth_user_id = (select auth.uid()) limit 1)
    )
  );
