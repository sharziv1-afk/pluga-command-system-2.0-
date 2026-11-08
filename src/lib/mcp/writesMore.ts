import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';
import { validateScoreConfig, withScoreConfig, type ScoreConfig } from '@/lib/trackingScore';
import { MCP_ORIGIN, jerusalemLocalToIso, matchByName, resolveDateKey } from './shape';
import {
  ATTENDANCE_MODE,
  EVENT_STATUSES,
  TRACKING_CATEGORIES,
  TRACKING_UNITS,
  TRACKING_UNIT_CODES,
  diffFields,
  jerusalemDisplay,
  staffUserIdOf,
} from './tracking';
import {
  CONFIRM_NOTE,
  DESTRUCTIVE,
  EVENT_TYPES,
  WRITE,
  audit,
  caller,
  clientIdOf,
  fail,
  ok,
  resolvePerson,
  visibleUsers,
} from './writes';

/**
 * More write tools (08.11.2026): edit and delete schedule events, and build
 * the tracking table — weeks, items, and the people on it (soldiers and
 * staff). Same rules as writes.ts: every write runs under the signed-in
 * user's own RLS, is checked for a real row (.select), carries the MCP origin
 * marker where the table has one, and is written to audit_logs.
 *
 * Migration 046 lets an OAuth token do the two things 035 blocked: insert
 * into tracking_weeks / tracking_items / soldiers (never update or delete
 * them), and delete an event that was not created through MCP (still only a
 * closed one, and only its creator or a commander).
 */

const EDIT_CONFIRM_NOTE = ' Changes real data: show the user the event and exactly which fields will change, and get their confirmation before calling. Returns each changed field before and after.';
const OPEN_EVENT_STATUSES = ['scheduled', 'in_progress'];

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  responsible_user_id: string | null;
  status: string;
  notify_audience: string;
};

const EVENT_COLUMNS = 'id,title,description,event_type,starts_at,ends_at,location,responsible_user_id,status,notify_audience';

/** An event as the user reads it: Israel times and the responsible person's name. */
function eventView(row: EventRow, names: Map<string, string>) {
  return {
    title: row.title,
    starts_at: jerusalemDisplay(row.starts_at),
    ends_at: jerusalemDisplay(row.ends_at),
    location: row.location,
    responsible: row.responsible_user_id ? names.get(row.responsible_user_id) ?? row.responsible_user_id : null,
    description: row.description,
    status: row.status,
    event_type: row.event_type,
  };
}

export function registerMoreWriteTools(server: McpServer) {
  // ── Schedule: edit ─────────────────────────────────────────────────────────
  server.registerTool(
    'update_event',
    {
      title: 'עריכת מופע בלו״ז',
      description: 'Edit an existing schedule event (לו״ז) by id (get_schedule lists ids). Give only the fields to change. Times are Israel wall-clock "YYYY-MM-DD HH:mm". '
        + 'ends_at "none" clears the end time; responsible "none" clears the responsible person; an empty location or description clears it. '
        + 'Status: scheduled, in_progress, completed, cancelled. Moving or cancelling an event notifies its responsible person and audience, as on the site. '
        + 'Allowed only to the event\'s creator or a commander.' + EDIT_CONFIRM_NOTE,
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string().min(2).max(200).optional(),
        starts_at: z.string().optional(),
        ends_at: z.string().optional().describe('"YYYY-MM-DD HH:mm", or "none" to clear'),
        location: z.string().max(200).optional(),
        responsible: z.string().optional().describe('Person\'s name, or "none" to clear'),
        description: z.string().max(4000).optional(),
        event_type: z.enum(EVENT_TYPES).optional(),
        status: z.enum(EVENT_STATUSES).optional(),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      const { id, ...changes } = args;
      if (Object.values(changes).every((value) => value === undefined)) return fail('Nothing to change: give at least one field.');

      const { data: before } = await c.supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle<EventRow>();
      if (!before) return fail('Event not found, or you cannot see it.');

      const payload: Partial<EventRow> = {};
      if (args.title !== undefined) payload.title = args.title.trim();
      if (args.description !== undefined) payload.description = args.description.trim() || null;
      if (args.location !== undefined) payload.location = args.location.trim() || null;
      if (args.event_type !== undefined) payload.event_type = args.event_type;
      try {
        if (args.starts_at !== undefined) payload.starts_at = jerusalemLocalToIso(args.starts_at);
        if (args.ends_at !== undefined) payload.ends_at = args.ends_at.trim().toLowerCase() === 'none' ? null : jerusalemLocalToIso(args.ends_at);
      } catch (e) { return fail((e as Error).message); }
      const startsAt = payload.starts_at ?? before.starts_at;
      const endsAt = payload.ends_at !== undefined ? payload.ends_at : before.ends_at;
      if (endsAt && new Date(endsAt) <= new Date(startsAt)) return fail('The end time must be after the start time.');

      if (args.responsible !== undefined) {
        if (args.responsible.trim().toLowerCase() === 'none') {
          payload.responsible_user_id = null;
        } else {
          const person = await resolvePerson(c, args.responsible);
          if ('error' in person) return fail(person.error);
          payload.responsible_user_id = person.id;
        }
      }

      if (args.status !== undefined) {
        payload.status = args.status;
      } else if (before.status === 'completed' && new Date(endsAt ?? startsAt).getTime() > Date.now()) {
        // Same as the site: a completed event moved into the future is open again.
        payload.status = 'scheduled';
      }

      // The database returns "…+00:00", the parser "….000Z": compare instants, not strings.
      const asInstant = (value: string | null) => (value ? new Date(value).toISOString() : null);
      const beforeComparable: Record<string, unknown> = { ...before, starts_at: asInstant(before.starts_at), ends_at: asInstant(before.ends_at) };
      const changed = diffFields(beforeComparable, payload as Record<string, unknown>);
      if (changed.length === 0) return ok({ unchanged: true, id, title: before.title });

      const { data, error } = await c.supabase.from('events').update(payload).eq('id', id).select('id');
      if (error || !didRowsUpdate(data)) return fail('The event was not changed — only its creator or a commander may edit it.');

      const { data: after } = await c.supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle<EventRow>();
      const names = new Map((await visibleUsers(c)).map((u) => [u.id, u.name]));
      const beforeView = eventView(before, names);
      const afterView = eventView(after ?? { ...before, ...payload }, names);
      await audit(c, ctx, {
        actionType: 'event_updated',
        entityType: 'event',
        entityId: id,
        previousValue: Object.fromEntries(changed.map(({ field, before: value }) => [field, value])),
        newValue: Object.fromEntries(changed.map(({ field, after: value }) => [field, value])),
      });
      return ok({
        updated: 'event',
        id,
        changes: diffFields(beforeView, afterView),
        before: beforeView,
        after: afterView,
      });
    },
  );

  // ── Schedule: delete ───────────────────────────────────────────────────────
  server.registerTool(
    'delete_event',
    {
      title: 'מחיקת מופע מהלו״ז',
      description: 'Permanently delete a schedule event by id, including events created on the website. Follows the site\'s rules: only the event\'s creator or a commander; '
        + 'an open event is first marked cancelled (its responsible person and audience get "מופע בוטל"), then deleted. '
        + 'Irreversible: show the user the event (title, time, responsible) and get explicit confirmation before calling. Returns what was deleted.',
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: DESTRUCTIVE,
    },
    async ({ id }, ctx) => {
      const c = caller(ctx);
      const { data: row } = await c.supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle<EventRow>();
      if (!row) return fail('Event not found, or you cannot see it.');
      const names = new Map((await visibleUsers(c)).map((u) => [u.id, u.name]));
      const snapshot = eventView(row, names);

      let cancelledFirst = false;
      if (OPEN_EVENT_STATUSES.includes(row.status)) {
        const { data: upd, error: updError } = await c.supabase.from('events').update({ status: 'cancelled' }).eq('id', id).select('id');
        if (updError || !didRowsUpdate(upd)) return fail('The event was not deleted — only its creator or a commander may delete it.');
        cancelledFirst = true;
      }
      const { data: del, error: delError } = await c.supabase.from('events').delete().eq('id', id).select('id');
      if (delError || !didRowsUpdate(del)) {
        if (cancelledFirst) {
          // Put it back as it was rather than leave it cancelled but not deleted.
          const { data: back } = await c.supabase.from('events').update({ status: row.status }).eq('id', id).select('id');
          if (!didRowsUpdate(back)) return fail('The event was marked cancelled but could not be deleted or restored — check it on the site.');
        }
        return fail('The event was not deleted — only its creator or a commander may delete it.');
      }
      await audit(c, ctx, {
        actionType: 'event_deleted',
        entityType: 'event',
        entityId: id,
        previousValue: { title: row.title, starts_at: row.starts_at, status: row.status, responsible_user_id: row.responsible_user_id },
        newValue: { cancelled_first: cancelledFirst },
      });
      return ok({ deleted: 'event', id, before: snapshot, after: null, cancelled_first: cancelledFirst });
    },
  );

  // ── Tracking: week ─────────────────────────────────────────────────────────
  server.registerTool(
    'create_tracking_week',
    {
      title: 'פתיחת שבוע מעקב',
      description: 'Open a tracking week (שבוע מעקב), e.g. "שבוע 46 – הכנת סגל", with an optional description and dates (YYYY-MM-DD, Israel). Tracking commanders only (מ״פ, סמ״פ). Items are added to it with create_tracking_item.' + CONFIRM_NOTE,
      inputSchema: z.object({
        title: z.string().min(2).max(120),
        description: z.string().max(1000).optional(),
        start_date: z.string().optional().describe('YYYY-MM-DD'),
        end_date: z.string().optional().describe('YYYY-MM-DD'),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      let startDate: string | null = null;
      let endDate: string | null = null;
      try {
        startDate = args.start_date ? resolveDateKey(args.start_date) : null;
        endDate = args.end_date ? resolveDateKey(args.end_date) : null;
      } catch (e) { return fail((e as Error).message); }
      if (startDate && endDate && endDate < startDate) return fail('The end date cannot be before the start date.');

      const { data: weeks } = await c.supabase.from('tracking_weeks').select('id,title,sort_order,is_active');
      const title = args.title.trim();
      if ((weeks ?? []).some((w) => w.is_active && w.title.trim() === title)) return fail(`An active week named "${title}" already exists.`);
      const sortOrder = (weeks ?? []).reduce((max, w) => Math.max(max, w.sort_order ?? 0), 0) + 1;

      const { data, error } = await c.supabase
        .from('tracking_weeks')
        .insert({
          title,
          description: args.description?.trim() || null,
          start_date: startDate,
          end_date: endDate,
          sort_order: sortOrder,
          created_by: c.profile.id,
        })
        .select('id,title,start_date,end_date')
        .single();
      if (error || !data) return fail('The week was not created — only a tracking commander (מ״פ, סמ״פ) can open one.');
      await audit(c, ctx, { actionType: 'tracking_week_created', entityType: 'tracking_week', entityId: data.id, previousValue: null, newValue: { title: data.title, start_date: data.start_date, end_date: data.end_date } });
      return ok({ created: 'tracking_week', id: data.id, title: data.title, start_date: data.start_date, end_date: data.end_date });
    },
  );

  // ── Tracking: item ─────────────────────────────────────────────────────────
  server.registerTool(
    'create_tracking_item',
    {
      title: 'הוספת מופע מעקב',
      description: 'Add a tracking item (מופע מעקב) to the tracking table, optionally inside a week (by its title). Types: '
        + 'attendance — נוכחות, no score (cells are נכח / לא נכח; the site shows them as עבר / לא עבר); '
        + 'pass_fail — עבר / לא עבר / השלמה; '
        + 'score — עם ציון: needs score_min, score_max and pass_score (רף מעבר); lower_is_better for times, pass_inclusive (default true) for a score exactly on the threshold. '
        + 'Categories: כשירות (default), אימון, מטווח, רפואה, מנהלה, אחר. Tracking commanders only.' + CONFIRM_NOTE,
      inputSchema: z.object({
        title: z.string().min(2).max(120),
        type: z.enum(['attendance', 'pass_fail', 'score']),
        week: z.string().optional().describe('Week title, as in get_tracking'),
        category: z.enum(TRACKING_CATEGORIES).optional(),
        description: z.string().max(1000).optional(),
        score_min: z.number().optional(),
        score_max: z.number().optional(),
        pass_score: z.number().optional(),
        lower_is_better: z.boolean().optional(),
        pass_inclusive: z.boolean().optional(),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      const origin = { created_via: MCP_ORIGIN, mcp_client_id: clientIdOf(ctx) };
      let metadata: Record<string, unknown>;
      let scoreConfig: ScoreConfig | null = null;
      if (args.type === 'score') {
        if (args.score_min === undefined || args.score_max === undefined || args.pass_score === undefined) {
          return fail('A score item needs score_min, score_max and pass_score.');
        }
        scoreConfig = {
          min: args.score_min,
          max: args.score_max,
          pass: args.pass_score,
          lowerIsBetter: args.lower_is_better ?? false,
          passInclusive: args.pass_inclusive ?? true,
        };
        const configError = validateScoreConfig(scoreConfig);
        if (configError) return fail(configError);
        metadata = withScoreConfig(origin, scoreConfig);
      } else {
        if ([args.score_min, args.score_max, args.pass_score, args.lower_is_better, args.pass_inclusive].some((v) => v !== undefined)) {
          return fail('Score settings belong only to a score item (type "score").');
        }
        metadata = args.type === 'attendance' ? { ...origin, mode: ATTENDANCE_MODE } : origin;
      }

      const [{ data: weeks }, { data: items }] = await Promise.all([
        c.supabase.from('tracking_weeks').select('id,title').eq('is_active', true),
        c.supabase.from('tracking_items').select('id,title,week_id,sort_order,is_active'),
      ]);
      let weekId: string | null = null;
      let weekTitle: string | null = null;
      if (args.week) {
        const w = matchByName(weeks ?? [], args.week, (x) => x.title);
        if (!w.match) return fail(w.candidates.length ? `Several weeks match: ${w.candidates.join('; ')}` : `No active week named "${args.week}".`);
        weekId = w.match.id;
        weekTitle = w.match.title;
      }
      const title = args.title.trim();
      if ((items ?? []).some((i) => i.is_active && i.title.trim() === title && i.week_id === weekId)) {
        return fail(`An active item named "${title}" already exists${weekTitle ? ` in "${weekTitle}"` : ''}.`);
      }
      const sortOrder = (items ?? []).reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0) + 1;

      const { data, error } = await c.supabase
        .from('tracking_items')
        .insert({
          title,
          category: args.category ?? 'כשירות',
          subject: null,
          week_id: weekId,
          description: args.description?.trim() || null,
          sort_order: sortOrder,
          metadata,
          created_by: c.profile.id,
          updated_by: c.profile.id,
        })
        .select('id,title,category')
        .single();
      if (error || !data) return fail('The item was not created — only a tracking commander (מ״פ, סמ״פ) can add one.');
      await audit(c, ctx, {
        actionType: 'tracking_item_created',
        entityType: 'tracking_item',
        entityId: data.id,
        previousValue: null,
        newValue: { title: data.title, category: data.category, type: args.type, week: weekTitle, score: scoreConfig },
      });
      return ok({ created: 'tracking_item', id: data.id, title: data.title, type: args.type, category: data.category, week: weekTitle, score: scoreConfig });
    },
  );

  // ── Tracking: person ───────────────────────────────────────────────────────
  server.registerTool(
    'add_tracking_soldier',
    {
      title: 'הוספת אדם לטבלת המעקב',
      description: 'Add a person to the tracking table (מעקב) in a unit: מחלקה 1–4 or פלוגה. For a soldier give their name. For a staff member (סגל) set staff: true and give their name or role as in list_people; '
        + 'the row is linked to their user, and set_tracking_status then finds them by name or role. Tracking commanders only (מ״פ, סמ״פ).' + CONFIRM_NOTE,
      inputSchema: z.object({
        name: z.string().min(2).max(120).describe('Soldier\'s full name, or the staff member\'s name / role'),
        unit: z.enum(TRACKING_UNITS),
        staff: z.boolean().optional().describe('true for a staff member (סגל) who is a user of the site'),
        role_label: z.string().max(80).optional().describe('Role shown in the table. Default for staff: their role'),
        squad_label: z.string().max(80).optional().describe('Squad (כיתה)'),
        personal_number: z.string().max(20).optional(),
        notes: z.string().max(500).optional(),
      }),
      annotations: WRITE,
    },
    async (args, ctx) => {
      const c = caller(ctx);
      const { data: units } = await c.supabase.from('units').select('id,code,name');
      const unit = (units ?? []).find((u) => u.code === TRACKING_UNIT_CODES[args.unit]);
      if (!unit) return fail(`Unit "${args.unit}" was not found.`);

      const { data: rows } = await c.supabase.from('soldiers').select('id,full_name,unit_id,metadata').eq('is_active', true);
      let fullName = args.name.trim();
      let roleLabel = args.role_label?.trim() || null;
      const metadata: Record<string, unknown> = { created_via: MCP_ORIGIN, mcp_client_id: clientIdOf(ctx) };

      if (args.staff) {
        const person = await resolvePerson(c, args.name);
        if ('error' in person) return fail(person.error);
        if (!person.id || !person.name) return fail('A staff member is required.');
        if ((rows ?? []).some((r) => staffUserIdOf(r.metadata) === person.id)) return fail(`${person.name} is already on the tracking table.`);
        const user = (await visibleUsers(c)).find((u) => u.id === person.id);
        fullName = person.name;
        roleLabel = roleLabel ?? user?.role ?? null;
        metadata.person_kind = 'staff';
        metadata.user_id = person.id;
      } else if ((rows ?? []).some((r) => r.full_name.trim() === fullName && r.unit_id === unit.id)) {
        return fail(`An active soldier named "${fullName}" is already in ${args.unit}.`);
      }

      const { data, error } = await c.supabase
        .from('soldiers')
        .insert({
          full_name: fullName,
          personal_number: args.personal_number?.trim() || null,
          unit_id: unit.id,
          squad_label: args.squad_label?.trim() || null,
          role_label: roleLabel,
          notes: args.notes?.trim() || null,
          metadata,
          created_by: c.profile.id,
          updated_by: c.profile.id,
        })
        .select('id,full_name,unit_id')
        .single();
      if (error || !data) return fail('The person was not added — only a tracking commander (מ״פ, סמ״פ) can add people to tracking.');
      await audit(c, ctx, {
        actionType: 'tracking_soldier_created',
        entityType: 'tracking_soldier',
        entityId: data.id,
        previousValue: null,
        newValue: { full_name: data.full_name, unit: args.unit, staff: !!args.staff, role_label: roleLabel },
      });
      return ok({ created: 'tracking_soldier', id: data.id, name: data.full_name, unit: args.unit, staff: !!args.staff, role_label: roleLabel });
    },
  );
}
