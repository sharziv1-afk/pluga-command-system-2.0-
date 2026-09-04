import type { SupabaseClient } from '@supabase/supabase-js';
import { writeWithHierarchyResolution, type FieldChange } from '../concurrency/hierarchyWrite';
import { queueAdd, queueGetAll, queueRemove } from './db';
import { TABLE_SYNC_CONFIG, type SyncTable } from './tableSyncConfig';

export interface QueuedWrite {
  id: string;
  table: SyncTable;
  rowId: string;
  baseUpdatedAt: string;
  changes: Record<string, FieldChange>;
  /** The row (or, for a nested column like `content`, that column's object) as it was loaded — used to rebuild the DB payload shape at flush time. */
  baseSnapshot: Record<string, unknown>;
  createdAt: number;
}

export async function enqueueWrite(params: {
  table: SyncTable;
  rowId: string;
  baseUpdatedAt: string;
  changes: Record<string, FieldChange>;
  baseSnapshot: Record<string, unknown>;
}): Promise<void> {
  const item: QueuedWrite = {
    id: `${params.table}:${params.rowId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    ...params,
    createdAt: Date.now(),
  };
  await queueAdd(item);
}

export async function pendingWriteCount(): Promise<number> {
  const items = await queueGetAll<QueuedWrite>();
  return items.length;
}

export interface FlushResult {
  applied: number;
  stillPending: number;
}

/**
 * Replays every queued write through the same field-level, role-hierarchy
 * conflict resolution used for a live save — a write made offline against a
 * task/report that someone else also changed in the meantime is resolved
 * exactly the same way it would be if both saves had happened live.
 */
export async function flushWriteQueue(
  supabase: SupabaseClient,
  currentUserId: string,
  currentPermissionLevel: number,
): Promise<FlushResult> {
  const queued = await queueGetAll<QueuedWrite>();
  let applied = 0;
  let stillPending = 0;

  for (const item of queued.sort((a, b) => a.createdAt - b.createdAt)) {
    const config = TABLE_SYNC_CONFIG[item.table];
    if (!config) {
      await queueRemove(item.id);
      continue;
    }
    try {
      await writeWithHierarchyResolution({
        supabase,
        table: item.table,
        id: item.rowId,
        baseUpdatedAt: item.baseUpdatedAt,
        changes: item.changes,
        selectColumns: config.selectColumns,
        extractFields: config.extractFields,
        buildPayload: (fields) => config.buildPayload(fields, item.baseSnapshot),
        currentUserId,
        currentPermissionLevel,
      });
      await queueRemove(item.id);
      applied += 1;
    } catch {
      // Still offline, or a transient error — leave it queued for the next flush.
      stillPending += 1;
    }
  }

  return { applied, stillPending };
}
