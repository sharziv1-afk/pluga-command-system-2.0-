import type { DbEvent } from './types';

/**
 * Calendar export for the schedule: the ICS download and the per-event
 * "add to Google Calendar" link. Pure — no React, no Supabase — so the rules
 * below are testable without a browser.
 */
export type CalendarEntry = Pick<DbEvent, 'id' | 'title' | 'starts_at' | 'ends_at' | 'location' | 'status'> & {
  /** Free text for the calendar's description/details field. */
  details: string;
};

type CalendarTiming = Pick<DbEvent, 'status' | 'starts_at' | 'ends_at'>;

/**
 * Whether an event still belongs in someone's calendar: not cancelled, and its
 * end — or its start, when there is no end — is now or later.
 *
 * This compares instants, not Jerusalem date keys, so it is already correct
 * for Asia/Jerusalem on any device timezone. The later of start and end is
 * used so a bad row with ends_at before starts_at is judged by whichever of
 * the two is still ahead, rather than vanishing from the export.
 */
export function isUpcomingForCalendar(event: CalendarTiming, nowMs = Date.now()) {
  if (event.status === 'cancelled') return false;
  const startMs = new Date(event.starts_at).getTime();
  const endMs = event.ends_at ? new Date(event.ends_at).getTime() : startMs;
  const latestMs = Math.max(startMs, Number.isFinite(endMs) ? endMs : startMs);
  return Number.isFinite(latestMs) && latestMs >= nowMs;
}

/** The end only when it is a real time after the start — otherwise null. */
function validEndMs(entry: Pick<DbEvent, 'starts_at' | 'ends_at'>) {
  if (!entry.ends_at) return null;
  const endMs = new Date(entry.ends_at).getTime();
  return Number.isFinite(endMs) && endMs > new Date(entry.starts_at).getTime() ? endMs : null;
}

/** RFC 5545 §3.3.11 TEXT escaping. Any line break style becomes the literal `\n`. */
export function icsEscape(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** UTC form-#2 date-time: `YYYYMMDDTHHMMSSZ`. */
export function icsUtc(value: string | number) {
  return `${new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * RFC 5545 §3.1: lines are at most 75 octets; longer ones continue on a new
 * line that starts with a space. Hebrew is two octets a letter in UTF-8, so a
 * title of ~35 letters already needs this. Splits only between code points.
 */
export function foldIcsLine(line: string) {
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const codePoint = char.codePointAt(0) ?? 0;
    const charBytes = codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
    if (currentBytes + charBytes > 75) {
      parts.push(current);
      current = ' ';
      currentBytes = 1;
    }
    current += char;
    currentBytes += charBytes;
  }
  parts.push(current);
  return parts.join('\r\n');
}

/**
 * The whole calendar file. Filters through `isUpcomingForCalendar` itself so
 * no caller can export history by forgetting the filter.
 */
export function buildIcsCalendar(entries: CalendarEntry[], nowMs = Date.now()) {
  const upcoming = entries.filter(entry => isUpcomingForCalendar(entry, nowMs));
  const stamp = icsUtc(nowMs);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//המפקד//לו״ז פלוגתי//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const entry of upcoming) {
    const endMs = validEndMs(entry);
    lines.push('BEGIN:VEVENT', `UID:${entry.id}@hamefaked`, `DTSTAMP:${stamp}`, `DTSTART:${icsUtc(entry.starts_at)}`);
    // No end, or an end that isn't after the start: omit DTEND (§3.6.1 then
    // treats it as a point in time) instead of writing DTEND == DTSTART.
    if (endMs !== null) lines.push(`DTEND:${icsUtc(endMs)}`);
    lines.push(`SUMMARY:${icsEscape(entry.title)}`);
    if (entry.location) lines.push(`LOCATION:${icsEscape(entry.location)}`);
    if (entry.details) lines.push(`DESCRIPTION:${icsEscape(entry.details)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');

  return { text: lines.map(foldIcsLine).join('\r\n'), count: upcoming.length };
}

/**
 * Google Calendar's "create event" template link. `dates` keeps a literal
 * slash between the two UTC stamps; with no valid end the event is a point in
 * time (end = start), matching the ICS rather than inventing a duration.
 */
export function buildGoogleCalendarUrl(entry: CalendarEntry) {
  const start = icsUtc(entry.starts_at);
  const endMs = validEndMs(entry);
  const end = endMs === null ? start : icsUtc(endMs);
  const params = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(entry.title)}`,
    `dates=${start}/${end}`,
    entry.details ? `details=${encodeURIComponent(entry.details)}` : null,
    entry.location ? `location=${encodeURIComponent(entry.location)}` : null,
    'ctz=Asia/Jerusalem',
  ].filter((part): part is string => part !== null);
  return `https://calendar.google.com/calendar/render?${params.join('&')}`;
}

// ── Personal subscription feed (calendar widgets) ──────────────────────────
// What calendar_feed() (migration 037) returns for a valid link code.
export type FeedEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
};

export type FeedForumReport = {
  report_date: string;
  level: 'platoon' | 'company' | 'staff';
  status: 'draft' | 'in_progress' | 'submitted' | 'closed';
  mine: boolean;
  platoon_unit_id: string | null;
  present: string | null;
  total: string | null;
};

export type CalendarFeedData = {
  today: string;
  user: { name: string; role: string; is_commander: boolean };
  events: FeedEvent[];
  forum: FeedForumReport[];
};

const FORUM_STATUS_LABELS: Record<FeedForumReport['status'], string> = {
  draft: 'טיוטה',
  in_progress: 'בטיפול',
  submitted: 'הוגש',
  closed: 'נסגר',
};

const isDone = (report: FeedForumReport) => report.status === 'submitted' || report.status === 'closed';

function count(value: string | null) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * One line for the day's leading forum, shown as an all-day event at the top
 * of the calendar widget. Everyone sees the company picture; anyone who is not
 * a commander also sees where their own report stands, first.
 */
export function forumSummaryLine(reports: FeedForumReport[], isCommander: boolean): string {
  const mine = reports.find(report => report.mine);
  const myReport = isCommander ? null : `הדוח שלי: ${mine ? FORUM_STATUS_LABELS[mine.status] : 'לא הוגש'}`;
  const platoons = reports.filter(report => report.level === 'platoon');
  const platoonsDone = new Set(platoons.filter(isDone).map(report => report.platoon_unit_id ?? report.report_date + report.status)).size;
  const staffDone = reports.filter(report => report.level === 'staff' && isDone(report)).length;
  const company = reports.find(report => report.level === 'company');
  let present = 0;
  let total = 0;
  let counted = 0;
  for (const report of platoons.filter(isDone)) {
    const p = count(report.present);
    const t = count(report.total);
    if (p === null && t === null) continue;
    present += p ?? 0;
    total += t ?? 0;
    counted += 1;
  }
  return [
    'פורום מוביל',
    myReport,
    `מחלקות ${Math.min(platoonsDone, 4)}/4`,
    `מפל״ג ${Math.min(staffDone, 4)}/4`,
    `פלוגתי: ${company ? FORUM_STATUS_LABELS[company.status] : 'לא הוגש'}`,
    counted > 0 ? `מצבה ${present}/${total}` : null,
  ].filter(Boolean).join(' · ');
}

function icsDate(dateKey: string) {
  return dateKey.replace(/-/g, '');
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * The subscription calendar. Unlike buildIcsCalendar it keeps the whole
 * window calendar_feed() returned — earlier events of today included — so the
 * widget shows the full day. The forum line is an all-day event per day that
 * has reports, and always for today; its UID is stable per date so the
 * calendar updates it in place on every refresh.
 */
export function buildFeedCalendar(feed: CalendarFeedData, nowMs = Date.now()) {
  const stamp = icsUtc(nowMs);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//המפקד//יומן אישי//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`המפקד · ${feed.user.name}`)}`,
    'X-WR-TIMEZONE:Asia/Jerusalem',
    // Hints for how often to re-fetch. Apple Calendar and most clients honour
    // one of these; Google Calendar ignores both and refreshes on its own.
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  for (const event of feed.events) {
    if (event.status === 'cancelled') continue;
    const endMs = validEndMs(event);
    lines.push('BEGIN:VEVENT', `UID:${event.id}@hamefaked`, `DTSTAMP:${stamp}`, `DTSTART:${icsUtc(event.starts_at)}`);
    if (endMs !== null) lines.push(`DTEND:${icsUtc(endMs)}`);
    lines.push(`SUMMARY:${icsEscape(event.title)}`);
    if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    lines.push('END:VEVENT');
  }

  const forumDates = new Set(feed.forum.map(report => report.report_date));
  forumDates.add(feed.today);
  for (const dateKey of [...forumDates].sort()) {
    const reports = feed.forum.filter(report => report.report_date === dateKey);
    lines.push(
      'BEGIN:VEVENT',
      `UID:forum-${icsDate(dateKey)}@hamefaked`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(dateKey)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDateKey(dateKey))}`,
      `SUMMARY:${icsEscape(forumSummaryLine(reports, feed.user.is_commander))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n');
}
