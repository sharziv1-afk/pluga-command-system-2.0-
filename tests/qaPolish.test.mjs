import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const audit = readFileSync('src/lib/audit.ts', 'utf8');
const dashboard = readFileSync('src/app/(protected)/dashboard/page.tsx', 'utf8');
const forum = readFileSync('src/app/(protected)/forum/page.tsx', 'utf8');

/** Found in the full live QA of 25.10.2026, as מ״פ. */

test('every audit action has a dashboard label, so the activity feed never says "עדכון מערכת"', () => {
  const union = audit.slice(audit.indexOf('export type AuditActionType'), audit.indexOf(';', audit.indexOf('export type AuditActionType')));
  const actions = [...union.matchAll(/\|\s*'([a-z_]+)'/g)].map(m => m[1]);
  assert.ok(actions.length > 40, `parsed ${actions.length} audit actions`);
  const labels = dashboard.slice(dashboard.indexOf('const auditActionLabels'), dashboard.indexOf('};', dashboard.indexOf('const auditActionLabels')));
  const missing = actions.filter(action => !new RegExp(`\\b${action}:`).test(labels));
  assert.deepEqual(missing, [], `actions without a label: ${missing.join(', ')}`);
});

test('the viewer\'s own company report shows once, in the "סיכום פלוגתי" slot, not again under "דוחות קיימים"', () => {
  assert.match(forum, /if \(report\.report_level === 'company'\) return report\.owner_user_id !== dbProfile\?\.id;/);
  // The slot it defers to resolves exactly that report.
  assert.match(forum, /if \(node\.level === 'company'\) \{\s*return dailyReports\.find\(report => report\.report_level === 'company' && report\.owner_user_id === dbProfile\?\.id\) \?\? null;/);
});

test('the floating role-list toggle is icon-only on phones but keeps a 44px target and its accessible name', () => {
  assert.match(forum, /<span className="hidden sm:inline">\{isTreeCollapsed \? 'בעלי תפקידים' : 'כווץ תפריט'\}<\/span>/);
  assert.match(forum, /fixed bottom-24 left-4 z-40 flex min-h-11 min-w-11 items-center justify-center/);
  assert.match(forum, /aria-label=\{isTreeCollapsed \? 'הצג את רשימת בעלי התפקידים' : 'קפל את רשימת בעלי התפקידים'\}/);
});
