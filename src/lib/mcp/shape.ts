// Pure shaping for MCP tool output. No runtime imports: tests load this file
// directly with --experimental-strip-types, and anything that needs the forum
// platoon mapping receives it as a parameter instead of importing it.

export const MAX_ROWS = 200;

/** YYYY-MM-DD in Asia/Jerusalem — the calendar the forum and schedule use. */
export function jerusalemDateKey(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** Accepts YYYY-MM-DD, "today", "yesterday", "tomorrow"; anything else is rejected. */
export function resolveDateKey(input: string | undefined, now: Date = new Date()): string {
  const today = jerusalemDateKey(now);
  if (!input || input === 'today') return today;
  if (input === 'yesterday') return addDays(today, -1);
  if (input === 'tomorrow') return addDays(today, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  throw new Error(`Invalid date "${input}". Use YYYY-MM-DD, today, yesterday or tomorrow.`);
}

/** Hebrew-gershayim–insensitive role comparison, as normalizeRole does in the app. */
export function normalizeRoleText(role: string | null | undefined): string {
  return (role ?? '').replace(/״/g, '"').trim();
}

export const reportStatusLabels: Record<string, string> = {
  draft: 'טיוטה',
  in_progress: 'בטיפול',
  submitted: 'הוגש',
  closed: 'נסגר',
};

export const staffSlots = [
  { role: 'medic', label: 'חופ״ל' },
  { role: 'assistant_commander', label: 'מש״ד' },
  { role: 'logistics_nco', label: 'רס״פ' },
  { role: 'deputy_commander', label: 'סמ״פ' },
] as const;

export interface UserLite {
  id: string;
  name: string;
  role: string;
  unit_id: string | null;
  status?: string;
  role_approval_status?: string;
}

export interface UnitLite {
  id: string;
  name: string;
}

export interface ForumReportRow {
  id: string;
  report_date: string;
  report_level: 'squad' | 'platoon' | 'company' | 'staff';
  staff_role: string | null;
  owner_user_id: string | null;
  status: 'draft' | 'in_progress' | 'submitted' | 'closed';
  content: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  updated_at?: string;
}

export interface PlatoonSlot {
  number: number;
  label: string;
  ownerUserId: string | null;
}

/** Platoon owners exactly as the forum page maps them: an active/approved מ"מ N in מחלקה N. */
export function buildPlatoonSlots(users: UserLite[], units: UnitLite[]): PlatoonSlot[] {
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  return [1, 2, 3, 4].map((number) => {
    const label = `מחלקה ${number}`;
    const owner = users.find(
      (u) =>
        normalizeRoleText(u.role) === `מ"מ ${number}` &&
        (u.unit_id ? unitName.get(u.unit_id) === label : false) &&
        (u.status ?? 'active') === 'active' &&
        (u.role_approval_status ?? 'approved') === 'approved',
    );
    return { number, label, ownerUserId: owner?.id ?? null };
  });
}

export type AssignPlatoonReports = (
  reports: ForumReportRow[],
  platoons: PlatoonSlot[],
) => { byNumber: Map<number, ForumReportRow>; unidentified: ForumReportRow[] };

export interface ForumSlotStatus {
  slot: string;
  owner: string | null;
  status: string;
  final: boolean;
  manpower: string | null;
  report_id: string | null;
  updated_at: string | null;
}

function countString(content: Record<string, unknown>, key: string): string {
  const v = content[key];
  return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
}

export function manpowerOf(content: Record<string, unknown>): string | null {
  const present = countString(content, 'present_count');
  const total = countString(content, 'total_count');
  if (!present && !total) return null;
  return `${present || '—'}/${total || '—'}`;
}

function slotFrom(
  slot: string,
  report: ForumReportRow | undefined,
  names: Map<string, string>,
  fallbackOwner: string | null,
): ForumSlotStatus {
  return {
    slot,
    owner: (report?.owner_user_id && names.get(report.owner_user_id)) || fallbackOwner,
    status: report ? reportStatusLabels[report.status] ?? report.status : 'לא הוגש דוח',
    final: report ? report.status === 'submitted' || report.status === 'closed' : false,
    manpower: report ? manpowerOf(report.content ?? {}) : null,
    report_id: report?.id ?? null,
    updated_at: report?.updated_at ?? null,
  };
}

/**
 * Who reported on a date. Platoon reports go through the same owner-first
 * assignment the forum page and WhatsApp preview use, so this can never
 * attribute platoon 1's report to platoon 2. Squad reports stay hidden, as in
 * the leading forum (showSquadReportsInLeadingForum = false).
 */
export function buildForumStatus(
  reports: ForumReportRow[],
  users: UserLite[],
  units: UnitLite[],
  assign: AssignPlatoonReports,
  visibleScope: 'company' | 'own',
) {
  const names = new Map(users.map((u) => [u.id, u.name]));
  const platoons = buildPlatoonSlots(users, units);
  const { byNumber, unidentified } = assign(reports, platoons);

  const platoonSlots = platoons.map((p) =>
    slotFrom(`${p.label} · סיכום מ״מ`, byNumber.get(p.number), names, p.ownerUserId ? names.get(p.ownerUserId) ?? null : null),
  );
  const staff = staffSlots.map((s) =>
    slotFrom(s.label, reports.find((r) => r.report_level === 'staff' && r.staff_role === s.role), names, null),
  );
  const company = slotFrom('סיכום פלוגתי (מ״פ)', reports.find((r) => r.report_level === 'company'), names, null);

  // A מ"מ only sees rows RLS returned: listing other platoons as "missing"
  // would be wrong, so the own scope reports only what exists.
  const slots = visibleScope === 'company'
    ? [...platoonSlots, ...staff, company]
    : [...platoonSlots, ...staff, company].filter((s) => s.report_id);

  const finals = (list: ForumSlotStatus[]) => list.filter((s) => s.final).length;
  return {
    scope: visibleScope === 'company' ? 'כל הפלוגה' : 'רק הדוחות שהמשתמש רשאי לראות',
    summary: visibleScope === 'company'
      ? {
          platoons_submitted: `${finals(platoonSlots)}/4`,
          staff_submitted: `${finals(staff)}/${staffSlots.length}`,
          company_report: company.status,
        }
      : { reports_visible: slots.length },
    slots,
    unidentified_platoon_reports: unidentified.map((r) => ({ report_id: r.id, status: reportStatusLabels[r.status] ?? r.status })),
  };
}

/** The structured text fields a report carries, in display order, with Hebrew labels. */
export const reportFieldLabels: Array<[string, string]> = [
  ['present_count', 'נוכחים'],
  ['total_count', 'סד״כ'],
  ['personnel', 'כוח אדם'],
  ['readiness', 'כוננות'],
  ['welfare', 'ת״ש'],
  ['medical', 'רפואה'],
  ['safety', 'בטיחות'],
  ['discipline', 'משמעת'],
  ['logistics', 'לוגיסטיקה'],
  ['personal_requests', 'בקשות אישיות'],
  ['plan_vs_actual', 'תכנון מול ביצוע'],
  ['network_and_knowledge', 'רשת / ניהול ריאלי / פרגון / שימור ידע'],
  ['daily_lessons', 'לקחים יומי'],
  ['next_actions', 'פעולות להמשך'],
  ['personal_note', 'התייחסות אישית'],
  ['notes', 'הערות'],
  ['commander_opening', 'פתיחת מ״פ'],
  ['company_summary', 'סיכום פלוגתי'],
  ['tomorrow_schedule', 'לו״ז מחר'],
  ['parallel_schedule', 'לו״ז מקביל'],
  ['commander_closing', 'סגירת מ״פ'],
];

export function reportFields(content: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, label] of reportFieldLabels) {
    const v = content[key];
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') out[label] = String(v).trim();
  }
  return out;
}

/** tracking_records.status codes, labelled as the tracking page shows them. */
export const trackingStatusLabels: Record<string, string> = {
  empty: 'ריק',
  passed: 'עבר',
  failed: 'לא עבר',
  makeup: 'השלמה',
};

export function trackingLabel(code: string | null | undefined): string {
  return trackingStatusLabels[code || 'empty'] ?? String(code);
}

export function trackingCodeFromLabel(label: string): 'empty' | 'passed' | 'failed' | 'makeup' {
  const map: Record<string, 'empty' | 'passed' | 'failed' | 'makeup'> = {
    'ריק': 'empty', 'עבר': 'passed', 'לא עבר': 'failed', 'השלמה': 'makeup',
    empty: 'empty', passed: 'passed', failed: 'failed', makeup: 'makeup',
  };
  const code = map[label.trim()];
  if (!code) throw new Error(`Unknown tracking status "${label}". Use עבר, לא עבר, השלמה or ריק.`);
  return code;
}

function squash(value: string): string {
  return normalizeRoleText(value).replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Resolve a person/soldier/item the user named in free text. Exact match wins;
 * otherwise a unique substring match. Never guesses between several matches —
 * the caller reports the candidates so the user can be specific.
 */
export function matchByName<T>(rows: T[], query: string, nameOf: (row: T) => string): { match: T | null; candidates: string[] } {
  const q = squash(query);
  if (!q) return { match: null, candidates: [] };
  const exact = rows.filter((r) => squash(nameOf(r)) === q);
  if (exact.length === 1) return { match: exact[0], candidates: [] };
  const partial = (exact.length > 1 ? exact : rows).filter((r) => squash(nameOf(r)).includes(q));
  if (partial.length === 1) return { match: partial[0], candidates: [] };
  return { match: null, candidates: partial.slice(0, 10).map(nameOf) };
}

function jerusalemOffsetMinutes(utcMillis: number): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'longOffset' })
    .formatToParts(new Date(utcMillis))
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+02:00';
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 120;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * Wall-clock time in Israel → ISO UTC. Accepts "YYYY-MM-DD HH:mm",
 * "YYYY-MM-DDTHH:mm", "YYYY-MM-DD" (09:00) or a full ISO string with Z/offset
 * (passed through). Handles the IST/IDT switch.
 */
export function jerusalemLocalToIso(input: string): string {
  const value = input.trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) && value.includes('T')) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid time "${input}".`);
    return d.toISOString();
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) throw new Error(`Invalid time "${input}". Use YYYY-MM-DD HH:mm (Israel time).`);
  const [, y, mo, d, h = '9', mi = '00'] = m;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  let offset = jerusalemOffsetMinutes(asUtc);
  offset = jerusalemOffsetMinutes(asUtc - offset * 60_000);
  return new Date(asUtc - offset * 60_000).toISOString();
}

/** Marks a row as written through MCP. The DB (migration 035) only lets an
 *  OAuth token delete rows carrying this marker, and never lets it change it. */
export const MCP_ORIGIN = 'mcp' as const;

export const openTaskStatuses = ['open', 'in_progress', 'blocked'] as const;
export const openRequestStatuses = ['open', 'in_progress', 'approved'] as const;

export function isOverdue(dueAt: string | null | undefined, status: string, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  if (!(openTaskStatuses as readonly string[]).includes(status)) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

/** Never let a tool answer grow unbounded; say when rows were cut. */
export function capRows<T>(rows: T[], limit = MAX_ROWS): { rows: T[]; truncated: boolean; total: number } {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit, total: rows.length };
}

export function asText(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}
