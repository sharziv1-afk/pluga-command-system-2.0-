// Pure helpers for the MCP tracking and schedule write tools (writesMore.ts).
// Import-free so the node tests load them directly.

/**
 * Attendance items (נוכחות, no score). The site has two kinds of item —
 * עבר / לא עבר and score — so an attendance item is a regular item with this
 * marker: the site shows its cells as עבר / לא עבר, and the MCP tools read
 * and write them as נכח / לא נכח. The key is not `kind`, which the site's
 * score form clears when an item is edited.
 */
export const ATTENDANCE_MODE = 'attendance';

export function isAttendanceItem(metadata: unknown): boolean {
  return !!metadata && typeof metadata === 'object' && (metadata as Record<string, unknown>).mode === ATTENDANCE_MODE;
}

export function attendanceCodeFromLabel(label: string): 'empty' | 'passed' | 'failed' {
  if (label === 'נכח') return 'passed';
  if (label === 'לא נכח') return 'failed';
  if (label === 'ריק') return 'empty';
  throw new Error(`Unknown attendance status "${label}". Use נכח, לא נכח or ריק.`);
}

/** A staff member (סגל) on the tracking table is a soldiers row linked to their user. */
export function staffUserIdOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  return m.person_kind === 'staff' && typeof m.user_id === 'string' ? m.user_id : null;
}

/** The units a person on the tracking table can belong to (seed_units_roles.sql). */
export const TRACKING_UNITS = ['מחלקה 1', 'מחלקה 2', 'מחלקה 3', 'מחלקה 4', 'פלוגה'] as const;
export const TRACKING_UNIT_CODES: Record<(typeof TRACKING_UNITS)[number], string> = {
  'מחלקה 1': 'platoon_1',
  'מחלקה 2': 'platoon_2',
  'מחלקה 3': 'platoon_3',
  'מחלקה 4': 'platoon_4',
  'פלוגה': 'company',
};

/** Same list as the tracking page's item form. */
export const TRACKING_CATEGORIES = ['כשירות', 'אימון', 'מטווח', 'רפואה', 'מנהלה', 'אחר'] as const;

export const EVENT_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;

/** UTC from the database → "YYYY-MM-DD HH:mm" in Israel time, for before/after reports. */
export function jerusalemDisplay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/**
 * Field-by-field before/after for the fields that actually changed, so an
 * edit or delete reports exactly what it did.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Array<{ field: string; before: unknown; after: unknown }> {
  return Object.keys(after)
    .filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
    .map((field) => ({ field, before: before[field] ?? null, after: after[field] ?? null }));
}
