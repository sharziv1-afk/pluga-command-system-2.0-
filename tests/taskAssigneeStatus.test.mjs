import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/036_task_assignee_status.sql', 'utf8');
const page = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');
const writes = readFileSync('src/lib/mcp/writes.ts', 'utf8');

/**
 * The gap this closes (QA 25.10.2026): a task's assignee could see it but not
 * change its status — only the creator and commanders could, in the UI and
 * in RLS. Migration 036 adds status-only rights for the assignee. Verified in
 * the sandbox in one rolled-back transaction, 14/14: the assignee moves it to
 * in progress and done; title, due date, reassigning, cancelling, reopening a
 * cancelled task and deleting are refused; an unrelated user changes nothing;
 * creator and commander keep full control; an OAuth (MCP) token behaves the
 * same as the site session.
 */

test('migration 036: the assignee gets an UPDATE policy that keeps the task theirs', () => {
  assert.match(migration, /create policy "tasks: assignee update status"\s+on public\.tasks for update to authenticated\s+using \( assigned_to = public\.current_app_user_id\(\) \)\s+with check \( assigned_to = public\.current_app_user_id\(\) \);/);
});

test('migration 036: a trigger limits an assignee-only update to status, and never to cancel', () => {
  assert.match(migration, /v_ignored text\[\] := array\['status', 'completed_at', 'updated_at', 'updated_by'\];/);
  assert.match(migration, /if old\.created_by = v_me\s+or public\.is_commander\(auth\.uid\(\)\)\s+or old\.assigned_to is distinct from v_me then\s+return new;/);
  assert.match(migration, /\(to_jsonb\(new\) - v_ignored\) is distinct from \(to_jsonb\(old\) - v_ignored\)/);
  assert.match(migration, /\(new\.status = 'cancelled' or old\.status = 'cancelled'\) and new\.status is distinct from old\.status/);
  assert.match(migration, /errcode = '42501'/);
  assert.match(migration, /revoke execute on function public\.guard_task_assignee_update\(\) from authenticated;/);
  assert.match(migration, /before update on public\.tasks\s+for each row execute function public\.guard_task_assignee_update\(\);/);
});

test('the tasks page mirrors it: the assignee gets the status picker, without "בוטלה"', () => {
  assert.match(page, /return task\.assigned_to === dbProfile\.id && task\.status !== 'cancelled';/);
  assert.match(page, /isAssigneeOnly\(task\) \? statusOptions\.filter\(status => status !== 'cancelled'\) : statusOptions/);
  assert.match(page, /\{statusChoicesFor\(task\)\.map\(status =>/);
  assert.doesNotMatch(page, /\{statusOptions\.map\(status => <option/, 'the card picker must not offer every status to everyone');
  // Editing the task itself (title, due date, assignee) stays creator / commander only.
  assert.match(page, /const canEditTask = \(task: TaskView\) => canSeeAll \|\| task\.created_by === dbProfile\?\.id;/);
});

test('MCP tells Claude what the assignee may do', () => {
  assert.match(writes, /the person it is assigned to can set any status except cancelled, and cannot reopen a cancelled task/);
});
