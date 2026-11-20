-- 048_task_checklist_assignee_tick.sql
-- Sub-tasks inside a task (צ׳ק ליסט, מ״פ 20.11.2026) live in
-- tasks.metadata.checklist as [{ id, text, done }]. The creator and the
-- commanders write the list; the assignee should be able to tick items off.
--
-- Migration 036 lets an assignee change a task's status only: its trigger
-- refuses any other column, metadata included. This replaces that trigger
-- function so an assignee may also flip the `done` flag of existing checklist
-- items — and nothing else: not the text, not the order, not adding or
-- removing items, not any other metadata key. Everything else in 036 stays
-- as it was (same policy, same cancel rule, same error code).
--
-- No table, column or policy change. Creators and commanders were never
-- limited by this trigger and are not now.

-- The metadata with every checklist item's `done` removed: two metadata
-- values that are equal under this differ only in ticks.
create or replace function public.task_metadata_without_ticks(p_metadata jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when p_metadata is null then '{}'::jsonb
    when jsonb_typeof(p_metadata -> 'checklist') = 'array' then
      jsonb_set(
        p_metadata,
        '{checklist}',
        coalesce(
          (
            select jsonb_agg(
              case when jsonb_typeof(item) = 'object' then item - 'done' else item end
              order by ord
            )
            from jsonb_array_elements(p_metadata -> 'checklist') with ordinality as entries(item, ord)
          ),
          '[]'::jsonb
        )
      )
    else p_metadata
  end
$$;

revoke execute on function public.task_metadata_without_ticks(jsonb) from public;
revoke execute on function public.task_metadata_without_ticks(jsonb) from anon;

create or replace function public.guard_task_assignee_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_app_user_id();
  v_ignored text[] := array['status', 'completed_at', 'updated_at', 'updated_by', 'metadata'];
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

  -- Status (036), and the checklist ticks (048): nothing else.
  if (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored)
     or public.task_metadata_without_ticks(new.metadata) is distinct from public.task_metadata_without_ticks(old.metadata) then
    raise exception 'An assignee may only change a task''s status and tick its checklist'
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
