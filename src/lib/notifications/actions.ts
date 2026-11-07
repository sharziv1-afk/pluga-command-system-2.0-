/**
 * Quick actions on a notification (notifications stage 4, migration 044).
 * The database decides what is allowed (notification_actions_for() and
 * notification_quick_action(), which runs under the user's own RLS); this
 * list only decides which buttons to show. Keep the two in step.
 */
export type QuickAction = 'task_start' | 'task_done' | 'request_ack' | 'seen' | 'mentoring_snooze';

export const QUICK_ACTION_LABELS: Record<QuickAction, string> = {
  task_start: 'התחלתי',
  task_done: 'בוצע',
  request_ack: 'קיבלתי',
  seen: 'ראיתי',
  mentoring_snooze: 'דחה ביום',
};

const ACTIONS_BY_KIND: Record<string, QuickAction[]> = {
  task_assigned: ['task_start', 'task_done'],
  task_soon: ['task_done'],
  task_overdue: ['task_done'],
  task_changed: ['task_done'],
  event_responsible: ['seen'],
  event_invite: ['seen'],
  event_reminder: ['seen'],
  event_soon: ['seen'],
  event_changed: ['seen'],
  request_assigned: ['request_ack'],
  mentoring_check: ['mentoring_snooze'],
};

export function actionsForKind(kind: string): QuickAction[] {
  return Object.hasOwn(ACTIONS_BY_KIND, kind) ? ACTIONS_BY_KIND[kind] : [];
}

export function isQuickAction(value: unknown): value is QuickAction {
  return typeof value === 'string' && Object.hasOwn(QUICK_ACTION_LABELS, value);
}

/** What a finished action says, in the bar and in the page. */
export const QUICK_ACTION_DONE: Record<QuickAction, string> = {
  task_start: 'המשימה סומנה בביצוע',
  task_done: 'המשימה סומנה כבוצעה',
  request_ack: 'הדרישה סומנה בטיפול',
  seen: 'סומן כנקרא',
  mentoring_snooze: 'הבדיקה נדחתה ביום',
};

/** Adds the notification id to its link, so the page can show the action bar. */
export function notificationHref(url: string | null, id: string): string | null {
  if (!url || !/^\/[^/\\]/.test(url)) return null;
  return `${url}${url.includes('?') ? '&' : '?'}n=${encodeURIComponent(id)}`;
}

/**
 * Mute groups in the profile (stage 5). A muted kind still lands in the bell;
 * only the phone stays quiet (claim_pending_pushes, migration 039). A task
 * someone gave me cannot be muted (plan, 05.11.2026).
 */
export const MUTE_GROUPS: Array<{ id: string; label: string; hint: string; kinds: string[] }> = [
  { id: 'task_reminders', label: 'תזכורות משימות', hint: 'בוקר, 5 דקות לפני היעד ואיחור', kinds: ['task_today', 'task_soon', 'task_overdue'] },
  { id: 'task_updates', label: 'עדכונים על משימות שנתתי', hint: 'נתקעה, הושלמה', kinds: ['task_blocked', 'task_completed'] },
  { id: 'task_changes', label: 'שינויים במשימה שלי', hint: 'בוטלה, היעד שונה', kinds: ['task_cancelled', 'task_changed'] },
  { id: 'events', label: 'מופעים', hint: 'מופע חדש, הוזז או בוטל', kinds: ['event_responsible', 'event_invite', 'event_changed'] },
  { id: 'event_reminders', label: 'תזכורות מופעים', hint: '24 שעות, שעה ו־5 דקות לפני', kinds: ['event_reminder', 'event_soon'] },
  { id: 'requests', label: 'דרישות', hint: 'דרישה חדשה, אושרה או נדחתה, ותזכורת לפני מופע', kinds: ['request_assigned', 'request_status', 'request_event_soon'] },
  { id: 'forum', label: 'פורום מוביל', hint: 'תזכורת הגשה, חסרים והכל הוגש', kinds: ['forum_reminder', 'forum_missing', 'forum_complete'] },
  { id: 'gaps', label: 'פערים', hint: 'החלטת מפקד, פער דחוף, פער לטיפולי', kinds: ['gap_decision', 'gap_urgent', 'gap_assigned'] },
  { id: 'mentoring', label: 'חניכה', hint: 'יום בדיקה ובדיקה שלא עודכנה', kinds: ['mentoring_check', 'mentoring_overdue'] },
  { id: 'admin', label: 'ניהול', hint: 'משתמש חדש ממתין לאישור', kinds: ['user_pending'] },
];

export const UNMUTABLE_KINDS = ['task_assigned'] as const;
