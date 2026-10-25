import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/app/(protected)/dashboard/page.tsx', 'utf8');
const requests = readFileSync('src/app/(protected)/requests/page.tsx', 'utf8');

/**
 * The bugs this guards (live QA, 25.10.2026, as מ״פ):
 * - The brief said "1 מופעים היום" while the card below said 9. The brief
 *   counts only events that have not ended, which the wording did not say.
 * - The dashboard card "דרישות פתוחות" showed 4 (open + in progress +
 *   approved); the requests page card with the same label showed 2 (open
 *   only), and approved requests appeared in no card or tab at all.
 */

test('the brief says the event count is what remains today, with a singular form', () => {
  assert.match(dashboard, /function countPhrase\(count: number, one: string, many: string\) \{\s*return count === 1 \? one : `\$\{count\} \$\{many\}`;\s*\}/);
  assert.match(dashboard, /countPhrase\(remainingTodayEvents, 'מופע אחד נותר היום', 'מופעים נותרו היום'\)/);
  assert.match(dashboard, /countPhrase\(remainingTodayEvents, 'מופע אחד שנותר היום', 'מופעים שנותרו היום'\)/);
  assert.doesNotMatch(dashboard, /\} מופעים היום`/, 'no bare "N מופעים היום" phrase may remain in the brief');
  assert.doesNotMatch(dashboard, /activeTodayEvents/);
});

test('the other brief counts read correctly for one item', () => {
  assert.match(dashboard, /countPhrase\(overdueTasks, 'משימה אחת באיחור', 'משימות באיחור'\)/);
  assert.match(dashboard, /countPhrase\(blockedTasks, 'משימה אחת תקועה', 'משימות תקועות'\)/);
  assert.match(dashboard, /countPhrase\(urgentRequests, 'דרישה אחת בעדיפות גבוהה', 'דרישות בעדיפות גבוהה'\)/);
  assert.match(dashboard, /countPhrase\(attentionItems\.length, 'פריט אחד דורש', 'פריטים דורשים'\)/);
});

test('the dashboard card that counts every active request is labelled "דרישות פעילות"', () => {
  assert.match(dashboard, /return request\.status === 'open' \|\| request\.status === 'in_progress' \|\| request\.status === 'approved';/);
  assert.match(dashboard, /title: 'דרישות פעילות',\s*value: String\(openRequests\.length\),/);
  assert.doesNotMatch(dashboard, /title: 'דרישות פתוחות'/);
});

test('on the requests page approved requests count, and filter, as in handling', () => {
  assert.match(requests, /case 'in_progress': return request\.status === 'in_progress' \|\| request\.status === 'approved';/);
  assert.match(requests, /if \(r\.status === 'in_progress' \|\| r\.status === 'approved'\) inProgress \+= 1;/);
  // open + in handling on this page now add up to the dashboard's active count.
  assert.match(requests, /if \(r\.status === 'open'\) open \+= 1;/);
});
