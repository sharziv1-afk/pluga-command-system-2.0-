import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildFeedCalendar, forumSummaryLine } from '../src/lib/calendarExport.ts';
import {
  calendarFeedUrls,
  createCalendarFeedToken,
  hashCalendarFeedToken,
  isCalendarFeedToken,
} from '../src/lib/calendarFeedToken.ts';

/**
 * Calendar widgets without an app: a personal ICS subscription the phone or
 * Mac calendar refreshes on its own. The forum shows as an all-day line at the
 * top of each day.
 */

const report = (over) => ({ report_date: '2026-10-21', level: 'platoon', status: 'submitted', mine: false, platoon_unit_id: 'p1', present: '27', total: '30', ...over });

test('commander forum line: platoons, staff, company report and manpower from submitted platoons', () => {
  const line = forumSummaryLine([
    report({ platoon_unit_id: 'p1', present: '27', total: '30' }),
    report({ platoon_unit_id: 'p2', present: '26', total: '28' }),
    report({ platoon_unit_id: 'p3', status: 'draft', present: '29', total: '32' }),
    report({ level: 'staff', platoon_unit_id: null }),
    report({ level: 'staff', platoon_unit_id: null, status: 'in_progress' }),
    report({ level: 'company', platoon_unit_id: null, status: 'in_progress' }),
  ], true);
  assert.equal(line, 'פורום מוביל · מחלקות 2/4 · מפל״ג 1/4 · פלוגתי: בטיפול · מצבה 53/58');
});

test('commander forum line with nothing submitted yet', () => {
  assert.equal(forumSummaryLine([], true), 'פורום מוביל · מחלקות 0/4 · מפל״ג 0/4 · פלוגתי: לא הוגש');
});

test('anyone else sees their own report first, then the company picture', () => {
  assert.equal(
    forumSummaryLine([report({ mine: true, status: 'draft' })], false),
    'פורום מוביל · הדוח שלי: טיוטה · מחלקות 0/4 · מפל״ג 0/4 · פלוגתי: לא הוגש',
  );
  assert.equal(
    forumSummaryLine([report({ mine: false })], false),
    'פורום מוביל · הדוח שלי: לא הוגש · מחלקות 1/4 · מפל״ג 0/4 · פלוגתי: לא הוגש · מצבה 27/30',
  );
});

const feed = {
  today: '2026-10-26',
  user: { name: 'סרן שחר ברנע', role: 'מ"פ', is_commander: true },
  events: [
    { id: 'e-past', title: 'ארוחת בוקר', description: null, location: 'חד״א', starts_at: '2026-10-26T05:30:00Z', ends_at: '2026-10-26T06:30:00Z', status: 'completed' },
    { id: 'e-next', title: 'מטה מול מ״פים', description: 'תיאום', location: null, starts_at: '2026-10-26T12:30:00Z', ends_at: '2026-10-26T15:30:00Z', status: 'scheduled' },
    { id: 'e-gone', title: 'בוטל', description: null, location: null, starts_at: '2026-10-26T16:00:00Z', ends_at: null, status: 'cancelled' },
  ],
  forum: [report({ report_date: '2026-10-25' })],
};

test('the feed keeps the whole day, drops cancelled events, and asks to be refreshed often', () => {
  const ics = buildFeedCalendar(feed, Date.parse('2026-10-26T10:00:00Z'));
  assert.match(ics, /UID:e-past@hamefaked/, 'an event earlier today stays, so the widget shows the full day');
  assert.match(ics, /UID:e-next@hamefaked/);
  assert.doesNotMatch(ics, /e-gone/);
  assert.match(ics, /REFRESH-INTERVAL;VALUE=DURATION:PT15M/);
  assert.match(ics, /X-PUBLISHED-TTL:PT15M/);
  assert.match(ics, /X-WR-TIMEZONE:Asia\/Jerusalem/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `line over 75 octets: ${line}`);
});

test('the forum is an all-day event per day, always present for today, with a stable UID', () => {
  const ics = buildFeedCalendar(feed);
  assert.match(ics, /UID:forum-20261025@hamefaked\r\nDTSTAMP:\d{8}T\d{6}Z\r\nDTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026/);
  assert.match(ics, /UID:forum-20261026@hamefaked/, 'today has a line even before any report exists');
  assert.match(ics, /TRANSP:TRANSPARENT/, 'the forum line never shows the day as busy');
});

test('link codes: 32 random bytes, and the browser hash equals the server hash', async () => {
  const a = createCalendarFeedToken();
  const b = createCalendarFeedToken();
  assert.ok(isCalendarFeedToken(a), a);
  assert.notEqual(a, b);
  assert.equal(await hashCalendarFeedToken(a), createHash('sha256').update(a).digest('hex'));
  assert.equal(isCalendarFeedToken('cal_short'), false);
  assert.equal(isCalendarFeedToken(`${a}.ics`), false);
  const urls = calendarFeedUrls('https://example.test/', a);
  assert.equal(urls.https, `https://example.test/api/calendar/${a}.ics`);
  assert.equal(urls.webcal, `webcal://example.test/api/calendar/${a}.ics`);
});

const migration = readFileSync('supabase/migrations/037_calendar_feeds.sql', 'utf8');
const route = readFileSync('src/app/api/calendar/[token]/route.ts', 'utf8');

test('migration 037: only hashes are stored, and each user manages only their own links', () => {
  assert.match(migration, /token_hash text not null unique check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(migration, /alter table public\.calendar_feeds enable row level security;/);
  for (const name of ['select own', 'insert own', 'update own']) {
    assert.match(migration, new RegExp(`"calendar_feeds: ${name}"[\\s\\S]*?user_id = public\\.current_app_user_id\\(\\)`));
  }
  assert.doesNotMatch(migration, /for delete to authenticated\s+using \( user_id/, 'links are revoked, not deleted');
  assert.match(migration, /"oauth: no insert" on public\.calendar_feeds/);
});

test('calendar_feed(): own unit + the company for events, the company picture for the forum', () => {
  const fn = migration.slice(migration.indexOf('create or replace function public.calendar_feed'));
  assert.match(fn, /security definer\s+set search_path = public/);
  assert.match(fn, /where token_hash = p_token_hash and revoked_at is null/);
  assert.match(fn, /v_user\.auth_user_id is null\s+or v_user\.status <> 'active'\s+or v_user\.role_approval_status <> 'approved'/);
  assert.match(fn, /select coalesce\(u\.parent_unit_id, u\.id\) into v_company_unit from public\.units u where u\.id = v_user\.unit_id;/);
  assert.match(fn, /e\.created_by = v_user\.id\s+or e\.responsible_user_id = v_user\.id\s+or \(e\.unit_id is not null and \(e\.unit_id = v_user\.unit_id or e\.unit_id = v_company_unit\)\)/);
  assert.doesNotMatch(fn, /v_is_commander\s+or e\./, 'the commander gets his own schedule, not every platoon\'s');
  assert.match(fn, /r\.report_level <> 'squad'/);
  assert.doesNotMatch(fn, /'content', r\.content|r\.summary_text|r\.whatsapp_text/, 'status and manpower only, never report text');
  assert.match(migration, /revoke execute on function public\.calendar_feed\(text\) from public;/);
});

test('the route checks the code shape, sends only its hash, and is never cached', () => {
  assert.match(route, /if \(!isCalendarFeedToken\(code\)\) return notFound\(\);/);
  assert.match(route, /createHash\('sha256'\)\.update\(code\)\.digest\('hex'\)/);
  assert.match(route, /rpc\('calendar_feed', \{ p_token_hash: tokenHash \}\)/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
  assert.doesNotMatch(route, /SERVICE_ROLE|service_role/);
});
