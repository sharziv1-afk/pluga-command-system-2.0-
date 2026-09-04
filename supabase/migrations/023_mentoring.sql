-- 023_mentoring.sql
-- "תיק חניכה" — a mentoring log the company commander (מ"פ) keeps for his
-- direct reports (4 מ"מ + סמ"פ today; מ"כים are explicitly out of scope for
-- now, per the commander). Modeled on the working מודל already proven in the
-- sibling project (PLUGA A APP: src/domain/mentoring.ts) — observation, focus,
-- agreed action, next check-in date — rather than inventing a new shape.
--
-- Deliberately does NOT duplicate personal data (name/role/unit already live
-- on public.users). Matches the exact privacy boundary already written down
-- in that sibling project's docs/notion-product-map.md: "no medical
-- diagnoses, no personnel file" — this table only ever holds mentoring
-- observations/actions the מ"פ chooses to write, never sensitive personal
-- data. commander_note gets the same FieldPrivacyHint treatment already used
-- elsewhere in this app for free-text sensitive fields (forum/tracking).
--
-- Access is intentionally stricter than the existing public.is_commander()
-- (which also grants סמ"פ) — this is מ"פ-only, both because it's a personal
-- coaching tool for him and because a סמ"פ seeing "notes about themselves and
-- their peers" would defeat the point.

create or replace function public.is_company_commander(auth_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text;
  v_status   text;
  v_approval text;
begin
  select role, status, role_approval_status
    into v_role, v_status, v_approval
    from public.users
   where auth_user_id = auth_id
   limit 1;

  if not found then
    return false;
  end if;

  if v_status <> 'active' or v_approval <> 'approved' then
    return false;
  end if;

  return v_role = 'מ"פ' or v_role = 'מ״פ';
end;
$$;

revoke execute on function public.is_company_commander(uuid) from public;
revoke execute on function public.is_company_commander(uuid) from anon;
grant execute on function public.is_company_commander(uuid) to authenticated;

create table if not exists public.mentoring_entries (
  id uuid primary key default gen_random_uuid(),
  mentee_user_id uuid not null references public.users(id) on delete cascade,
  created_by uuid not null references public.users(id),
  occurred_on date not null,
  observation text,
  focus text not null,
  agreed_action text not null,
  next_check_at date,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentoring_entries_mentee_idx on public.mentoring_entries(mentee_user_id, occurred_on desc);

drop trigger if exists set_mentoring_entries_updated_at on public.mentoring_entries;
create trigger set_mentoring_entries_updated_at
  before update on public.mentoring_entries
  for each row execute function public.set_updated_at();

alter table public.mentoring_entries enable row level security;

create policy "mentoring_entries: commander only"
  on public.mentoring_entries
  for all
  using ( public.is_company_commander((select auth.uid())) )
  with check ( public.is_company_commander((select auth.uid())) );
