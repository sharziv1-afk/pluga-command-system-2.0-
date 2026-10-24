import { z } from 'zod';
import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { assignPlatoonReports } from '@/lib/forum/companyReport';
import { hasCompanyWideUiAccess, isCompanyCommander } from '@/lib/permissions';
import { requestStatusLabels, taskStatusLabels, eventStatusLabels } from '@/lib/statusLabels';
import { callerFrom, type McpCaller } from './context';
import {
  addDays,
  asText,
  buildForumStatus,
  capRows,
  isOverdue,
  jerusalemDateKey,
  trackingLabel,
  openRequestStatuses,
  openTaskStatuses,
  reportFields,
  reportStatusLabels,
  resolveDateKey,
  staffSlots,
  buildPlatoonSlots,
  manpowerOf,
  type AssignPlatoonReports,
  type ForumReportRow,
  type UnitLite,
  type UserLite,
} from './shape';

/**
 * Read-only tools. Every tool:
 * - is annotated readOnlyHint and never calls insert/update/upsert/delete/rpc;
 * - queries with the caller's own JWT, so RLS decides scope;
 * - drops columns that identify soldiers beyond the site's own display
 *   (personal_number) and never returns emails or auth ids.
 */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

type Ctx = ServerContext;

function caller(ctx: Ctx): McpCaller {
  return callerFrom(ctx.http?.authInfo);
}

function fail(message: string) {
  return { ...asText({ error: message }), isError: true };
}

async function lookups(c: McpCaller) {
  const [{ data: users }, { data: units }] = await Promise.all([
    c.supabase.from('users').select('id,name,role,unit_id,status,role_approval_status'),
    c.supabase.from('units').select('id,name'),
  ]);
  const userList = (users ?? []) as UserLite[];
  const unitList = (units ?? []) as UnitLite[];
  return {
    users: userList,
    units: unitList,
    userName: new Map(userList.map((u) => [u.id, u.name])),
    unitName: new Map(unitList.map((u) => [u.id, u.name])),
  };
}

function scopeLabel(c: McpCaller): 'company' | 'own' {
  return hasCompanyWideUiAccess(c.profile.role, c.profile.permission_level) ? 'company' : 'own';
}

const dateArg = z
  .string()
  .optional()
  .describe('YYYY-MM-DD, or "today" / "yesterday" / "tomorrow". Default: today (Asia/Jerusalem).');

export function registerReadTools(server: McpServer) {
  server.registerTool(
    'whoami',
    {
      title: 'מי מחובר',
      description: 'Who is signed in to "המפקד": name, role, unit and what they are allowed to see. Call this first if unsure about scope.',
      inputSchema: z.object({}),
      annotations: READ_ONLY,
    },
    async (_args, ctx) => {
      const c = caller(ctx);
      return asText({
        name: c.profile.name,
        role: c.profile.role,
        unit: c.profile.unit_name,
        permission_level: c.profile.permission_level,
        scope: scopeLabel(c) === 'company' ? 'כל הפלוגה' : `המסגרת שלי (${c.profile.unit_name ?? 'לא משויך'}) ופריטים שהוקצו לי`,
        mentoring_access: isCompanyCommander(c.profile.role),
        note: 'Everything runs with your own permissions (RLS). Write tools change real data and need your confirmation; delete_mcp_item removes only items created through Claude.',
      });
    },
  );

  server.registerTool(
    'get_forum_status',
    {
      title: 'מצב הפורום המוביל',
      description:
        'Daily leading-forum status for a date: which platoon summaries (מ״מ 1-4), staff reports (חופ״ל, מש״ד, רס״פ, סמ״פ) and the company report were submitted, are in progress, or are missing, with each platoon\'s manpower.',
      inputSchema: z.object({ date: dateArg }),
      annotations: READ_ONLY,
    },
    async ({ date }, ctx) => {
      const c = caller(ctx);
      let dateKey: string;
      try { dateKey = resolveDateKey(date); } catch (e) { return fail((e as Error).message); }
      const [{ data, error }, lk] = await Promise.all([
        c.supabase
          .from('forum_daily_reports')
          .select('id,report_date,report_level,staff_role,owner_user_id,status,content,metadata,updated_at')
          .eq('report_date', dateKey)
          .neq('report_level', 'squad'),
        lookups(c),
      ]);
      if (error) return fail('Could not load forum reports.');
      const status = buildForumStatus(
        (data ?? []) as ForumReportRow[],
        lk.users,
        lk.units,
        assignPlatoonReports as unknown as AssignPlatoonReports,
        scopeLabel(c),
      );
      return asText({ date: dateKey, ...status });
    },
  );

  server.registerTool(
    'get_manpower',
    {
      title: 'מצבה',
      description: 'Manpower (נוכחים/סד״כ) per platoon for a date, from the platoon commanders\' daily reports, plus the company total. Same numbers as the forum\'s company rollup.',
      inputSchema: z.object({ date: dateArg }),
      annotations: READ_ONLY,
    },
    async ({ date }, ctx) => {
      const c = caller(ctx);
      let dateKey: string;
      try { dateKey = resolveDateKey(date); } catch (e) { return fail((e as Error).message); }
      const [{ data, error }, lk] = await Promise.all([
        c.supabase
          .from('forum_daily_reports')
          .select('id,report_date,report_level,staff_role,owner_user_id,status,content,metadata')
          .eq('report_date', dateKey)
          .eq('report_level', 'platoon'),
        lookups(c),
      ]);
      if (error) return fail('Could not load platoon reports.');
      const platoons = buildPlatoonSlots(lk.users, lk.units);
      const { byNumber } = (assignPlatoonReports as unknown as AssignPlatoonReports)((data ?? []) as ForumReportRow[], platoons);
      let present = 0;
      let total = 0;
      let counted = 0;
      const rows = platoons.map((p) => {
        const report = byNumber.get(p.number);
        const content = report?.content ?? {};
        const pres = Number(String(content.present_count ?? '').replace(/[^\d.-]/g, ''));
        const tot = Number(String(content.total_count ?? '').replace(/[^\d.-]/g, ''));
        if (report && Number.isFinite(pres) && Number.isFinite(tot) && String(content.present_count ?? '') !== '') {
          present += pres;
          total += tot;
          counted += 1;
        }
        return {
          platoon: p.label,
          manpower: report ? manpowerOf(content) : null,
          report_status: report ? reportStatusLabels[report.status] ?? report.status : 'לא הוגש דוח',
        };
      }).filter((r) => scopeLabel(c) === 'company' || r.manpower !== null || r.report_status !== 'לא הוגש דוח');
      return asText({
        date: dateKey,
        platoons: rows,
        company_total: counted ? `${present}/${total}` : null,
        platoons_counted: counted,
        note: scopeLabel(c) === 'company' ? undefined : 'Only the platoons you are allowed to see are included.',
      });
    },
  );

  server.registerTool(
    'get_forum_report',
    {
      title: 'דוח פורום מלא',
      description: 'Full text of one daily forum report: a platoon summary (platoon 1-4), a staff report (medic, assistant_commander, logistics_nco, deputy_commander) or the company report.',
      inputSchema: z.object({
        date: dateArg,
        platoon: z.number().int().min(1).max(4).optional().describe('Platoon number 1-4'),
        staff_role: z.enum(['medic', 'assistant_commander', 'logistics_nco', 'deputy_commander']).optional(),
        company: z.boolean().optional().describe('true for the company (מ״פ) report'),
      }),
      annotations: READ_ONLY,
    },
    async ({ date, platoon, staff_role, company }, ctx) => {
      const c = caller(ctx);
      let dateKey: string;
      try { dateKey = resolveDateKey(date); } catch (e) { return fail((e as Error).message); }
      if ([platoon !== undefined, staff_role !== undefined, company === true].filter(Boolean).length !== 1) {
        return fail('Pass exactly one of: platoon, staff_role, company.');
      }
      const [{ data, error }, lk] = await Promise.all([
        c.supabase
          .from('forum_daily_reports')
          .select('id,report_date,report_level,staff_role,owner_user_id,status,content,metadata,updated_at')
          .eq('report_date', dateKey)
          .neq('report_level', 'squad'),
        lookups(c),
      ]);
      if (error) return fail('Could not load forum reports.');
      const reports = (data ?? []) as ForumReportRow[];
      let report: ForumReportRow | undefined;
      let label = '';
      if (platoon !== undefined) {
        const { byNumber } = (assignPlatoonReports as unknown as AssignPlatoonReports)(reports, buildPlatoonSlots(lk.users, lk.units));
        report = byNumber.get(platoon);
        label = `מחלקה ${platoon}`;
      } else if (staff_role) {
        report = reports.find((r) => r.report_level === 'staff' && r.staff_role === staff_role);
        label = staffSlots.find((s) => s.role === staff_role)?.label ?? staff_role;
      } else {
        report = reports.find((r) => r.report_level === 'company');
        label = 'סיכום פלוגתי';
      }
      if (!report) return asText({ date: dateKey, report: label, found: false, note: 'No report exists for this slot and date, or you are not allowed to see it.' });
      return asText({
        date: dateKey,
        report: label,
        found: true,
        status: reportStatusLabels[report.status] ?? report.status,
        owner: report.owner_user_id ? lk.userName.get(report.owner_user_id) ?? null : null,
        updated_at: report.updated_at ?? null,
        fields: reportFields(report.content ?? {}),
      });
    },
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'משימות',
      description: 'Tasks with status, priority, owner, unit and due date. Default: open tasks (open, in progress, stuck). Overdue tasks are flagged.',
      inputSchema: z.object({
        status: z.enum(['open', 'completed', 'cancelled', 'all']).optional().describe('Default "open" (open + in_progress + blocked)'),
        mine: z.boolean().optional().describe('Only tasks I created or that are assigned to me'),
        overdue_only: z.boolean().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ status = 'open', mine, overdue_only }, ctx) => {
      const c = caller(ctx);
      let q = c.supabase
        .from('tasks')
        .select('id,title,description,status,priority,assigned_to,created_by,unit_id,due_at,completed_at,event_id,metadata,created_at')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(500);
      if (status === 'open') q = q.in('status', [...openTaskStatuses]);
      else if (status !== 'all') q = q.eq('status', status);
      const [{ data, error }, lk] = await Promise.all([q, lookups(c)]);
      if (error) return fail('Could not load tasks.');
      const now = new Date();
      let rows = (data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description || null,
        status: taskStatusLabels[t.status as keyof typeof taskStatusLabels] ?? t.status,
        priority: (t.priority as string) ?? null,
        category: (t.metadata as Record<string, unknown> | null)?.category ?? null,
        assigned_to: t.assigned_to ? lk.userName.get(t.assigned_to) ?? 'לא זמין' : null,
        created_by: t.created_by ? lk.userName.get(t.created_by) ?? 'לא זמין' : null,
        unit: t.unit_id ? lk.unitName.get(t.unit_id) ?? null : null,
        due_at: t.due_at,
        overdue: isOverdue(t.due_at, t.status, now),
        mine: t.created_by === c.profile.id || t.assigned_to === c.profile.id,
      }));
      if (mine) rows = rows.filter((r) => r.mine);
      if (overdue_only) rows = rows.filter((r) => r.overdue);
      const capped = capRows(rows);
      return asText({ filter: { status, mine: !!mine, overdue_only: !!overdue_only }, count: capped.total, overdue: rows.filter((r) => r.overdue).length, truncated: capped.truncated, tasks: capped.rows });
    },
  );

  server.registerTool(
    'list_requests',
    {
      title: 'דרישות',
      description: 'Requests (דרישות) from the field with status, category, priority, requester and handler. Default: active (open, in progress, approved).',
      inputSchema: z.object({
        status: z.enum(['active', 'completed', 'rejected', 'cancelled', 'all']).optional(),
        mine: z.boolean().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ status = 'active', mine }, ctx) => {
      const c = caller(ctx);
      let q = c.supabase
        .from('requests')
        .select('id,title,description,status,request_type,requested_by,assigned_to,unit_id,metadata,created_at,updated_at,event_id')
        .order('created_at', { ascending: false })
        .limit(500);
      if (status === 'active') q = q.in('status', [...openRequestStatuses]);
      else if (status !== 'all') q = q.eq('status', status);
      const [{ data, error }, lk] = await Promise.all([q, lookups(c)]);
      if (error) return fail('Could not load requests.');
      let rows = (data ?? []).map((r) => {
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          title: r.title,
          description: r.description || null,
          status: requestStatusLabels[r.status as keyof typeof requestStatusLabels] ?? r.status,
          category: meta.category ?? r.request_type ?? null,
          priority: meta.priority ?? null,
          requested_by: (meta.creator_name as string) ?? (r.requested_by ? lk.userName.get(r.requested_by) ?? null : null),
          handler: r.assigned_to ? lk.userName.get(r.assigned_to) ?? 'לא זמין' : null,
          unit: r.unit_id ? lk.unitName.get(r.unit_id) ?? null : null,
          created_at: r.created_at,
          updated_at: r.updated_at,
          mine: r.requested_by === c.profile.id || r.assigned_to === c.profile.id,
        };
      });
      if (mine) rows = rows.filter((r) => r.mine);
      const capped = capRows(rows);
      return asText({ filter: { status, mine: !!mine }, count: capped.total, truncated: capped.truncated, requests: capped.rows });
    },
  );

  server.registerTool(
    'list_gaps',
    {
      title: 'פערים',
      description: 'Operational gaps (פערים) with urgency, category, handler and whether a commander decision is required.',
      inputSchema: z.object({ include_closed: z.boolean().optional() }),
      annotations: READ_ONLY,
    },
    async ({ include_closed }, ctx) => {
      const c = caller(ctx);
      const [{ data, error }, lk] = await Promise.all([
        c.supabase.from('gaps').select('id,title,description,category,reported_by,unit_id,urgency,status,handler_id,requires_commander_decision,notes,created_at,updated_at').order('created_at', { ascending: false }).limit(500),
        lookups(c),
      ]);
      if (error) return fail('Could not load gaps.');
      let rows = (data ?? []).map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description || null,
        category: g.category,
        urgency: g.urgency,
        status: g.status,
        unit: g.unit_id ? lk.unitName.get(g.unit_id) ?? null : null,
        handler: g.handler_id ? lk.userName.get(g.handler_id) ?? 'לא זמין' : null,
        requires_commander_decision: g.requires_commander_decision,
        notes: g.notes || null,
        created_at: g.created_at,
      }));
      if (!include_closed) rows = rows.filter((g) => !['closed', 'resolved', 'converted', 'cancelled'].includes(String(g.status)));
      const capped = capRows(rows);
      return asText({ count: capped.total, truncated: capped.truncated, gaps: capped.rows });
    },
  );

  server.registerTool(
    'get_schedule',
    {
      title: 'לו״ז',
      description: 'Schedule events (לו״ז) in a date range, oldest first, with type, location, responsible person and status. Default: today through the next 7 days. Past ranges are allowed.',
      inputSchema: z.object({
        from: dateArg,
        days: z.number().int().min(1).max(62).optional().describe('Number of days from "from". Default 7.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ from, days = 7 }, ctx) => {
      const c = caller(ctx);
      let start: string;
      try { start = resolveDateKey(from); } catch (e) { return fail((e as Error).message); }
      const end = addDays(start, days);
      // Jerusalem is UTC+2/+3; widen by a day each side and filter by local date.
      const [{ data, error }, lk] = await Promise.all([
        c.supabase
          .from('events')
          .select('id,title,description,event_type,starts_at,ends_at,location,unit_id,responsible_user_id,status')
          .gte('starts_at', `${addDays(start, -1)}T00:00:00Z`)
          .lt('starts_at', `${addDays(end, 1)}T00:00:00Z`)
          .order('starts_at', { ascending: true })
          .limit(500),
        lookups(c),
      ]);
      if (error) return fail('Could not load events.');
      const rows = (data ?? [])
        .filter((e) => {
          const k = jerusalemDateKey(e.starts_at);
          return k >= start && k < end;
        })
        .map((e) => ({
          id: e.id,
          date: jerusalemDateKey(e.starts_at),
          title: e.title,
          type: e.event_type,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          location: e.location || null,
          unit: e.unit_id ? lk.unitName.get(e.unit_id) ?? null : null,
          responsible: e.responsible_user_id ? lk.userName.get(e.responsible_user_id) ?? 'לא זמין' : null,
          status: eventStatusLabels[e.status as keyof typeof eventStatusLabels] ?? e.status,
          description: e.description || null,
        }));
      const capped = capRows(rows);
      return asText({ from: start, to_exclusive: end, count: capped.total, truncated: capped.truncated, events: capped.rows });
    },
  );

  server.registerTool(
    'get_tracking',
    {
      title: 'מעקב',
      description: 'Soldier tracking matrix (מעקב): tracking items (e.g. ranges, tests) and each soldier\'s status per item (עבר / לא עבר / השלמה / ריק), with per-item totals. Filter by week title, unit name or item.',
      inputSchema: z.object({
        week: z.string().optional().describe('Part of a tracking-week title, e.g. "מטווחים"'),
        unit: z.string().optional().describe('Unit name, e.g. "מחלקה 2"'),
        item: z.string().optional().describe('Part of a tracking-item title'),
        only_not_passed: z.boolean().optional().describe('Only cells that are not "עבר"'),
      }),
      annotations: READ_ONLY,
    },
    async ({ week, unit, item, only_not_passed }, ctx) => {
      const c = caller(ctx);
      const [{ data: weeks }, { data: items, error: itemsError }, { data: soldiers, error: soldiersError }, { data: records, error: recordsError }, lk] = await Promise.all([
        c.supabase.from('tracking_weeks').select('id,title,start_date,end_date,is_active'),
        c.supabase.from('tracking_items').select('id,title,category,subject,week_id,is_active,sort_order').eq('is_active', true),
        c.supabase.from('soldiers').select('id,full_name,unit_id,squad_label,role_label,is_active').eq('is_active', true),
        c.supabase.from('tracking_records').select('soldier_id,tracking_item_id,status,note'),
        lookups(c),
      ]);
      if (itemsError || soldiersError || recordsError) return fail('Could not load tracking data.');
      const weekById = new Map((weeks ?? []).map((w) => [w.id, w]));
      let itemList = (items ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      if (week) itemList = itemList.filter((i) => (weekById.get(i.week_id)?.title ?? '').includes(week));
      if (item) itemList = itemList.filter((i) => String(i.title).includes(item));
      let soldierList = soldiers ?? [];
      if (unit) soldierList = soldierList.filter((s) => (s.unit_id ? lk.unitName.get(s.unit_id) : '') === unit);
      const recordKey = new Map((records ?? []).map((r) => [`${r.soldier_id}:${r.tracking_item_id}`, r]));
      const statusOf = (sid: string, iid: string) => trackingLabel(recordKey.get(`${sid}:${iid}`)?.status);
      const perItem = itemList.map((i) => {
        const counts: Record<string, number> = {};
        for (const s of soldierList) {
          const st = statusOf(s.id, i.id);
          counts[st] = (counts[st] ?? 0) + 1;
        }
        return { item: i.title, category: i.category, week: weekById.get(i.week_id)?.title ?? null, counts };
      });
      let cells = soldierList.map((s) => ({
        soldier: s.full_name,
        unit: s.unit_id ? lk.unitName.get(s.unit_id) ?? null : null,
        squad: s.squad_label || null,
        role: s.role_label || null,
        statuses: Object.fromEntries(itemList.map((i) => [i.title, statusOf(s.id, i.id)])),
        notes: Object.fromEntries(itemList.map((i) => [i.title, recordKey.get(`${s.id}:${i.id}`)?.note || null]).filter(([, n]) => n)),
      }));
      if (only_not_passed) {
        cells = cells
          .map((s) => ({ ...s, statuses: Object.fromEntries(Object.entries(s.statuses).filter(([, st]) => st !== 'עבר')) }))
          .filter((s) => Object.keys(s.statuses).length > 0);
      }
      const capped = capRows(cells);
      return asText({
        weeks: (weeks ?? []).map((w) => ({ title: w.title, start_date: w.start_date, end_date: w.end_date, active: w.is_active })),
        items: perItem,
        soldiers_count: soldierList.length,
        truncated: capped.truncated,
        soldiers: capped.rows,
      });
    },
  );

  server.registerTool(
    'list_mentoring',
    {
      title: 'יומן חניכה',
      description: 'The company commander\'s private mentoring log (observation, focus, agreed action, next check) about platoon commanders and the deputy. Only the מ״פ can see it; for anyone else it returns nothing.',
      inputSchema: z.object({
        mentee: z.string().optional().describe('Part of the mentee\'s name'),
        due_only: z.boolean().optional().describe('Only entries whose next check date has passed'),
      }),
      annotations: READ_ONLY,
    },
    async ({ mentee, due_only }, ctx) => {
      const c = caller(ctx);
      if (!isCompanyCommander(c.profile.role)) {
        return asText({ entries: [], note: 'The mentoring log is visible to the company commander only.' });
      }
      const [{ data, error }, lk] = await Promise.all([
        c.supabase.from('mentoring_entries').select('id,mentee_user_id,occurred_on,observation,focus,agreed_action,next_check_at,task_id,created_at').order('occurred_on', { ascending: false }).limit(500),
        lookups(c),
      ]);
      if (error) return fail('Could not load the mentoring log.');
      const now = Date.now();
      let rows = (data ?? []).map((m) => ({
        id: m.id,
        mentee: m.mentee_user_id ? lk.userName.get(m.mentee_user_id) ?? 'לא זמין' : null,
        occurred_on: m.occurred_on,
        observation: m.observation,
        focus: m.focus,
        agreed_action: m.agreed_action,
        next_check_at: m.next_check_at,
        check_due: m.next_check_at ? new Date(m.next_check_at).getTime() <= now : false,
        linked_task: m.task_id ?? null,
      }));
      if (mentee) rows = rows.filter((r) => (r.mentee ?? '').includes(mentee));
      if (due_only) rows = rows.filter((r) => r.check_due);
      const capped = capRows(rows);
      return asText({ count: capped.total, truncated: capped.truncated, entries: capped.rows });
    },
  );

  server.registerTool(
    'list_people',
    {
      title: 'סגל',
      description: 'Command staff in the system: name, role, unit, permission level and whether they have signed in yet. A platoon commander sees only themselves.',
      inputSchema: z.object({ unit: z.string().optional() }),
      annotations: READ_ONLY,
    },
    async ({ unit }, ctx) => {
      const c = caller(ctx);
      const [{ data, error }, lk] = await Promise.all([
        c.supabase.from('users').select('id,name,role,unit_id,permission_level,status,role_approval_status,auth_user_id').order('permission_level', { ascending: false }),
        lookups(c),
      ]);
      if (error) return fail('Could not load people.');
      let rows = (data ?? []).map((u) => ({
        name: u.name,
        role: u.role,
        unit: u.unit_id ? lk.unitName.get(u.unit_id) ?? null : null,
        permission_level: u.permission_level,
        status: u.status === 'blocked' ? 'חסום' : u.role_approval_status === 'approved' ? 'מאושר' : u.role_approval_status,
        signed_in: Boolean(u.auth_user_id),
      }));
      if (unit) rows = rows.filter((r) => r.unit === unit);
      return asText({ count: rows.length, people: rows });
    },
  );

  server.registerTool(
    'get_daily_brief',
    {
      title: 'תמונת מצב',
      description: 'One-call commander brief for today: forum submission status and manpower, open and overdue tasks, active requests, today\'s and tomorrow\'s events, and mentoring checks due (מ״פ only). Use for "what\'s the situation" questions.',
      inputSchema: z.object({}),
      annotations: READ_ONLY,
    },
    async (_args, ctx) => {
      const c = caller(ctx);
      const today = resolveDateKey('today');
      const tomorrow = addDays(today, 1);
      const [forum, tasks, requests, events, lk] = await Promise.all([
        c.supabase.from('forum_daily_reports').select('id,report_date,report_level,staff_role,owner_user_id,status,content,metadata,updated_at').eq('report_date', today).neq('report_level', 'squad'),
        c.supabase.from('tasks').select('id,title,status,due_at,assigned_to').in('status', [...openTaskStatuses]).limit(500),
        c.supabase.from('requests').select('id,title,status,metadata').in('status', [...openRequestStatuses]).limit(500),
        c.supabase.from('events').select('id,title,starts_at,status,location').gte('starts_at', `${addDays(today, -1)}T00:00:00Z`).lt('starts_at', `${addDays(tomorrow, 2)}T00:00:00Z`).order('starts_at').limit(200),
        lookups(c),
      ]);
      const forumStatus = buildForumStatus((forum.data ?? []) as ForumReportRow[], lk.users, lk.units, assignPlatoonReports as unknown as AssignPlatoonReports, scopeLabel(c));
      const now = new Date();
      const openTasks = tasks.data ?? [];
      const overdue = openTasks.filter((t) => isOverdue(t.due_at, t.status, now));
      const evs = (events.data ?? []).map((e) => ({ ...e, date: jerusalemDateKey(e.starts_at) }));
      let mentoringDue: number | undefined;
      if (isCompanyCommander(c.profile.role)) {
        const { data: m } = await c.supabase.from('mentoring_entries').select('next_check_at');
        mentoringDue = (m ?? []).filter((x) => x.next_check_at && new Date(x.next_check_at).getTime() <= now.getTime()).length;
      }
      return asText({
        date: today,
        viewer: { name: c.profile.name, role: c.profile.role, unit: c.profile.unit_name },
        forum: forumStatus.summary,
        forum_missing: forumStatus.slots.filter((s) => !s.final).map((s) => `${s.slot}: ${s.status}`),
        manpower_by_platoon: forumStatus.slots.filter((s) => s.slot.includes('מחלקה')).map((s) => ({ slot: s.slot, manpower: s.manpower })),
        tasks: {
          open: openTasks.length,
          overdue: overdue.length,
          overdue_titles: overdue.slice(0, 10).map((t) => ({ title: t.title, due_at: t.due_at, assigned_to: t.assigned_to ? lk.userName.get(t.assigned_to) ?? 'לא זמין' : null })),
        },
        requests_active: (requests.data ?? []).length,
        events_today: evs.filter((e) => e.date === today).map((e) => ({ title: e.title, starts_at: e.starts_at, location: e.location })),
        events_tomorrow: evs.filter((e) => e.date === tomorrow).map((e) => ({ title: e.title, starts_at: e.starts_at, location: e.location })),
        mentoring_checks_due: mentoringDue,
      });
    },
  );
}
