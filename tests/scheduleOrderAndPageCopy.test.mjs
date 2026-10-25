import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schedule = readFileSync('src/app/(protected)/schedule/page.tsx', 'utf8');
const tasks = readFileSync('src/app/(protected)/tasks/page.tsx', 'utf8');
const requests = readFileSync('src/app/(protected)/requests/page.tsx', 'utf8');

test('the schedule list is chronological even though events load newest-first', () => {
  // The fetch stays descending (so the row cap keeps recent/upcoming rows)...
  assert.match(schedule, /\.order\('starts_at', \{ ascending: false \}\)/);
  // ...and the grouping sorts ascending, so the nearest day is at the top.
  const grouped = schedule.slice(schedule.indexOf('const groupedEvents = useMemo'));
  assert.match(grouped, /const chronological = \[\.\.\.visibleEvents\]\.sort\(\s*\(a, b\) => new Date\(a\.starts_at\)\.getTime\(\) - new Date\(b\.starts_at\)\.getTime\(\),?\s*\);/);
  assert.match(grouped, /for \(const event of chronological\)/);
  assert.doesNotMatch(grouped.slice(0, 600), /for \(const event of visibleEvents\)/);
});

test('the calendar export only carries upcoming events and offers Google Calendar', () => {
  assert.match(schedule, /buildIcsCalendar\(events\.map\(toCalendarEntry\), Date\.now\(\)\)/);
  assert.match(schedule, /buildGoogleCalendarUrl\(toCalendarEntry\(event\)\)/);
  assert.doesNotMatch(schedule, /events\.filter\(event => event\.status !== 'cancelled'\)/, 'the old export-everything filter is gone');
});

test('tasks and requests explain the difference between them', () => {
  assert.match(tasks, /subtitle="עבודה שמוטלת על בעל תפקיד, עם אחראי, תאריך יעד ותוצר — משהו שצריך לבצע\. אם מישהו אחר צריך לספק לך משהו, פתח דרישה\."/);
  const requestSubtitles = requests.match(/subtitle="בקשה שגורם מטפל יספק משאב או טיפול: לוגיסטיקה, רפואה, קשר, רכב או כוח אדם — משהו שצריך לקבל\. אם אתה מבצע את זה בעצמך, זו משימה\."/g) ?? [];
  assert.equal(requestSubtitles.length, 3, 'loading, no-access and main states all use the same description');
});
