/**
 * One source of truth for status and priority labels.
 *
 * Two problems this file exists to prevent, both of which were live:
 *
 * 1. Gender drift. `/dashboard` said "הושלמה", `/requests` said "הושלם" for the
 *    same DB value. Worse than untidy: StatusBadge matched only the masculine
 *    forms, so every feminine label fell through to the neutral grey default —
 *    a completed task and a cancelled one looked identical.
 * 2. Four priority scales with no shared ramp, so "דחופה" was warning on one
 *    page and danger on another.
 *
 * Gender follows the noun each domain uses: משימה and דרישה are feminine,
 * אירוע and פער are masculine. The DB codes are untouched — the labels are a
 * presentation concern, and renaming stored values means a data migration.
 */

export type TaskStatusCode = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type RequestStatusCode = 'open' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type EventStatusCode = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

// משימה — feminine
export const taskStatusLabels: Record<TaskStatusCode, string> = {
  open: 'פתוחה',
  in_progress: 'בתהליך',
  blocked: 'תקועה',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
};

// דרישה — feminine. `in_progress` is "בטיפול" here and "בתהליך" for a task:
// a requirement is being handled by someone, a task is mid-execution.
export const requestStatusLabels: Record<RequestStatusCode, string> = {
  open: 'פתוחה',
  in_progress: 'בטיפול',
  approved: 'אושרה',
  rejected: 'נדחתה',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
};

// אירוע — masculine
export const eventStatusLabels: Record<EventStatusCode, string> = {
  scheduled: 'מתוכנן',
  in_progress: 'בתהליך',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

export type Tone = 'neutral' | 'muted' | 'info' | 'success' | 'warning' | 'danger';

export const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-strong)]',
  muted: 'bg-[var(--surface-muted)] text-[var(--text-muted-accessible)] border-[var(--border-subtle)]',
  info: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/25',
  success: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/25',
  warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/25',
  danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/25',
};

/**
 * Every Hebrew status label the app renders, in both genders where both exist.
 * StatusBadge receives labels, not codes, so this table has to be exhaustive —
 * a missing entry is silent (renders neutral), which is how the gender bug hid.
 */
export const statusTones: Record<string, Tone> = {
  // open / new
  'חדש': 'neutral',
  'פתוח': 'neutral',
  'פתוחה': 'neutral',
  'נפתחה': 'neutral',
  'מתוכנן': 'neutral',
  // in flight
  'בתהליך': 'info',
  'בטיפול': 'info',
  // done
  'הושלם': 'success',
  'הושלמה': 'success',
  'אושר': 'success',
  'אושרה': 'success',
  'סופק': 'success',
  'נסגר': 'success',
  'פעיל': 'success',
  // waiting
  'ממתין לאישור': 'warning',
  // problem
  'דחוף': 'danger',
  'קריטי': 'danger',
  'תקוע': 'danger',
  'תקועה': 'danger',
  'חסום': 'danger',
  'נדחה': 'danger',
  'נדחתה': 'danger',
  // retired
  'בוטל': 'muted',
  'בוטלה': 'muted',
  'לא פעיל': 'muted',
};

/**
 * Priority ramps, side by side so the scales can be compared.
 * The vocabularies differ because they are separate DB value sets; what is
 * shared is the escalation ramp, so the same visual step means the same thing
 * across pages. Requests have a below-normal step; tasks and gaps do not.
 */
export const priorityTones = {
  request: { 'נמוכה': 'muted', 'רגילה': 'neutral', 'גבוהה': 'warning', 'דחופה': 'danger' },
  task: { 'רגילה': 'neutral', 'חשובה': 'info', 'דחופה': 'warning', 'קריטית': 'danger' },
  gap: { 'רגיל': 'neutral', 'חשוב': 'info', 'דחוף': 'warning', 'קריטי': 'danger' },
} satisfies Record<string, Record<string, Tone>>;

export function priorityClass(scale: keyof typeof priorityTones, value: string) {
  const tone = (priorityTones[scale] as Record<string, Tone>)[value] ?? 'neutral';
  return toneClasses[tone];
}
