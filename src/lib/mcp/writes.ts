import { z } from 'zod';
import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { createAuditLog, type CreateAuditLogParams } from '@/lib/audit';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';
import { isCompanyCommander } from '@/lib/permissions';
import {
  formatScore,
  readRecordScore,
  readScoreConfig,
  scoreRangeLabel,
  statusForScore,
  validateScore,
  withRecordScore,
} from '@/lib/trackingScore';
import { callerFrom, type McpCaller } from './context';
import {
  MCP_ORIGIN,
  asText,
  jerusalemLocalToIso,
  matchByName,
  resolveDateKey,
  trackingCodeFromLabel,
  trackingLabel,
  type UserLite,
} from './shape';

/**
 * Write tools (goal 2). Each one mirrors the website's own write for the same
 * action — same columns, same metadata, a `.select()` row check so an
 * RLS-denied write is never reported as success, and a best-effort audit row.
 *
 * Everything written here carries the origin marker (metadata.created_via =
 * 'mcp', or created_via for mentoring). Migration 035 lets an OAuth token
 * delete ONLY such rows, never change the marker, and never write to any table
 * outside tasks / requests / events / tracking_records / mentoring_entries.
 * The user's own permissions (RLS) still decide every write.
 */

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } as const;

const TASK_PRIORITIES = ['רגילה', 'חשובה', 'דחופה', 'קריטית'] as const;
const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'completed', 'cancelled'] as const;
const REQUEST_CATEGORIES = ['לוגיסטיקה', 'רפואה', 'קשר', 'רכב', 'כוח אדם', 'אחר'] as const;
const REQUEST_PRIORITIES = ['נמוכה', 'רגילה', 'גבוהה', 'דחופה'] as const;
const REQUEST_STATUSES = ['open', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled'] as const;
const EVENT_TYPES = ['training', 'logistics', 'meeting', 'inspection', 'operation', 'admin', 'other'] as const;

const CONFIRM_NOTE = ' Changes real data: tell the user exactly what will be written and get their confirmation before calling.';

function caller(ctx: ServerContext): McpCaller {
  return callerFrom(ctx.http?.authInfo);
}

function clientIdOf(ctx: ServerContext): string {
  return ctx.http?.authInfo?.clientId ?? 'unknown';
}

function fail(message: string) {
  return { ...asText({ ok: false, error: message }), isError: true };
}

function ok(value: Record<string, unknown>) {
  return asText({ ok: true, ...value });
}

/** Awaited so the row lands before the serverless function returns; never throws. */
async function audit(c: McpCaller, ctx: ServerContext, params: Omit<CreateAuditLogParams, 'userId' | 'userName' | 'userRole'>) {
  await createAuditLog(c.supabase, {
    ...params,
    userId: c.profile.id,
    userName: c.profile.name,
    userRole: c.profile.role,
    newValue: { ...(params.newValue ?? {}), via: MCP_ORIGIN, mcp_client_id: clientIdOf(ctx) },
  });
}

async function visibleUsers(c: McpCaller): Promise<UserLite[]> {
  const { data } = await c.supabase.from('users').select('id,name,role,unit_id,status,role_approval_status');
  return ((data ?? []) as UserLite[]).filter((u) => u.status !== 'blocked');
}

/** Resolve a person by name, or explain why not (none / ambiguous). */
async function resolvePerson(c: McpCaller, name: string | undefined): Promise<{ id: string | null; name: string | null } | { error: string }> {
  if (!name) return { id: null, name: null };
  const { match, candidates } = matchByName(await visibleUsers(c), name, (u) => `${u.name} (${u.role})`);
  if (match) return { id: match.id, name: match.name };
  return {
    error: candidates.length
      ? `"${name}" matches several people: ${candidates.join('; ')}. Be more specific.`
      : `No person named "${name}" is visible to you.`,
  };
}

function creatorMeta(c: McpCaller, ctx: ServerContext) {
  return {
    creator_name: c.profile.name,
    creator_role: c.profile.role,
    creator_unit: c.profile.unit_name ?? undefined,
    created_via: MCP_ORIGIN,
    mcp_client_id: clientIdOf(ctx),
  };
}

export function registerWriteTools(server: McpServer) {
  // ── Tasks ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'create_task',
    {
      title: 'יצירת משימה',
      description: 'Create a task (משימה) in the commander\'s task board, assigned to a person by name, with priority and due date (Israel time).' + CONFIRM_NOTE,
      inputSchema: z.object({
        title: z.string().min(2).max(200),
        description: z.string().max(4000).optional(),
        priority: z.enum(TASK_PRIORITIES).optional().describe('Default רגילה'),
        assignee: z.string().optional().describe('Person\'s name as shown in list_people'),
        due: z.string().optional().describe('Due date/time in Israel time: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD"'),
        category: z.string().max(100).optional(),
        location: z.string().max(200).optional(),
        output_required: z.string().max(500).optional(),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      const assignee = await resolvePerson(c, args.assignee);
      if ('error' in assignee) return fail(assignee.error);
      let dueAt: string | null = null;
      try { dueAt = args.due ? jerusalemLocalToIso(args.due) : null; } catch (e) { return fail((e as Error).message); }

      const metadata = {
        category: args.category?.trim() || undefined,
        location: args.location?.trim() || undefined,
        output_required: args.output_required?.trim() || undefined,
        control_questions: [],
        stuck_reason: undefined,
        source_type: 'mcp',
        source_id: null,
        ...creatorMeta(c, ctx),
      };
      const { data, error } = await c.supabase
        .from('tasks')
        .insert({
          title: args.title.trim(),
          description: args.description?.trim() || null,
          status: 'open',
          priority: args.priority ?? 'רגילה',
          created_by: c.profile.id,
          unit_id: c.profile.unit_id,
          assigned_to: assignee.id,
          event_id: null,
          due_at: dueAt,
          metadata,
        })
        .select('id,title,status,priority,due_at')
        .single();
      if (error || !data) return fail('The task was not created — you may not have permission for this.');
      await audit(c, ctx, { actionType: 'task_created', entityType: 'task', entityId: data.id, previousValue: null, newValue: { title: data.title, status: data.status, priority: data.priority } });
      return ok({ created: 'task', id: data.id, title: data.title, assigned_to: assignee.name, due_at: data.due_at });
    },
  );

  server.registerTool(
    'update_task_status',
    {
      title: 'עדכון סטטוס משימה',
      description: 'Change a task\'s status (open, in_progress, blocked = תקועה, completed, cancelled). Use list_tasks to get the id. Allowed only where the site allows you to update that task: its creator and commanders can set any status; the person it is assigned to can set any status except cancelled, and cannot reopen a cancelled task.' + CONFIRM_NOTE,
      inputSchema: z.object({ task_id: z.string().uuid(), status: z.enum(TASK_STATUSES) }),
      annotations: WRITE,
    },
    async ({ task_id, status }, ctx) => {
      const c = caller(ctx);
      const { data: before } = await c.supabase.from('tasks').select('id,title,status').eq('id', task_id).maybeSingle();
      if (!before) return fail('Task not found, or you cannot see it.');
      if (before.status === status) return ok({ unchanged: true, id: task_id, status });
      const { data, error } = await c.supabase
        .from('tasks')
        .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
        .eq('id', task_id)
        .select('id');
      if (error || !didRowsUpdate(data)) return fail('The status was not changed — you do not have permission to update this task.');
      await audit(c, ctx, { actionType: 'task_status_changed', entityType: 'task', entityId: task_id, previousValue: { status: before.status }, newValue: { status } });
      return ok({ updated: 'task', id: task_id, title: before.title, from: before.status, to: status });
    },
  );

  // ── Requests ───────────────────────────────────────────────────────────────
  server.registerTool(
    'create_request',
    {
      title: 'פתיחת דרישה',
      description: 'Open a request (דרישה) with category and priority, optionally assigned to a handler by name.' + CONFIRM_NOTE,
      inputSchema: z.object({
        title: z.string().min(2).max(200),
        description: z.string().max(4000).optional(),
        category: z.enum(REQUEST_CATEGORIES),
        priority: z.enum(REQUEST_PRIORITIES).optional().describe('Default רגילה'),
        handler: z.string().optional().describe('Handler\'s name as shown in list_people'),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      const handler = await resolvePerson(c, args.handler);
      if ('error' in handler) return fail(handler.error);
      const priority = args.priority ?? 'רגילה';
      const { data, error } = await c.supabase
        .from('requests')
        .insert({
          title: args.title.trim(),
          description: args.description?.trim() ?? '',
          status: 'open',
          request_type: args.category,
          requested_by: c.profile.id,
          unit_id: c.profile.unit_id,
          event_id: null,
          assigned_to: handler.id,
          metadata: { category: args.category, priority, ...creatorMeta(c, ctx) },
        })
        .select('id,title,status,request_type')
        .single();
      if (error || !data) return fail('The request was not opened — you may not have permission for this.');
      await audit(c, ctx, { actionType: 'request_created', entityType: 'request', entityId: data.id, previousValue: null, newValue: { title: data.title, status: data.status, request_type: data.request_type } });
      return ok({ created: 'request', id: data.id, title: data.title, handler: handler.name });
    },
  );

  server.registerTool(
    'update_request_status',
    {
      title: 'עדכון סטטוס דרישה',
      description: 'Change a request\'s status (open, in_progress, approved, rejected, completed, cancelled). Use list_requests to get the id.' + CONFIRM_NOTE,
      inputSchema: z.object({ request_id: z.string().uuid(), status: z.enum(REQUEST_STATUSES) }),
      annotations: WRITE,
    },
    async ({ request_id, status }, ctx) => {
      const c = caller(ctx);
      const { data: before } = await c.supabase.from('requests').select('id,title,status').eq('id', request_id).maybeSingle();
      if (!before) return fail('Request not found, or you cannot see it.');
      if (before.status === status) return ok({ unchanged: true, id: request_id, status });
      const { data, error } = await c.supabase.from('requests').update({ status }).eq('id', request_id).select('id');
      if (error || !didRowsUpdate(data)) return fail('The status was not changed — you do not have permission to update this request.');
      await audit(c, ctx, { actionType: 'request_status_changed', entityType: 'request', entityId: request_id, previousValue: { status: before.status }, newValue: { status } });
      return ok({ updated: 'request', id: request_id, title: before.title, from: before.status, to: status });
    },
  );

  // ── Schedule ───────────────────────────────────────────────────────────────
  server.registerTool(
    'create_event',
    {
      title: 'הוספת מופע ללו״ז',
      description: 'Add an event to the schedule (לו״ז). Times are Israel wall-clock "YYYY-MM-DD HH:mm". Types: training, logistics, meeting, inspection, operation, admin, other.' + CONFIRM_NOTE,
      inputSchema: z.object({
        title: z.string().min(2).max(200),
        starts_at: z.string(),
        ends_at: z.string().optional(),
        event_type: z.enum(EVENT_TYPES).optional().describe('Default other'),
        location: z.string().max(200).optional(),
        responsible: z.string().optional().describe('Responsible person\'s name'),
        description: z.string().max(4000).optional(),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      let startsAt: string;
      let endsAt: string | null = null;
      try {
        startsAt = jerusalemLocalToIso(args.starts_at);
        endsAt = args.ends_at ? jerusalemLocalToIso(args.ends_at) : null;
      } catch (e) { return fail((e as Error).message); }
      if (endsAt && new Date(endsAt) <= new Date(startsAt)) return fail('The end time must be after the start time.');
      const responsible = await resolvePerson(c, args.responsible);
      if ('error' in responsible) return fail(responsible.error);
      const { data, error } = await c.supabase
        .from('events')
        .insert({
          title: args.title.trim(),
          description: args.description?.trim() || null,
          event_type: args.event_type ?? 'other',
          starts_at: startsAt,
          ends_at: endsAt,
          location: args.location?.trim() || null,
          unit_id: c.profile.unit_id,
          created_by: c.profile.id,
          responsible_user_id: responsible.id,
          status: 'scheduled',
          metadata: { created_via: MCP_ORIGIN, mcp_client_id: clientIdOf(ctx) },
        })
        .select('id,title,event_type,starts_at,status')
        .single();
      if (error || !data) return fail('The event was not created — you may not have permission for this.');
      await audit(c, ctx, { actionType: 'event_created', entityType: 'event', entityId: data.id, previousValue: null, newValue: { title: data.title, event_type: data.event_type, starts_at: data.starts_at } });
      return ok({ created: 'event', id: data.id, title: data.title, starts_at: data.starts_at, responsible: responsible.name });
    },
  );

  // ── Tracking ───────────────────────────────────────────────────────────────
  server.registerTool(
    'set_tracking_status',
    {
      title: 'עדכון תא במעקב',
      description: 'Set one soldier\'s result for one tracking item (מעקב), with an optional note. Regular items take a status: עבר / לא עבר / השלמה / ריק ("ריק" clears the cell). Score items (מעקב עם ציון) take a score instead, within the item\'s range; עבר / לא עבר then follows the item\'s pass rule. Status "ריק" without a score clears a score item too. Soldier and item are matched by name.' + CONFIRM_NOTE,
      inputSchema: z.object({
        soldier: z.string().min(2),
        item: z.string().min(2).describe('Tracking item title, e.g. "מטווח רובה"'),
        status: z.enum(['עבר', 'לא עבר', 'השלמה', 'ריק']).optional().describe('Regular items only (and "ריק" to clear a score item)'),
        score: z.number().optional().describe('Score items only, e.g. 86'),
        note: z.string().max(500).optional(),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      const [{ data: soldiers }, { data: items }] = await Promise.all([
        c.supabase.from('soldiers').select('id,full_name').eq('is_active', true),
        c.supabase.from('tracking_items').select('id,title,metadata').eq('is_active', true),
      ]);
      const s = matchByName(soldiers ?? [], args.soldier, (x) => x.full_name);
      if (!s.match) return fail(s.candidates.length ? `Several soldiers match: ${s.candidates.join('; ')}` : `No visible soldier named "${args.soldier}".`);
      const it = matchByName(items ?? [], args.item, (x) => x.title);
      if (!it.match) return fail(it.candidates.length ? `Several items match: ${it.candidates.join('; ')}` : `No active tracking item named "${args.item}".`);
      // Score items: the score decides עבר / לא עבר; a hand-picked status would
      // contradict it. Regular items never carry a score.
      const scoreConfig = readScoreConfig(it.match.metadata);
      let status: ReturnType<typeof trackingCodeFromLabel>;
      let score: number | null = null;
      if (scoreConfig) {
        if (args.score === undefined) {
          if (args.status !== 'ריק') return fail(`"${it.match.title}" is a score item — give a score between ${scoreRangeLabel(scoreConfig)}, or status "ריק" to clear it.`);
          status = 'empty';
        } else {
          if (args.status !== undefined) return fail(`"${it.match.title}" is a score item — give only a score; עבר / לא עבר follows from it.`);
          const rangeError = validateScore(args.score, scoreConfig);
          if (rangeError) return fail(`Score out of range for "${it.match.title}": ${scoreRangeLabel(scoreConfig)}.`);
          score = args.score;
          status = statusForScore(score, scoreConfig);
        }
      } else {
        if (args.score !== undefined) return fail(`"${it.match.title}" is not a score item — give a status (עבר / לא עבר / השלמה / ריק).`);
        if (args.status === undefined) return fail('A status is required (עבר / לא עבר / השלמה / ריק).');
        status = trackingCodeFromLabel(args.status);
      }

      const { data: existing } = await c.supabase
        .from('tracking_records')
        .select('id,status,note,metadata')
        .eq('soldier_id', s.match.id)
        .eq('tracking_item_id', it.match.id)
        .maybeSingle();

      let recordId: string | null = null;
      if (existing) {
        const { data, error } = await c.supabase
          .from('tracking_records')
          .update({
            status,
            ...(args.note !== undefined ? { note: args.note.trim() || null } : {}),
            updated_by: c.profile.id,
            metadata: {
              ...(scoreConfig ? withRecordScore(existing.metadata, score) : ((existing.metadata as Record<string, unknown>) ?? {})),
              last_updated_via: MCP_ORIGIN,
            },
          })
          .eq('id', existing.id)
          .select('id');
        if (error || !didRowsUpdate(data)) return fail('The cell was not updated — you cannot edit tracking for this soldier.');
        recordId = existing.id;
      } else {
        const { data, error } = await c.supabase
          .from('tracking_records')
          .insert({
            soldier_id: s.match.id,
            tracking_item_id: it.match.id,
            status,
            note: args.note?.trim() || null,
            created_by: c.profile.id,
            updated_by: c.profile.id,
            metadata: { created_via: MCP_ORIGIN, mcp_client_id: clientIdOf(ctx), ...(score !== null ? { score } : {}) },
          })
          .select('id')
          .single();
        if (error || !data) return fail('The cell was not updated — you cannot edit tracking for this soldier.');
        recordId = data.id;
      }
      await audit(c, ctx, {
        actionType: 'tracking_record_updated',
        entityType: 'tracking_record',
        entityId: recordId!,
        previousValue: existing
          ? { status: existing.status, ...(scoreConfig ? { score: readRecordScore(existing.metadata) } : {}) }
          : null,
        newValue: { soldier: s.match.full_name, item: it.match.title, status, ...(scoreConfig ? { score } : {}) },
      });
      return ok({
        updated: 'tracking',
        soldier: s.match.full_name,
        item: it.match.title,
        from: existing ? trackingLabel(existing.status) : 'ריק',
        to: trackingLabel(status),
        ...(scoreConfig
          ? { from_score: existing ? readRecordScore(existing.metadata) : null, score: score === null ? null : formatScore(score) }
          : {}),
      });
    },
  );

  // ── Mentoring (מ״פ only) ───────────────────────────────────────────────────
  server.registerTool(
    'add_mentoring_entry',
    {
      title: 'רשומה ביומן החניכה',
      description: 'Add an entry to the company commander\'s private mentoring log about a platoon commander or the deputy. מ״פ only. focus and agreed_action are required.' + CONFIRM_NOTE,
      inputSchema: z.object({
        mentee: z.string().min(2).describe('Name of the מ״מ / סמ״פ'),
        focus: z.string().min(2).max(1000),
        agreed_action: z.string().min(2).max(1000),
        observation: z.string().max(2000).optional(),
        occurred_on: z.string().optional().describe('YYYY-MM-DD or today/yesterday. Default today.'),
        next_check_at: z.string().optional().describe('YYYY-MM-DD'),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      if (!isCompanyCommander(c.profile.role)) return fail('The mentoring log is available to the company commander only.');
      const mentee = await resolvePerson(c, args.mentee);
      if ('error' in mentee) return fail(mentee.error);
      if (!mentee.id) return fail('A mentee is required.');
      let occurredOn: string;
      let nextCheck: string | null = null;
      try {
        occurredOn = resolveDateKey(args.occurred_on);
        nextCheck = args.next_check_at ? resolveDateKey(args.next_check_at) : null;
      } catch (e) { return fail((e as Error).message); }
      const { data, error } = await c.supabase
        .from('mentoring_entries')
        .insert({
          mentee_user_id: mentee.id,
          created_by: c.profile.id,
          occurred_on: occurredOn,
          observation: args.observation?.trim() || null,
          focus: args.focus.trim(),
          agreed_action: args.agreed_action.trim(),
          next_check_at: nextCheck,
          created_via: MCP_ORIGIN,
        })
        .select('id')
        .single();
      if (error || !data) return fail('The entry was not saved.');
      await audit(c, ctx, { actionType: 'mentoring_entry_created', entityType: 'mentoring_entry', entityId: data.id, previousValue: null, newValue: { mentee: mentee.name, occurred_on: occurredOn } });
      return ok({ created: 'mentoring_entry', id: data.id, mentee: mentee.name, occurred_on: occurredOn, next_check_at: nextCheck });
    },
  );

  // ── Delete what MCP created ────────────────────────────────────────────────
  server.registerTool(
    'delete_mcp_item',
    {
      title: 'מחיקת פריט שנוצר דרך Claude',
      description:
        'Permanently delete a task, request, event or mentoring entry THAT WAS CREATED THROUGH THIS MCP CONNECTOR (never items created on the website). ' +
        'Follows the site\'s rules: an open task/request/event is first marked cancelled, then deleted, and only if you are its creator or a commander. ' +
        'Irreversible: show the user the item and get explicit confirmation first.',
      inputSchema: z.object({
        type: z.enum(['task', 'request', 'event', 'mentoring']),
        id: z.string().uuid(),
      }),
      annotations: DESTRUCTIVE,
    },
    async ({ type, id }, ctx) => {
      const c = caller(ctx);
      if (type === 'mentoring') {
        const { data: row } = await c.supabase.from('mentoring_entries').select('id,created_via,occurred_on').eq('id', id).maybeSingle();
        if (!row) return fail('Mentoring entry not found, or you cannot see it.');
        if (row.created_via !== MCP_ORIGIN) return fail('This entry was not created through Claude, so it can only be deleted on the website.');
        const { data, error } = await c.supabase.from('mentoring_entries').delete().eq('id', id).select('id');
        if (error || !didRowsUpdate(data)) return fail('The entry was not deleted — you do not have permission.');
        await audit(c, ctx, { actionType: 'mentoring_entry_deleted', entityType: 'mentoring_entry', entityId: id, previousValue: { occurred_on: row.occurred_on }, newValue: null });
        return ok({ deleted: 'mentoring_entry', id });
      }

      const table = type === 'task' ? 'tasks' : type === 'request' ? 'requests' : 'events';
      const closed: Record<typeof table, string[]> = {
        tasks: ['completed', 'cancelled'],
        requests: ['completed', 'rejected', 'cancelled'],
        events: ['completed', 'cancelled'],
      };
      const { data: row } = await c.supabase.from(table).select('id,title,status,metadata').eq('id', id).maybeSingle();
      if (!row) return fail(`The ${type} was not found, or you cannot see it.`);
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      if (meta.created_via !== MCP_ORIGIN) return fail(`This ${type} was not created through Claude, so it can only be deleted on the website.`);

      let cancelledFirst = false;
      if (!closed[table].includes(row.status as string)) {
        const { data: upd, error: updError } = await c.supabase.from(table).update({ status: 'cancelled' }).eq('id', id).select('id');
        if (updError || !didRowsUpdate(upd)) return fail(`The ${type} could not be cancelled before deletion — you do not have permission.`);
        cancelledFirst = true;
      }
      const { data: del, error: delError } = await c.supabase.from(table).delete().eq('id', id).select('id');
      if (delError || !didRowsUpdate(del)) {
        return fail(cancelledFirst
          ? `The ${type} was marked cancelled but not deleted — only its creator or a commander may delete it.`
          : `The ${type} was not deleted — only its creator or a commander may delete it.`);
      }
      await audit(c, ctx, {
        actionType: type === 'task' ? 'task_deleted' : type === 'request' ? 'request_deleted' : 'event_deleted',
        entityType: type,
        entityId: id,
        previousValue: { title: row.title, status: row.status },
        newValue: { cancelled_first: cancelledFirst },
      });
      return ok({ deleted: type, id, title: row.title, cancelled_first: cancelledFirst });
    },
  );
}
