/**
 * One place for user-facing date/time formatting.
 *
 * Every formatter here pins Asia/Jerusalem. Before this module the timezone
 * was applied inconsistently: `formatTime` carried it everywhere, but
 * `formatDateTime` had it on /schedule and not on /tasks or /requests, so the
 * same event rendered at two different times depending on which screen you
 * opened it from. `formatDate` had it nowhere outside the forum, which can
 * also shift the *day* either side of midnight.
 *
 * On a device already set to Israel time none of that is visible — which is
 * why it survived. It is still wrong, and the fix costs nothing.
 *
 * NOT here, on purpose: `formatDateTimeLocalInput` in schedule/tasks. It
 * produces a value for <input type="datetime-local">, and the save path parses
 * that value back with `new Date(...)`, i.e. as device-local. The two agree
 * with each other; pinning only the formatter would make them disagree and
 * shift stored event times on any non-Israel device. Fixing that pair means
 * changing the parse side in the same move, and it writes to live company
 * data — it wants its own change with a real device to test on.
 */
const TZ = 'Asia/Jerusalem';

/** dd/mm/yyyy */
export function formatDate(value: string | null | undefined, fallback = 'לא נקבע') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('he-IL', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** dd/mm/yyyy hh:mm */
export function formatDateTime(value: string | null | undefined, fallback = 'לא נקבע') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('he-IL', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** hh:mm */
export function formatTime(value: string | null | undefined, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString('he-IL', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A "date key" is a Jerusalem calendar date as `YYYY-MM-DD` — the identity the
 * schedule uses for a day. Arithmetic on it must not involve the host
 * timezone at all.
 */
export function getJerusalemDateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Add days to a date key, entirely in UTC.
 *
 * The schedule previously did this by building `new Date(key + 'T12:00:00')`
 * — no zone suffix, so *local* noon — and converting back to a Jerusalem key.
 * At a large negative offset local noon is already the next day in Jerusalem,
 * so the round-trip shifted the date: in Pacific/Honolulu, adding zero days to
 * 2026-09-08 returned 2026-09-09, moving the whole week view and making
 * "מחר" mean the day after tomorrow.
 *
 * The input is already a Jerusalem calendar date, so there is nothing to
 * convert — this is plain calendar arithmetic, and UTC is the only way to do
 * it without the host timezone getting a vote. Date.UTC normalises overflow,
 * so month and year boundaries need no special case.
 */
export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * A date key as a Date for display formatters, anchored at UTC noon so the
 * shift into Asia/Jerusalem (UTC+2/+3) stays on the same calendar day.
 */
export function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`);
}
