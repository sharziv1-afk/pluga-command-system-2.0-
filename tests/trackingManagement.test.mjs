import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Week create/edit/remove and editing existing soldiers/items on the tracking
// page. No tracking table has a DELETE policy, so every removal must stay a
// soft update — a hard delete would fail under RLS and read as a bug.

const SOURCE = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');

const bodyOf = (name, length = 2500) => {
  const idx = SOURCE.indexOf(`const ${name}`);
  assert.ok(idx >= 0, `${name} must exist`);
  return SOURCE.slice(idx, idx + length);
};

test('nothing on the tracking page hard-deletes a row', () => {
  // Zero-arg form only: Supabase's .delete() takes none, Set#delete(key) does.
  assert.doesNotMatch(SOURCE, /\.delete\(\)/, 'removal must be is_active=false, there is no DELETE policy on any tracking table');
});

test('removing a week is a soft update checked for RLS no-ops', () => {
  const body = bodyOf('handleRemoveWeek');
  assert.match(body, /from\('tracking_weeks'\)\s*\.update\(\{ is_active: false \}\)/);
  assert.match(body, /didRowsUpdate\(updatedRows\)/, 'an RLS-denied update returns no error, only zero rows');
  assert.match(body, /if \(selectedWeekId === week\.id\) setSelectedWeekId\('all'\)/, 'a removed week must not stay selected');
});

test("a removed week's items leave the table, but not when the weeks query itself failed", () => {
  assert.match(
    SOURCE,
    /setItems\(\(itemsResult\.data \?\? \[\]\)\.filter\(item => weeksResult\.error \|\| !item\.week_id \|\| activeWeekIds\.has\(item\.week_id\)\)\)/,
  );
});

test('every edit path verifies rows were actually updated', () => {
  for (const name of ['handleSubmitSoldier', 'handleSubmitItem', 'handleSubmitWeek']) {
    const body = bodyOf(name, 3000);
    assert.match(body, /\.update\(fields\)/, `${name} must have an update branch`);
    assert.match(body, /didRowsUpdate\(updatedRows\)/, `${name} must check the update touched a row`);
  }
});

test('edits never overwrite created_by', () => {
  for (const name of ['handleSubmitSoldier', 'handleSubmitItem', 'handleSubmitWeek']) {
    const body = bodyOf(name, 3000);
    const fieldsBlock = body.slice(body.indexOf('const fields = {'), body.indexOf('};', body.indexOf('const fields = {')));
    assert.doesNotMatch(fieldsBlock, /created_by/, `${name}: created_by belongs only on the insert`);
  }
});

test('a week cannot end before it starts', () => {
  const body = bodyOf('handleSubmitWeek');
  assert.match(body, /weekForm\.endDate < weekForm\.startDate/);
});
