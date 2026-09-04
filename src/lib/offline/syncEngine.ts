import type { SupabaseClient } from '@supabase/supabase-js';
import { writeWithHierarchyResolution, type FieldChange } from '../concurrency/hierarchyWrite';
import { queueAdd, queueGetAll, queueRemove } from './db';
import { TABLE_SYNC_CONFIG, type SyncTable } from './tableSyncConfig';

/** Give up on an item after this many failed flush attempts so a permanently
 *  poisoned write (row deleted, permission revoked) can't wedge the queue. */
const MAX_FLUSH_ATTEMPTS = 5;

export interface QueuedWrite {
  id: string;
  table: SyncTable;
  rowId: string;
  baseUpdatedAt: string;
  changes: Record<string, FieldChange>;
  /** The row (or, for a nested column like `content`, that column's object) as it was loaded — used to rebuild the DB payload shape at flush time. */
  baseSnapshot: Record<string, unknown>;
  /** Who actually made this edit. A queued write must never be replayed under
   *  a different user's identity — on a shared phone that would stamp
   *  updated_by with whoever happens to be signed in at flush time and
   *  resolve conflicts using their rank instead of the real author's. */
  authorUserId: string;
  createdAt: number;
  /** Failed flush attempts so far; see MAX_FLUSH_ATTEMPTS. */
  attempts?: number;
}

export async function enqueueWrite(params: {
  table: SyncTable;
  rowId: string;
  baseUpdatedAt: string;
  changes: Record<string, FieldChange>;
  baseSnapshot: Record<string, unknown>;
  authorUserId: string;
}): Promise<void> {
  const item: QueuedWrite = {
    id: `${params.table}:${params.rowId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    ...params,
    createdAt: Date.now(),
    attempts: 0,
  };
  await queueAdd(item);
}

/** Counts only the signed-in user's own pending writes. */
export async function pendingWriteCount(currentUserId: string): Promise<number> {
  const items = await queueGetAll<QueuedWrite>();
  return items.filter((item) => item.authorUserId === currentUserId).length;
}

export interface FlushResult {
  applied: number;
  stillPending: number;
  /** Items dropped after exceeding MAX_FLUSH_ATTEMPTS. */
  abandoned: number;
}

/**
 * Replays the signed-in user's queued writes through the same field-level,
 * rank-aware conflict resolution used for a live save — a write made offline
 * against a record someone else also changed meanwhile is resolved exactly
 * the same way it would be if both saves had happened live.
 *
 * Writes authored by a different user are left untouched: they belong to that
 * account and must replay under it, not under whoever is signed in now.
 */
export async function flushWriteQueue(
  supabase: SupabaseClient,
  currentUserId: string,
): Promise<FlushResult> {
  const queued = await queueGetAll<QueuedWrite>();
  let applied = 0;
  let stillPending = 0;
  let abandoned = 0;

  const mine = queued
    .filter((item) => item.authorUserId === currentUserId)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const item of mine) {
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
      });
      await queueRemove(item.id);
      applied += 1;
    } catch {
      const attempts = (item.attempts ?? 0) + 1;
      if (attempts >= MAX_FLUSH_ATTEMPTS) {
        await queueRemove(item.id);
        abandoned += 1;
      } else {
        await queueAdd({ ...item, attempts });
        stillPending += 1;
      }
    }
  }

  return { applied, stillPending, abandoned };
}
