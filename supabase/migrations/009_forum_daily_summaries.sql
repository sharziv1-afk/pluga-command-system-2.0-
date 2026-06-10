-- Forum Phase 2A: daily commander forum summaries.

create table if not exists public.forum_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null,
  unit_id uuid references public.units(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  commander_opening text,
  platoon_updates jsonb not null default '{}'::jsonb,
  company_staff_updates jsonb not null default '{}'::jsonb,
  tomorrow_schedule text,
  parallel_schedule text,
  commander_closing text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, summary_date)
);

create index if not exists idx_forum_daily_summaries_unit_date
  on public.forum_daily_summaries(unit_id, summary_date desc);

create index if not exists idx_forum_daily_summaries_created_by
  on public.forum_daily_summaries(created_by);

drop trigger if exists set_forum_daily_summaries_updated_at on public.forum_daily_summaries;
create trigger set_forum_daily_summaries_updated_at
  before update on public.forum_daily_summaries
  for each row
  execute function set_updated_at();

alter table public.forum_daily_summaries enable row level security;

-- I1. Approved active authenticated users can read daily forum summaries.
drop policy if exists "forum_daily_summaries: approved active select" on public.forum_daily_summaries;
create policy "forum_daily_summaries: approved active select"
  on public.forum_daily_summaries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.auth_user_id = auth.uid()
        and u.status = 'active'
        and u.role_approval_status = 'approved'
    )
  );

-- I2. Authenticated users can insert summaries only for their own unit.
drop policy if exists "forum_daily_summaries: insert own unit" on public.forum_daily_summaries;
create policy "forum_daily_summaries: insert own unit"
  on public.forum_daily_summaries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.users u
      where u.auth_user_id = auth.uid()
        and u.status = 'active'
        and u.role_approval_status = 'approved'
        and created_by = u.id
        and unit_id = u.unit_id
    )
  );

-- I3. Creators can update summaries they created.
drop policy if exists "forum_daily_summaries: creator update own" on public.forum_daily_summaries;
create policy "forum_daily_summaries: creator update own"
  on public.forum_daily_summaries
  for update
  to authenticated
  using (
    created_by = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  )
  with check (
    created_by = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  );

-- I4. Commanders can update every daily forum summary.
drop policy if exists "forum_daily_summaries: commander update all" on public.forum_daily_summaries;
create policy "forum_daily_summaries: commander update all"
  on public.forum_daily_summaries
  for update
  to authenticated
  using (public.is_commander(auth.uid()))
  with check (public.is_commander(auth.uid()));

-- Run manually in Supabase SQL editor. Do not run automatically.
