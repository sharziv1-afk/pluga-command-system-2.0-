import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARRY_OVER_MAX_DAYS,
  carryOverWindow,
  hasCarryableContent,
  isCarryOverTarget,
  pickCarryOverSource,
  shiftIsoDate,
} from '../src/lib/forum/carryOver.ts';

const KEYS = ['present_count', 'total_count', 'personnel', 'readiness', 'notes', 'commander_closing'];
const row = (report_date, status, content = { personnel: 'כ״א תקין' }) => ({ id: `r-${report_date}-${status}`, report_date, status, content });

test('date math crosses month and year boundaries', () => {
  assert.equal(shiftIsoDate('2026-11-01', -1), '2026-10-31');
  assert.equal(shiftIsoDate('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftIsoDate('2026-11-07', -7), '2026-10-31');
  assert.deepEqual(carryOverWindow('2026-11-08'), { from: '2026-11-01', before: '2026-11-08' });
  assert.equal(CARRY_OVER_MAX_DAYS, 7);
});

test('only text and numbers count as content; flags and blanks do not', () => {
  assert.equal(hasCarryableContent(null, KEYS), false);
  assert.equal(hasCarryableContent({}, KEYS), false);
  assert.equal(hasCarryableContent({ personnel: '   ', company_report_manually_edited: true }, KEYS), false);
  assert.equal(hasCarryableContent({ unrelated_key: 'x' }, KEYS), false, 'keys outside the form are ignored');
  assert.equal(hasCarryableContent({ present_count: 0 }, KEYS), true, 'a legacy numeric count is content');
  assert.equal(hasCarryableContent({ readiness: 'כוננות א׳' }, KEYS), true);
});

test('a slot is a target only when it has no report or an open, empty one', () => {
  assert.equal(isCarryOverTarget(null, KEYS), true, 'no report yet');
  assert.equal(isCarryOverTarget({ status: 'draft', content: {} }, KEYS), true, 'opened but empty');
  assert.equal(isCarryOverTarget({ status: 'in_progress', content: { personnel: '' } }, KEYS), true, 'reset report');
  assert.equal(isCarryOverTarget({ status: 'draft', content: { personnel: 'x' } }, KEYS), false, 'never overwrite written text (incl. the close-time carry-forward)');
  assert.equal(isCarryOverTarget({ status: 'submitted', content: {} }, KEYS), false, 'never refill a submitted report');
  assert.equal(isCarryOverTarget({ status: 'closed', content: {} }, KEYS), false, 'never refill a closed report');
});

test('copies only from a submitted or closed report, never a draft', () => {
  const rows = [row('2026-11-06', 'in_progress'), row('2026-11-05', 'submitted')];
  assert.equal(pickCarryOverSource(rows, '2026-11-07', KEYS)?.report_date, '2026-11-05');
  assert.equal(pickCarryOverSource([row('2026-11-06', 'draft')], '2026-11-07', KEYS), null);
});

test('after Shabbat it takes the last working day, newest first regardless of row order', () => {
  // Sunday 2026-11-08: nothing on Saturday, Friday closed, Thursday submitted.
  const rows = [row('2026-11-05', 'submitted'), row('2026-11-06', 'closed')];
  assert.equal(pickCarryOverSource(rows, '2026-11-08', KEYS)?.report_date, '2026-11-06');
});

test('the window is the 7 days before the date, and never the date itself or later', () => {
  assert.equal(pickCarryOverSource([row('2026-11-01', 'closed')], '2026-11-08', KEYS)?.report_date, '2026-11-01', 'exactly 7 days back is in');
  assert.equal(pickCarryOverSource([row('2026-10-31', 'closed')], '2026-11-08', KEYS), null, '8 days back is out');
  assert.equal(pickCarryOverSource([row('2026-11-08', 'closed'), row('2026-11-09', 'closed')], '2026-11-08', KEYS), null);
});

test('skips a source with nothing to copy and falls back to an older one', () => {
  const rows = [row('2026-11-06', 'closed', { personnel: ' ' }), row('2026-11-04', 'submitted')];
  assert.equal(pickCarryOverSource(rows, '2026-11-07', KEYS)?.report_date, '2026-11-04');
});

test('the page wires carry-over through the user\'s own RLS read, with no write of its own', () => {
  const source = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');
  assert.match(source, /from '@\/lib\/forum\/carryOver'/);

  const fetchBlock = source.slice(source.indexOf('// Carry-over source read'), source.indexOf('// End carry-over source read'));
  assert.ok(fetchBlock.length > 0, 'the carry-over read is marked in the page');
  assert.match(fetchBlock, /\.select\('id,report_date,status,content'\)/);
  assert.match(fetchBlock, /\.eq\('owner_user_id', carryOverOwnerId\)/, 'the same slot owner');
  assert.match(fetchBlock, /\.eq\('report_level', carryOverLevel\)/, 'the same report level');
  assert.match(fetchBlock, /\.in\('status', \[\.\.\.CARRY_OVER_SOURCE_STATUSES\]\)/);
  assert.match(fetchBlock, /\.lt\('report_date', selectedDate\)/);
  assert.doesNotMatch(fetchBlock, /\.(insert|update|upsert|delete)\(/, 'reading the source never writes');

  // Auto-fill only on the viewer's own slot; someone else's slot gets a button.
  assert.match(source, /carryOverOwnerId === dbProfile\?\.id/);
  assert.match(source, /התחל דוח ריק/);
});
