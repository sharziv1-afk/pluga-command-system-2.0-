// Per-table shape info needed to replay a queued write through
// writeWithHierarchyResolution — kept in its own zero-dependency module
// (not inline in syncEngine.ts) so it can be unit-tested directly: Node's
// native TS loader (used by the test suite) requires explicit extensions on
// relative imports, which tsc's bundler resolution mode forbids — the fix
// is to keep this leaf module import-free rather than fight that conflict.
export const TABLE_SYNC_CONFIG = {
  tasks: {
    selectColumns: 'title,description,priority,assigned_to,due_at,event_id,metadata,updated_by',
    extractFields: (row: Record<string, unknown>) => row,
    buildPayload: (fields: Record<string, unknown>) => fields,
  },
  forum_daily_reports: {
    selectColumns: 'content,updated_by',
    extractFields: (row: Record<string, unknown>) => (row.content as Record<string, unknown>) ?? {},
    buildPayload: (fields: Record<string, unknown>, baseSnapshot: Record<string, unknown>) => ({
      content: { ...baseSnapshot, ...fields },
    }),
  },
} as const;

export type SyncTable = keyof typeof TABLE_SYNC_CONFIG;
