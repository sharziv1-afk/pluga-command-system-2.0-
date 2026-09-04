-- 026_tracking_weeks.sql
-- Formalizes what the commander was already doing informally: every
-- tracking_items row so far shares subject='שבוע מטווחים' — a free-text
-- "week" label with no real definition, no dates, and no way to browse or
-- search by it. This adds a real tracking_weeks entity (title + short
-- definition of what the week covers + date range) and links items to it,
-- while leaving tracking_items.subject/category untouched — subject stays as
-- free text for now (not removed), category becomes searchable in the UI.
--
-- Existing behavior is preserved: tracking_items.week_id is nullable, so the
-- current flat "all items" table view keeps working unchanged for any item
-- not assigned to a week.

create table if not exists public.tracking_weeks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tracking_items add column if not exists week_id uuid references public.tracking_weeks(id);
create index if not exists tracking_items_week_id_idx on public.tracking_items(week_id);

drop trigger if exists set_tracking_weeks_updated_at on public.tracking_weeks;
create trigger set_tracking_weeks_updated_at
  before update on public.tracking_weeks
  for each row execute function public.set_updated_at();

alter table public.tracking_weeks enable row level security;

-- Mirrors tracking_items' own policies exactly (026 follows 015's pattern):
-- any active/approved user reads week definitions, only a tracking commander
-- creates/edits them.
drop policy if exists "tracking_weeks: active approved select" on public.tracking_weeks;
create policy "tracking_weeks: active approved select"
  on public.tracking_weeks
  for select
  to authenticated
  using (public.current_app_user_id() is not null);

drop policy if exists "tracking_weeks: commander insert" on public.tracking_weeks;
create policy "tracking_weeks: commander insert"
  on public.tracking_weeks
  for insert
  to authenticated
  with check (public.is_tracking_commander(auth.uid()));

drop policy if exists "tracking_weeks: commander update" on public.tracking_weeks;
create policy "tracking_weeks: commander update"
  on public.tracking_weeks
  for update
  to authenticated
  using (public.is_tracking_commander(auth.uid()))
  with check (public.is_tracking_commander(auth.uid()));

-- Backfill: the 3 live items sharing subject='שבוע מטווחים' become the first
-- real week, preserving continuity instead of losing the existing grouping.
insert into public.tracking_weeks (title, description, sort_order)
select 'שבוע מטווחים', 'מטווחי אקדח ורובה ומבחן סיווג ירי.', 1
where exists (select 1 from public.tracking_items where subject = 'שבוע מטווחים')
  and not exists (select 1 from public.tracking_weeks where title = 'שבוע מטווחים');

update public.tracking_items
set week_id = (select id from public.tracking_weeks where title = 'שבוע מטווחים' limit 1)
where subject = 'שבוע מטווחים' and week_id is null;
