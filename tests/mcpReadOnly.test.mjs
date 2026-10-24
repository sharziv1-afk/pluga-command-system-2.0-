import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addDays,
  buildForumStatus,
  buildPlatoonSlots,
  capRows,
  isOverdue,
  jerusalemDateKey,
  manpowerOf,
  reportFields,
  resolveDateKey,
  trackingLabel,
} from '../src/lib/mcp/shape.ts';
import { assignPlatoonReports } from '../src/lib/forum/companyReport.ts';
import { safeNextPath } from '../src/lib/safeNextPath.ts';

const units = [
  { id: 'u-co', name: 'פלוגה' },
  { id: 'u1', name: 'מחלקה 1' },
  { id: 'u2', name: 'מחלקה 2' },
  { id: 'u3', name: 'מחלקה 3' },
  { id: 'u4', name: 'מחלקה 4' },
];
const users = [
  { id: 'mp', name: 'מ״פ', role: 'מ"פ', unit_id: 'u-co', status: 'active', role_approval_status: 'approved' },
  { id: 'mm1', name: 'מ״מ אחת', role: 'מ״מ 1', unit_id: 'u1', status: 'active', role_approval_status: 'approved' },
  { id: 'mm2', name: 'מ״מ שתיים', role: 'מ"מ 2', unit_id: 'u2', status: 'active', role_approval_status: 'approved' },
  { id: 'mm3', name: 'מ״מ שלוש', role: 'מ"מ 3', unit_id: 'u3', status: 'active', role_approval_status: 'approved' },
  { id: 'mm4', name: 'מ״מ ארבע', role: 'מ"מ 4', unit_id: 'u4', status: 'active', role_approval_status: 'approved' },
];
const report = (id, level, owner, status, content = {}, extra = {}) => ({
  id, report_date: '2026-10-21', report_level: level, staff_role: null, owner_user_id: owner, status, content, metadata: null, ...extra,
});

test('dates resolve in Asia/Jerusalem, not UTC', () => {
  // 22:30 UTC on Oct 20 is already Oct 21 in Jerusalem (UTC+3).
  assert.equal(jerusalemDateKey(new Date('2026-10-20T22:30:00Z')), '2026-10-21');
  const now = new Date('2026-10-20T22:30:00Z');
  assert.equal(resolveDateKey(undefined, now), '2026-10-21');
  assert.equal(resolveDateKey('yesterday', now), '2026-10-20');
  assert.equal(resolveDateKey('2026-09-08', now), '2026-09-08');
  assert.throws(() => resolveDateKey('next week', now));
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('platoon owners are mapped by role AND unit, with gershayim normalized', () => {
  const slots = buildPlatoonSlots(users, units);
  assert.deepEqual(slots.map((s) => s.ownerUserId), ['mm1', 'mm2', 'mm3', 'mm4']);
  const wrongUnit = users.map((u) => (u.id === 'mm3' ? { ...u, unit_id: 'u4' } : u));
  assert.equal(buildPlatoonSlots(wrongUnit, units)[2].ownerUserId, null);
});

test('forum status attributes platoon reports by owner, never by array position', () => {
  // Platoon 2's report comes first; index-based mapping would call it platoon 1.
  const reports = [
    report('r2', 'platoon', 'mm2', 'submitted', { present_count: '26', total_count: '28' }),
    report('r1', 'platoon', 'mm1', 'submitted', { present_count: '27', total_count: '30' }),
    report('r3', 'platoon', 'mm3', 'in_progress', { present_count: '29', total_count: '32' }),
    report('rs', 'staff', 'x', 'submitted', {}, { staff_role: 'medic' }),
    report('rc', 'company', 'mp', 'in_progress'),
  ];
  const s = buildForumStatus(reports, users, units, assignPlatoonReports, 'company');
  const byLabel = Object.fromEntries(s.slots.map((x) => [x.slot, x]));
  assert.equal(byLabel['מחלקה 1 · סיכום מ״מ'].report_id, 'r1');
  assert.equal(byLabel['מחלקה 1 · סיכום מ״מ'].manpower, '27/30');
  assert.equal(byLabel['מחלקה 2 · סיכום מ״מ'].report_id, 'r2');
  assert.equal(byLabel['מחלקה 3 · סיכום מ״מ'].status, 'בטיפול');
  assert.equal(byLabel['מחלקה 4 · סיכום מ״מ'].status, 'לא הוגש דוח');
  assert.equal(byLabel['מחלקה 4 · סיכום מ״מ'].owner, 'מ״מ ארבע');
  assert.equal(byLabel['חופ״ל'].final, true);
  assert.equal(s.summary.platoons_submitted, '2/4');
  assert.equal(s.summary.staff_submitted, '1/4');
  assert.equal(s.summary.company_report, 'בטיפול');
});

test('a platoon-scoped viewer is not told other platoons are "missing"', () => {
  const s = buildForumStatus([report('r1', 'platoon', 'mm1', 'submitted')], users.filter((u) => u.id === 'mm1'), units, assignPlatoonReports, 'own');
  assert.equal(s.slots.length, 1);
  assert.equal(s.slots[0].report_id, 'r1');
  assert.deepEqual(s.summary, { reports_visible: 1 });
});

test('report fields are labelled in Hebrew and empty fields are dropped', () => {
  assert.deepEqual(reportFields({ present_count: '27', total_count: '30', medical: '  ', logistics: 'חסרים טושים' }), {
    'נוכחים': '27',
    'סד״כ': '30',
    'לוגיסטיקה': 'חסרים טושים',
  });
  assert.equal(manpowerOf({}), null);
  assert.equal(manpowerOf({ present_count: '25' }), '25/—');
});

test('overdue applies only to open tasks with a past due date; rows are capped', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  assert.equal(isOverdue('2026-09-10T06:00:00Z', 'open', now), true);
  assert.equal(isOverdue('2026-09-10T06:00:00Z', 'completed', now), false);
  assert.equal(isOverdue(null, 'open', now), false);
  const c = capRows(Array.from({ length: 205 }, (_, i) => i));
  assert.equal(c.rows.length, 200);
  assert.equal(c.truncated, true);
  assert.equal(c.total, 205);
});

test('tracking codes are labelled as on the tracking page', () => {
  assert.equal(trackingLabel('passed'), 'עבר');
  assert.equal(trackingLabel('failed'), 'לא עבר');
  assert.equal(trackingLabel('makeup'), 'השלמה');
  assert.equal(trackingLabel(undefined), 'ריק');
  assert.equal(trackingLabel('empty'), 'ריק');
});

test('login ?next= only follows same-origin paths', () => {
  assert.equal(safeNextPath('/oauth/consent?authorization_id=abc'), '/oauth/consent?authorization_id=abc');
  assert.equal(safeNextPath('/forum'), '/forum');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', 'evil.com', '/%0d%0aSet-Cookie', '', null]) {
    const result = safeNextPath(bad);
    assert.ok(result === null || result.startsWith('/') && !result.startsWith('//'), `rejected or neutralised: ${bad}`);
  }
  assert.equal(safeNextPath('//evil.com'), null);
  assert.equal(safeNextPath('https://evil.com'), null);
  assert.equal(safeNextPath('/\\evil.com'), null);
});

const tools = readFileSync('src/lib/mcp/tools.ts', 'utf8');
const context = readFileSync('src/lib/mcp/context.ts', 'utf8');
const route = readFileSync('src/app/api/mcp/route.ts', 'utf8');
const consent = readFileSync('src/app/(auth)/oauth/consent/page.tsx', 'utf8');

test('the MCP layer contains no write calls and no service-role key', () => {
  for (const [name, src] of [['tools.ts', tools], ['context.ts', context], ['route.ts', route]]) {
    assert.doesNotMatch(src, /\.(insert|update|upsert|delete|rpc)\(/, `${name} must stay read-only`);
    assert.doesNotMatch(src, /SERVICE_ROLE|service_role|SUPABASE_SECRET/i, `${name} must not use a privileged key`);
  }
});

test('every tool is annotated read-only and soldier identifiers are never selected', () => {
  const registrations = tools.match(/server\.registerTool\(/g) ?? [];
  const annotated = tools.match(/annotations: READ_ONLY/g) ?? [];
  assert.ok(registrations.length >= 12);
  assert.equal(annotated.length, registrations.length);
  assert.match(tools, /readOnlyHint: true, destructiveHint: false/);
  const selects = tools.match(/\.select\('[^']*'\)/g) ?? [];
  assert.ok(selects.length > 10);
  for (const s of selects) {
    assert.doesNotMatch(s, /personal_number|email/, s);
    assert.doesNotMatch(s, /\*/, `no select(*): ${s}`);
  }
  // auth_user_id is read only to derive signed_in; it is never an output field.
  assert.doesNotMatch(tools, /\bauth_user_id:/);
});

test('the endpoint requires a verified, active, approved profile', () => {
  assert.match(route, /withMcpAuth\(handler, verifyMcpToken, \{\s*required: true/);
  assert.match(context, /supabase\.auth\.getUser\(bearerToken\)/);
  assert.match(context, /profile\.status !== 'active' \|\| profile\.role_approval_status !== 'approved'/);
  assert.match(context, /Authorization: `Bearer \$\{token\}`/);
});

test('consent requires a signed-in, approved profile and returns to the client explicitly', () => {
  assert.match(consent, /getAuthorizationDetails\(authorizationId\)/);
  assert.match(consent, /window\.location\.replace\(`\/login\?next=/);
  assert.match(consent, /profile\.status !== 'active' \|\| profile\.role_approval_status !== 'approved'/);
  assert.match(consent, /approveAuthorization\(authorizationId, \{ skipBrowserRedirect: true \}\)/);
  assert.match(consent, /denyAuthorization\(authorizationId, \{ skipBrowserRedirect: true \}\)/);
});
