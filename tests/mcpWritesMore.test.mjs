import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  attendanceCodeFromLabel,
  diffFields,
  isAttendanceItem,
  jerusalemDisplay,
  staffUserIdOf,
  TRACKING_UNIT_CODES,
} from '../src/lib/mcp/tracking.ts';
import { jerusalemLocalToIso } from '../src/lib/mcp/shape.ts';

/**
 * MCP write tools added 08.11.2026 (src/lib/mcp/writesMore.ts, migration 046):
 * update_event, delete_event, create_tracking_week, create_tracking_item,
 * add_tracking_soldier, and set_tracking_status for staff and attendance.
 */

const more = readFileSync('src/lib/mcp/writesMore.ts', 'utf8');
const writes = readFileSync('src/lib/mcp/writes.ts', 'utf8');
const route = readFileSync('src/app/api/mcp/route.ts', 'utf8');
const m046 = readFileSync('supabase/migrations/046_mcp_more_writes.sql', 'utf8');

const toolBody = (source, name) => {
  const start = source.indexOf(`'${name}',`);
  assert.ok(start >= 0, `${name} is registered`);
  const next = source.indexOf('server.registerTool(', start);
  return source.slice(start, next < 0 ? undefined : next);
};

test('Israel time out matches Israel time in, across the summer/winter switch', () => {
  assert.equal(jerusalemDisplay('2026-10-21T05:00:00Z'), '2026-10-21 08:00'); // summer, UTC+3
  assert.equal(jerusalemDisplay('2026-12-01T06:00:00+00:00'), '2026-12-01 08:00'); // winter, UTC+2
  for (const local of ['2026-10-21 08:00', '2026-10-25 01:30', '2026-12-01 23:45', '2027-03-26 09:00']) {
    assert.equal(jerusalemDisplay(jerusalemLocalToIso(local)), local, local);
  }
  assert.equal(jerusalemDisplay(null), null);
  assert.equal(jerusalemDisplay('not a date'), null);
});

test('before/after lists only the fields that changed', () => {
  assert.deepEqual(
    diffFields({ title: 'א', location: null, status: 'scheduled' }, { title: 'ב', location: null }),
    [{ field: 'title', before: 'א', after: 'ב' }],
  );
  assert.deepEqual(diffFields({ location: 'מטווח' }, { location: null }), [{ field: 'location', before: 'מטווח', after: null }]);
});

test('attendance items and staff rows are recognised by their markers', () => {
  assert.equal(attendanceCodeFromLabel('נכח'), 'passed');
  assert.equal(attendanceCodeFromLabel('לא נכח'), 'failed');
  assert.equal(attendanceCodeFromLabel('ריק'), 'empty');
  assert.throws(() => attendanceCodeFromLabel('עבר'));
  assert.equal(isAttendanceItem({ mode: 'attendance' }), true);
  assert.equal(isAttendanceItem({ kind: 'score' }), false);
  assert.equal(isAttendanceItem(null), false);
  assert.equal(staffUserIdOf({ person_kind: 'staff', user_id: 'u1' }), 'u1');
  assert.equal(staffUserIdOf({ user_id: 'u1' }), null, 'a soldier row is never mistaken for staff');
  assert.deepEqual(Object.values(TRACKING_UNIT_CODES), ['platoon_1', 'platoon_2', 'platoon_3', 'platoon_4', 'company']);
});

test('the new tools are registered behind the same auth', () => {
  assert.match(route, /registerWriteTools\(server\);\s*registerMoreWriteTools\(server\);/);
  for (const name of ['update_event', 'delete_event', 'create_tracking_week', 'create_tracking_item', 'add_tracking_soldier']) {
    toolBody(more, name);
  }
});

test('they write only to the tables migration 046 opens, and every write is checked and logged', () => {
  const tables = [...more.matchAll(/\.from\('([a-z_]+)'\)\s*\.(insert|update|delete|upsert)\(/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tables)].sort(), ['events', 'soldiers', 'tracking_items', 'tracking_weeks']);
  assert.doesNotMatch(more, /\.upsert\(|service_role|SERVICE_ROLE/i);
  // A write RLS filtered out returns no error, so each one reads back its rows.
  const raw = more.match(/\.(update|delete)\(/g) ?? [];
  const checked = more.match(/\.(update|delete)\([^)]*\)[\s\S]{0,120}?\.select\('id'\)/g) ?? [];
  assert.equal(checked.length, raw.length);
  const inserts = more.match(/\.insert\(\{[\s\S]*?\}\)\s*\.select\([^)]*\)\s*\.single\(\)/g) ?? [];
  assert.equal(inserts.length, 3);
  for (const name of ['update_event', 'delete_event', 'create_tracking_week', 'create_tracking_item', 'add_tracking_soldier']) {
    assert.match(toolBody(more, name), /await audit\(c, ctx, \{/, `${name} writes to the activity log`);
  }
  // The origin marker, where the table has a metadata column.
  assert.match(toolBody(more, 'create_tracking_item'), /const origin = \{ created_via: MCP_ORIGIN, mcp_client_id: clientIdOf\(ctx\) \};/);
  assert.match(toolBody(more, 'add_tracking_soldier'), /created_via: MCP_ORIGIN, mcp_client_id: clientIdOf\(ctx\)/);
});

test('edit and delete ask for confirmation first and report before and after', () => {
  const update = toolBody(more, 'update_event');
  const del = toolBody(more, 'delete_event');
  assert.match(more, /const EDIT_CONFIRM_NOTE = ' Changes real data: show the user the event and exactly which fields will change, and get their confirmation before calling\. Returns each changed field before and after\.';/);
  assert.match(update, /\+ EDIT_CONFIRM_NOTE/);
  assert.match(del, /get explicit confirmation before calling/);
  assert.match(update, /changes: diffFields\(beforeView, afterView\),\s*before: beforeView,\s*after: afterView,/);
  assert.match(del, /return ok\(\{ deleted: 'event', id, before: snapshot, after: null/);
  assert.match(del, /annotations: DESTRUCTIVE/);
  assert.match(update, /annotations: WRITE/);
  assert.equal((more.match(/annotations: DESTRUCTIVE/g) ?? []).length, 1);
});

test('times go in as Israel time and come back as Israel time', () => {
  const update = toolBody(more, 'update_event');
  assert.match(update, /payload\.starts_at = jerusalemLocalToIso\(args\.starts_at\)/);
  assert.match(update, /jerusalemLocalToIso\(args\.ends_at\)/);
  assert.match(more, /starts_at: jerusalemDisplay\(row\.starts_at\)/);
  // An unchanged time is not reported as a change because of string format.
  assert.match(update, /const asInstant = \(value: string \| null\) => \(value \? new Date\(value\)\.toISOString\(\) : null\);/);
  assert.match(update, /if \(endsAt && new Date\(endsAt\) <= new Date\(startsAt\)\) return fail/);
});

test('delete follows the site: open events are cancelled first, and restored if the delete fails', () => {
  const del = toolBody(more, 'delete_event');
  assert.match(del, /update\(\{ status: 'cancelled' \}\)/);
  assert.match(del, /update\(\{ status: row\.status \}\)/);
  assert.ok(del.indexOf("update({ status: 'cancelled' })") < del.indexOf('.delete()'));
});

test('score items reuse the site\'s rules; attendance and staff are marked, not new columns', () => {
  const item = toolBody(more, 'create_tracking_item');
  assert.match(item, /const configError = validateScoreConfig\(scoreConfig\);/);
  assert.match(item, /metadata = withScoreConfig\(origin, scoreConfig\);/);
  assert.match(item, /\{ \.\.\.origin, mode: ATTENDANCE_MODE \}/);
  const person = toolBody(more, 'add_tracking_soldier');
  assert.match(person, /metadata\.person_kind = 'staff';\s*metadata\.user_id = person\.id;/);
  assert.match(person, /is already on the tracking table/);
});

test('set_tracking_status finds staff and understands attendance, without changing the rest', () => {
  const tool = toolBody(writes, 'set_tracking_status');
  assert.match(tool, /z\.enum\(\['עבר', 'לא עבר', 'השלמה', 'ריק', 'נכח', 'לא נכח'\]\)/);
  assert.match(tool, /const s = await resolveTrackedPerson\(c, soldiers \?\? \[\], args\.soldier\);/);
  assert.match(tool, /\} else if \(isAttendanceItem\(it\.match\.metadata\)\) \{/);
  assert.match(writes, /const linked = rows\.find\(\(row\) => staffUserIdOf\(row\.metadata\) === staff\.match!\.id\);/);
  // Score items still decide עבר / לא עבר from the score.
  assert.match(tool, /status = statusForScore\(score, scoreConfig\);/);
});

test('migration 046 opens exactly two things and keeps the rest of 035', () => {
  const statements = m046.split('\n').filter((line) => line.trim() && !line.trim().startsWith('--'));
  assert.deepEqual(statements, [
    'drop policy if exists "oauth: no insert" on public.tracking_weeks;',
    'drop policy if exists "oauth: no insert" on public.tracking_items;',
    'drop policy if exists "oauth: no insert" on public.soldiers;',
    'drop policy if exists "oauth: delete only mcp-created" on public.events;',
  ]);
});
