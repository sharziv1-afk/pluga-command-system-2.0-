-- Makes `updated_by` non-forgeable.
--
-- Migration 029 moved the rank comparison server-side, but the conflict
-- resolver still asks "who edited this row last?" by reading `updated_by` —
-- and that column was written by the client as part of the update payload.
-- A user could stamp it with their own id (or leave it null on a row that
-- had never been through the resolver) and the client-side code would then
-- skip the rank check entirely and treat itself as the winner.
--
-- Fixing this in the client is not possible: any value the browser sends is
-- attacker-controlled. So the database now owns the column. Every UPDATE on
-- these tables has `updated_by` overwritten with the caller's real app-user
-- id, whatever the payload said.
--
-- current_app_user_id() returns null for a non-app caller (service role, SQL
-- editor, a migration). In that case the supplied value is left alone so
-- admin/maintenance writes and backfills are not rewritten to null.
create or replace function public.force_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := coalesce(public.current_app_user_id(), new.updated_by);
  return new;
end;
$$;

revoke execute on function public.force_updated_by() from public;
revoke execute on function public.force_updated_by() from anon;
revoke execute on function public.force_updated_by() from authenticated;

drop trigger if exists tasks_force_updated_by on public.tasks;
create trigger tasks_force_updated_by
  before update on public.tasks
  for each row execute function public.force_updated_by();

drop trigger if exists forum_daily_reports_force_updated_by on public.forum_daily_reports;
create trigger forum_daily_reports_force_updated_by
  before update on public.forum_daily_reports
  for each row execute function public.force_updated_by();
