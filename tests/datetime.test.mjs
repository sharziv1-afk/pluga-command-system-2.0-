import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

/**
 * The bug this guards: formatDateTime pinned Asia/Jerusalem on /schedule but
 * not on /tasks or /requests, so the same event showed two different times.
 * It was invisible on an Israel-time device, which is why it survived — so
 * the test has to run the formatters under a foreign timezone to see it.
 *
 * A child process is the only honest way to do that: TZ is read once when the
 * process starts, so setting process.env.TZ inside this test would not change
 * what Intl does.
 */
const ISO = '2026-09-08T21:30:00.000Z'; // 00:30 on the 9th in Jerusalem (UTC+3)

function formatUnder(tz) {
  const script = `
    import { formatDate, formatDateTime, formatTime } from './src/lib/datetime.ts';
    console.log(JSON.stringify({
      date: formatDate('${ISO}'),
      dateTime: formatDateTime('${ISO}'),
      time: formatTime('${ISO}'),
    }));
  `;
  const out = execFileSync(
    process.execPath,
    ['--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval', script],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
  );
  return JSON.parse(out);
}

test('date formatting is identical regardless of the device timezone', () => {
  const jerusalem = formatUnder('Asia/Jerusalem');
  for (const tz of ['America/New_York', 'UTC', 'Asia/Tokyo']) {
    assert.deepEqual(
      formatUnder(tz),
      jerusalem,
      `formatters drifted under TZ=${tz}; they must pin Asia/Jerusalem`,
    );
  }
});

test('the pinned time is the Jerusalem wall clock, not UTC', () => {
  const { time, date } = formatUnder('UTC');
  // 21:30Z is 00:30 the following day in Jerusalem. A formatter that leaked
  // UTC would say 21:30 and keep the 8th.
  assert.equal(time, '00:30');
  assert.match(date, /09\.?\/?2026|09\/09\/2026/);
});

test('null and unparseable values fall back instead of printing Invalid Date', () => {
  const script = `
    import { formatDate, formatDateTime, formatTime } from './src/lib/datetime.ts';
    console.log(JSON.stringify({
      nullDate: formatDate(null),
      badDate: formatDate('not-a-date'),
      badDateTime: formatDateTime('not-a-date'),
      badTime: formatTime('not-a-date'),
      customFallback: formatDate(null, '—'),
    }));
  `;
  const out = execFileSync(
    process.execPath,
    ['--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval', script],
    { encoding: 'utf8' },
  );
  const r = JSON.parse(out);
  assert.equal(r.nullDate, 'לא נקבע');
  assert.equal(r.badDate, 'לא נקבע');
  assert.equal(r.badDateTime, 'לא נקבע');
  assert.equal(r.badTime, '');
  assert.equal(r.customFallback, '—');
  for (const v of Object.values(r)) assert.doesNotMatch(String(v), /Invalid Date/);
});

/**
 * Date-key arithmetic. Found by Codex in the schedule's own copy of these
 * helpers and reproduced here before fixing: the old implementation parsed
 * `${key}T12:00:00` as LOCAL noon and converted back to a Jerusalem key, so
 * at a large negative offset the round-trip moved the date by a day. It only
 * breaks below roughly UTC-9 — New York is fine, Honolulu is not — which is
 * why it survived on an Israel-time device.
 */
function keysUnder(tz) {
  const script = `
    import { addDaysToDateKey, getJerusalemDateKey, dateFromKey } from './src/lib/datetime.ts';
    console.log(JSON.stringify({
      same: addDaysToDateKey('2026-09-08', 0),
      next: addDaysToDateKey('2026-09-08', 1),
      back: addDaysToDateKey('2026-09-08', -1),
      monthEnd: addDaysToDateKey('2026-09-30', 1),
      yearEnd: addDaysToDateKey('2026-12-31', 1),
      leap: addDaysToDateKey('2028-02-28', 1),
      week: Array.from({ length: 7 }, (_, i) => addDaysToDateKey('2026-09-08', i)),
      keyOfUtcNoon: getJerusalemDateKey(dateFromKey('2026-09-08')),
    }));
  `;
  const out = execFileSync(
    process.execPath,
    ['--no-warnings', '--experimental-strip-types', '--input-type=module', '--eval', script],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
  );
  return JSON.parse(out);
}

test('date-key arithmetic is identical in every timezone', () => {
  const israel = keysUnder('Asia/Jerusalem');
  // Honolulu (UTC-10) is the case that actually broke; the others guard the
  // opposite direction and the boundaries.
  for (const tz of ['Pacific/Honolulu', 'UTC', 'Asia/Tokyo', 'America/New_York', 'Pacific/Kiritimati']) {
    assert.deepEqual(keysUnder(tz), israel, `date keys drifted under TZ=${tz}`);
  }
});

test('a date key is its own day, and rolls over correctly', () => {
  const k = keysUnder('Pacific/Honolulu');
  assert.equal(k.same, '2026-09-08', 'adding zero days must be a no-op');
  assert.equal(k.next, '2026-09-09');
  assert.equal(k.back, '2026-09-07');
  assert.equal(k.monthEnd, '2026-10-01', 'month boundary');
  assert.equal(k.yearEnd, '2027-01-01', 'year boundary');
  assert.equal(k.leap, '2028-02-29', 'leap day');
  assert.equal(k.keyOfUtcNoon, '2026-09-08', 'the display anchor must stay on its own day');
  assert.deepEqual(k.week, [
    '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
    '2026-09-12', '2026-09-13', '2026-09-14',
  ]);
});
