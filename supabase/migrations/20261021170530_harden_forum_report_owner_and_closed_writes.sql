-- REVIEWED PROPOSAL: execute manually only after explicit approval.
-- No report/user rows, role assignments, or authentication settings are changed.
-- Preserve owner + commander access; require the owner to remain active/approved.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists "forum_daily_reports: owner select own" on public.forum_daily_reports;
create policy "forum_daily_reports: owner select own"
  on public.forum_daily_reports for select to authenticated
  using (owner_user_id = public.current_app_user_id());

drop policy if exists "forum_daily_reports: owner update own" on public.forum_daily_reports;
create policy "forum_daily_reports: owner update own"
  on public.forum_daily_reports for update to authenticated
  using (owner_user_id = public.current_app_user_id())
  with check (owner_user_id = public.current_app_user_id());

drop policy if exists "forum_daily_reports: delete own or commander" on public.forum_daily_reports;
create policy "forum_daily_reports: delete own or commander"
  on public.forum_daily_reports for delete to authenticated
  using (
    public.is_commander((select auth.uid()))
    or created_by = public.current_app_user_id()
    or owner_user_id = public.current_app_user_id()
  );

-- RLS controls WHO can write. This trigger protects the lock invariant even
-- for a stale/older client. A deliberate status-only reopen remains available
-- to the same authorized owner/commander as before. An idempotent close is safe.
create or replace function public.guard_closed_forum_report_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'closed' and (
    new.status not in ('closed', 'in_progress')
    or (to_jsonb(new) - array['status', 'updated_at', 'updated_by'])
       is distinct from
       (to_jsonb(old) - array['status', 'updated_at', 'updated_by'])
  ) then
    raise exception using
      errcode = '55000',
      message = 'forum_report_locked',
      hint = 'Reopen the report without changing content before editing it.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_closed_forum_report_content() from public, anon, authenticated;

drop trigger if exists forum_daily_reports_guard_closed_content on public.forum_daily_reports;
create trigger forum_daily_reports_guard_closed_content
  before update on public.forum_daily_reports
  for each row execute function public.guard_closed_forum_report_content();

commit;
