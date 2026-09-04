// PostgREST returns 204 with NO error when an UPDATE matches zero rows —
// which is exactly what happens when RLS silently filters out a write the
// caller isn't allowed to make. Every `.update(...)` in this app must add
// `.select('id')` and check the result through this before reporting
// success: without it, a denied write and a real one are indistinguishable,
// and the UI ends up telling the user "saved" for something that never
// touched the database.
export function didRowsUpdate(rows: { id?: string }[] | null): boolean {
  return Array.isArray(rows) && rows.length > 0;
}
