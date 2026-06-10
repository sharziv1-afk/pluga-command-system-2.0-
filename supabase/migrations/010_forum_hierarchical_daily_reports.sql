-- Forum hierarchical daily reports.
-- This supersedes the prototype forum_daily_summaries model from 009.

create table if not exists public.forum_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,

  company_unit_id uuid references public.units(id) on delete set null,
  platoon_unit_id uuid references public.units(id) on delete set null,
  squad_unit_id uuid references public.units(id) on delete set null,

  report_level text not null check (report_level in ('squad','platoon','company','staff')),
  staff_role text null check (
    staff_role is null or staff_role in (
      'medic',
      'assistant_commander',
      'logistics_nco',
      'deputy_commander'
    )
  ),

  parent_report_id uuid references public.forum_daily_reports(id) on delete set null,

  created_by uuid references public.users(id) on delete set null,
  owner_user_id uuid references public.users(id) on delete set null,

  status text not null default 'draft' check (status in ('draft','in_progress','submitted','closed')),

  content jsonb not null default '{}'::jsonb,
  summary_text text,
  whatsapp_text text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (report_date, report_level, owner_user_id)
);

create index if not exists idx_forum_daily_reports_date_level
  on public.forum_daily_reports(report_date desc, report_level);

create index if not exists idx_forum_daily_reports_owner_date
  on public.forum_daily_reports(owner_user_id, report_date desc);

create index if not exists idx_forum_daily_reports_company_date
  on public.forum_daily_reports(company_unit_id, report_date desc);

create index if not exists idx_forum_daily_reports_platoon_date
  on public.forum_daily_reports(platoon_unit_id, report_date desc);

create index if not exists idx_forum_daily_reports_squad_date
  on public.forum_daily_reports(squad_unit_id, report_date desc);

create index if not exists idx_forum_daily_reports_status
  on public.forum_daily_reports(status);

drop trigger if exists set_forum_daily_reports_updated_at on public.forum_daily_reports;
create trigger set_forum_daily_reports_updated_at
  before update on public.forum_daily_reports
  for each row
  execute function set_updated_at();

alter table public.forum_daily_reports enable row level security;

-- J1. Owners can read their own reports.
drop policy if exists "forum_daily_reports: owner select own" on public.forum_daily_reports;
create policy "forum_daily_reports: owner select own"
  on public.forum_daily_reports
  for select
  to authenticated
  using (
    owner_user_id = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  );

-- J2. Approved active users can insert reports only for themselves.
drop policy if exists "forum_daily_reports: owner insert own" on public.forum_daily_reports;
create policy "forum_daily_reports: owner insert own"
  on public.forum_daily_reports
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
        and owner_user_id = u.id
    )
  );

-- J3. Owners can update their own reports.
drop policy if exists "forum_daily_reports: owner update own" on public.forum_daily_reports;
create policy "forum_daily_reports: owner update own"
  on public.forum_daily_reports
  for update
  to authenticated
  using (
    owner_user_id = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  )
  with check (
    owner_user_id = (
      select u.id
      from public.users u
      where u.auth_user_id = auth.uid()
      limit 1
    )
  );

-- J4. Commanders can read every daily report.
drop policy if exists "forum_daily_reports: commander select all" on public.forum_daily_reports;
create policy "forum_daily_reports: commander select all"
  on public.forum_daily_reports
  for select
  to authenticated
  using (public.is_commander(auth.uid()));

-- J5. Commanders can update every daily report.
drop policy if exists "forum_daily_reports: commander update all" on public.forum_daily_reports;
create policy "forum_daily_reports: commander update all"
  on public.forum_daily_reports
  for update
  to authenticated
  using (public.is_commander(auth.uid()))
  with check (public.is_commander(auth.uid()));

-- J6 intentionally deferred:
-- Same-platoon/company visibility requires a verified unit hierarchy mapping.
-- Until then, platoon/staff scoping is UI-gated and owner/commander RLS remains the DB guard.

-- Run manually in Supabase SQL editor. Do not run automatically.
