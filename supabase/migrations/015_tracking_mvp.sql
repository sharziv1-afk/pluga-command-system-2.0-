-- 015_tracking_mvp.sql
-- Tracking Module MVP draft.
--
-- STATUS: Draft for review only.
-- PURPOSE: Company-wide spreadsheet-style tracking:
--   soldiers = rows, tracking_items = columns, tracking_records = cells.
--
-- Do not run automatically.
-- Review manually before applying in Supabase SQL Editor.

-- ============================================================
-- A. Tracking helper functions
-- ============================================================

-- Current active/approved public.users row for auth.uid().
-- Kept small and reusable so RLS policies do not duplicate profile lookups.
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.status = 'active'
    and u.role_approval_status = 'approved'
  limit 1
$$;

-- Read scope: prefer commanded_unit_id when present, fallback to unit_id.
-- This follows the Tracking MVP decision but still requires review against live data.
create or replace function public.current_tracking_unit_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.commanded_unit_id, u.unit_id)
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.status = 'active'
    and u.role_approval_status = 'approved'
  limit 1
$$;

-- Tracking-only command scope.
-- The global public.is_commander(auth_id) intentionally stays unchanged.
-- For Tracking MVP, assistant company commander (ע.מ"פ / ע. מ"פ) receives the
-- same full-company access as MP/SMP.
-- Currently production may have no assistant commander user, but any future
-- approved active user with role `ע. מ״פ` must get full Tracking access via
-- is_tracking_commander.
create or replace function public.is_tracking_commander(auth_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
  v_approval text;
  v_level integer;
  v_normalized_role text;
  v_compact_role text;
begin
  if public.is_commander(auth_id) then
    return true;
  end if;

  select u.role, u.status, u.role_approval_status, u.permission_level
    into v_role, v_status, v_approval, v_level
    from public.users u
   where u.auth_user_id = auth_id
   limit 1;

  if not found then
    return false;
  end if;

  if v_status <> 'active' or v_approval <> 'approved' then
    return false;
  end if;

  v_normalized_role := btrim(
    translate(
      coalesce(v_role, ''),
      chr(1524) || chr(1523) || chr(39) || chr(34) || chr(180) || chr(8220) || chr(8221),
      '"""""""'
    )
  );
  v_compact_role := replace(v_normalized_role, ' ', '');

  return
    v_compact_role = U&'\05E2.\05DE"\05E4'
    or v_level >= 90;
end;
$$;

-- Edit scope for Tracking MVP.
-- Tracking commanders edit everything through public.is_tracking_commander(auth.uid()).
-- Platoon commanders (role starts with mem-mem, normalized for Hebrew gershayim)
-- may edit only tracking_records for their commanded unit, falling back to unit_id if
-- commanded_unit_id is null. This requires a production snapshot before manual SQL run.
-- Squad commanders remain read-only in MVP because there is no squads table yet.
create or replace function public.can_edit_tracking_unit(target_unit_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
  v_approval text;
  v_unit_id uuid;
  v_commanded_unit_id uuid;
  v_normalized_role text;
begin
  if target_unit_id is null then
    return false;
  end if;

  if public.is_tracking_commander(auth.uid()) then
    return true;
  end if;

  select u.role, u.status, u.role_approval_status, u.unit_id, u.commanded_unit_id
    into v_role, v_status, v_approval, v_unit_id, v_commanded_unit_id
    from public.users u
   where u.auth_user_id = auth.uid()
   limit 1;

  if not found then
    return false;
  end if;

  if v_status <> 'active' or v_approval <> 'approved' then
    return false;
  end if;

  -- Normalize the quote variants seen in Hebrew role labels:
  -- Hebrew gershayim, Hebrew geresh, straight quotes, acute accent, and smart quotes.
  -- This keeps "מ״מ", "מ"מ", "מ׳מ", and similar variants comparable.
  v_normalized_role := btrim(
    translate(
      coalesce(v_role, ''),
      chr(1524) || chr(1523) || chr(39) || chr(34) || chr(180) || chr(8220) || chr(8221),
      '"""""""'
    )
  );

  return
    v_normalized_role like U&'\05DE"\05DE%'
    and coalesce(v_commanded_unit_id, v_unit_id) = target_unit_id;
end;
$$;

revoke execute on function public.current_app_user_id() from public;
revoke execute on function public.current_app_user_id() from anon;
grant execute on function public.current_app_user_id() to authenticated;

revoke execute on function public.current_tracking_unit_id() from public;
revoke execute on function public.current_tracking_unit_id() from anon;
grant execute on function public.current_tracking_unit_id() to authenticated;

revoke execute on function public.is_tracking_commander(uuid) from public;
revoke execute on function public.is_tracking_commander(uuid) from anon;
grant execute on function public.is_tracking_commander(uuid) to authenticated;

revoke execute on function public.can_edit_tracking_unit(uuid) from public;
revoke execute on function public.can_edit_tracking_unit(uuid) from anon;
grant execute on function public.can_edit_tracking_unit(uuid) to authenticated;

-- ============================================================
-- B. Tables
-- ============================================================

create table if not exists public.soldiers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  personal_number text,
  unit_id uuid not null references public.units(id) on delete restrict,
  squad_label text,
  role_label text,
  notes text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  subject text,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_records (
  id uuid primary key default gen_random_uuid(),
  soldier_id uuid not null references public.soldiers(id) on delete restrict,
  tracking_item_id uuid not null references public.tracking_items(id) on delete restrict,
  status text not null default 'empty',
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracking_records_status_check
    check (status in ('empty', 'passed', 'failed', 'makeup')),
  constraint tracking_records_soldier_item_unique
    unique (soldier_id, tracking_item_id)
);

-- ============================================================
-- C. Indexes
-- ============================================================

create index if not exists idx_soldiers_unit_id
  on public.soldiers(unit_id);

create index if not exists idx_soldiers_squad_label
  on public.soldiers(squad_label);

create index if not exists idx_soldiers_is_active
  on public.soldiers(is_active);

-- Optional personal number. Empty strings are treated as missing for uniqueness.
create unique index if not exists idx_soldiers_personal_number_unique
  on public.soldiers(lower(btrim(personal_number)))
  where personal_number is not null
    and btrim(personal_number) <> '';

create index if not exists idx_tracking_items_category
  on public.tracking_items(category);

create index if not exists idx_tracking_items_subject
  on public.tracking_items(subject);

create index if not exists idx_tracking_items_is_active
  on public.tracking_items(is_active);

create index if not exists idx_tracking_items_sort_order
  on public.tracking_items(sort_order);

create index if not exists idx_tracking_items_category_sort_order
  on public.tracking_items(category, sort_order);

create index if not exists idx_tracking_records_soldier_id
  on public.tracking_records(soldier_id);

create index if not exists idx_tracking_records_tracking_item_id
  on public.tracking_records(tracking_item_id);

create index if not exists idx_tracking_records_status
  on public.tracking_records(status);

create index if not exists idx_tracking_records_item_status
  on public.tracking_records(tracking_item_id, status);

-- ============================================================
-- D. Updated-at triggers
-- ============================================================

drop trigger if exists set_soldiers_updated_at on public.soldiers;
create trigger set_soldiers_updated_at
  before update on public.soldiers
  for each row execute function public.set_updated_at();

drop trigger if exists set_tracking_items_updated_at on public.tracking_items;
create trigger set_tracking_items_updated_at
  before update on public.tracking_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_tracking_records_updated_at on public.tracking_records;
create trigger set_tracking_records_updated_at
  before update on public.tracking_records
  for each row execute function public.set_updated_at();

-- ============================================================
-- E. RLS draft
-- ============================================================

alter table public.soldiers enable row level security;
alter table public.tracking_items enable row level security;
alter table public.tracking_records enable row level security;

-- soldiers: commanders see all; active/approved users see their effective unit.
-- Roster management is commander-only in MVP. Platoon commanders can update
-- tracking_records, but they cannot create/update/soft-delete soldiers yet.
drop policy if exists "soldiers: commander select all" on public.soldiers;
create policy "soldiers: commander select all"
  on public.soldiers
  for select
  to authenticated
  using (public.is_tracking_commander(auth.uid()));

drop policy if exists "soldiers: select own tracking unit" on public.soldiers;
create policy "soldiers: select own tracking unit"
  on public.soldiers
  for select
  to authenticated
  using (
    unit_id = public.current_tracking_unit_id()
  );

drop policy if exists "soldiers: insert tracking unit editors" on public.soldiers;
drop policy if exists "soldiers: commander insert" on public.soldiers;
create policy "soldiers: commander insert"
  on public.soldiers
  for insert
  to authenticated
  with check (public.is_tracking_commander(auth.uid()));

drop policy if exists "soldiers: update tracking unit editors" on public.soldiers;
drop policy if exists "soldiers: commander update" on public.soldiers;
create policy "soldiers: commander update"
  on public.soldiers
  for update
  to authenticated
  using (public.is_tracking_commander(auth.uid()))
  with check (public.is_tracking_commander(auth.uid()));

-- No soldiers delete policy: MVP uses soft delete via is_active=false.

-- tracking_items: company-wide column definitions.
-- All active/approved users may read item definitions; only commanders may create/update them in MVP.
drop policy if exists "tracking_items: active approved select" on public.tracking_items;
create policy "tracking_items: active approved select"
  on public.tracking_items
  for select
  to authenticated
  using (public.current_app_user_id() is not null);

drop policy if exists "tracking_items: commander insert" on public.tracking_items;
create policy "tracking_items: commander insert"
  on public.tracking_items
  for insert
  to authenticated
  with check (public.is_tracking_commander(auth.uid()));

drop policy if exists "tracking_items: commander update" on public.tracking_items;
create policy "tracking_items: commander update"
  on public.tracking_items
  for update
  to authenticated
  using (public.is_tracking_commander(auth.uid()))
  with check (public.is_tracking_commander(auth.uid()));

-- No tracking_items delete policy: MVP uses soft delete via is_active=false.

-- tracking_records: cells inherit visibility/editability from their soldier row.
drop policy if exists "tracking_records: select visible soldiers" on public.tracking_records;
create policy "tracking_records: select visible soldiers"
  on public.tracking_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.soldiers s
      where s.id = tracking_records.soldier_id
        and (
          public.is_tracking_commander(auth.uid())
          or s.unit_id = public.current_tracking_unit_id()
        )
    )
  );

drop policy if exists "tracking_records: insert tracking unit editors" on public.tracking_records;
create policy "tracking_records: insert tracking unit editors"
  on public.tracking_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.soldiers s
      where s.id = tracking_records.soldier_id
        and public.can_edit_tracking_unit(s.unit_id)
    )
  );

drop policy if exists "tracking_records: update tracking unit editors" on public.tracking_records;
create policy "tracking_records: update tracking unit editors"
  on public.tracking_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.soldiers s
      where s.id = tracking_records.soldier_id
        and public.can_edit_tracking_unit(s.unit_id)
    )
  )
  with check (
    exists (
      select 1
      from public.soldiers s
      where s.id = tracking_records.soldier_id
        and public.can_edit_tracking_unit(s.unit_id)
    )
  );

-- No tracking_records delete policy in MVP. Keep history stable and update status/note instead.

-- Requires review before manual SQL execution:
-- 1. Verify commanded_unit_id is populated for platoon commanders in live Supabase.
-- 2. Verify role strings for platoon commanders normalize to values starting with mem-mem.
-- 3. Verify regular squad commanders can read only their effective unit and cannot update records.

-- ============================================================
-- F. Production snapshot queries - read-only, do not run automatically
-- ============================================================
--
-- Run these manually before applying this migration to production:
--
-- 0. Assistant commander Tracking full-access candidates:
-- Currently production may have no assistant commander user, but any future
-- approved active user with role `ע. מ״פ` must get full Tracking access via
-- is_tracking_commander.
-- select u.id, u.email, u.name, u.role, u.unit_id, u.commanded_unit_id, u.permission_level, u.status, u.role_approval_status
-- from public.users u
-- where u.status = 'active'
--   and u.role_approval_status = 'approved'
--   and (
--     replace(u.role, ' ', '') ilike '%ע.מ%פ%'
--     or u.role ilike '%ע. מ%פ%'
--     or u.role ilike '%ע.מ"%פ%'
--     or u.role ilike '%ע. מ"%פ%'
--     or u.role ilike '%ע. מ״פ%'
--     or u.role ilike '%ע.מ״פ%'
--   )
-- order by u.role, u.name;
--
-- 1. Platoon commander role strings and unit mapping:
-- select u.id, u.email, u.name, u.role, u.unit_id, u.commanded_unit_id, u.permission_level, u.status, u.role_approval_status
-- from public.users u
-- where u.status = 'active'
--   and u.role_approval_status = 'approved'
--   and (
--     u.role ilike '%מ%מ%'
--     or u.role ilike '%מ"%מ%'
--     or u.role ilike '%מ״מ%'
--   )
-- order by u.role, u.name;
--
-- 2. Verify commanded_unit_id fallback for approved active platoon commanders:
-- select u.role, count(*) as total,
--        count(u.commanded_unit_id) as with_commanded_unit,
--        count(u.unit_id) as with_unit
-- from public.users u
-- where u.status = 'active'
--   and u.role_approval_status = 'approved'
--   and (
--     u.role ilike '%מ%מ%'
--     or u.role ilike '%מ"%מ%'
--     or u.role ilike '%מ״מ%'
--   )
-- group by u.role
-- order by u.role;
--
-- 3. Check that no non-platoon roles would be mistaken for mem-mem roles:
-- select u.id, u.email, u.name, u.role, u.unit_id, u.commanded_unit_id, u.permission_level
-- from public.users u
-- where u.status = 'active'
--   and u.role_approval_status = 'approved'
--   and (
--     u.role ilike 'מ%'
--     or u.role ilike '%מ״%'
--     or u.role ilike '%מ"%'
--   )
-- order by u.role, u.name;
--
-- 4. Permission levels in reference roles:
-- select name, permission_level
-- from public.roles
-- order by permission_level desc, name;
--
-- 5. Existing platoon/company units:
-- select id, name, code, parent_unit_id
-- from public.units
-- where code in ('company', 'platoon_1', 'platoon_2', 'platoon_3', 'platoon_4')
--    or name ilike '%מחלקה%'
--    or name ilike '%פלוגה%'
-- order by code nulls last, name;
