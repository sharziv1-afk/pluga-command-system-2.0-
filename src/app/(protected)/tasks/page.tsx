'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CommandConfirmDialog } from '@/components/ui/CommandDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { priorityClass, taskStatusLabels as statusLabels } from '@/lib/statusLabels';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { writeWithHierarchyResolution } from '@/lib/concurrency/hierarchyWrite';
import { cacheGet, cacheSet } from '@/lib/offline/db';
import { enqueueWrite, flushWriteQueue, pendingWriteCount } from '@/lib/offline/syncEngine';
import { getPermissionLevelForRole, hasCompanyWideUiAccess } from '@/lib/permissions';
import { getScheduleDisplayStatus } from '@/lib/schedule';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';
import type { DbTask } from '@/lib/types';

type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
type TaskPriority = 'רגילה' | 'חשובה' | 'דחופה' | 'קריטית';
type TaskTab = 'all' | 'mine' | 'assigned' | 'open' | 'in_progress' | 'completed';
type TaskQuickFilter = 'none' | 'mine' | 'urgent' | 'stuck';

type DbProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  units: { name: string } | null;
};

type TaskUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  unit_id: string | null;
};

type EventOption = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at?: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
};

type TaskMetadata = {
  category?: string;
  location?: string;
  output_required?: string;
  control_questions?: string[];
  stuck_reason?: string;
  source_type?: 'manual' | 'gap' | 'forum' | 'tracking';
  source_id?: string | null;
  creator_name?: string;
  creator_role?: string;
  creator_unit?: string;
};

type TaskView = DbTask & {
  creatorName: string | null;
  assigneeName: string | null;
  unitName: string | null;
  eventTitle: string | null;
  eventTimeLabel: string | null;
};

const statusOptions: TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed', 'cancelled'];
const priorityOptions: TaskPriority[] = ['רגילה', 'חשובה', 'דחופה', 'קריטית'];

const taskTabs: { id: TaskTab; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'mine', label: 'שיצרתי' },
  { id: 'assigned', label: 'באחריותי' },
  { id: 'open', label: 'פתוחות' },
  { id: 'in_progress', label: 'בתהליך' },
  { id: 'completed', label: 'הושלמו' },
];



function formatDate(value: string | null) {
  if (!value) return 'לא נקבע';
  return new Date(value).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return 'לא נקבע';
  return new Date(value).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventTimeLabel(startsAt: string | null, endsAt: string | null) {
  const start = formatTime(startsAt);
  if (!start) return null;

  const end = formatTime(endsAt);
  return end ? `${start}–${end}` : start;
}

function formatDateTimeLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function getTaskMetadata(task: DbTask): TaskMetadata {
  return (task.metadata ?? {}) as TaskMetadata;
}

function getUserDisplayName(user: Pick<TaskUser, 'name' | 'email'>) {
  return user.name || user.email;
}

function filterTaskByTab(task: TaskView, tab: TaskTab, profileId: string | undefined) {
  switch (tab) {
    case 'mine': return task.created_by === profileId;
    case 'assigned': return task.assigned_to === profileId;
    case 'open': return task.status === 'open';
    case 'in_progress': return task.status === 'in_progress' || task.status === 'blocked';
    case 'completed': return task.status === 'completed';
    default: return true;
  }
}

function filterTaskByQuickFilter(task: TaskView, filter: TaskQuickFilter, profileId: string | undefined) {
  switch (filter) {
    case 'mine': return task.created_by === profileId || task.assigned_to === profileId;
    case 'urgent': return task.priority === 'דחופה' || task.priority === 'קריטית';
    case 'stuck': return task.status === 'blocked';
    default: return true;
  }
}

const taskQuickFilters: { id: Exclude<TaskQuickFilter, 'none'>; label: string }[] = [
  { id: 'mine', label: 'שלי' },
  { id: 'urgent', label: 'דחוף' },
  { id: 'stuck', label: 'תקוע' },
];

export default function TasksPage() {
  const { currentUser, isLoading: isContextLoading, refreshProfile } = useApp();
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<TaskUser[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<TaskView | null>(null);
  const [editingTask, setEditingTask] = useState<TaskView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TaskTab>('all');
  const [quickFilter, setQuickFilter] = useState<TaskQuickFilter>('none');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('רגילה');
  const [assignedTo, setAssignedTo] = useState('none');
  const [selectedEventId, setSelectedEventId] = useState('none');
  const [dueAt, setDueAt] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [outputRequired, setOutputRequired] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('רגילה');
  const [editAssignedTo, setEditAssignedTo] = useState('none');
  const [editEventId, setEditEventId] = useState('none');
  const [editDueAt, setEditDueAt] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOutputRequired, setEditOutputRequired] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const dbProfile = useMemo<DbProfile | null>(() => currentUser ? {
    id: currentUser.id,
    name: currentUser.full_name,
    email: currentUser.email,
    role: currentUser.role,
    unit_id: currentUser.unit_id,
    permission_level: currentUser.permission_level,
    units: { name: currentUser.assigned_frame },
  } : null, [currentUser]);
  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && hasCompanyWideUiAccess(dbProfile?.role ?? currentUser.role, profilePermissionLevel));
  // ponytail: one page-wide write lock; split by task only if concurrent edits become necessary.
  const isTaskWritePending = isSubmitting || isEditSubmitting || Boolean(updatingTaskId || deletingTaskId);

  // Cache keys are scoped per user: on a shared phone one commander must
  // never read another's cached rows offline.
  const TASKS_CACHE_KEY = `tasks:list:${currentUser?.id ?? 'anonymous'}`;

  const loadTasks = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (!navigator.onLine) {
      const cached = await cacheGet<TaskView[]>(TASKS_CACHE_KEY);
      setIsOffline(true);
      setCachedAt(cached?.cachedAt ?? null);
      setTasks(cached?.data ?? []);
      setIsLoading(false);
      return;
    }
    setIsOffline(false);

    try {
      const profileData = dbProfile;
      if (!profileData) {
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }

      const canAssign = hasCompanyWideUiAccess(profileData.role, profileData.permission_level);

      // Round 1: three independent queries in parallel instead of in sequence —
      // none of these need each other's results.
      const [
        { data: taskData, error: tasksError },
        assignableUsersResult,
        { data: visibleEvents, error: eventsError },
      ] = await Promise.all([
        supabase
          .from('tasks')
          .select('id,title,description,status,priority,assigned_to,created_by,unit_id,event_id,due_at,completed_at,metadata,created_at,updated_at')
          .order('created_at', { ascending: false })
          .returns<DbTask[]>(),
        canAssign
          ? supabase
              .from('users')
              .select('id,name,email,role,unit_id')
              .eq('status', 'active')
              .eq('role_approval_status', 'approved')
              .order('name', { ascending: true })
              .returns<TaskUser[]>()
          : Promise.resolve({ data: [] as TaskUser[], error: null }),
        supabase
          .from('events')
          .select('id,title,starts_at,ends_at,status')
          .in('status', ['scheduled', 'in_progress'])
          .order('starts_at', { ascending: true })
          .returns<EventOption[]>(),
      ]);

      if (tasksError) {
        logSupabaseError('Tasks load failed', tasksError);
        setError('לא ניתן לטעון את המשימות כרגע. נסה לרענן את הדף בעוד רגע.');
        return;
      }

      if (assignableUsersResult.error) {
        logSupabaseError('Task assignable users load failed', assignableUsersResult.error);
        setAssignableUsers([]);
      } else {
        setAssignableUsers(assignableUsersResult.data ?? []);
      }

      const rawTasks = taskData ?? [];
      const userIds = [
        ...new Set(
          rawTasks.flatMap(task => [task.created_by, task.assigned_to]).filter((id): id is string => Boolean(id)),
        ),
      ];
      const unitIds = [...new Set(rawTasks.map(task => task.unit_id).filter((id): id is string => Boolean(id)))];
      const eventIds = [...new Set(rawTasks.map(task => task.event_id).filter((id): id is string => Boolean(id)))];

      // Round 2: these all key off rawTasks' ids, so they can't start earlier —
      // but they don't depend on each other, so run them in parallel too.
      const [{ data: usersData }, { data: unitsData }, { data: eventsData }] = await Promise.all([
        userIds.length > 0
          ? supabase.from('users').select('id,name,email,role').in('id', userIds).returns<Array<Pick<TaskUser, 'id' | 'name' | 'email' | 'role'>>>()
          : Promise.resolve({ data: [] as Array<Pick<TaskUser, 'id' | 'name' | 'email' | 'role'>> }),
        unitIds.length > 0
          ? supabase.from('units').select('id,name').in('id', unitIds).returns<Array<{ id: string; name: string }>>()
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
        eventIds.length > 0
          ? supabase.from('events').select('id,title,starts_at,ends_at').in('id', eventIds).returns<Array<Pick<EventOption, 'id' | 'title' | 'starts_at' | 'ends_at'>>>()
          : Promise.resolve({ data: [] as Array<Pick<EventOption, 'id' | 'title' | 'starts_at' | 'ends_at'>> }),
      ]);

      const userNames: Record<string, { name: string; role: string | null }> = {};
      for (const user of usersData ?? []) {
        userNames[user.id] = { name: getUserDisplayName(user), role: user.role };
      }

      const unitNames: Record<string, string> = {};
      for (const unit of unitsData ?? []) unitNames[unit.id] = unit.name;

      const eventDetails: Record<string, { title: string; timeLabel: string | null }> = {};
      for (const event of eventsData ?? []) {
        eventDetails[event.id] = {
          title: event.title,
          timeLabel: formatEventTimeLabel(event.starts_at, event.ends_at ?? null),
        };
      }

      if (eventsError) {
        logSupabaseError('Task event options load failed', eventsError);
        setEventOptions([]);
      } else {
        setEventOptions((visibleEvents ?? []).filter(event => getScheduleDisplayStatus({
          status: event.status,
          starts_at: event.starts_at ?? '',
          ends_at: event.ends_at ?? null,
        }) !== 'completed'));
      }

      const mappedTasks = rawTasks.map(task => {
        const metadata = getTaskMetadata(task);
        return {
          ...task,
          creatorName: task.created_by ? (userNames[task.created_by]?.name ?? metadata.creator_name ?? null) : metadata.creator_name ?? null,
          assigneeName: task.assigned_to ? (userNames[task.assigned_to]?.name ?? null) : null,
          unitName: task.unit_id ? (unitNames[task.unit_id] ?? metadata.creator_unit ?? null) : metadata.creator_unit ?? null,
          eventTitle: task.event_id ? (eventDetails[task.event_id]?.title ?? null) : null,
          eventTimeLabel: task.event_id ? (eventDetails[task.event_id]?.timeLabel ?? null) : null,
        };
      });
      setTasks(mappedTasks);
      void cacheSet(TASKS_CACHE_KEY, mappedTasks);
    } catch (loadError) {
      logSupabaseError('Tasks load failed unexpectedly', loadError);
      // navigator.onLine can lie (some browsers/networks report "online" on a
      // dead connection) — a network-shaped failure falls back to cache too,
      // not just an explicit offline check at the top of this function.
      const cached = await cacheGet<TaskView[]>(TASKS_CACHE_KEY);
      if (cached) {
        setIsOffline(true);
        setCachedAt(cached.cachedAt);
        setTasks(cached.data);
      } else {
        setError('לא ניתן לטעון את המשימות כרגע. נסה לרענן את הדף בעוד רגע.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isContextLoading) void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContextLoading, currentUser]);

  useEffect(() => {
    if (!dbProfile) return;
    void pendingWriteCount(dbProfile.id).then(setPendingSyncCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dbProfile?.id]);

  useEffect(() => {
    if (!dbProfile) return;

    const trySync = async () => {
      const result = await flushWriteQueue(supabase, dbProfile.id);
      setPendingSyncCount(await pendingWriteCount(dbProfile.id));
      if (result.abandoned > 0) {
        setError(`${result.abandoned} שינויים שנשמרו במכשיר לא הצליחו להישמר בשרת ובוטלו. ייתכן שהמשימה נמחקה או שאין לך הרשאה לערוך אותה.`);
      }
      if (result.applied > 0) await loadTasks();
    };

    void trySync();
    const onOnline = () => void trySync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbProfile?.id]);

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<TaskTab, number>> = {};
    for (const tab of taskTabs) counts[tab.id] = tasks.filter(task => filterTaskByTab(task, tab.id, dbProfile?.id)).length;
    return counts;
  }, [tasks, dbProfile?.id]);

  const visibleTasks = useMemo(
    () => tasks.filter(task => (
      filterTaskByTab(task, activeTab, dbProfile?.id)
      && filterTaskByQuickFilter(task, quickFilter, dbProfile?.id)
    )),
    [activeTab, quickFilter, tasks, dbProfile?.id],
  );

  const editAssigneeOptions = useMemo(() => {
    if (!editingTask?.assigned_to || assignableUsers.some(user => user.id === editingTask.assigned_to)) {
      return assignableUsers;
    }

    return [
      ...assignableUsers,
      {
        id: editingTask.assigned_to,
        name: editingTask.assigneeName,
        email: '',
        role: '',
        unit_id: null,
        units: null,
      },
    ];
  }, [assignableUsers, editingTask]);

  const editEventOptions = useMemo(() => {
    if (!editingTask?.event_id || eventOptions.some(event => event.id === editingTask.event_id)) {
      return eventOptions;
    }

    return [
      ...eventOptions,
      {
        id: editingTask.event_id,
        title: editingTask.eventTitle ?? 'מופע קיים',
        starts_at: null,
        ends_at: null,
      },
    ];
  }, [editingTask, eventOptions]);

  const { openCount, inProgressCount, completedCount } = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let completed = 0;
    for (const task of tasks) {
      if (task.status === 'open') open += 1;
      else if (task.status === 'in_progress' || task.status === 'blocked') inProgress += 1;
      else if (task.status === 'completed') completed += 1;
    }
    return { openCount: open, inProgressCount: inProgress, completedCount: completed };
  }, [tasks]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('רגילה');
    setAssignedTo('none');
    setSelectedEventId('none');
    setDueAt('');
    setCategory('');
    setLocation('');
    setOutputRequired('');
  };

  const resolveTaskUnitId = async () => dbProfile?.unit_id ?? null;

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isTaskWritePending) return;
    if (!currentUser || !dbProfile) {
      setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('יש להזין כותרת למשימה.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
    const taskUnitId = await resolveTaskUnitId();
    const metadata: TaskMetadata = {
      category: category.trim() || undefined,
      location: location.trim() || undefined,
      output_required: outputRequired.trim() || undefined,
      control_questions: [],
      stuck_reason: undefined,
      source_type: 'manual',
      source_id: null,
      creator_name: dbProfile.name || currentUser.full_name,
      creator_role: dbProfile.role || currentUser.role,
      creator_unit: dbProfile.units?.name || currentUser.assigned_frame,
    };

    const { data: createdTask, error: insertError } = await supabase.from('tasks').insert({
      title: cleanTitle,
      description: description.trim() || null,
      status: 'open',
      priority,
      created_by: dbProfile.id,
      unit_id: taskUnitId,
      assigned_to: assignedTo === 'none' ? null : assignedTo,
      event_id: selectedEventId === 'none' ? null : selectedEventId,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      metadata,
    })
      .select('id,title,status,priority,event_id')
      .single<Pick<DbTask, 'id' | 'title' | 'status' | 'priority' | 'event_id'>>();

    if (insertError || !createdTask) {
      if (insertError) logSupabaseError('Task create failed', insertError);
      setError('לא הצלחנו ליצור את המשימה. בדוק שיש לך הרשאה לפעולה זו ונסה שוב.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'task_created',
      entityType: 'task',
      entityId: createdTask.id,
      previousValue: null,
      newValue: {
        title: createdTask.title,
        status: createdTask.status,
        priority: createdTask.priority,
        event_id: createdTask.event_id ?? null,
      },
    });

    resetForm();
    setIsFormOpen(false);
    setSuccess('המשימה נוצרה ונשמרה במערכת.');
    await loadTasks();
    } catch (createError) {
      logSupabaseError('Task create failed unexpectedly', createError);
      setError('לא הצלחנו ליצור את המשימה. נסה שוב בעוד רגע.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canUpdateTaskStatus = (task: TaskView) => {
    if (!dbProfile) return false;
    return canSeeAll || task.created_by === dbProfile.id;
  };

  const canEditTask = (task: TaskView) => canSeeAll || task.created_by === dbProfile?.id;

  const canDeleteTask = (task: TaskView) => {
    if (!dbProfile) return false;
    const isClosed = ['completed', 'cancelled'].includes(task.status);
    if (!isClosed) return false;
    return canSeeAll || task.created_by === dbProfile.id;
  };

  const openEditTask = (task: TaskView) => {
    if (isTaskWritePending || !canEditTask(task)) return;

    const metadata = getTaskMetadata(task);
    const taskPriority = priorityOptions.includes(task.priority as TaskPriority) ? (task.priority as TaskPriority) : 'רגילה';

    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditPriority(taskPriority);
    setEditAssignedTo(task.assigned_to ?? 'none');
    setEditEventId(task.event_id ?? 'none');
    setEditDueAt(formatDateTimeLocalInput(task.due_at));
    setEditCategory(metadata.category ?? '');
    setEditLocation(metadata.location ?? '');
    setEditOutputRequired(metadata.output_required ?? '');
  };

  const closeEditTask = () => {
    if (isEditSubmitting) return;
    setEditingTask(null);
    setEditTitle('');
    setEditDescription('');
    setEditPriority('רגילה');
    setEditAssignedTo('none');
    setEditEventId('none');
    setEditDueAt('');
    setEditCategory('');
    setEditLocation('');
    setEditOutputRequired('');
  };

  const handleEditTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dbProfile || isTaskWritePending || !editingTask || !canEditTask(editingTask)) return;

    const cleanTitle = editTitle.trim();
    if (!cleanTitle) {
      setError('יש להזין כותרת למשימה.');
      return;
    }

    const previousMetadata = getTaskMetadata(editingTask);
    const nextMetadata: Record<string, unknown> = {
      ...(editingTask.metadata ?? {}),
      category: editCategory.trim() || null,
      location: editLocation.trim() || null,
      output_required: editOutputRequired.trim() || null,
    };

    const nextValues = {
      title: cleanTitle,
      description: editDescription.trim() || null,
      priority: editPriority,
      assigned_to: editAssignedTo === 'none' ? null : editAssignedTo,
      due_at: editDueAt ? new Date(editDueAt).toISOString() : null,
      event_id: editEventId === 'none' ? null : editEventId,
      metadata: nextMetadata,
    };

    setIsEditSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
    const changes: Record<string, { base: unknown; next: unknown }> = {
      title: { base: editingTask.title, next: nextValues.title },
      description: { base: editingTask.description, next: nextValues.description },
      priority: { base: editingTask.priority, next: nextValues.priority },
      assigned_to: { base: editingTask.assigned_to, next: nextValues.assigned_to },
      due_at: { base: editingTask.due_at, next: nextValues.due_at },
      event_id: { base: editingTask.event_id, next: nextValues.event_id },
      metadata: { base: editingTask.metadata, next: nextValues.metadata },
    };

    if (!navigator.onLine) {
      // Queue the write for the next reconnect instead of failing outright.
      // It replays later through the exact same field-level, role-hierarchy
      // conflict resolution a live save uses — a write made offline against
      // a task someone else also changed while I was gone is resolved the
      // same way it would be if both saves had happened live.
      await enqueueWrite({
        table: 'tasks',
        rowId: editingTask.id,
        baseUpdatedAt: editingTask.updated_at,
        changes,
        baseSnapshot: editingTask as unknown as Record<string, unknown>,
        authorUserId: dbProfile.id,
      });
      setPendingSyncCount(await pendingWriteCount(dbProfile.id));
      const optimisticTasks = tasks.map(task => (task.id === editingTask.id ? { ...task, ...nextValues } : task));
      setTasks(optimisticTasks);
      void cacheSet(TASKS_CACHE_KEY, optimisticTasks);
      setEditingTask(null);
      setSuccess('אין רשת — השינוי יישמר אוטומטית כשהחיבור יחזור.');
      setIsEditSubmitting(false);
      return;
    }

    const writeResult = await writeWithHierarchyResolution({
      supabase,
      table: 'tasks',
      id: editingTask.id,
      baseUpdatedAt: editingTask.updated_at,
      changes,
      selectColumns: 'title,description,priority,assigned_to,due_at,event_id,metadata,updated_by',
      extractFields: (row) => row,
      buildPayload: (fields) => fields,
      currentUserId: dbProfile.id,
    });

    if (writeResult.status === 'merged' && writeResult.overriddenFields.length > 0) {
      setError(`השדות שהשתנו במקביל על ידי מפקד/ת בכיר/ה יותר (${writeResult.overriddenFields.join(', ')}) לא נשמרו מהעריכה שלך — שאר השינויים נשמרו.`);
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'task_updated',
      entityType: 'task',
      entityId: editingTask.id,
      previousValue: {
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        assigned_to: editingTask.assigned_to,
        due_at: editingTask.due_at,
        event_id: editingTask.event_id,
        category: previousMetadata.category ?? null,
        location: previousMetadata.location ?? null,
        output_required: previousMetadata.output_required ?? null,
      },
      newValue: {
        title: nextValues.title,
        description: nextValues.description,
        priority: nextValues.priority,
        assigned_to: nextValues.assigned_to,
        due_at: nextValues.due_at,
        event_id: nextValues.event_id,
        category: nextMetadata.category,
        location: nextMetadata.location,
        output_required: nextMetadata.output_required,
      },
    });

    setEditingTask(null);
    if (writeResult.status !== 'merged' || writeResult.overriddenFields.length === 0) {
      setSuccess('המשימה עודכנה.');
    }
    await loadTasks();
    } catch (updateError) {
      logSupabaseError('Task edit failed unexpectedly', updateError);
      setError('לא ניתן לעדכן את המשימה. נסה שוב בעוד רגע.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleStatusChange = async (task: TaskView, nextStatus: TaskStatus) => {
    if (!dbProfile || isTaskWritePending || task.status === nextStatus || !canUpdateTaskStatus(task)) return;

    const oldStatus = task.status;
    setUpdatingTaskId(task.id);
    setError(null);
    setSuccess(null);

    try {
    const { data: updatedRows, error: updateError } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', task.id)
      .select('id');

    if (updateError) {
      logSupabaseError('Task status update failed', updateError);
      setError('לא ניתן לעדכן את סטטוס המשימה כרגע. נסה שוב בעוד רגע.');
      return;
    }
    if (!didRowsUpdate(updatedRows)) {
      setError('לא ניתן לעדכן את סטטוס המשימה — אין לך הרשאה לכך, או שהמשימה השתנתה. רענן ונסה שוב.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'task_status_changed',
      entityType: 'task',
      entityId: task.id,
      previousValue: { status: oldStatus },
      newValue: { status: nextStatus },
    });

    setTasks(current => current.map(item => (
      item.id === task.id
        ? { ...item, status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null }
        : item
    )));
    setSuccess('סטטוס המשימה עודכן.');
    } catch (updateError) {
      logSupabaseError('Task status update failed unexpectedly', updateError);
      setError('לא ניתן לעדכן את סטטוס המשימה כרגע. נסה שוב בעוד רגע.');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDeleteTask = async (task: TaskView) => {
    if (!dbProfile || isTaskWritePending || !canDeleteTask(task)) return;
    setTaskPendingDelete(task);
  };

  const confirmDeleteTask = async () => {
    const task = taskPendingDelete;
    if (!task || !dbProfile) return;
    setTaskPendingDelete(null);

    setDeletingTaskId(task.id);
    setError(null);
    setSuccess(null);

    try {
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    if (deleteError) {
      logSupabaseError('Task delete failed', deleteError);
      setError('לא ניתן למחוק את המשימה. בדוק שיש לך הרשאה למחוק משימה זו.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'task_deleted',
      entityType: 'task',
      entityId: task.id,
      previousValue: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigned_to: task.assigned_to,
        created_by: task.created_by,
        unit_id: task.unit_id,
        due_at: task.due_at,
        completed_at: task.completed_at,
      },
      newValue: null,
    });

    setTasks(current => current.filter(item => item.id !== task.id));
    setSuccess('המשימה הסגורה נמחקה מהרשימה.');
    } catch (deleteError) {
      logSupabaseError('Task delete failed unexpectedly', deleteError);
      setError('לא ניתן למחוק את המשימה. בדוק שיש לך הרשאה למחוק משימה זו.');
    } finally {
      setDeletingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="משימות ובקרה פלוגתית"
        subtitle="ניהול משימות: פתיחה, הקצאה, מעקב סטטוס ובקרת ביצוע בסיסית."
      />

      {isOffline && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-3 text-sm font-bold text-[var(--color-warning)]">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            אין רשת — מוצגות משימות שנשמרו במכשיר{cachedAt ? ` בשעה ${new Date(cachedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : ''}.
            {pendingSyncCount > 0 && ` יש ${pendingSyncCount} שינויים שממתינים לסנכרון.`}
          </span>
        </div>
      )}
      {!isOffline && pendingSyncCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/10 px-4 py-3 text-sm font-bold text-[var(--color-action-on-surface)]">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>מסנכרן {pendingSyncCount} שינויים שנשמרו בזמן שלא הייתה רשת...</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted-accessible)]">פתוחות</p>
            <p className="command-kpi mt-1 text-3xl text-[var(--text-primary)]">{openCount}</p>
          </div>
          <ClipboardList className="h-9 w-9 text-[var(--brand)]" />
        </GlassCard>
        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted-accessible)]">בתהליך / תקועות</p>
            <p className="command-kpi mt-1 text-3xl text-[var(--text-primary)]">{inProgressCount}</p>
          </div>
          <AlertTriangle className="h-9 w-9 text-[var(--color-action-on-surface)]" />
        </GlassCard>
        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted-accessible)]">הושלמו</p>
            <p className="command-kpi mt-1 text-3xl text-[var(--text-primary)]">{completedCount}</p>
          </div>
          <CheckCircle2 className="h-9 w-9 text-[var(--color-success)]" />
        </GlassCard>
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {taskTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`touch-target rounded-2xl border px-3 py-2 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? 'border-[var(--action)]/40 bg-[var(--action)]/12 text-[var(--color-action-on-surface)]'
                    : 'border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-muted-accessible)] hover:border-[var(--action)]/30'
                }`}
              >
                {tab.label}
                <span className="mr-2 rounded-full bg-[var(--tactical-glass)] px-2 py-0.5 text-caption text-[var(--text-primary)]">{tabCounts[tab.id] ?? 0}</span>
              </button>
            ))}
            <span className="mx-1 hidden w-px self-stretch bg-[var(--border-strong)] sm:block" />
            {taskQuickFilters.map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setQuickFilter(current => (current === filter.id ? 'none' : filter.id))}
                className={`touch-target rounded-full border px-3 py-2 text-xs font-bold transition ${
                  quickFilter === filter.id
                    ? 'border-[var(--action)]/40 bg-[var(--action)]/12 text-[var(--color-action-on-surface)]'
                    : 'border-[var(--border-strong)] bg-[var(--tactical-glass)] text-[var(--text-muted-accessible)] hover:border-[var(--action)]/30'
                }`}
              >
                {filter.label}
              </button>
            ))}
            <span className="self-center text-xs font-bold text-[var(--text-muted-accessible)]">
              מציג {visibleTasks.length} מתוך {tasks.length} משימות
            </span>
          </div>

          <div className="flex gap-2">
            <GlossyButton variant="slate" size="sm" onClick={() => void refreshProfile()} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
              רענן
            </GlossyButton>
            <GlossyButton variant="orange" size="sm" onClick={() => setIsFormOpen(current => !current)}>
              <Plus className="h-4 w-4" />
              משימה חדשה
            </GlossyButton>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 p-3 text-sm font-bold text-[var(--color-danger)]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 p-3 text-sm font-bold text-[var(--color-success)]">
            {success}
          </div>
        )}

        {isFormOpen && (
          <form onSubmit={handleCreateTask} className="grid gap-4 rounded-3xl border border-[var(--brand)]/15 bg-[var(--tactical-glass)] p-4 lg:grid-cols-2">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">כותרת</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                placeholder="לדוגמה: השלמת בדיקת ציוד מחלקתית"
                required
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">תיאור</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                placeholder="פירוט קצר של המשימה, תוצאה נדרשת ודגשים לביצוע"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">עדיפות</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
              >
                {priorityOptions.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">אחראי</span>
              <select
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
              >
                <option value="none">טרם הוקצה</option>
                {assignableUsers.map(user => (
                  <option key={user.id} value={user.id}>{getUserDisplayName(user)} · {user.role}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">תאריך יעד</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">שייך למופע</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
              >
                <option value="none">ללא שיוך</option>
                {eventOptions.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} — {formatDateTime(event.starts_at)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">קטגוריה</span>
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                placeholder="לוגיסטיקה / כשירות / מנהלה"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">מיקום</span>
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                placeholder="אופציונלי"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--text-muted-accessible)]">תוצר נדרש</span>
              <input
                type="text"
                value={outputRequired}
                onChange={(event) => setOutputRequired(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                placeholder="איך יודעים שהמשימה נסגרה"
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
              <GlossyButton variant="orange" type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                צור משימה
              </GlossyButton>
              <GlossyButton variant="slate" onClick={() => { resetForm(); setIsFormOpen(false); }}>
                ביטול
              </GlossyButton>
            </div>
          </form>
        )}
      </GlassCard>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visibleTasks.length === 0 && !isFormOpen ? (
        <div className="py-10">
          <EmptyState
            icon={ClipboardList}
            title="אין משימות להצגה"
            description="אין משימות להצגה בטאב הנוכחי."
            actionText="צור משימה חדשה"
            onAction={() => setIsFormOpen(true)}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleTasks.map(task => {
            const metadata = getTaskMetadata(task);
            const taskStatus = statusOptions.includes(task.status as TaskStatus) ? (task.status as TaskStatus) : 'open';
            const taskPriority = priorityOptions.includes(task.priority as TaskPriority) ? (task.priority as TaskPriority) : 'רגילה';
            const canUpdate = canUpdateTaskStatus(task);
            const canEdit = canEditTask(task);

            return (
              <GlassCard key={task.id} className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{task.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted-accessible)]">{task.description || 'אין תיאור למשימה.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={statusLabels[taskStatus]} />
                    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-caption font-bold ${priorityClass('task', taskPriority)}`}>
                      {taskPriority}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-3">
                    <p className="text-xs font-bold text-[var(--command-subtle)]">אחראי</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{task.assigneeName || 'טרם הוקצה'}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-3">
                    <p className="text-xs font-bold text-[var(--command-subtle)]">נוצר על ידי / יחידה</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{task.creatorName || 'לא ידוע'} · {task.unitName || 'ללא יחידה'}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-3">
                    <p className="flex items-center gap-1 text-xs font-bold text-[var(--command-subtle)]">
                      <CalendarClock className="h-3.5 w-3.5" />
                      יעד
                    </p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{formatDateTime(task.due_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-3">
                    <p className="text-xs font-bold text-[var(--command-subtle)]">קטגוריה / מיקום</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{metadata.category || 'ללא קטגוריה'} · {metadata.location || 'ללא מיקום'}</p>
                  </div>
                </div>

                {metadata.output_required && (
                  <div className="rounded-2xl border border-[var(--brand)]/15 bg-[var(--brand)]/8 p-3 text-sm text-[var(--text-primary)]">
                    <span className="font-semibold">תוצר נדרש: </span>
                    {metadata.output_required}
                  </div>
                )}

                {task.event_id && task.eventTitle && (
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--brand)]/15 bg-[var(--brand)]/8 px-3 py-2 text-xs font-bold text-[var(--color-action-on-surface)]">
                    <CalendarClock className="h-4 w-4" />
                    <span>מופע: {task.eventTitle}{task.eventTimeLabel ? ` · ${task.eventTimeLabel}` : ''}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted-accessible)]">
                    <UserCheck className="h-4 w-4" />
                    נוצרה: {formatDate(task.created_at)}
                  </div>

                  {canUpdate ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit && (
                        <GlossyButton
                          variant="slate"
                          size="sm"
                          onClick={() => openEditTask(task)}
                          disabled={isTaskWritePending}
                        >
                          <Pencil className="h-4 w-4" />
                          ערוך
                        </GlossyButton>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-muted-accessible)]">עדכון סטטוס</span>
                        <select
                          value={taskStatus}
                          onChange={(event) => void handleStatusChange(task, event.target.value as TaskStatus)}
                          disabled={isTaskWritePending}
                          className="touch-target rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                        >
                          {statusOptions.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
                        </select>
                        {updatingTaskId === task.id && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-action-on-surface)]" />}
                      </div>
                      {canDeleteTask(task) && (
                        <GlossyButton
                          variant="slate"
                          size="sm"
                          onClick={() => void handleDeleteTask(task)}
                          disabled={isTaskWritePending}
                          className="text-[var(--color-danger)] hover:border-[var(--color-danger)]/25 hover:bg-[var(--color-danger)]/10"
                        >
                          {deletingTaskId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          מחק
                        </GlossyButton>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-[var(--command-subtle)]">אין הרשאת עדכון למשימה זו</p>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/20 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-edit-title"
          onClick={closeEditTask}
        >
          <form
            onSubmit={handleEditTask}
            className="flex max-h-[85svh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--tactical-strong-glass)] shadow-[0_24px_70px_rgba(2,1,8,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <p className="text-xs font-semibold text-[var(--color-action-on-surface)]">עריכת משימה</p>
                <h2 id="task-edit-title" className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {editingTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditTask}
                className="rounded-full border border-[var(--border-strong)] bg-[var(--tactical-glass)] p-2 text-[var(--text-muted-accessible)] transition hover:border-[var(--action)]/30 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
                aria-label="סגור עריכת משימה"
                disabled={isEditSubmitting}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">כותרת</span>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                    required
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">תיאור</span>
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">עדיפות</span>
                  <select
                    value={editPriority}
                    onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  >
                    {priorityOptions.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">אחראי</span>
                  <select
                    value={editAssignedTo}
                    onChange={(event) => setEditAssignedTo(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  >
                    <option value="none">טרם הוקצה</option>
                    {editAssigneeOptions.map(user => (
                      <option key={user.id} value={user.id}>
                        {getUserDisplayName(user)}{user.role ? ` · ${user.role}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">תאריך יעד</span>
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(event) => setEditDueAt(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">שייך למופע</span>
                  <select
                    value={editEventId}
                    onChange={(event) => setEditEventId(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  >
                    <option value="none">ללא שיוך</option>
                    {editEventOptions.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.title}{event.starts_at ? ` — ${formatDateTime(event.starts_at)}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">קטגוריה</span>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">מיקום</span>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(event) => setEditLocation(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-bold text-[var(--text-muted-accessible)]">תוצר נדרש</span>
                  <input
                    type="text"
                    value={editOutputRequired}
                    onChange={(event) => setEditOutputRequired(event.target.value)}
                    className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)]"
                  />
                </label>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--tactical-glass)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold text-[var(--command-subtle)]">סטטוס המשימה מתעדכן מהכרטיס עצמו.</p>
              <div className="flex gap-2">
                <GlossyButton variant="slate" type="button" onClick={closeEditTask} disabled={isEditSubmitting}>
                  ביטול
                </GlossyButton>
                <GlossyButton variant="orange" type="submit" disabled={isEditSubmitting}>
                  {isEditSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  שמור
                </GlossyButton>
              </div>
            </div>
          </form>
        </div>
      )}

      <CommandConfirmDialog
        open={!!taskPendingDelete}
        onCancel={() => setTaskPendingDelete(null)}
        onConfirm={() => void confirmDeleteTask()}
        title="מחיקת משימה"
        description="האם למחוק משימה סגורה זו? הפעולה לא ניתנת לביטול."
        confirmLabel="מחק"
        destructive
        loading={!!deletingTaskId}
      />
    </div>
  );
}
