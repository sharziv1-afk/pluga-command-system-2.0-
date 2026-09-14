import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// tracking_records.note already existed in the schema and the TypeScript
// type, set to null on every insert and never read back — the column was
// pure dead weight. This adds the UI: a note per cell, and a weekly summary
// per soldier aggregating that week's notes.

const SOURCE = readFileSync('src/app/(protected)/tracking/page.tsx', 'utf8');

test('the note dialog only ever updates an existing record, never inserts one', () => {
  // openNoteDialog's third parameter is typed as DbTrackingRecord (not
  // `| undefined`), and is only ever called from a spot gated on `record &&`
  // — a cell with no status yet has nothing to attach a note to.
  assert.match(SOURCE, /openNoteDialog = \(soldier: DbSoldier, item: DbTrackingItem, record: DbTrackingRecord\)/, 'openNoteDialog must require a real record, not optional');
  assert.match(SOURCE, /onClick=\{\(\) => record && openNoteDialog\(soldier, item, record\)\}/, 'the note button must be gated on record existing, both in the mobile and desktop rendering');

  const handlerIdx = SOURCE.indexOf('const handleSaveCellNote');
  const handlerBody = SOURCE.slice(handlerIdx, handlerIdx + 1500);
  assert.match(handlerBody, /\.update\(\{ note: nextNote/, 'must call .update(), not .insert() — there is no code path for a note-only row');
  assert.doesNotMatch(handlerBody, /\.insert\(/, 'handleSaveCellNote must never insert a row');
});

test('a no-op save (unchanged note and status) closes without hitting the network', () => {
  const handlerIdx = SOURCE.indexOf('const handleSaveCellNote');
  const handlerBody = SOURCE.slice(handlerIdx, handlerIdx + 700);
  assert.match(handlerBody, /if \(nextNote === record\.note && nextStatus === record\.status\) \{\s*closeNoteDialog\(\);\s*return;/, 'must short-circuit only when both the trimmed note and the picked status equal the stored ones');
});

test('the cell dialog writes the picked status together with the note', () => {
  const handlerIdx = SOURCE.indexOf('const handleSaveCellNote');
  const handlerBody = SOURCE.slice(handlerIdx, handlerIdx + 1500);
  assert.match(handlerBody, /\.update\(\{ note: nextNote, status: nextStatus/, 'status and note must go out in one update, so the cell never lands half-saved');
});

test('an empty note is stored as null, not an empty string', () => {
  assert.match(SOURCE, /const nextNote = trimmed \|\| null;/, 'clearing a note must write null, matching the column\'s existing null default, not leave an empty-string row behind');
});

test('the weekly summary only aggregates when one specific week is selected', () => {
  const memoIdx = SOURCE.indexOf('const weeklyNotesBySoldier');
  const memoBody = SOURCE.slice(memoIdx, memoIdx + 800);
  assert.match(memoBody, /if \(selectedWeekId === 'all'\) return bySoldier;/, "must return empty rather than aggregating across a soldier's entire history when no single week is selected");
});

test('both the mobile card view and the desktop table render the weekly summary conditionally on the same flag', () => {
  const occurrences = SOURCE.match(/selectedWeekId !== 'all'/g) ?? [];
  // One for the memo's early-return guard, one for the mobile section, two
  // for the desktop header + row cell — four call sites keeping the same
  // condition in sync is exactly the kind of thing that silently drifts.
  assert.ok(occurrences.length >= 4, `expected the "specific week selected" check in at least 4 places (memo guard, mobile, desktop header, desktop cell); found ${occurrences.length}`);
});
