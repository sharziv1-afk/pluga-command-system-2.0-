import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as calendar from '../src/lib/calendarExport.ts';

/**
 * The bug this guards: "ייצוא ליומן" exported every event that wasn't
 * cancelled — including ones that ended last week — so importing the file
 * back-filled the phone's calendar with history. Only events whose end (or
 * start, when there is no end) is now or later belong in the export.
 *
 * "Now" is an instant, so the comparison must not depend on the device
 * timezone; the cross-TZ test runs it in a child process because TZ is read
 * once at process start.
 */
const NOW = '2026-10-12T09:00:00.000Z'; // 12:00 in Jerusalem
const NOW_MS = Date.parse(NOW);

const entry = (id, startsAt, endsAt, extra = {}) => ({
  id,
  title: `מופע ${id}`,
  starts_at: startsAt,
  ends_at: endsAt,
  location: null,
  status: 'scheduled',
  details: '',
  ...extra,
});

const FIXTURE = [
  entry('ended-yesterday', '2026-10-11T06:00:00.000Z', '2026-10-11T08:00:00.000Z'),
  entry('ended-this-morning', '2026-10-12T05:00:00.000Z', '2026-10-12T07:00:00.000Z'),
  entry('in-progress', '2026-10-12T08:00:00.000Z', '2026-10-12T10:00:00.000Z'),
  entry('tomorrow', '2026-10-13T06:00:00.000Z', '2026-10-13T08:00:00.000Z'),
  entry('no-end-future', '2026-10-12T15:00:00.000Z', null),
  entry('no-end-past', '2026-10-12T08:59:00.000Z', null),
  entry('cancelled-future', '2026-10-13T06:00:00.000Z', '2026-10-13T07:00:00.000Z', { status: 'cancelled' }),
  entry('ends-exactly-now', '2026-10-12T08:00:00.000Z', NOW),
  // A bad row: end before start. The start is still ahead, so it is upcoming.
  entry('end-before-start', '2026-10-12T12:00:00.000Z', '2026-10-12T06:00:00.000Z'),
];

const EXPECTED_UPCOMING = ['in-progress', 'tomorrow', 'no-end-future', 'ends-exactly-now', 'end-before-start'];

const uidsIn = (ics) => [...ics.matchAll(/^UID:(.+)@hamefaked$/gm)].map(match => match[1]);

// RFC 5545 §3.1: a line beginning with a space continues the previous one.
const unfold = (ics) => ics.replace(/\r\n /g, '');

test('ICS export contains only events that end now or later', () => {
  const { text, count } = calendar.buildIcsCalendar(FIXTURE, NOW_MS);
  assert.deepEqual(uidsIn(unfold(text)).sort(), [...EXPECTED_UPCOMING].sort());
  assert.equal(count, EXPECTED_UPCOMING.length);
});

test('isUpcomingForCalendar matches the export filter, including the ends_at < starts_at row', () => {
  assert.equal(typeof calendar.isUpcomingForCalendar, 'function', 'isUpcomingForCalendar must be exported');
  const upcoming = FIXTURE.filter(event => calendar.isUpcomingForCalendar(event, NOW_MS)).map(event => event.id);
  assert.deepEqual(upcoming.sort(), [...EXPECTED_UPCOMING].sort());

  // Both orderings of a bad row resolve on the later instant.
  assert.equal(calendar.isUpcomingForCalendar(entry('a', '2026-10-12T06:00:00.000Z', '2026-10-12T05:00:00.000Z'), NOW_MS), false);
  assert.equal(calendar.isUpcomingForCalendar(entry('b', '2026-10-12T10:00:00.000Z', '2026-10-12T05:00:00.000Z'), NOW_MS), true);
  // An unparseable timestamp is never "upcoming" — and must not throw.
  assert.equal(calendar.isUpcomingForCalendar(entry('c', 'not-a-date', null), NOW_MS), false);
});

test('the upcoming filter is identical under any device timezone', () => {
  // 23:30 Jerusalem on the 12th vs. "now" at 00:30 Jerusalem on the 13th —
  // the case a date-key comparison would get wrong in a far-west timezone.
  const script = `
    import { buildIcsCalendar } from './src/lib/calendarExport.ts';
    const fixture = ${JSON.stringify([
      ...FIXTURE,
      entry('late-last-night', '2026-10-12T19:00:00.000Z', '2026-10-12T20:30:00.000Z'),
      entry('after-midnight', '2026-10-12T21:00:00.000Z', '2026-10-12T22:00:00.000Z'),
    ])};
    const late = Date.parse('2026-10-12T21:30:00.000Z');
    const uids = (ics) => [...ics.replace(/\\r\\n /g, '').matchAll(/^UID:(.+)@hamefaked$/gm)].map(m => m[1]).sort();
    console.log(JSON.stringify({
      noon: uids(buildIcsCalendar(fixture, ${NOW_MS}).text),
      late: uids(buildIcsCalendar(fixture, late).text),
    }));
  `;
  const runUnder = (tz) => JSON.parse(execFileSync(
    process.execPath,
    ['--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval', script],
    { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: tz }, encoding: 'utf8' },
  ));

  const jerusalem = runUnder('Asia/Jerusalem');
  assert.deepEqual(jerusalem.late, ['after-midnight', 'tomorrow']);
  for (const tz of ['America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo', 'UTC']) {
    assert.deepEqual(runUnder(tz), jerusalem, `export drifted under TZ=${tz}`);
  }
});

test('ICS output stays importable by Google Calendar (RFC 5545 structure)', () => {
  const longTitle = '🎯 תרגיל פלוגתי מורחב בשטח האש הצפוני עם כל המחלקות, כולל מסע לילה; ותדריך בטיחות מלא לפני היציאה';
  const details = 'שורה ראשונה\r\nשורה שנייה, עם; תווים\\מיוחדים\nשורה שלישית';
  const { text } = calendar.buildIcsCalendar([
    entry('long', '2026-10-13T06:00:00.000Z', '2026-10-13T08:00:00.000Z', { title: longTitle, details, location: 'שטח אש 105, צפון' }),
    entry('no-end', '2026-10-13T10:00:00.000Z', null),
    entry('bad-end', '2026-10-13T12:00:00.000Z', '2026-10-13T11:00:00.000Z'),
  ], NOW_MS);

  // CRLF only — no bare CR or LF anywhere.
  assert.doesNotMatch(text.replace(/\r\n/g, ''), /[\r\n]/, 'every line break must be CRLF');

  // Every physical line is at most 75 octets (§3.1).
  for (const line of text.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line exceeds 75 octets: ${line}`);
  }

  const lines = unfold(text).split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-1), 'END:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.includes('METHOD:PUBLISH'), 'METHOD:PUBLISH tells importers this is a plain calendar, not an invitation');
  assert.equal(lines.filter(line => line === 'BEGIN:VEVENT').length, 3);
  assert.equal(lines.filter(line => line === 'END:VEVENT').length, 3);

  const blocks = unfold(text).split('BEGIN:VEVENT\r\n').slice(1);
  for (const block of blocks) {
    const field = (name) => block.split('\r\n').find(line => line.startsWith(`${name}:`))?.slice(name.length + 1);
    assert.ok(field('UID'), 'VEVENT needs UID');
    assert.ok(field('DTSTAMP'), 'VEVENT needs DTSTAMP');
    assert.match(field('DTSTART') ?? '', /^\d{8}T\d{6}Z$/);
    const end = field('DTEND');
    if (end !== undefined) {
      assert.match(end, /^\d{8}T\d{6}Z$/);
      assert.ok(end > field('DTSTART'), 'DTEND must be later than DTSTART (§3.6.1)');
    }
  }
  const byUid = (uid) => blocks.find(block => block.includes(`UID:${uid}@hamefaked`));
  assert.doesNotMatch(byUid('no-end'), /DTEND/, 'an event with no end time must omit DTEND, not repeat DTSTART');
  assert.doesNotMatch(byUid('bad-end'), /DTEND/, 'an end before the start must not be exported');

  // Folding must round-trip to the escaped original, without splitting a character.
  assert.ok(lines.includes(`SUMMARY:${longTitle.replace(/,/g, '\\,').replace(/;/g, '\\;')}`));
  assert.ok(lines.includes('DESCRIPTION:שורה ראשונה\\nשורה שנייה\\, עם\\; תווים\\\\מיוחדים\\nשורה שלישית'));
  assert.ok(lines.includes('LOCATION:שטח אש 105\\, צפון'));
});

test('Google Calendar link is a valid TEMPLATE URL with the event data', () => {
  assert.equal(typeof calendar.buildGoogleCalendarUrl, 'function', 'buildGoogleCalendarUrl must be exported');

  const url = calendar.buildGoogleCalendarUrl(entry('g', '2026-10-13T06:00:00.000Z', '2026-10-13T08:30:00.000Z', {
    title: 'מטווח לילה & ירי',
    location: 'מטווח 7, צפון',
    details: 'אימון · אחראי: מ״מ 2\nלהביא ציוד',
  }));
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://calendar.google.com');
  assert.equal(parsed.pathname, '/calendar/render');
  assert.equal(parsed.searchParams.get('action'), 'TEMPLATE');
  assert.match(url, /[?&]dates=20261013T060000Z\/20261013T083000Z(&|$)/, 'dates keeps a literal slash between UTC stamps');
  assert.equal(parsed.searchParams.get('text'), 'מטווח לילה & ירי');
  assert.equal(parsed.searchParams.get('location'), 'מטווח 7, צפון');
  assert.equal(parsed.searchParams.get('details'), 'אימון · אחראי: מ״מ 2\nלהביא ציוד');
  assert.equal(parsed.searchParams.get('ctz'), 'Asia/Jerusalem');

  const noEnd = calendar.buildGoogleCalendarUrl(entry('n', '2026-10-13T06:00:00.000Z', null));
  assert.match(noEnd, /[?&]dates=20261013T060000Z\/20261013T060000Z(&|$)/, 'no end time means end = start, not an invented duration');
  assert.equal(new URL(noEnd).searchParams.get('location'), null, 'no empty location parameter');
});

test('the schedule page delegates to the calendar module instead of filtering inline', () => {
  const source = readFileSync(new URL('../src/app/(protected)/schedule/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /import\s*\{[^}]*buildIcsCalendar[^}]*\}\s*from\s*['"]@\/lib\/calendarExport['"]/s);
  assert.match(source, /import\s*\{[^}]*buildGoogleCalendarUrl[^}]*\}\s*from\s*['"]@\/lib\/calendarExport['"]/s);
  assert.match(source, /import\s*\{[^}]*isUpcomingForCalendar[^}]*\}\s*from\s*['"]@\/lib\/calendarExport['"]/s);

  const start = source.indexOf('const downloadScheduleAsIcs');
  assert.ok(start >= 0, 'downloadScheduleAsIcs must exist');
  const body = source.slice(start, source.indexOf('\n  };\n', start));
  assert.doesNotMatch(body, /status\s*!==\s*'cancelled'/, 'the upcoming filter lives in buildIcsCalendar, not inline');
  assert.match(source, /הוסף ליומן Google/, 'event details offer an add-to-Google button');
});
