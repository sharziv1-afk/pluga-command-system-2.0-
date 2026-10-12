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
