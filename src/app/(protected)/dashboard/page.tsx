'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  Clock,
  FilePlus2,
  Loader2,
  RadioTower,
  ShieldAlert,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { getPermissionLevelForRole } from '@/lib/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import type { DbAuditLog, DbEvent, DbTask } from '@/lib/types';

type RequestStatus = 'open' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled';
type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
type DashboardItemType = 'request' | 'task' | 'event';
type QuickCreateType = 'request' | 'task' | 'event';
type EventType = DbEvent['event_type'];

type DbProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  unit_name?: string | null;
  units?: { name: string } | null;
};

type DashboardRequest = {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  request_type: string;
  requested_by: string | null;
  assigned_to: string | null;
  unit_id: string | null;
  event_id: string | null;
  metadata: {
    category?: string;
    priority?: string;
    creator_name?: string;
    creator_role?: string;
    creator_unit?: string;
  } | null;
  created_at: string;
  updated_at: string;
};

type DashboardUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type DashboardItem = {
  id: string;
  type: DashboardItemType;
  title: string;
  meta: string;
  status: string;
  href: string;
  priority: number;
  time?: string;
};

type SummaryCard = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  tone: 'orange' | 'blue' | 'green' | 'slate' | 'red';
};

type DashboardData = {
  profile: DbProfile | null;
  requests: DashboardRequest[];
  tasks: DbTask[];
  events: DbEvent[];
  auditLogs: DbAuditLog[];
  usersById: Record<string, DashboardUser>;
  errors: string[];
};

type QuickRequestForm = {
  title: string;
  description: string;
  category: string;
  priority: 'רגילה' | 'גבוהה' | 'דחופה';
  eventId: string;
};

type QuickTaskForm = {
  title: string;
  description: string;
  priority: string;
  dueAt: string;
  assignedTo: string;
  eventId: string;
};

type QuickEventForm = {
  title: string;
  eventType: EventType;
  startsAt: string;
  endsAt: string;
  location: string;
  description: string;
};

const defaultRequestForm: QuickRequestForm = {
  title: '',
  description: '',
  category: 'לוגיסטיקה',
  priority: 'רגילה',
  eventId: 'none',
};

const defaultTaskForm: QuickTaskForm = {
  title: '',
  description: '',
  priority: 'רגילה',
  dueAt: '',
  assignedTo: 'none',
  eventId: 'none',
};

const defaultEventForm: QuickEventForm = {
  title: '',
  eventType: 'meeting',
  startsAt: '',
  endsAt: '',
  location: '',
  description: '',
};

const requestCategories = ['לוגיסטיקה', 'רפואה', 'קשר', 'רכב', 'כוח אדם', 'אחר'];
const requestPriorities: QuickRequestForm['priority'][] = ['רגילה', 'גבוהה', 'דחופה'];
const taskPriorities = ['רגילה', 'חשובה', 'דחופה', 'קריטית'];
const eventTypeOptions: { value: EventType; label: string }[] = [
  { value: 'training', label: 'אימון' },
  { value: 'logistics', label: 'לוגיסטיקה' },
  { value: 'meeting', label: 'פגישה' },
  { value: 'inspection', label: 'ביקורת' },
  { value: 'operation', label: 'מבצע' },
  { value: 'admin', label: 'מנהלה' },
  { value: 'other', label: 'אחר' },
];

const requestStatusLabels: Record<RequestStatus, string> = {
  open: 'פתוחה',
  in_progress: 'בטיפול',
  approved: 'אושרה',
  rejected: 'נדחתה',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
};

const taskStatusLabels: Record<TaskStatus, string> = {
  open: 'פתוחה',
  in_progress: 'בתהליך',
  blocked: 'תקועה',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
};

const eventStatusLabels: Record<DbEvent['status'], string> = {
  scheduled: 'מתוכנן',
  in_progress: 'בתהליך',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const auditActionLabels: Record<string, string> = {
  request_created: 'נפתחה דרישה',
  request_updated: 'עודכנה דרישה',
  request_status_changed: 'סטטוס דרישה עודכן',
  request_assigned: 'שויך מטפל לדרישה',
  request_comment_added: 'נוספה תגובה לדרישה',
  request_deleted: 'דרישה נמחקה',
  task_created: 'נוצרה משימה',
  task_status_changed: 'סטטוס משימה עודכן',
  task_updated: 'משימה נערכה',
  task_deleted: 'משימה נמחקה',
  event_created: 'נוצר מופע',
  event_status_changed: 'סטטוס מופע עודכן',
  event_deleted: 'מופע נמחק',
  forum_daily_report_created: 'נוצר דיווח פורום מוביל',
  forum_daily_report_submitted: 'הוגש דיווח פורום מוביל',
};

const typeLabels: Record<DashboardItemType, string> = {
  request: 'דרישה',
  task: 'משימה',
  event: 'מופע',
};

const toneClasses: Record<SummaryCard['tone'], string> = {
  orange: 'border-[#FF6B02]/18 bg-[#FF6B02]/10 text-[#C54F00]',
  blue: 'border-blue-500/18 bg-blue-500/10 text-blue-700',
  green: 'border-emerald-500/18 bg-emerald-500/10 text-emerald-700',
  slate: 'border-slate-500/18 bg-slate-500/10 text-slate-700',
  red: 'border-red-500/18 bg-red-500/10 text-red-700',
};

function normalizeRole(role: string) {
  return role.replace(/[״׳´׳³'"]/g, '"');
}

function isCommanderRole(role: string, permissionLevel: number) {
  const normalizedRole = normalizeRole(role);
  const inferredLevel = getPermissionLevelForRole(normalizedRole);
  return permissionLevel >= 90 || inferredLevel >= 90 || normalizedRole.includes('מ"פ') || normalizedRole.includes('סמ"פ');
}

function isActiveRequest(request: DashboardRequest) {
  return request.status === 'open' || request.status === 'in_progress' || request.status === 'approved';
}

function isUrgentRequest(request: DashboardRequest) {
  const priority = request.metadata?.priority;
  return priority === 'גבוהה' || priority === 'דחופה' || priority === 'high' || priority === 'urgent';
}

function isActiveTask(task: DbTask) {
  return task.status === 'open' || task.status === 'in_progress' || task.status === 'blocked';
}

function isOverdueTask(task: DbTask, now = new Date()) {
  if (!task.due_at || task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.due_at).getTime() < now.getTime();
}

function formatTime(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDateTime(value: string | null) {
  if (!value) return 'לא נקבע';
  return new Date(value).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getJerusalemDayKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 1) return 'עכשיו';
  if (diffMinutes < 60) return `לפני ${diffMinutes} דק׳`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `לפני ${diffHours} שע׳`;
  return formatShortDateTime(value);
}

function getUserName(usersById: Record<string, DashboardUser>, id: string | null | undefined) {
  if (!id) return 'לא משויך';
  const user = usersById[id];
  return user?.name || user?.email || 'משתמש';
}

function buildSummaryCards(data: DashboardData, profileId: string | null): SummaryCard[] {
  const todayKey = getJerusalemDayKey(new Date());
  const openRequests = data.requests.filter(isActiveRequest);
  const urgentRequests = openRequests.filter(isUrgentRequest);
  const openTasks = data.tasks.filter(isActiveTask);
  const overdueTasks = openTasks.filter(task => isOverdueTask(task));
  const todayEvents = data.events.filter(event => getJerusalemDayKey(event.starts_at) === todayKey);
  const myItems = [
    ...data.requests.filter(request => request.assigned_to === profileId || request.requested_by === profileId),
    ...data.tasks.filter(task => task.assigned_to === profileId || task.created_by === profileId),
  ].filter(item => 'request_type' in item ? isActiveRequest(item) : isActiveTask(item));

  return [
    {
      title: 'דרישות פתוחות',
      value: String(openRequests.length),
      subtitle: 'פתוחות, בטיפול או מאושרות',
      icon: ClipboardList,
      tone: 'orange',
    },
    {
      title: 'דרישות דחופות',
      value: String(urgentRequests.length),
      subtitle: 'עדיפות גבוהה או דחופה',
      icon: AlertTriangle,
      tone: urgentRequests.length > 0 ? 'red' : 'slate',
    },
    {
      title: 'משימות פתוחות',
      value: String(openTasks.length),
      subtitle: 'פתוחות, בתהליך או תקועות',
      icon: CheckSquare,
      tone: 'blue',
    },
    {
      title: 'משימות באיחור',
      value: String(overdueTasks.length),
      subtitle: 'תאריך יעד עבר ועדיין פעילות',
      icon: Clock,
      tone: overdueTasks.length > 0 ? 'red' : 'green',
    },
    {
      title: 'מופעים היום',
      value: String(todayEvents.length),
      subtitle: 'לפי שעון Asia/Jerusalem',
      icon: CalendarClock,
      tone: 'green',
    },
    {
      title: 'פריטים לטיפול שלי',
      value: String(myItems.length),
      subtitle: 'שיוך ישיר או פריטים שיצרתי',
      icon: UserRound,
      tone: 'slate',
    },
  ];
}

function buildAttentionItems(data: DashboardData): DashboardItem[] {
  const now = new Date();
  const soonLimit = now.getTime() + 6 * 60 * 60 * 1000;

  const urgentRequests: DashboardItem[] = data.requests
    .filter(request => isActiveRequest(request) && isUrgentRequest(request))
    .map(request => ({
      id: request.id,
      type: 'request',
      title: request.title,
      meta: `${request.metadata?.category || request.request_type} · ${request.metadata?.priority || 'רגילה'}`,
      status: requestStatusLabels[request.status],
      href: '/requests',
      priority: request.metadata?.priority === 'דחופה' || request.metadata?.priority === 'urgent' ? 10 : 8,
      time: getRelativeTime(request.created_at),
    }));

  const waitingRequests: DashboardItem[] = data.requests
    .filter(request => request.status === 'open' || request.status === 'in_progress')
    .map(request => ({
      id: request.id,
      type: 'request',
      title: request.title,
      meta: request.metadata?.category || request.request_type,
      status: requestStatusLabels[request.status],
      href: '/requests',
      priority: request.status === 'in_progress' ? 5 : 4,
      time: getRelativeTime(request.created_at),
    }));

  const blockedOrOverdueTasks: DashboardItem[] = data.tasks
    .filter(task => task.status === 'blocked' || isOverdueTask(task, now))
    .map(task => ({
      id: task.id,
      type: 'task',
      title: task.title,
      meta: task.status === 'blocked' ? 'משימה תקועה' : `יעד: ${formatShortDateTime(task.due_at)}`,
      status: taskStatusLabels[task.status as TaskStatus] ?? task.status,
      href: '/tasks',
      priority: task.status === 'blocked' ? 9 : 7,
      time: task.due_at ? formatShortDateTime(task.due_at) : undefined,
    }));

  const soonEvents: DashboardItem[] = data.events
    .filter(event => {
      const time = new Date(event.starts_at).getTime();
      return event.status !== 'completed' && event.status !== 'cancelled' && time >= now.getTime() && time <= soonLimit;
    })
    .map(event => ({
      id: event.id,
      type: 'event',
      title: event.title,
      meta: event.location || 'ללא מיקום',
      status: eventStatusLabels[event.status],
      href: '/schedule',
      priority: 6,
      time: formatShortDateTime(event.starts_at),
    }));

  const seen = new Set<string>();

  return [...urgentRequests, ...blockedOrOverdueTasks, ...soonEvents, ...waitingRequests]
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      const dedupeKey = `${item.type}:${item.id}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .slice(0, 8);
}

function getOpenTasks(data: DashboardData) {
  return data.tasks
    .filter(isActiveTask)
    .sort((a, b) => {
      if (a.status === 'blocked' && b.status !== 'blocked') return -1;
      if (b.status === 'blocked' && a.status !== 'blocked') return 1;
      const aTime = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 5);
}

const emptyDashboardData: DashboardData = {
  profile: null,
  requests: [],
  tasks: [],
  events: [],
  auditLogs: [],
  usersById: {},
  errors: [],
};

export default function DashboardPage() {
  const { currentUser, isLoading: isContextLoading } = useApp();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboardData);
  const [isLoading, setIsLoading] = useState(true);
  const [quickCreateType, setQuickCreateType] = useState<QuickCreateType | null>(null);
  const [isQuickCreateSubmitting, setIsQuickCreateSubmitting] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState<QuickRequestForm>(defaultRequestForm);
  const [taskForm, setTaskForm] = useState<QuickTaskForm>(defaultTaskForm);
  const [eventForm, setEventForm] = useState<QuickEventForm>(defaultEventForm);

  const loadDashboard = useCallback(async () => {
    if (!currentUser) {
      setDashboardData(emptyDashboardData);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const nextData: DashboardData = { ...emptyDashboardData, errors: [] };

    const { data: profileRow, error: profileError } = await supabase
      .from('users')
      .select('id,name,email,role,unit_id,permission_level')
      .eq('id', currentUser.id)
      .maybeSingle<DbProfile>();

    if (profileError) {
      logSupabaseError('Dashboard profile lookup failed', profileError, {
        currentUserId: currentUser.id,
        currentUserEmail: currentUser.email,
      });
      nextData.errors.push('טעינת פרופיל המשתמש נכשלה.');
    }

    let profileData = profileRow;

    if (!profileData) {
      nextData.errors.push('לא נמצא פרופיל פעיל בטבלת המשתמשים. ייתכן שנדרש שיוך או אישור מנהל.');
    }

    if (profileData?.unit_id) {
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('name')
        .eq('id', profileData.unit_id)
        .maybeSingle<{ name: string }>();

      if (unitError) {
        logSupabaseError('Dashboard profile unit lookup failed', unitError, {
          profileId: profileData.id,
          unitId: profileData.unit_id,
        });
      }

      profileData = {
        ...profileData,
        unit_name: unitData?.name ?? null,
        units: unitData ? { name: unitData.name } : null,
      };
    }

    nextData.profile = profileData ?? null;

    const [requestsResult, tasksResult, eventsResult, auditResult] = await Promise.all([
      supabase
        .from('requests')
        .select('id,title,description,status,request_type,requested_by,assigned_to,unit_id,event_id,metadata,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(80)
        .returns<DashboardRequest[]>(),
      supabase
        .from('tasks')
        .select('id,title,description,status,priority,assigned_to,created_by,unit_id,event_id,due_at,completed_at,metadata,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(80)
        .returns<DbTask[]>(),
      supabase
        .from('events')
        .select('id,title,description,event_type,starts_at,ends_at,location,unit_id,created_by,responsible_user_id,status,metadata,created_at,updated_at')
        .order('starts_at', { ascending: true })
        .limit(80)
        .returns<DbEvent[]>(),
      supabase
        .from('audit_logs')
        .select('id,user_id,user_name,user_role,action_type,entity_type,entity_id,previous_value,new_value,created_at')
        .order('created_at', { ascending: false })
        .limit(8)
        .returns<DbAuditLog[]>(),
    ]);

    if (requestsResult.error) {
      logSupabaseError('Dashboard requests lookup failed', requestsResult.error);
      nextData.errors.push('טעינת הדרישות נכשלה.');
    } else {
      nextData.requests = requestsResult.data ?? [];
    }

    if (tasksResult.error) {
      logSupabaseError('Dashboard tasks lookup failed', tasksResult.error);
      nextData.errors.push('טעינת המשימות נכשלה.');
    } else {
      nextData.tasks = tasksResult.data ?? [];
    }

    if (eventsResult.error) {
      logSupabaseError('Dashboard events lookup failed', eventsResult.error);
      nextData.errors.push('טעינת הלוז נכשלה.');
    } else {
      nextData.events = eventsResult.data ?? [];
    }

    if (auditResult.error) {
      logSupabaseError('Dashboard audit lookup failed', auditResult.error);
      nextData.errors.push('טעינת הפעילות האחרונה נכשלה.');
    } else {
      nextData.auditLogs = auditResult.data ?? [];
    }

    const userIds = new Set<string>();
    nextData.requests.forEach(request => {
      if (request.assigned_to) userIds.add(request.assigned_to);
      if (request.requested_by) userIds.add(request.requested_by);
    });
    nextData.tasks.forEach(task => {
      if (task.assigned_to) userIds.add(task.assigned_to);
      if (task.created_by) userIds.add(task.created_by);
    });
    nextData.events.forEach(event => {
      if (event.responsible_user_id) userIds.add(event.responsible_user_id);
      if (event.created_by) userIds.add(event.created_by);
    });

    if (userIds.size > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id,name,email')
        .in('id', Array.from(userIds))
        .returns<DashboardUser[]>();

      if (usersError) {
        logSupabaseError('Dashboard users lookup failed', usersError);
      } else {
        nextData.usersById = Object.fromEntries((usersData ?? []).map(user => [user.id, user]));
      }
    }

    setDashboardData(nextData);
    setIsLoading(false);
  }, [currentUser, supabase]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const profile = dashboardData.profile;
  const permissionLevel = profile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && isCommanderRole(profile?.role ?? currentUser.role, permissionLevel));
  const summaryCards = useMemo(() => buildSummaryCards(dashboardData, profile?.id ?? currentUser?.id ?? null), [dashboardData, profile?.id, currentUser?.id]);
  const attentionItems = useMemo(() => buildAttentionItems(dashboardData), [dashboardData]);
  const openTasks = useMemo(() => getOpenTasks(dashboardData), [dashboardData]);
  const todayEvents = useMemo(() => {
    const todayKey = getJerusalemDayKey(new Date());
    return dashboardData.events
      .filter(event => getJerusalemDayKey(event.starts_at) === todayKey)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [dashboardData.events]);
  const eventOptions = useMemo(
    () => dashboardData.events.filter(event => event.status === 'scheduled' || event.status === 'in_progress'),
    [dashboardData.events],
  );
  const assignableUsers = useMemo(
    () => Object.values(dashboardData.usersById).sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', 'he')),
    [dashboardData.usersById],
  );

  const resetQuickForms = () => {
    setRequestForm(defaultRequestForm);
    setTaskForm(defaultTaskForm);
    setEventForm(defaultEventForm);
    setQuickCreateError(null);
  };

  const closeQuickCreate = () => {
    if (isQuickCreateSubmitting) return;
    setQuickCreateType(null);
    resetQuickForms();
  };

  const openQuickCreate = (type: QuickCreateType) => {
    setSuccessMessage(null);
    setQuickCreateError(null);
    setQuickCreateType(type);
  };

  const handleQuickRequestSubmit = async () => {
    if (!currentUser || !profile) {
      setQuickCreateError('לא נמצא פרופיל משתמש פעיל. יש להתחבר מחדש.');
      return;
    }

    const title = requestForm.title.trim();
    if (!title) {
      setQuickCreateError('כותרת הדרישה היא שדה חובה.');
      return;
    }

    setIsQuickCreateSubmitting(true);
    setQuickCreateError(null);

    const eventId = requestForm.eventId === 'none' ? null : requestForm.eventId;
    const metadata = {
      category: requestForm.category,
      priority: requestForm.priority,
      creator_name: profile.name || currentUser.full_name,
      creator_role: profile.role || currentUser.role,
      creator_unit: profile.units?.name || currentUser.assigned_frame,
    };

    const { data: createdRequest, error } = await supabase
      .from('requests')
      .insert({
        title,
        description: requestForm.description.trim() || null,
        request_type: requestForm.category,
        status: 'open',
        requested_by: currentUser.id,
        unit_id: profile.unit_id,
        event_id: eventId,
        metadata,
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      logSupabaseError('Dashboard quick request insert failed', error);
      setQuickCreateError('יצירת הדרישה נכשלה. בדוק הרשאות או נסה שוב.');
      setIsQuickCreateSubmitting(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: profile.id,
      userName: profile.name,
      userRole: profile.role,
      actionType: 'request_created',
      entityType: 'request',
      entityId: createdRequest.id,
      newValue: { title, request_type: requestForm.category, status: 'open', event_id: eventId, metadata },
    });

    setQuickCreateType(null);
    resetQuickForms();
    setSuccessMessage('הדרישה נוצרה בהצלחה.');
    await loadDashboard();
    setIsQuickCreateSubmitting(false);
  };

  const handleQuickTaskSubmit = async () => {
    if (!currentUser || !profile) {
      setQuickCreateError('לא נמצא פרופיל משתמש פעיל. יש להתחבר מחדש.');
      return;
    }

    const title = taskForm.title.trim();
    if (!title) {
      setQuickCreateError('כותרת המשימה היא שדה חובה.');
      return;
    }

    setIsQuickCreateSubmitting(true);
    setQuickCreateError(null);

    const assignedTo = taskForm.assignedTo === 'none' ? null : taskForm.assignedTo;
    const eventId = taskForm.eventId === 'none' ? null : taskForm.eventId;
    const dueAt = taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null;
    const metadata = {
      source_type: 'manual',
      source_id: null,
      creator_name: profile.name || currentUser.full_name,
      creator_role: profile.role || currentUser.role,
      creator_unit: profile.units?.name || currentUser.assigned_frame,
    };

    const { data: createdTask, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description: taskForm.description.trim() || null,
        status: 'open',
        priority: taskForm.priority,
        assigned_to: assignedTo,
        created_by: profile.id,
        unit_id: profile.unit_id,
        event_id: eventId,
        due_at: dueAt,
        completed_at: null,
        metadata,
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      logSupabaseError('Dashboard quick task insert failed', error);
      setQuickCreateError('יצירת המשימה נכשלה. בדוק הרשאות או נסה שוב.');
      setIsQuickCreateSubmitting(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: profile.id,
      userName: profile.name,
      userRole: profile.role,
      actionType: 'task_created',
      entityType: 'task',
      entityId: createdTask.id,
      newValue: { title, status: 'open', priority: taskForm.priority, assigned_to: assignedTo, due_at: dueAt, event_id: eventId, metadata },
    });

    setQuickCreateType(null);
    resetQuickForms();
    setSuccessMessage('המשימה נוצרה בהצלחה.');
    await loadDashboard();
    setIsQuickCreateSubmitting(false);
  };

  const handleQuickEventSubmit = async () => {
    if (!currentUser || !profile) {
      setQuickCreateError('לא נמצא פרופיל משתמש פעיל. יש להתחבר מחדש.');
      return;
    }

    const title = eventForm.title.trim();
    if (!title) {
      setQuickCreateError('כותרת המופע היא שדה חובה.');
      return;
    }

    if (!eventForm.startsAt) {
      setQuickCreateError('שעת התחלה היא שדה חובה.');
      return;
    }

    setIsQuickCreateSubmitting(true);
    setQuickCreateError(null);

    const startsAt = new Date(eventForm.startsAt).toISOString();
    const endsAt = eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : null;

    const { data: createdEvent, error } = await supabase
      .from('events')
      .insert({
        title,
        description: eventForm.description.trim() || null,
        event_type: eventForm.eventType,
        starts_at: startsAt,
        ends_at: endsAt,
        location: eventForm.location.trim() || null,
        unit_id: profile.unit_id,
        created_by: profile.id,
        responsible_user_id: null,
        status: 'scheduled',
        metadata: {},
      })
      .select('id')
      .single<{ id: string }>();

    if (error) {
      logSupabaseError('Dashboard quick event insert failed', error);
      setQuickCreateError('יצירת המופע נכשלה. בדוק הרשאות או נסה שוב.');
      setIsQuickCreateSubmitting(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: profile.id,
      userName: profile.name,
      userRole: profile.role,
      actionType: 'event_created',
      entityType: 'event',
      entityId: createdEvent.id,
      newValue: { title, event_type: eventForm.eventType, starts_at: startsAt, ends_at: endsAt, status: 'scheduled' },
    });

    setQuickCreateType(null);
    resetQuickForms();
    setSuccessMessage('המופע נוצר בהצלחה.');
    await loadDashboard();
    setIsQuickCreateSubmitting(false);
  };

  if (isContextLoading || isLoading) {
    return (
      <div className="space-y-6 text-right">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-20 flex-1 rounded-3xl" />
          <Skeleton className="hidden h-12 w-40 rounded-2xl sm:block" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="space-y-6 text-right">
        <PageHeader title="דשבורד פיקודי" subtitle="אנא התחבר למערכת כדי לראות תמונת מצב עדכנית." />
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
          <ShieldAlert className="mb-3 h-12 w-12 text-red-500" />
          <span className="text-sm font-black text-slate-500">לא נמצא פרופיל משתמש פעיל</span>
          <p className="mt-1 text-xs text-slate-500">אנא התחבר מחדש.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right">
      <PageHeader
        title="דשבורד פיקודי"
        subtitle="תמונת מצב עדכנית של הפלוגה, המשימות, הדרישות והלו״ז"
        actions={
          <div className="relative flex flex-wrap justify-end gap-2">
            <QuickActionButton onClick={() => openQuickCreate('request')} icon={FilePlus2} label="פתיחת דרישה" variant="orange" />
            <QuickActionButton onClick={() => openQuickCreate('task')} icon={CheckSquare} label="יצירת משימה" />
            <QuickActionButton onClick={() => openQuickCreate('event')} icon={CalendarClock} label="הוספת מופע" />
            <QuickCreateModal
              type={quickCreateType}
              requestForm={requestForm}
              taskForm={taskForm}
              eventForm={eventForm}
              eventOptions={eventOptions}
              assignableUsers={assignableUsers}
              error={quickCreateError}
              isSubmitting={isQuickCreateSubmitting}
              onClose={closeQuickCreate}
              onRequestChange={setRequestForm}
              onTaskChange={setTaskForm}
              onEventChange={setEventForm}
              onSubmitRequest={handleQuickRequestSubmit}
              onSubmitTask={handleQuickTaskSubmit}
              onSubmitEvent={handleQuickEventSubmit}
            />
          </div>
        }
      />

      {successMessage && (
        <GlassCard className="border-emerald-500/20 bg-emerald-500/5 py-4">
          <div className="flex items-center gap-3 text-sm font-black text-emerald-700">
            <Sparkles className="h-5 w-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        </GlassCard>
      )}

      {dashboardData.errors.length > 0 && (
        <GlassCard className="border-red-500/20 bg-red-500/5 py-4">
          <div className="flex items-start gap-3 text-right text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">חלק מנתוני הדשבורד לא נטענו.</p>
              <p className="mt-1 text-xs text-red-600">{dashboardData.errors.join(' ')}</p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map(card => (
          <SummaryMetricCard key={card.title} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <GlassCard className="space-y-4" glow="orange">
          <SectionHeader icon={RadioTower} title="דרוש טיפול" actionHref="/requests" actionLabel="לניהול" />
          {attentionItems.length > 0 ? (
            <div className="space-y-3">
              {attentionItems.map(item => <AttentionItemCard key={`${item.type}-${item.id}`} item={item} />)}
            </div>
          ) : (
            <CompactEmptyState title="אין פריטים דחופים כרגע" text="לא נמצאו דרישות דחופות, משימות תקועות או מופעים שמתחילים בקרוב." />
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <SectionHeader icon={CalendarClock} title="היום בלו״ז" actionHref="/schedule" actionLabel="כל הלו״ז" />
          {todayEvents.length > 0 ? (
            <div className="space-y-3">
              {todayEvents.map(event => (
                <TodayEventCard
                  key={event.id}
                  event={event}
                  taskCount={dashboardData.tasks.filter(task => task.event_id === event.id).length}
                  requestCount={dashboardData.requests.filter(request => request.event_id === event.id).length}
                />
              ))}
            </div>
          ) : (
            <CompactEmptyState title="אין מופעים להיום" text="לא נמצאו מופעים מתוכננים להיום." />
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard className="space-y-4">
          <SectionHeader icon={CheckSquare} title="משימות פתוחות" actionHref="/tasks" actionLabel="כל המשימות" />
          {openTasks.length > 0 ? (
            <div className="divide-y divide-[rgba(2,1,8,0.08)]">
              {openTasks.map(task => (
                <OpenTaskRow key={task.id} task={task} assigneeName={getUserName(dashboardData.usersById, task.assigned_to)} />
              ))}
            </div>
          ) : (
            <CompactEmptyState title="אין משימות פתוחות" text="המשימות הפעילות יופיעו כאן לאחר יצירה או שיוך." />
          )}
        </GlassCard>

        <GlassCard className="space-y-4">
          <SectionHeader icon={Activity} title="פעילות אחרונה" actionHref={canSeeAll ? '/admin' : '/dashboard'} actionLabel={canSeeAll ? 'ניהול' : undefined} />
          {dashboardData.auditLogs.length > 0 ? (
            <div className="space-y-3">
              {dashboardData.auditLogs.map(log => <AuditLogRow key={log.id} log={log} />)}
            </div>
          ) : (
            <CompactEmptyState title="אין פעילות להצגה" text="פעולות אחרונות במערכת יופיעו כאן." />
          )}
        </GlassCard>
      </div>

    </div>
  );
}

function QuickActionButton({
  onClick,
  icon: Icon,
  label,
  variant = 'slate',
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant?: 'orange' | 'slate';
}) {
  const classes = variant === 'orange'
    ? 'border-[#FF6B02]/45 bg-[#FF6B02] text-white shadow-[0_14px_28px_rgba(255,107,2,0.22)] hover:bg-[#E65F00]'
    : 'border-[rgba(2,1,8,0.10)] bg-white/76 text-[#020108] shadow-[0_10px_24px_rgba(2,1,8,0.06)] hover:border-[#FF6B02]/30 hover:bg-[#FF6B02]/10';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-xl border px-3 text-xs font-black transition active:scale-[0.98] ${classes}`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-white/30 to-transparent" />
      <Icon className="relative z-10 h-4 w-4" />
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function QuickCreateModal({
  type,
  requestForm,
  taskForm,
  eventForm,
  eventOptions,
  assignableUsers,
  error,
  isSubmitting,
  onClose,
  onRequestChange,
  onTaskChange,
  onEventChange,
  onSubmitRequest,
  onSubmitTask,
  onSubmitEvent,
}: {
  type: QuickCreateType | null;
  requestForm: QuickRequestForm;
  taskForm: QuickTaskForm;
  eventForm: QuickEventForm;
  eventOptions: DbEvent[];
  assignableUsers: DashboardUser[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onRequestChange: React.Dispatch<React.SetStateAction<QuickRequestForm>>;
  onTaskChange: React.Dispatch<React.SetStateAction<QuickTaskForm>>;
  onEventChange: React.Dispatch<React.SetStateAction<QuickEventForm>>;
  onSubmitRequest: () => Promise<void>;
  onSubmitTask: () => Promise<void>;
  onSubmitEvent: () => Promise<void>;
}) {
  if (!type) return null;

  const titles: Record<QuickCreateType, string> = {
    request: 'פתיחת דרישה מהירה',
    task: 'יצירת משימה מהירה',
    event: 'הוספת מופע מהיר',
  };

  const subtitles: Record<QuickCreateType, string> = {
    request: 'יצירת דרישה בסיסית בלי לצאת מהדשבורד',
    task: 'משימה קצרה עם שיוך, יעד ומופע אופציונלי',
    event: 'מופע לו״ז בסיסי עם זמן התחלה וסוג',
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (type === 'request') await onSubmitRequest();
    if (type === 'task') await onSubmitTask();
    if (type === 'event') await onSubmitEvent();
  };

  return (
    <>
      <button
        type="button"
        aria-label="סגירת יצירה מהירה"
        onClick={onClose}
        disabled={isSubmitting}
        className="fixed inset-0 z-40 cursor-default bg-black/5 disabled:pointer-events-none"
      />

      <div
        className="fixed inset-x-4 top-24 z-50 w-auto max-w-none rounded-3xl border border-white/80 bg-white/95 shadow-[0_18px_50px_rgba(2,1,8,0.16)] md:inset-x-auto md:left-1/2 md:top-32 md:w-[min(92vw,520px)] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2"
        dir="rtl"
      >
        <span className="absolute -top-2 left-1/2 hidden h-4 w-4 -translate-x-1/2 rotate-45 border-r border-t border-white/80 bg-white/95 md:block" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(2,1,8,0.08)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-[#020108]">{titles[type]}</h2>
            <p className="mt-1 text-xs font-semibold text-[#667085]">{subtitles[type]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 text-[#020108] transition hover:border-[#FF6B02]/30 hover:bg-[#FF6B02]/10 disabled:opacity-50"
            aria-label="סגירת חלון"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-5 sm:px-6 md:max-h-[72vh]">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {type === 'request' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <QuickField label="כותרת" required className="sm:col-span-2">
                <input
                  value={requestForm.title}
                  onChange={event => onRequestChange(prev => ({ ...prev, title: event.target.value }))}
                  className="command-input"
                  placeholder="מה צריך לפתוח?"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="תיאור" className="sm:col-span-2">
                <textarea
                  value={requestForm.description}
                  onChange={event => onRequestChange(prev => ({ ...prev, description: event.target.value }))}
                  className="command-input min-h-24 resize-none"
                  placeholder="פירוט קצר, אם צריך"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="קטגוריה">
                <select
                  value={requestForm.category}
                  onChange={event => onRequestChange(prev => ({ ...prev, category: event.target.value }))}
                  className="command-select"
                  disabled={isSubmitting}
                >
                  {requestCategories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </QuickField>
              <QuickField label="עדיפות">
                <select
                  value={requestForm.priority}
                  onChange={event => onRequestChange(prev => ({ ...prev, priority: event.target.value as QuickRequestForm['priority'] }))}
                  className="command-select"
                  disabled={isSubmitting}
                >
                  {requestPriorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </QuickField>
              <QuickField label="שיוך למופע" className="sm:col-span-2">
                <EventSelect value={requestForm.eventId} events={eventOptions} disabled={isSubmitting} onChange={eventId => onRequestChange(prev => ({ ...prev, eventId }))} />
              </QuickField>
            </div>
          )}

          {type === 'task' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <QuickField label="כותרת" required className="sm:col-span-2">
                <input
                  value={taskForm.title}
                  onChange={event => onTaskChange(prev => ({ ...prev, title: event.target.value }))}
                  className="command-input"
                  placeholder="מה המשימה?"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="תיאור" className="sm:col-span-2">
                <textarea
                  value={taskForm.description}
                  onChange={event => onTaskChange(prev => ({ ...prev, description: event.target.value }))}
                  className="command-input min-h-24 resize-none"
                  placeholder="פירוט קצר, אם צריך"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="עדיפות">
                <select
                  value={taskForm.priority}
                  onChange={event => onTaskChange(prev => ({ ...prev, priority: event.target.value }))}
                  className="command-select"
                  disabled={isSubmitting}
                >
                  {taskPriorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </QuickField>
              <QuickField label="תאריך יעד">
                <input
                  type="datetime-local"
                  value={taskForm.dueAt}
                  onChange={event => onTaskChange(prev => ({ ...prev, dueAt: event.target.value }))}
                  className="command-input"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="אחראי">
                <select
                  value={taskForm.assignedTo}
                  onChange={event => onTaskChange(prev => ({ ...prev, assignedTo: event.target.value }))}
                  className="command-select"
                  disabled={isSubmitting}
                >
                  <option value="none">ללא שיוך</option>
                  {assignableUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email || 'משתמש'}</option>)}
                </select>
              </QuickField>
              <QuickField label="שיוך למופע">
                <EventSelect value={taskForm.eventId} events={eventOptions} disabled={isSubmitting} onChange={eventId => onTaskChange(prev => ({ ...prev, eventId }))} />
              </QuickField>
            </div>
          )}

          {type === 'event' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <QuickField label="כותרת" required className="sm:col-span-2">
                <input
                  value={eventForm.title}
                  onChange={event => onEventChange(prev => ({ ...prev, title: event.target.value }))}
                  className="command-input"
                  placeholder="שם המופע"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="סוג מופע">
                <select
                  value={eventForm.eventType}
                  onChange={event => onEventChange(prev => ({ ...prev, eventType: event.target.value as EventType }))}
                  className="command-select"
                  disabled={isSubmitting}
                >
                  {eventTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </QuickField>
              <QuickField label="התחלה" required>
                <input
                  type="datetime-local"
                  value={eventForm.startsAt}
                  onChange={event => onEventChange(prev => ({ ...prev, startsAt: event.target.value }))}
                  className="command-input"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="סיום">
                <input
                  type="datetime-local"
                  value={eventForm.endsAt}
                  onChange={event => onEventChange(prev => ({ ...prev, endsAt: event.target.value }))}
                  className="command-input"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="מיקום">
                <input
                  value={eventForm.location}
                  onChange={event => onEventChange(prev => ({ ...prev, location: event.target.value }))}
                  className="command-input"
                  placeholder="מיקום, אם יש"
                  disabled={isSubmitting}
                />
              </QuickField>
              <QuickField label="תיאור" className="sm:col-span-2">
                <textarea
                  value={eventForm.description}
                  onChange={event => onEventChange(prev => ({ ...prev, description: event.target.value }))}
                  className="command-input min-h-24 resize-none"
                  placeholder="פירוט קצר, אם צריך"
                  disabled={isSubmitting}
                />
              </QuickField>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[rgba(2,1,8,0.08)] pt-4 sm:flex-row sm:justify-start">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/76 px-5 text-sm font-black text-[#020108] transition hover:border-[#FF6B02]/30 hover:bg-[#FF6B02]/10 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#FF6B02]/45 bg-[#FF6B02] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(255,107,2,0.24)] transition hover:bg-[#E65F00] disabled:opacity-60"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-white/30 to-transparent" />
              {isSubmitting && <Loader2 className="relative z-10 h-4 w-4 animate-spin" />}
              <span className="relative z-10">שמירה</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function QuickField({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`space-y-2 text-right ${className ?? ''}`}>
      <span className="block text-xs font-black text-[#667085]">
        {label}{required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

function EventSelect({
  value,
  events,
  disabled,
  onChange,
}: {
  value: string;
  events: DbEvent[];
  disabled: boolean;
  onChange: (eventId: string) => void;
}) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className="command-select" disabled={disabled}>
      <option value="none">ללא שיוך</option>
      {events.map(event => (
        <option key={event.id} value={event.id}>
          {event.title} · {formatShortDateTime(event.starts_at)}
        </option>
      ))}
    </select>
  );
}

function SummaryMetricCard({ card }: { card: SummaryCard }) {
  const Icon = card.icon;

  return (
    <GlassCard className="min-h-32 p-4 sm:p-5">
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${toneClasses[card.tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-xs font-black text-[#667085]">{card.title}</span>
        </div>
        <div>
          <span className="block text-3xl font-black text-[#020108]">{card.value}</span>
          <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#667085]">{card.subtitle}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  actionHref,
  actionLabel,
}: {
  icon: React.ElementType;
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[rgba(2,1,8,0.08)] pb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#FF6B02]" />
        <h2 className="text-sm font-black text-[#020108]">{title}</h2>
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="rounded-xl border border-[rgba(2,1,8,0.10)] bg-white/70 px-3 py-2 text-xs font-black text-[#020108] transition hover:border-[#FF6B02]/30 hover:bg-[#FF6B02]/10">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function AttentionItemCard({ item }: { item: DashboardItem }) {
  const isCritical = item.priority >= 8;

  return (
    <Link
      href={item.href}
      className="block rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-4 transition hover:border-[#FF6B02]/30 hover:bg-white/82"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${isCritical ? toneClasses.red : toneClasses.orange}`}>
              {typeLabels[item.type]}
            </span>
            <span className="text-sm font-black text-[#020108]">{item.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#667085]">
            <span>{item.meta}</span>
            {item.time && <span>{item.time}</span>}
          </div>
        </div>
        <StatusBadge status={item.status} className="self-start" />
      </div>
    </Link>
  );
}

function TodayEventCard({
  event,
  taskCount,
  requestCount,
}: {
  event: DbEvent;
  taskCount: number;
  requestCount: number;
}) {
  return (
    <Link
      href="/schedule"
      className="block rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-4 transition hover:border-[#FF6B02]/30 hover:bg-white/82"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <span className="block text-xs font-black text-[#FF6B02]">{formatTime(event.starts_at)}</span>
          <span className="block text-sm font-black text-[#020108]">{event.title}</span>
          <span className="block text-xs font-semibold text-[#667085]">{event.location || 'ללא מיקום'}</span>
          {(taskCount > 0 || requestCount > 0) && (
            <span className="mt-2 block text-[11px] font-bold text-[#667085]">
              {taskCount} משימות · {requestCount} דרישות קשורות
            </span>
          )}
        </div>
        <StatusBadge status={eventStatusLabels[event.status]} className="shrink-0" />
      </div>
    </Link>
  );
}

function OpenTaskRow({ task, assigneeName }: { task: DbTask; assigneeName: string }) {
  return (
    <Link href="/tasks" className="flex flex-col gap-3 py-3 transition hover:bg-white/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <span className="block text-sm font-black text-[#020108]">{task.title}</span>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#667085]">
          <span>אחראי: {assigneeName}</span>
          <span>יעד: {formatShortDateTime(task.due_at)}</span>
        </div>
      </div>
      <StatusBadge status={taskStatusLabels[task.status as TaskStatus] ?? task.status} className="self-start sm:self-center" />
    </Link>
  );
}

function AuditLogRow({ log }: { log: DbAuditLog }) {
  return (
    <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <span className="block text-sm font-black text-[#020108]">{auditActionLabels[log.action_type] ?? log.action_type}</span>
          <span className="block text-xs font-semibold text-[#667085]">
            {log.user_name || 'משתמש'} · {log.user_role || 'תפקיד לא ידוע'}
          </span>
        </div>
        <span className="shrink-0 rounded-full border border-slate-500/15 bg-slate-500/10 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {getRelativeTime(log.created_at)}
        </span>
      </div>
    </div>
  );
}

function CompactEmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[rgba(2,1,8,0.12)] bg-white/54 px-5 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02]">
        <Sparkles className="h-5 w-5" />
      </div>
      <span className="text-sm font-black text-[#020108]">{title}</span>
      <p className="mt-2 max-w-sm text-xs font-semibold leading-relaxed text-[#667085]">{text}</p>
    </div>
  );
}
