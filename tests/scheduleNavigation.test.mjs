import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schedule = readFileSync('src/app/(protected)/schedule/page.tsx', 'utf8');

/**
 * Reported by the מ״פ on 29.10.2026: the "היום", "מחר" and "השבוע" views were
 * pinned to today, so later days were reachable only in "הכל". The day and
 * week views now step back and forward — a day at a time, or a week in
 * "השבוע" — with a way back to the current day.
 */

test('the day and week filters take an offset from today', () => {
  assert.match(schedule, /function getWeekDateKeys\(offset = 0\) \{\s*const startKey = addDaysToDateKey\(getJerusalemDateKey\(new Date\(\)\), offset\);/);
  assert.match(schedule, /function getTabDayKey\(tab: 'today' \| 'tomorrow', offset = 0\) \{\s*return addDaysToDateKey\(getJerusalemDateKey\(new Date\(\)\), \(tab === 'tomorrow' \? 1 : 0\) \+ offset\);/);
  assert.match(schedule, /function getTabStep\(tab: ScheduleTab\) \{\s*return tab === 'week' \? 7 : 1;/);
  assert.match(schedule, /if \(tab === 'week'\) return getWeekDateKeys\(offset\)\.includes\(eventKey\);/);
});

test('the visible events and the week columns follow the offset', () => {
  assert.match(schedule, /const \[dayOffset, setDayOffset\] = useState\(0\);/);
  assert.match(schedule, /events\.filter\(event => filterEventByTab\(event, activeTab, dayOffset\)\)/);
  assert.match(schedule, /getWeekDateKeys\(dayOffset\)\.map\(dateKey => \(\{/);
  // An earlier day still shows its events; only "הכל" hides old ones.
  assert.match(schedule, /activeTab === 'all'\s*\? defaultVisibleEvents/);
});

test('arrows step by the view, a tab resets to the current day, and there is a way back', () => {
  assert.match(schedule, /onClick=\{\(\) => setDayOffset\(current => current - getTabStep\(activeTab\)\)\}/);
  assert.match(schedule, /onClick=\{\(\) => setDayOffset\(current => current \+ getTabStep\(activeTab\)\)\}/);
  assert.match(schedule, /setActiveTab\(tab\.id\);\s*setDayOffset\(0\);/);
  assert.match(schedule, /\{dayOffset !== 0 && \(/);
  assert.match(schedule, /'חזרה לשבוע הנוכחי' : activeTab === 'tomorrow' \? 'חזרה למחר' : 'חזרה להיום'/);
  assert.match(schedule, /aria-label=\{`\$\{stepLabel\} קודם`\}/);
  assert.match(schedule, /aria-label=\{`\$\{stepLabel\} הבא`\}/);
  // "הכל" has nothing to step through.
  assert.match(schedule, /\{activeTab !== 'all' && \(\s*<div className="flex items-center justify-between gap-2/);
});
