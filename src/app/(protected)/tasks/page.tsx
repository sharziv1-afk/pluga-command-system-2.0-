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
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { getPermissionLevelForRole } from '@/lib/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
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

const statusLabels: Record<TaskStatus, string> = {
  open: 'פתוחה',
  in_progress: 'בתהליך',
  blocked: 'תקועה',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
};

const priorityStyles: Record<TaskPriority, string> = {
  רגילה: 'border-slate-500/20 bg-slate-500/10 text-slate-700',
  חשובה: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
  דחופה: 'border-[#FF6B02]/25 bg-[#FF6B02]/10 text-[#C54F00]',
  קריטית: 'border-red-500/20 bg-red-500/10 text-red-700',
};

function normalizeRole(role: string) {
  return role.replace(/[״׳'"]/g, '"');
}

function isCommanderRole(role: string, permissionLevel: number) {
  const normalizedRole = normalizeRole(role);
  const inferredLevel = getPermissionLevelForRole(normalizedRole);
  return permissionLevel >= 90 || inferredLevel >= 90 || normalizedRole.includes('מ"פ') || normalizedRole.includes('סמ"פ');
}

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
  const { currentUser, isLoading: isContextLoading } = useApp();
  const [dbProfile, setDbProfile] = useState<DbProfile | null>(null);
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<TaskUser[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
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

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && isCommanderRole(dbProfile?.role ?? currentUser.role, profilePermissionLevel));

  const loadTasks = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('users')
        .select('id,name,email,role,unit_id,permission_level')
        .eq('id', currentUser.id)
        .maybeSingle<DbProfile>();

      if (profileError) {
        logSupabaseError('Tasks profile lookup failed', profileError, { currentUserId: currentUser.id });
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }

      if (!profileRow) {
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }

      let profileData = profileRow;
      if (profileData.unit_id) {
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('name')
          .eq('id', profileData.unit_id)
          .maybeSingle<{ name: string }>();

        if (unitError) {
          logSupabaseError('Tasks profile unit lookup failed', unitError, {
            profileId: profileData.id,
            unitId: profileData.unit_id,
          });
        }

        profileData = { ...profileData, units: unitData ? { name: unitData.name } : null };
      }

      setDbProfile(profileData);

      const { data: taskData, error: tasksError } = await supabase
        .from('tasks')
        .select('id,title,description,status,priority,assigned_to,created_by,unit_id,event_id,due_at,completed_at,metadata,created_at,updated_at')
        .order('created_at', { ascending: false })
        .returns<DbTask[]>();

      if (tasksError) {
        logSupabaseError('Tasks load failed', tasksError);
        setError('לא ניתן לטעון משימות. ייתכן שנדרשת מדיניות RLS ל-public.tasks.');
        return;
      }

      const rawTasks = taskData ?? [];
      const userIds = [
        ...new Set(
          rawTasks.flatMap(task => [task.created_by, task.assigned_to]).filter((id): id is string => Boolean(id)),
        ),
      ];
      const unitIds = [...new Set(rawTasks.map(task => task.unit_id).filter((id): id is string => Boolean(id)))];
      const eventIds = [...new Set(rawTasks.map(task => task.event_id).filter((id): id is string => Boolean(id)))];

      const userNames: Record<string, { name: string; role: string | null }> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id,name,email,role')
          .in('id', userIds)
          .returns<Array<Pick<TaskUser, 'id' | 'name' | 'email' | 'role'>>>();

        for (const user of usersData ?? []) {
          userNames[user.id] = { name: getUserDisplayName(user), role: user.role };
        }
      }

      const unitNames: Record<string, string> = {};
      if (unitIds.length > 0) {
        const { data: unitsData } = await supabase
          .from('units')
          .select('id,name')
          .in('id', unitIds)
          .returns<Array<{ id: string; name: string }>>();

        for (const unit of unitsData ?? []) unitNames[unit.id] = unit.name;
      }

      const eventDetails: Record<string, { title: string; timeLabel: string | null }> = {};
      if (eventIds.length > 0) {
        const { data: eventsData } = await supabase
          .from('events')
          .select('id,title,starts_at,ends_at')
          .in('id', eventIds)
          .returns<Array<Pick<EventOption, 'id' | 'title' | 'starts_at' | 'ends_at'>>>();

        for (const event of eventsData ?? []) {
          eventDetails[event.id] = {
            title: event.title,
            timeLabel: formatEventTimeLabel(event.starts_at, event.ends_at ?? null),
          };
        }
      }

      let usersForAssignment: TaskUser[] = [];
      if (isCommanderRole(profileData.role, profileData.permission_level)) {
        const { data: activeUsers, error: usersError } = await supabase
          .from('users')
          .select('id,name,email,role,unit_id')
          .eq('status', 'active')
          .eq('role_approval_status', 'approved')
          .order('name', { ascending: true })
          .returns<TaskUser[]>();

        if (usersError) {
          logSupabaseError('Task assignable users load failed', usersError);
        } else {
          usersForAssignment = activeUsers ?? [];
        }
      }
      setAssignableUsers(usersForAssignment);

      const { data: visibleEvents, error: eventsError } = await supabase
        .from('events')
        .select('id,title,starts_at')
        .in('status', ['scheduled', 'in_progress'])
        .order('starts_at', { ascending: true })
        .returns<EventOption[]>();

      if (eventsError) {
        logSupabaseError('Task event options load failed', eventsError);
        setEventOptions([]);
      } else {
        setEventOptions(visibleEvents ?? []);
      }

      setTasks(rawTasks.map(task => {
        const metadata = getTaskMetadata(task);
        return {
          ...task,
          creatorName: task.created_by ? (userNames[task.created_by]?.name ?? metadata.creator_name ?? null) : metadata.creator_name ?? null,
          assigneeName: task.assigned_to ? (userNames[task.assigned_to]?.name ?? null) : null,
          unitName: task.unit_id ? (unitNames[task.unit_id] ?? metadata.creator_unit ?? null) : metadata.creator_unit ?? null,
          eventTitle: task.event_id ? (eventDetails[task.event_id]?.title ?? null) : null,
          eventTimeLabel: task.event_id ? (eventDetails[task.event_id]?.timeLabel ?? null) : null,
        };
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isContextLoading) void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContextLoading, currentUser?.id]);

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

  const openCount = tasks.filter(task => task.status === 'open').length;
  const inProgressCount = tasks.filter(task => task.status === 'in_progress' || task.status === 'blocked').length;
  const completedCount = tasks.filter(task => task.status === 'completed').length;

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

  const resolveTaskUnitId = async () => {
    if (!dbProfile) return null;
    if (dbProfile.unit_id) return dbProfile.unit_id;

    const fallbackUnitName = dbProfile.units?.name || currentUser?.assigned_frame;
    if (!fallbackUnitName) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[tasks] user profile has no unit_id or unit name; task.unit_id will be null');
      }
      return null;
    }

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id')
      .eq('name', fallbackUnitName)
      .maybeSingle<{ id: string }>();

    if (unitError || !unit) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[tasks] could not resolve unit_id for task:', unitError?.message ?? fallbackUnitName);
      }
      return null;
    }

    return unit.id;
  };

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    setIsSubmitting(false);

    if (insertError || !createdTask) {
      if (insertError) logSupabaseError('Task create failed', insertError);
      setError('לא הצלחנו ליצור משימה. אם זו שגיאת הרשאות, יש להריץ RLS ל-public.tasks ב-Supabase.');
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
    if (!canEditTask(task)) return;

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
    if (!dbProfile || !editingTask || !canEditTask(editingTask)) return;

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

    const { error: updateError } = await supabase
      .from('tasks')
      .update(nextValues)
      .eq('id', editingTask.id);

    setIsEditSubmitting(false);

    if (updateError) {
      logSupabaseError('Task edit failed', updateError);
      setError('לא ניתן לעדכן את המשימה. ייתכן שמדיניות RLS מאפשרת עריכה רק ליוצר המשימה או למפקד.');
      return;
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
    setSuccess('המשימה עודכנה.');
    await loadTasks();
  };

  const handleStatusChange = async (task: TaskView, nextStatus: TaskStatus) => {
    if (!dbProfile || task.status === nextStatus || !canUpdateTaskStatus(task)) return;

    const oldStatus = task.status;
    setUpdatingTaskId(task.id);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    setUpdatingTaskId(null);

    if (updateError) {
      logSupabaseError('Task status update failed', updateError);
      setError('לא ניתן לעדכן סטטוס משימה. ייתכן שנדרשת מדיניות RLS לעדכון public.tasks.');
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
  };

  const handleDeleteTask = async (task: TaskView) => {
    if (!dbProfile || !canDeleteTask(task)) return;

    const confirmed = window.confirm('האם למחוק משימה סגורה זו?');
    if (!confirmed) return;

    setDeletingTaskId(task.id);
    setError(null);
    setSuccess(null);

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    setDeletingTaskId(null);

    if (deleteError) {
      logSupabaseError('Task delete failed', deleteError);
      setError('לא ניתן למחוק את המשימה. ייתכן שנדרשת מדיניות RLS למחיקת משימות סגורות.');
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
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="משימות ובקרה פלוגתית"
        subtitle="ניהול משימות מול Supabase: פתיחה, הקצאה, מעקב סטטוס ובקרת ביצוע בסיסית."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#667085]">פתוחות</p>
            <p className="mt-1 text-3xl font-black text-[#020108]">{openCount}</p>
          </div>
          <ClipboardList className="h-9 w-9 text-[#FF6B02]" />
        </GlassCard>
        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#667085]">בתהליך / תקועות</p>
            <p className="mt-1 text-3xl font-black text-[#020108]">{inProgressCount}</p>
          </div>
          <AlertTriangle className="h-9 w-9 text-[#C54F00]" />
        </GlassCard>
        <GlassCard className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#667085]">הושלמו</p>
            <p className="mt-1 text-3xl font-black text-[#020108]">{completedCount}</p>
          </div>
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
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
                className={`rounded-2xl border px-3 py-2 text-xs font-bold transition ${
                  activeTab === tab.id
                    ? 'border-[#FF6B02]/40 bg-[#FF6B02]/12 text-[#C54F00]'
                    : 'border-[rgba(2,1,8,0.10)] bg-white/60 text-[#667085] hover:border-[#FF6B02]/30'
                }`}
              >
                {tab.label}
                <span className="mr-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-[#020108]">{tabCounts[tab.id] ?? 0}</span>
              </button>
            ))}
            <span className="mx-1 hidden w-px self-stretch bg-[rgba(2,1,8,0.10)] sm:block" />
            {taskQuickFilters.map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setQuickFilter(current => (current === filter.id ? 'none' : filter.id))}
                className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                  quickFilter === filter.id
                    ? 'border-[#FF6B02]/40 bg-[#FF6B02]/12 text-[#C54F00]'
                    : 'border-[rgba(2,1,8,0.10)] bg-white/60 text-[#667085] hover:border-[#FF6B02]/30'
                }`}
              >
                {filter.label}
              </button>
            ))}
            <span className="self-center text-xs font-bold text-[#667085]">
              מציג {visibleTasks.length} מתוך {tasks.length} משימות
            </span>
          </div>

          <div className="flex gap-2">
            <GlossyButton variant="slate" size="sm" onClick={() => void loadTasks()} disabled={isLoading}>
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
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-700">
            {success}
          </div>
        )}

        {isFormOpen && (
          <form onSubmit={handleCreateTask} className="grid gap-4 rounded-3xl border border-[#FF6B02]/15 bg-white/70 p-4 lg:grid-cols-2">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold text-[#667085]">כותרת</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                placeholder="לדוגמה: השלמת בדיקת ציוד מחלקתית"
                required
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold text-[#667085]">תיאור</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm text-[#020108] outline-none focus:border-[#FF6B02]/50"
                placeholder="פירוט קצר של המשימה, תוצאה נדרשת ודגשים לביצוע"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">עדיפות</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
              >
                {priorityOptions.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">אחראי</span>
              <select
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
              >
                <option value="none">טרם הוקצה</option>
                {assignableUsers.map(user => (
                  <option key={user.id} value={user.id}>{getUserDisplayName(user)} · {user.role}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">תאריך יעד</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">שייך למופע</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
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
              <span className="text-xs font-bold text-[#667085]">קטגוריה</span>
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                placeholder="לוגיסטיקה / כשירות / מנהלה"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">מיקום</span>
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                placeholder="אופציונלי"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">תוצר נדרש</span>
              <input
                type="text"
                value={outputRequired}
                onChange={(event) => setOutputRequired(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
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
      ) : visibleTasks.length === 0 ? (
        <div className="py-10">
          <EmptyState
            icon={ClipboardList}
            title="אין משימות להצגה"
            description="לא קיימות משימות בטאב הנוכחי, או שמדיניות RLS עדיין לא מאפשרת צפייה במשימות."
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
                    <h2 className="text-lg font-black text-[#020108]">{task.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#667085]">{task.description || 'אין תיאור למשימה.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={statusLabels[taskStatus]} />
                    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${priorityStyles[taskPriority]}`}>
                      {taskPriority}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 p-3">
                    <p className="text-xs font-bold text-[#98A2B3]">אחראי</p>
                    <p className="mt-1 font-bold text-[#020108]">{task.assigneeName || 'טרם הוקצה'}</p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 p-3">
                    <p className="text-xs font-bold text-[#98A2B3]">נוצר על ידי / יחידה</p>
                    <p className="mt-1 font-bold text-[#020108]">{task.creatorName || 'לא ידוע'} · {task.unitName || 'ללא יחידה'}</p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 p-3">
                    <p className="flex items-center gap-1 text-xs font-bold text-[#98A2B3]">
                      <CalendarClock className="h-3.5 w-3.5" />
                      יעד
                    </p>
                    <p className="mt-1 font-bold text-[#020108]">{formatDateTime(task.due_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 p-3">
                    <p className="text-xs font-bold text-[#98A2B3]">קטגוריה / מיקום</p>
                    <p className="mt-1 font-bold text-[#020108]">{metadata.category || 'ללא קטגוריה'} · {metadata.location || 'ללא מיקום'}</p>
                  </div>
                </div>

                {metadata.output_required && (
                  <div className="rounded-2xl border border-[#FF6B02]/15 bg-[#FF6B02]/8 p-3 text-sm text-[#020108]">
                    <span className="font-black">תוצר נדרש: </span>
                    {metadata.output_required}
                  </div>
                )}

                {task.event_id && task.eventTitle && (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#FF6B02]/15 bg-[#FF6B02]/8 px-3 py-2 text-xs font-bold text-[#C54F00]">
                    <CalendarClock className="h-4 w-4" />
                    <span>מופע: {task.eventTitle}{task.eventTimeLabel ? ` · ${task.eventTimeLabel}` : ''}</span>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-[rgba(2,1,8,0.08)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#667085]">
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
                        >
                          <Pencil className="h-4 w-4" />
                          ערוך
                        </GlossyButton>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#667085]">עדכון סטטוס</span>
                        <select
                          value={taskStatus}
                          onChange={(event) => void handleStatusChange(task, event.target.value as TaskStatus)}
                          disabled={updatingTaskId === task.id}
                          className="rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-3 py-2 text-xs font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                        >
                          {statusOptions.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
                        </select>
                        {updatingTaskId === task.id && <Loader2 className="h-4 w-4 animate-spin text-[#FF6B02]" />}
                      </div>
                      {canDeleteTask(task) && (
                        <GlossyButton
                          variant="slate"
                          size="sm"
                          onClick={() => void handleDeleteTask(task)}
                          disabled={deletingTaskId === task.id}
                          className="text-red-700 hover:border-red-500/30 hover:bg-red-500/10"
                        >
                          {deletingTaskId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          מחק
                        </GlossyButton>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-[#98A2B3]">אין הרשאת עדכון למשימה זו</p>
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
            className="flex max-h-[85svh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[rgba(2,1,8,0.10)] bg-white/95 shadow-[0_24px_70px_rgba(2,1,8,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgba(2,1,8,0.08)] px-5 py-4">
              <div>
                <p className="text-xs font-black text-[#FF6B02]">עריכת משימה</p>
                <h2 id="task-edit-title" className="mt-1 text-xl font-black text-[#020108]">
                  {editingTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditTask}
                className="rounded-full border border-[rgba(2,1,8,0.10)] bg-white/80 p-2 text-[#667085] transition hover:border-[#FF6B02]/30 hover:text-[#020108] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6B02]/18"
                aria-label="סגור עריכת משימה"
                disabled={isEditSubmitting}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-bold text-[#667085]">כותרת</span>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                    required
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-bold text-[#667085]">תיאור</span>
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm text-[#020108] outline-none focus:border-[#FF6B02]/50"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[#667085]">עדיפות</span>
                  <select
                    value={editPriority}
                    onChange={(event) => setEditPriority(event.target.value as TaskPriority)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                  >
                    {priorityOptions.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[#667085]">אחראי</span>
                  <select
                    value={editAssignedTo}
                    onChange={(event) => setEditAssignedTo(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
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
                  <span className="text-xs font-bold text-[#667085]">תאריך יעד</span>
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(event) => setEditDueAt(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[#667085]">שייך למופע</span>
                  <select
                    value={editEventId}
                    onChange={(event) => setEditEventId(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
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
                  <span className="text-xs font-bold text-[#667085]">קטגוריה</span>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-bold text-[#667085]">מיקום</span>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(event) => setEditLocation(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                  />
                </label>

                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs font-bold text-[#667085]">תוצר נדרש</span>
                  <input
                    type="text"
                    value={editOutputRequired}
                    onChange={(event) => setEditOutputRequired(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                  />
                </label>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-[rgba(2,1,8,0.08)] bg-white/76 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold text-[#98A2B3]">סטטוס המשימה מתעדכן מהכרטיס עצמו.</p>
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
    </div>
  );
}
