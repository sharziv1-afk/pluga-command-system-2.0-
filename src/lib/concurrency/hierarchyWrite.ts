import type { SupabaseClient } from '@supabase/supabase-js';

/** How many times to re-resolve when yet another save lands mid-resolution. */
const MAX_MERGE_ATTEMPTS = 3;

export interface FieldChange {
  base: unknown;
  next: unknown;
}

export interface FieldConflictResolution {
  merged: Record<string, unknown>;
  overriddenFields: string[];
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Field-level (not row-level) conflict resolution. Two edits to the same
 * record never collide just for touching the same row — only a field that
 * BOTH sides actually changed, to different values, is a real conflict.
 * Everything else merges automatically. Only a genuine per-field overlap
 * consults rank, via `callerOutranks`.
 *
 * `callerOutranks` is deliberately a plain boolean decided by the DB
 * (`caller_outranks`, migration 029) rather than two permission levels: the
 * caller's own rank must never be something the browser can state.
 */
export function resolveFieldConflicts(
  changes: Record<string, FieldChange>,
  currentServerFields: Record<string, unknown>,
  callerOutranks: boolean,
): FieldConflictResolution {
  const merged: Record<string, unknown> = {};
  const overriddenFields: string[] = [];

  for (const [field, { base, next }] of Object.entries(changes)) {
    const currentValue = currentServerFields[field];

    if (valuesEqual(base, next)) {
      // I never actually changed this field (a form that resubmits every
      // field even when untouched) — always defer to whatever's on the
      // server now, never my stale loaded copy of it.
      merged[field] = currentValue;
      continue;
    }

    if (valuesEqual(currentValue, base) || valuesEqual(currentValue, next)) {
      // Nobody else touched this field since I loaded it, or they already
      // saved the exact value I'm saving — no real collision either way.
      merged[field] = next;
      continue;
    }

    // Same field, two different new values — an actual conflict.
    if (callerOutranks) {
      merged[field] = next;
    } else {
      merged[field] = currentValue;
      overriddenFields.push(field);
    }
  }

  return { merged, overriddenFields };
}

export interface HierarchyWriteParams {
  supabase: SupabaseClient;
  table: string;
  id: string;
  baseUpdatedAt: string;
  /** Only the fields this save is touching, each with the value it was loaded from and the new value. */
  changes: Record<string, FieldChange>;
  /** Columns to refetch on conflict — must cover every key in `changes`, plus updated_by. `updated_at` is added automatically. */
  selectColumns: string;
  /** Pulls the diffable field map out of a freshly-fetched row (flat columns: identity; nested e.g. `content`: unwrap it). */
  extractFields: (row: Record<string, unknown>) => Record<string, unknown>;
  /** Shapes resolved field values into the actual DB update payload (flat columns: identity; nested: wrap in `{ content: {...} }`). */
  buildPayload: (resolvedFields: Record<string, unknown>) => Record<string, unknown>;
  currentUserId: string;
}

export type HierarchyWriteResult =
  | { status: 'applied' }
  /** A conflicting save happened in between. overriddenFields lists fields where MY edit lost to an
   *  equal-or-higher-ranked conflicting edit on that exact field — everything else (mine and theirs) was saved. */
  | { status: 'merged'; overriddenFields: string[] };

export async function writeWithHierarchyResolution({
  supabase,
  table,
  id,
  baseUpdatedAt,
  changes,
  selectColumns,
  extractFields,
  buildPayload,
  currentUserId,
}: HierarchyWriteParams): Promise<HierarchyWriteResult> {
  const fullNext: Record<string, unknown> = {};
  for (const [field, { next }] of Object.entries(changes)) fullNext[field] = next;

  // Fast path: nobody has touched the row since it was loaded.
  const { data: applied, error } = await supabase
    .from(table)
    .update({ ...buildPayload(fullNext), updated_by: currentUserId })
    .eq('id', id)
    .eq('updated_at', baseUpdatedAt)
    .select('id');

  if (error) throw error;
  if (applied && applied.length > 0) return { status: 'applied' };

  // Conflict path. The merge write is guarded on the updated_at we just read,
  // so a third save landing between the read and the merge can't be silently
  // clobbered — it loses the guard, and we re-resolve against the newer state.
  // `changes` is never rebased: each field's `base` stays the value the user
  // actually loaded, which is what defines "did I change this field".
  for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS; attempt += 1) {
    const { data: current, error: readError } = await supabase
      .from(table)
      .select(`${selectColumns},updated_at`)
      .eq('id', id)
      .maybeSingle<Record<string, unknown>>();

    if (readError) throw readError;
    if (!current) throw new Error(`Row ${id} not found in ${table} while resolving a write conflict`);

    // `updated_by` is written by a BEFORE UPDATE trigger from the caller's
    // own JWT identity (migration 030), never from the request payload — so
    // it is safe to base the authority decision on it. Without that trigger
    // a client could stamp itself as the last editor and skip the check.
    const otherEditorId = (current.updated_by as string | null) ?? null;
    let callerOutranks: boolean;

    if (!otherEditorId) {
      // Nobody identifiable holds the current value, so there is no rank to
      // beat. Fail closed: keep what's on the server and report the loss
      // rather than silently overwriting an edit we can't attribute.
      callerOutranks = false;
    } else if (otherEditorId === currentUserId) {
      // Genuinely my own earlier write (another tab, or a queued offline
      // edit of mine that already landed) — my newer value supersedes it.
      callerOutranks = true;
    } else {
      // Both ranks are compared inside the DB against the caller's JWT
      // identity — the browser never states its own authority.
      const { data: outranks, error: rankError } = await supabase
        .rpc('caller_outranks', { target_user_id: otherEditorId });
      if (rankError) throw rankError;
      callerOutranks = outranks === true;
    }

    const { merged, overriddenFields } = resolveFieldConflicts(
      changes,
      extractFields(current),
      callerOutranks,
    );

    const { data: mergedRows, error: mergeError } = await supabase
      .from(table)
      .update({ ...buildPayload(merged), updated_by: currentUserId })
      .eq('id', id)
      .eq('updated_at', current.updated_at as string)
      .select('id');

    if (mergeError) throw mergeError;
    if (mergedRows && mergedRows.length > 0) return { status: 'merged', overriddenFields };
  }

  throw new Error(
    `Could not settle a write conflict on ${table}/${id} after ${MAX_MERGE_ATTEMPTS} attempts`,
  );
}
