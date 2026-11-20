import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHECKLIST_MAX_ITEMS,
  checklistFromLines,
  checklistProgress,
  checklistToLines,
  readChecklist,
  toggleChecklistItem,
  withChecklist,
} from '../src/lib/taskChecklist.ts';

/**
 * Sub-tasks inside a task (מ״פ, 20.11.2026): the task is the heading, and the
 * lines under it are ticked off one by one, like a checklist note. Stored in
 * tasks.metadata.checklist. Migration 048 lets the assignee tick — verified in
 * the sandbox in one rolled-back transaction, 10/10: the assignee ticks,
 * unticks, and ticks with a status change; editing a line, adding one,
 * removing the list, another metadata key, the title and cancelling are
 * refused (42501); the creator still edits the text.
 */

let counter = 0;
const ids = () => `id${++counter}`;

test('one line per sub-task; bullets and blank lines are dropped', () => {
  counter = 0;
  const items = checklistFromLines('* לבדוק ציוד\n\n- להזמין הסעה\n• לתאם מטווח\n[ ] לעדכן מ״פ\n   ', [], ids);
  assert.deepEqual(items.map(i => i.text), ['לבדוק ציוד', 'להזמין הסעה', 'לתאם מטווח', 'לעדכן מ״פ']);
  assert.ok(items.every(i => i.done === false));
  assert.deepEqual(checklistFromLines('', [], ids), []);
});

test('invisible characters pasted from Notes or WhatsApp are dropped', () => {
  // Found in the live "משימות של ברוש" (20.11.2026): "* ⁠טבלת…" with U+2060.
  const items = checklistFromLines('* ⁠טבלת כשיר להכשיר\n*​ רשמ”צ מטווחים﻿', [], ids);
  assert.deepEqual(items.map(i => i.text), ['טבלת כשיר להכשיר', 'רשמ”צ מטווחים']);
});

test('editing the list keeps what was already ticked', () => {
  counter = 0;
  const first = checklistFromLines('א\nב\nג', [], ids);
  const ticked = toggleChecklistItem(first, first[1].id, true);
  const edited = checklistFromLines('א\nב\nד', ticked, ids);
  assert.deepEqual(edited.map(i => [i.text, i.done]), [['א', false], ['ב', true], ['ד', false]]);
  assert.equal(edited[1].id, first[1].id, 'the same line keeps its id');
  assert.equal(checklistToLines(edited), 'א\nב\nד');
});

test('ticking changes one item only, and progress counts the ticks', () => {
  counter = 0;
  const items = checklistFromLines('א\nב\nג', [], ids);
  const next = toggleChecklistItem(items, items[2].id, true);
  assert.deepEqual(next.map(i => i.done), [false, false, true]);
  assert.deepEqual(items.map(i => i.done), [false, false, false], 'the input is not changed');
  assert.deepEqual(checklistProgress(next), { done: 1, total: 3 });
});

test('the list round-trips through task metadata and keeps the other keys', () => {
  counter = 0;
  const items = checklistFromLines('א\nב', [], ids);
  const metadata = withChecklist({ category: 'מנהלה' }, items);
  assert.equal(metadata.category, 'מנהלה');
  assert.deepEqual(readChecklist(metadata), items);
  assert.equal('checklist' in withChecklist(metadata, []), false, 'an empty list removes the key');
  assert.deepEqual(readChecklist(null), []);
  assert.deepEqual(readChecklist({ checklist: [{ id: 'x', text: '' }, 'junk', { text: 'no id' }, { id: 'ok', text: 'טוב', done: 'yes' }] }),
    [{ id: 'ok', text: 'טוב', done: false }], 'malformed entries are skipped');
});

test('there is a sane cap on the list', () => {
  const lines = Array.from({ length: CHECKLIST_MAX_ITEMS + 10 }, (_, i) => `שורה ${i}`).join('\n');
  assert.equal(checklistFromLines(lines).length, CHECKLIST_MAX_ITEMS);
});

test('migration 048: the assignee may tick, nothing more, and 036 is otherwise unchanged', () => {
  const sql = readFileSync('supabase/migrations/048_task_checklist_assignee_tick.sql', 'utf8');
  assert.match(sql, /create or replace function public\.task_metadata_without_ticks\(p_metadata jsonb\)/);
  assert.match(sql, /item - 'done'/);
  assert.match(sql, /v_ignored text\[\] := array\['status', 'completed_at', 'updated_at', 'updated_by', 'metadata'\];/);
  assert.match(sql, /or public\.task_metadata_without_ticks\(new\.metadata\) is distinct from public\.task_metadata_without_ticks\(old\.metadata\) then/);
  assert.match(sql, /\(new\.status = 'cancelled' or old\.status = 'cancelled'\) and new\.status is distinct from old\.status/);
  assert.match(sql, /errcode = '42501'/);
  assert.match(sql, /revoke execute on function public\.guard_task_assignee_update\(\) from authenticated;/);
  assert.doesNotMatch(sql, /create policy|drop policy|alter table|create table/i, 'no table or policy change');
});

test('the tasks page: a checklist in the form, ticks on the card, guarded by updated_at', () => {
  const page = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');
  assert.match(page, /תתי-משימות — שורה לכל אחת/);
  assert.match(page, /const checklist = checklistFromLines\(checklistText\);/);
  assert.match(page, /checklistFromLines\(editChecklistText, readChecklist\(editingTask\.metadata\)\)/, 'editing keeps the ticks');
  assert.match(page, /const canTickChecklist = \(task: TaskView\) => canUpdateTaskStatus\(task\) && task\.status !== 'cancelled';/);
  const handler = page.slice(page.indexOf('const handleToggleChecklistItem = async'), page.indexOf('const handleStatusChange = async'));
  assert.match(handler, /\.update\(\{ metadata: nextMetadata \}\)/);
  assert.match(handler, /\.eq\('updated_at', task\.updated_at\)/, 'two people ticking at once never overwrite each other');
  assert.match(handler, /if \(!didRowsUpdate\(updatedRows\)\) \{/);
  assert.match(handler, /actionType: 'task_updated'/);
  assert.match(page, /role="checkbox"\s*aria-checked=\{item\.done\}/);
  assert.match(page, /\{progress\.done\}\/\{progress\.total\}/);
});
