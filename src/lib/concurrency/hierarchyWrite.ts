import type { SupabaseClient } from '@supabase/supabase-js';

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
 * falls back to role hierarchy: the higher permission_level value wins.
 */
export function resolveFieldConflicts(
  changes: Record<string, FieldChange>,
  currentServerFields: Record<string, unknown>,
  currentPermissionLevel: number,
  otherPermissionLevel: number,
): FieldConflictResolution {
  const merged: Record<string, unknown> = {};
  const overriddenFields: string[] = [];

  for (const [field, { base, next }] of Object.entries(changes)) {
    const currentValue = currentServerFields[field];

    if (valuesEqual(currentValue, base) || valuesEqual(currentValue, next)) {
      // Nobody else touched this field since I loaded it, or they already
      // saved the exact value I'm saving — no real collision either way.
      merged[field] = next;
      continue;
    }

    // Same field, two different new values — an actual conflict.
    if (currentPermissionLevel > otherPermissionLevel) {
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
  /** Columns to refetch on conflict — must cover every key in `changes`, plus updated_by. */
  selectColumns: string;
  /** Pulls the diffable field map out of a freshly-fetched row (flat columns: identity; nested e.g. `content`: unwrap it). */
  extractFields: (row: Record<string, unknown>) => Record<string, unknown>;
  /** Shapes resolved field values into the actual DB update payload (flat columns: identity; nested: wrap in `{ content: {...} }`). */
  buildPayload: (resolvedFields: Record<string, unknown>) => Record<string, unknown>;
  currentUserId: string;
  currentPermissionLevel: number;
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
  currentPermissionLevel,
}: HierarchyWriteParams): Promise<HierarchyWriteResult> {
  const fullNext: Record<string, unknown> = {};
  for (const [field, { next }] of Object.entries(changes)) fullNext[field] = next;

  const { data: applied, error } = await supabase
    .from(table)
    .update({ ...buildPayload(fullNext), updated_by: currentUserId })
    .eq('id', id)
    .eq('updated_at', baseUpdatedAt)
    .select('id');

  if (error) throw error;
  if (applied && applied.length > 0) return { status: 'applied' };

  const { data: current } = await supabase
    .from(table)
    .select(selectColumns)
    .eq('id', id)
    .maybeSingle<Record<string, unknown>>();

  if (!current) throw new Error(`Row ${id} not found in ${table} while resolving a write conflict`);

  const otherEditorId = (current.updated_by as string | null) ?? null;
  let otherPermissionLevel = 0;

  if (otherEditorId && otherEditorId !== currentUserId) {
    const { data: otherUser } = await supabase
      .from('users')
      .select('permission_level')
      .eq('id', otherEditorId)
      .maybeSingle<{ permission_level: number | null }>();
    otherPermissionLevel = otherUser?.permission_level ?? 0;
  }

  const { merged, overriddenFields } = resolveFieldConflicts(
    changes,
    extractFields(current),
    currentPermissionLevel,
    otherPermissionLevel,
  );

  const { error: mergeError } = await supabase
    .from(table)
    .update({ ...buildPayload(merged), updated_by: currentUserId })
    .eq('id', id);

  if (mergeError) throw mergeError;

  return { status: 'merged', overriddenFields };
}
