// Why this exists:
//
// The app queues writes for later only in two places — editing a task and
// editing a forum daily report. Those two go through enqueueWrite. The other
// 44 write sites (every creation, and every edit on the remaining screens)
// talk to Supabase directly, so with no signal the fetch simply rejects.
//
// That is a real limitation and it is allowed to be one. What is NOT allowed
// is what the error messages did about it: a create that failed because the
// phone is in a concrete stairwell reported "לא הצלחנו ליצור את המשימה. נסה
// שוב בעוד רגע" — the wording of a transient server hiccup. A commander reads
// that, taps the button again, gets it again, and has no way to learn that the
// answer is "walk outside", not "wait". Meanwhile what they typed is gone.
//
// So: when the browser itself says there is no connectivity, say that instead.
// This changes no behaviour while online — the original message is returned
// untouched — and it does not pretend the write was saved, because it wasn't.
//
// Deliberately not doing the bigger thing here: making creates queue offline
// like edits do. That needs the queue to carry inserts (client-generated ids,
// replay ordering, de-duplication if a flush half-succeeds), and it touches
// the one subsystem whose failure mode is silently losing a commander's field
// work. It belongs in a change of its own, tested on a real phone.

/** navigator.onLine is only trustworthy in the negative direction: false means
 *  genuinely no interface, true can still mean a captive portal or a dead
 *  uplink. Used only to *explain* a failure that already happened, never to
 *  decide whether to attempt one. */
export function isDefinitelyOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/** Shown when a write failed and the device has no connectivity. Says what
 *  happened, that nothing was saved, and what to do — in that order. */
export const OFFLINE_WRITE_FAILED =
  'אין חיבור לרשת, והפעולה הזו לא נשמרת במכשיר — מה שהוזן לא נשמר. חזור למקום עם קליטה ונסה שוב.';

/**
 * Returns `fallback` normally, or the offline explanation when the device is
 * offline. Call it where a write error message is set, so the message matches
 * the actual cause.
 */
export function writeFailureMessage(fallback: string): string {
  return isDefinitelyOffline() ? OFFLINE_WRITE_FAILED : fallback;
}
