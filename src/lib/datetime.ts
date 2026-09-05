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
