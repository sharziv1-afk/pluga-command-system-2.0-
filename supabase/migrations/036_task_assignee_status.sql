-- 036_task_assignee_status.sql
--
-- Lets the person a task is assigned to update its status. Run manually —
-- first in the SANDBOX (hjltpajvqhnygjybtivd), then in LIVE
-- (vmfihyritfmjycrfpxjn). Idempotent.
--
-- Until now only the creator ("tasks: creator update own") and commanders
-- ("tasks: commander update all") could update a task, so a מ״מ could not
-- mark a task assigned to them as done — the assignee could see it
-- ("tasks: select assigned") but every status change came back as zero rows.
--
-- The assignee gets status only:
--   * a new permissive UPDATE policy matches rows assigned to the caller, and
--     its WITH CHECK keeps the task assigned to them (no handing it off);
--   * a BEFORE UPDATE trigger rejects, for an assignee who is neither the
--     creator nor a commander, any change other than status / completed_at,
--     and any move into or out of 'cancelled' — cancelling stays the
--     creator's or a commander's call.
-- Creators and commanders are untouched. OAuth (MCP) tokens get the same
-- rights as the site session, since 035's restrictive policies only limit
-- deletes and other tables.

drop policy if exists "tasks: assignee update status" on public.tasks;
create policy "tasks: assignee update status"
  on public.tasks for update to authenticated
  using ( assigned_to = public.current_app_user_id() )
  with check ( assigned_to = public.current_app_user_id() );

create or replace function public.guard_task_assignee_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_app_user_id();
  v_ignored text[] := array['status', 'completed_at', 'updated_at', 'updated_by'];
begin
  -- Not an app user (service role, SQL editor, migration): leave it alone.
  if v_me is null then
    return new;
  end if;

  -- Creators and commanders keep full control; other callers are not
  -- assignee-only updates, so the existing policies decide.
  if old.created_by = v_me
     or public.is_commander(auth.uid())
     or old.assigned_to is distinct from v_me then
    return new;
  end if;

  if (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored) then
    raise exception 'An assignee may only change a task''s status'
      using errcode = '42501';
  end if;

  if (new.status = 'cancelled' or old.status = 'cancelled') and new.status is distinct from old.status then
    raise exception 'Only the task''s creator or a commander can cancel or reopen a cancelled task'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_task_assignee_update() from public;
revoke execute on function public.guard_task_assignee_update() from anon;
revoke execute on function public.guard_task_assignee_update() from authenticated;

drop trigger if exists guard_task_assignee_update_before_update on public.tasks;
create trigger guard_task_assignee_update_before_update
  before update on public.tasks
  for each row execute function public.guard_task_assignee_update();
