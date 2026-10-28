import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/app/(protected)/dashboard/page.tsx', 'utf8');

/**
 * Found 28.10.2026, after the November schedule was imported (102 events):
 * the dashboard loaded "the 80 latest-starting events", which were now all in
 * November, so "מופעים היום" said 0 and "היום בלו״ז" was empty although the
 * schedule page showed today's events. The same day the מ״פ asked to drop the
 * "דרוש טיפול" and "פעילות אחרונה" lists from the dashboard.
 */

test('dashboard events are loaded by a date window from today, not the latest N', () => {
  const query = dashboard.slice(dashboard.indexOf(".from('events')"), dashboard.indexOf('.returns<DbEvent[]>()', dashboard.indexOf(".from('events')")));
  assert.match(query, /\.gte\('starts_at', `\$\{addDaysToDateKey\(todayKey, -1\)\}T20:00:00Z`\)/);
  assert.match(query, /\.lt\('starts_at', `\$\{addDaysToDateKey\(todayKey, 15\)\}T00:00:00Z`\)/);
  assert.match(query, /\.order\('starts_at', \{ ascending: true \}\)/);
  assert.doesNotMatch(query, /ascending: false/);
  assert.match(dashboard, /const todayKey = getJerusalemDateKey\(new Date\(\)\);/);
});

test('the window always contains all of today in Jerusalem, in summer and winter time', () => {
  // 20:00 UTC the day before is 22:00 (UTC+2) or 23:00 (UTC+3) in Jerusalem.
  for (const [today, offsetHours] of [['2026-10-28', 2], ['2026-07-15', 3]]) {
    const midnight = Date.parse(`${today}T00:00:00Z`) - offsetHours * 3_600_000;
    const [y, m, d] = today.split('-').map(Number);
    const windowStart = Date.UTC(y, m - 1, d - 1, 20);
    assert.ok(windowStart <= midnight, `${today}: window opens before Jerusalem midnight`);
  }
});

test('the "דרוש טיפול" and "פעילות אחרונה" cards are gone, and nothing loads the audit log for them', () => {
  assert.doesNotMatch(dashboard, /title="דרוש טיפול"/);
  assert.doesNotMatch(dashboard, /title="פעילות אחרונה"/);
  assert.doesNotMatch(dashboard, /from\('audit_logs'\)/);
  assert.doesNotMatch(dashboard, /function AuditLogRow|function AttentionItemCard|auditActionLabels/);
});

test('today\'s schedule and open tasks stay, side by side', () => {
  assert.match(dashboard, /<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">\s*<GlassCard className="space-y-4">\s*<SectionHeader icon=\{CalendarClock\} title="היום בלו״ז"/);
  assert.match(dashboard, /<SectionHeader icon=\{CheckSquare\} title="משימות פתוחות"/);
  assert.match(dashboard, /title: 'מופעים היום',\s*value: String\(todayEvents\.length\)/);
});
