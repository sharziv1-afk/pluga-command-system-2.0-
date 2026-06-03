'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
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
import type { DbEvent } from '@/lib/types';

type EventType = DbEvent['event_type'];
type EventStatus = DbEvent['status'];
type ScheduleTab = 'today' | 'tomorrow' | 'week' | 'all';

type DbProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  units: { name: string } | null;
};

type EventUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  unit_id: string | null;
  units: { name: string } | null;
};

type EventView = DbEvent & {
  creatorName: string | null;
  responsibleName: string | null;
  unitName: string | null;
};

type EventTaskView = {
  id: string;
  title: string;
  status: string;
};

type EventRequestView = {
  id: string;
  title: string;
  status: string;
  request_type: string | null;
};

const eventTypes: EventType[] = ['training', 'logistics', 'meeting', 'inspection', 'operation', 'admin', 'other'];
const eventStatuses: EventStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

const tabs: { id: ScheduleTab; label: string }[] = [
  { id: 'today', label: 'היום' },
  { id: 'tomorrow', label: 'מחר' },
  { id: 'week', label: 'השבוע' },
  { id: 'all', label: 'הכל' },
];

const eventTypeLabels: Record<EventType, string> = {
  training: 'אימון',
  logistics: 'לוגיסטיקה',
  meeting: 'ישיבה',
  inspection: 'ביקורת',
  operation: 'מבצע',
  admin: 'מנהלה',
  other: 'אחר',
};

const statusLabels: Record<EventStatus, string> = {
  scheduled: 'מתוכנן',
  in_progress: 'בתהליך',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const taskStatusLabels: Record<string, string> = {
  open: 'פתוחה',
  in_progress: 'בתהליך',
  blocked: 'תקועה',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
};

const requestStatusLabels: Record<string, string> = {
  open: 'פתוח',
  in_progress: 'בטיפול',
  approved: 'אושר',
  rejected: 'נדחה',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const eventTypeStyles: Record<EventType, string> = {
  training: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  logistics: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
  meeting: 'border-purple-500/20 bg-purple-500/10 text-purple-700',
  inspection: 'border-[#FF6B02]/25 bg-[#FF6B02]/10 text-[#C54F00]',
  operation: 'border-red-500/20 bg-red-500/10 text-red-700',
  admin: 'border-slate-500/20 bg-slate-500/10 text-slate-700',
  other: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-700',
};

function normalizeRole(role: string) {
  return role.replace(/[״׳'"]/g, '"');
}

function isCommanderRole(role: string, permissionLevel: number) {
  const normalizedRole = normalizeRole(role);
  const inferredLevel = getPermissionLevelForRole(normalizedRole);
  return permissionLevel >= 90 || inferredLevel >= 90 || normalizedRole.includes('מ"פ') || normalizedRole.includes('סמ"פ');
}

function getUserDisplayName(user: Pick<EventUser, 'name' | 'email'>) {
  return user.name || user.email;
}

function logSupabaseError(message: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  if (process.env.NODE_ENV !== 'development') return;
  console.error(message, { message: error.message, code: error.code, details: error.details, hint: error.hint });
}

function getJerusalemDateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'לא נקבע';
  return new Date(value).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
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

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatShortDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatWeekdayFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
  });
}

function getTimelineHour(value: string) {
  return new Date(value).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getJerusalemDateKey(date);
}

function getWeekDateKeys() {
  const todayKey = getJerusalemDateKey(new Date());
  return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(todayKey, index));
}

function isEventVisibleInDefaultSchedule(event: DbEvent) {
  const now = new Date();
  const eventEnd = event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at);
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return eventEnd >= cutoff;
}

function shouldAutoCompleteEvent(event: DbEvent) {
  if (!['scheduled', 'in_progress'].includes(event.status)) return false;

  const endTime = event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at);
  return endTime.getTime() < Date.now();
}

function filterEventByTab(event: EventView, tab: ScheduleTab) {
  if (tab === 'all') return true;

  const now = new Date();
  const eventKey = getJerusalemDateKey(event.starts_at);

  if (tab === 'week') {
    return getWeekDateKeys().includes(eventKey);
  }

  const todayKey = getJerusalemDateKey(now);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  if (tab === 'today') return eventKey === todayKey;
  return eventKey === tomorrowKey;
}

export default function SchedulePage() {
  const { currentUser, isLoading: isContextLoading } = useApp();
  const [dbProfile, setDbProfile] = useState<DbProfile | null>(null);
  const [events, setEvents] = useState<EventView[]>([]);
  const [responsibleUsers, setResponsibleUsers] = useState<EventUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventView | null>(null);
  const [eventTasks, setEventTasks] = useState<EventTaskView[]>([]);
  const [isEventTasksLoading, setIsEventTasksLoading] = useState(false);
  const [eventRequests, setEventRequests] = useState<EventRequestView[]>([]);
  const [isEventRequestsLoading, setIsEventRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ScheduleTab>('today');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('other');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('none');

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && isCommanderRole(dbProfile?.role ?? currentUser.role, profilePermissionLevel));

  const loadEvents = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id,name,email,role,unit_id,permission_level,units(name)')
        .eq('id', currentUser.id)
        .maybeSingle<DbProfile>();

      if (profileError) {
        logSupabaseError('Schedule profile lookup failed', profileError);
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }

      if (!profileData) {
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }

      setDbProfile(profileData);

      const { data: eventData, error: eventsError } = await supabase
        .from('events')
        .select('id,title,description,event_type,starts_at,ends_at,location,unit_id,created_by,responsible_user_id,status,metadata,created_at,updated_at')
        .order('starts_at', { ascending: true })
        .returns<DbEvent[]>();

      if (eventsError) {
        logSupabaseError('Events load failed', eventsError);
        setError('לא ניתן לטעון מופעים. ייתכן שצריך להריץ את 003_events_schema.sql ואת RLS section G ב-Supabase.');
        return;
      }

      const rawEvents = eventData ?? [];
      const userIds = [
        ...new Set(
          rawEvents.flatMap(event => [event.created_by, event.responsible_user_id]).filter((id): id is string => Boolean(id)),
        ),
      ];
      const unitIds = [...new Set(rawEvents.map(event => event.unit_id).filter((id): id is string => Boolean(id)))];

      const userNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id,name,email')
          .in('id', userIds)
          .returns<Array<Pick<EventUser, 'id' | 'name' | 'email'>>>();

        for (const user of usersData ?? []) userNames[user.id] = getUserDisplayName(user);
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

      let usersForResponsibility: EventUser[] = [{
        id: profileData.id,
        name: profileData.name,
        email: profileData.email ?? currentUser.email,
        role: profileData.role,
        unit_id: profileData.unit_id,
        units: profileData.units,
      }];

      if (isCommanderRole(profileData.role, profileData.permission_level)) {
        const { data: activeUsers, error: usersError } = await supabase
          .from('users')
          .select('id,name,email,role,unit_id,units(name)')
          .eq('status', 'active')
          .eq('role_approval_status', 'approved')
          .order('name', { ascending: true })
          .returns<EventUser[]>();

        if (usersError) {
          logSupabaseError('Event responsible users load failed', usersError);
        } else {
          usersForResponsibility = activeUsers ?? usersForResponsibility;
        }
      }

      const dedupedUsers = Array.from(new Map(usersForResponsibility.map(user => [user.id, user])).values());
      setResponsibleUsers(dedupedUsers);

      const canAutoCompleteAll = isCommanderRole(profileData.role, profileData.permission_level);
      const autoCompletedEventIds = new Set<string>();
      const eventsToAutoComplete = rawEvents.filter(event => (
        shouldAutoCompleteEvent(event)
        && (canAutoCompleteAll || event.created_by === profileData.id)
      ));

      for (const event of eventsToAutoComplete) {
        const { error: autoCompleteError } = await supabase
          .from('events')
          .update({ status: 'completed' })
          .eq('id', event.id);

        if (autoCompleteError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[schedule] auto-complete event failed:', autoCompleteError.message);
          }
          continue;
        }

        autoCompletedEventIds.add(event.id);
        void createAuditLog(supabase, {
          userId: profileData.id,
          userName: profileData.name,
          userRole: profileData.role,
          actionType: 'event_status_changed',
          entityType: 'event',
          entityId: event.id,
          previousValue: { status: event.status },
          newValue: { status: 'completed', auto_completed: true },
        });
      }

      setEvents(rawEvents.map(event => ({
        ...event,
        status: autoCompletedEventIds.has(event.id) ? 'completed' : event.status,
        creatorName: event.created_by ? (userNames[event.created_by] ?? null) : null,
        responsibleName: event.responsible_user_id ? (userNames[event.responsible_user_id] ?? null) : null,
        unitName: event.unit_id ? (unitNames[event.unit_id] ?? null) : null,
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isContextLoading) void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContextLoading, currentUser?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadEventTasks = async () => {
      if (!selectedEvent) {
        setEventTasks([]);
        setIsEventTasksLoading(false);
        return;
      }

      setIsEventTasksLoading(true);
      const { data, error: tasksError } = await supabase
        .from('tasks')
        .select('id,title,status')
        .eq('event_id', selectedEvent.id)
        .returns<EventTaskView[]>();

      if (!isMounted) return;

      if (tasksError) {
        logSupabaseError('Event linked tasks load failed', tasksError);
        setEventTasks([]);
      } else {
        setEventTasks(data ?? []);
      }

      setIsEventTasksLoading(false);
    };

    void loadEventTasks();

    return () => {
      isMounted = false;
    };
  }, [selectedEvent, supabase]);

  useEffect(() => {
    let isMounted = true;

    const loadEventRequests = async () => {
      if (!selectedEvent) {
        setEventRequests([]);
        setIsEventRequestsLoading(false);
        return;
      }

      setIsEventRequestsLoading(true);
      const { data, error: requestsError } = await supabase
        .from('requests')
        .select('id,title,status,request_type')
        .eq('event_id', selectedEvent.id)
        .returns<EventRequestView[]>();

      if (!isMounted) return;

      if (requestsError) {
        logSupabaseError('Event linked requests load failed', requestsError);
        setEventRequests([]);
      } else {
        setEventRequests(data ?? []);
      }

      setIsEventRequestsLoading(false);
    };

    void loadEventRequests();

    return () => {
      isMounted = false;
    };
  }, [selectedEvent, supabase]);

  const defaultVisibleEvents = useMemo(
    () => events.filter(isEventVisibleInDefaultSchedule),
    [events],
  );

  const visibleEvents = useMemo(
    () => defaultVisibleEvents.filter(event => filterEventByTab(event, activeTab)),
    [activeTab, defaultVisibleEvents],
  );

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<ScheduleTab, number>> = {};
    for (const tab of tabs) counts[tab.id] = defaultVisibleEvents.filter(event => filterEventByTab(event, tab.id)).length;
    return counts;
  }, [defaultVisibleEvents]);

  const todayCount = tabCounts.today ?? 0;
  const tomorrowCount = tabCounts.tomorrow ?? 0;
  const weekCount = tabCounts.week ?? 0;
  const allCount = tabCounts.all ?? defaultVisibleEvents.length;

  const groupedEvents = useMemo(() => {
    const dayGroups = new Map<string, EventView[]>();

    for (const event of visibleEvents) {
      const dayKey = getJerusalemDateKey(event.starts_at);
      const dayItems = dayGroups.get(dayKey) ?? [];
      dayItems.push(event);
      dayGroups.set(dayKey, dayItems);
    }

    return Array.from(dayGroups.entries()).map(([dayKey, dayEvents]) => {
      const hourGroups = new Map<string, EventView[]>();
      for (const event of dayEvents) {
        const hourKey = getTimelineHour(event.starts_at);
        const hourItems = hourGroups.get(hourKey) ?? [];
        hourItems.push(event);
        hourGroups.set(hourKey, hourItems);
      }

      return {
        dayKey,
        dayLabel: formatDateLabel(dayEvents[0].starts_at),
        hourGroups: Array.from(hourGroups.entries()).map(([hour, hourEvents]) => ({
          hour,
          events: hourEvents,
        })),
      };
    });
  }, [visibleEvents]);

  const weekColumns = useMemo(() => (
    getWeekDateKeys().map(dateKey => ({
      dateKey,
      dayLabel: formatWeekdayFromKey(dateKey),
      dateLabel: formatShortDateFromKey(dateKey),
      events: defaultVisibleEvents
        .filter(event => getJerusalemDateKey(event.starts_at) === dateKey)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    }))
  ), [defaultVisibleEvents]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType('other');
    setStartsAt('');
    setEndsAt('');
    setLocation('');
    setResponsibleUserId('none');
  };

  const resolveUnitId = async () => {
    if (!dbProfile) return null;
    if (dbProfile.unit_id) return dbProfile.unit_id;

    const fallbackUnitName = dbProfile.units?.name || currentUser?.assigned_frame;
    if (!fallbackUnitName) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[schedule] user profile has no unit_id or unit name; event.unit_id will be null');
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
        console.warn('[schedule] could not resolve unit_id for event:', unitError?.message ?? fallbackUnitName);
      }
      return null;
    }

    return unit.id;
  };

  const handleCreateEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !dbProfile) {
      setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('יש להזין כותרת למופע.');
      return;
    }

    if (!startsAt) {
      setError('יש לבחור זמן התחלה.');
      return;
    }

    const startsAtIso = new Date(startsAt).toISOString();
    const endsAtIso = endsAt ? new Date(endsAt).toISOString() : null;

    if (endsAtIso && new Date(endsAtIso) <= new Date(startsAtIso)) {
      setError('שעת סיום חייבת להיות אחרי שעת ההתחלה.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const unitId = await resolveUnitId();
    const { data: createdEvent, error: insertError } = await supabase.from('events').insert({
      title: cleanTitle,
      description: description.trim() || null,
      event_type: eventType,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      location: location.trim() || null,
      unit_id: unitId,
      created_by: dbProfile.id,
      responsible_user_id: responsibleUserId === 'none' ? null : responsibleUserId,
      status: 'scheduled',
      metadata: {},
    })
      .select('id,title,event_type,starts_at,status')
      .single<Pick<DbEvent, 'id' | 'title' | 'event_type' | 'starts_at' | 'status'>>();

    setIsSubmitting(false);

    if (insertError || !createdEvent) {
      if (insertError) logSupabaseError('Event create failed', insertError);
      setError('לא הצלחנו ליצור מופע. אם זו שגיאת הרשאות, יש להריץ את RLS section G ב-Supabase.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'event_created',
      entityType: 'event',
      entityId: createdEvent.id,
      previousValue: null,
      newValue: {
        title: createdEvent.title,
        event_type: createdEvent.event_type,
        starts_at: createdEvent.starts_at,
        status: createdEvent.status,
      },
    });

    resetForm();
    setIsFormOpen(false);
    setSuccess('המופע נוצר ונשמר בלו"ז.');
    await loadEvents();
  };

  const canUpdateEventStatus = (event: EventView) => {
    if (!dbProfile) return false;
    return canSeeAll || event.created_by === dbProfile.id;
  };

  const canDeleteEvent = (event: EventView) => {
    if (!dbProfile) return false;
    const isClosed = ['completed', 'cancelled'].includes(event.status);
    if (!isClosed) return false;
    return canSeeAll || event.created_by === dbProfile.id;
  };

  const handleStatusChange = async (event: EventView, nextStatus: EventStatus) => {
    if (!dbProfile || event.status === nextStatus || !canUpdateEventStatus(event)) return;

    const oldStatus = event.status;
    setUpdatingEventId(event.id);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from('events')
      .update({ status: nextStatus })
      .eq('id', event.id);

    setUpdatingEventId(null);

    if (updateError) {
      logSupabaseError('Event status update failed', updateError);
      setError('לא ניתן לעדכן סטטוס מופע. ייתכן שנדרשת מדיניות RLS לעדכון public.events.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'event_status_changed',
      entityType: 'event',
      entityId: event.id,
      previousValue: { status: oldStatus },
      newValue: { status: nextStatus },
    });

    setEvents(current => current.map(item => (item.id === event.id ? { ...item, status: nextStatus } : item)));
    setSelectedEvent(current => current && current.id === event.id ? { ...current, status: nextStatus } : current);
    setSuccess('סטטוס המופע עודכן.');
  };

  const handleDeleteEvent = async (event: EventView) => {
    if (!dbProfile || !canDeleteEvent(event)) return;

    const confirmed = window.confirm('האם למחוק מופע זה? משימות ודרישות הקשורות אליו יתנתקו מהמופע אך לא יימחקו.');
    if (!confirmed) return;

    setIsDeletingEvent(true);
    setError(null);
    setSuccess(null);

    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', event.id);

    setIsDeletingEvent(false);

    if (deleteError) {
      logSupabaseError('Event delete failed', deleteError);
      setError('לא ניתן למחוק את המופע כרגע.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'event_deleted',
      entityType: 'event',
      entityId: event.id,
      previousValue: {
        title: event.title,
        event_type: event.event_type,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        status: event.status,
        created_by: event.created_by,
        unit_id: event.unit_id,
      },
      newValue: null,
    });

    setSelectedEvent(null);
    setSuccess('המופע הסגור נמחק.');
    await loadEvents();
  };

  const activeEventTasksCount = eventTasks.filter(task => ['open', 'in_progress', 'blocked'].includes(task.status)).length;
  const completedEventTasksCount = eventTasks.filter(task => task.status === 'completed').length;
  const activeEventRequestsCount = eventRequests.filter(request => ['open', 'in_progress', 'approved'].includes(request.status)).length;
  const completedEventRequestsCount = eventRequests.filter(request => request.status === 'completed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="לו״ז פלוגתי"
        subtitle="מופעים, תרגילים ותזמונים מבצעיים לפי יום ושבוע"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'היום', value: todayCount, icon: CalendarClock, hint: 'מופעים להיום' },
          { label: 'מחר', value: tomorrowCount, icon: Clock3, hint: 'תכנון מחר' },
          { label: 'השבוע', value: weekCount, icon: CalendarDays, hint: '7 ימים קדימה' },
          { label: 'הכל', value: allCount, icon: CheckCircle2, hint: 'כל המופעים' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <GlassCard key={item.label} className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs font-black text-[#667085]">{item.label}</p>
                <p className="mt-1 text-3xl font-black text-[#020108]">{item.value}</p>
                <p className="mt-1 text-[11px] font-bold text-[#98A2B3]">{item.hint}</p>
              </div>
              <Icon className="h-8 w-8 text-[#FF6B02]" />
            </GlassCard>
          );
        })}
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
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
          </div>

          <div className="flex gap-2">
            <GlossyButton variant="slate" size="sm" onClick={() => void loadEvents()} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
              רענן
            </GlossyButton>
            <GlossyButton variant="orange" size="sm" onClick={() => setIsFormOpen(current => !current)}>
              <Plus className="h-4 w-4" />
              מופע חדש
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
          <form onSubmit={handleCreateEvent} className="grid gap-4 rounded-3xl border border-[#FF6B02]/15 bg-white/70 p-4 lg:grid-cols-2">
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold text-[#667085]">כותרת</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                placeholder="לדוגמה: אימון כשירות מחלקתי"
                required
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold text-[#667085]">תיאור</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm text-[#020108] outline-none focus:border-[#FF6B02]/50"
                placeholder="פירוט קצר, דגשים, ציוד או הכנות נדרשות"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">סוג מופע</span>
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value as EventType)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
              >
                {eventTypes.map(type => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">אחראי</span>
              <select
                value={responsibleUserId}
                onChange={(event) => setResponsibleUserId(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
              >
                <option value="none">טרם הוקצה</option>
                {responsibleUsers.map(user => (
                  <option key={user.id} value={user.id}>{getUserDisplayName(user)} · {user.role}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">התחלה</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold text-[#667085]">סיום</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
              />
            </label>

            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-bold text-[#667085]">מיקום</span>
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-4 py-3 text-sm font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                placeholder="אופציונלי"
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
              <GlossyButton variant="orange" type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                צור מופע
              </GlossyButton>
              <GlossyButton variant="slate" onClick={() => { resetForm(); setIsFormOpen(false); }}>
                ביטול
              </GlossyButton>
            </div>
          </form>
        )}
      </GlassCard>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : activeTab !== 'week' && visibleEvents.length === 0 ? (
        <div className="py-10">
          <EmptyState
            icon={CalendarClock}
            title="אין מופעים בטווח הזמן הזה"
            description="הלו״ז נקי בטאב הנוכחי. אפשר ליצור מופע חדש או לעבור לטווח זמן אחר."
            actionText="צור מופע חדש"
            onAction={() => setIsFormOpen(true)}
          />
        </div>
      ) : (
        <GlassCard className="space-y-5 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[rgba(2,1,8,0.08)] pb-3">
            <div>
              <h2 className="text-base font-black text-[#020108]">ציר לו״ז</h2>
              <p className="mt-1 text-xs font-bold text-[#667085]">מופעים מסודרים לפי יום ושעת התחלה</p>
            </div>
            <CalendarClock className="h-6 w-6 text-[#FF6B02]" />
          </div>

          {activeTab === 'week' && (
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[980px] grid-cols-7 gap-3">
                {weekColumns.map(column => (
                  <section
                    key={column.dateKey}
                    className="min-h-80 rounded-3xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3"
                  >
                    <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-[#FF6B02]/14 bg-white/90 px-3 py-2 shadow-[0_10px_22px_rgba(2,1,8,0.05)]">
                      <p className="text-sm font-black text-[#020108]">{column.dayLabel}</p>
                      <p className="mt-0.5 font-mono text-xs font-black text-[#FF6B02]">{column.dateLabel}</p>
                    </div>

                    {column.events.length === 0 ? (
                      <p className="mt-4 rounded-2xl border border-dashed border-[rgba(2,1,8,0.10)] bg-white/58 p-3 text-center text-xs font-bold text-[#98A2B3]">
                        אין מופעים
                      </p>
                    ) : (
                      <div className="mt-4 space-y-2">
                        {column.events.map(event => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setSelectedEvent(event)}
                            className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/78 p-2.5 text-right shadow-[0_8px_18px_rgba(2,1,8,0.05)] transition hover:border-[#FF6B02]/28 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6B02]/18"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="shrink-0 font-mono text-[11px] font-black text-[#FF6B02]">
                                {formatTime(event.starts_at)}
                              </span>
                              <StatusBadge status={statusLabels[event.status]} className="min-h-5 shrink-0 px-2 text-[10px]" />
                            </div>
                            <h3 className="mt-1 line-clamp-2 text-xs font-black leading-5 text-[#020108]">{event.title}</h3>
                            {event.location && (
                              <p className="mt-1 truncate text-[11px] font-bold text-[#667085]">{event.location}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}

          <div className={activeTab === 'week' ? 'hidden' : 'space-y-7'}>
            {groupedEvents.map(dayGroup => (
              <section key={dayGroup.dayKey} className="space-y-3">
                {(activeTab === 'week' || activeTab === 'all') && (
                  <div className="sticky top-2 z-10 inline-flex rounded-full border border-[#FF6B02]/20 bg-white/90 px-3 py-1 text-xs font-black text-[#C54F00] shadow-[0_10px_22px_rgba(2,1,8,0.06)] backdrop-blur-xl">
                    {dayGroup.dayLabel}
                  </div>
                )}

                <div className="space-y-4">
                  {dayGroup.hourGroups.map(hourGroup => (
                    <div key={`${dayGroup.dayKey}-${hourGroup.hour}`} className="grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[5.5rem_1fr]">
                      <div className="pt-1 text-left">
                        <div className="font-mono text-sm font-black text-[#020108]">{hourGroup.hour}</div>
                        <div className="mt-1 h-full min-h-16 border-l-2 border-dashed border-[#FF6B02]/24" />
                      </div>

                      <div className="space-y-3">
                        {hourGroup.events.map(event => {
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => setSelectedEvent(event)}
                              className="w-full rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/72 p-3 text-right shadow-[0_10px_26px_rgba(2,1,8,0.06)] backdrop-blur-xl transition hover:border-[#FF6B02]/28 hover:bg-white/88 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6B02]/18"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-black text-[#FF6B02]">
                                      {formatTime(event.starts_at)}
                                      {event.ends_at ? `-${formatTime(event.ends_at)}` : ''}
                                    </span>
                                    <h3 className="truncate text-sm font-black text-[#020108] sm:text-base">{event.title}</h3>
                                  </div>
                                  <p className="mt-1 truncate text-xs font-bold text-[#667085]">
                                    {event.location || 'לא נקבע'}
                                    {' · '}
                                    אחראי: {event.responsibleName || 'טרם הוקצה'}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-1.5">
                                  <span className={`inline-flex min-h-5 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${eventTypeStyles[event.event_type]}`}>
                                    {eventTypeLabels[event.event_type]}
                                  </span>
                                  <StatusBadge status={statusLabels[event.status]} className="min-h-5 px-2 text-[10px]" />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </GlassCard>
      )}

      {selectedEvent && (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/20 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-event-details-title"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="flex max-h-[85svh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[rgba(2,1,8,0.10)] bg-white/95 shadow-[0_24px_70px_rgba(2,1,8,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[rgba(2,1,8,0.08)] px-5 py-4">
              <div>
                <p className="text-xs font-black text-[#FF6B02]">{formatDateTime(selectedEvent.starts_at)}</p>
                <h2 id="schedule-event-details-title" className="mt-1 text-xl font-black text-[#020108]">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full border border-[rgba(2,1,8,0.10)] bg-white/80 p-2 text-[#667085] transition hover:border-[#FF6B02]/30 hover:text-[#020108] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6B02]/18"
                aria-label="סגור פירוט מופע"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${eventTypeStyles[selectedEvent.event_type]}`}>
                  {eventTypeLabels[selectedEvent.event_type]}
                </span>
                <StatusBadge status={statusLabels[selectedEvent.status]} />
              </div>

              {selectedEvent.description && (
                <div className="mt-4 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-4">
                  <p className="text-xs font-black text-[#98A2B3]">תיאור</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#020108]">{selectedEvent.description}</p>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3">
                  <p className="text-xs font-black text-[#98A2B3]">התחלה</p>
                  <p className="mt-1 text-sm font-bold text-[#020108]">{formatDateTime(selectedEvent.starts_at)}</p>
                </div>
                {selectedEvent.ends_at && (
                  <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3">
                    <p className="text-xs font-black text-[#98A2B3]">סיום</p>
                    <p className="mt-1 text-sm font-bold text-[#020108]">{formatDateTime(selectedEvent.ends_at)}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3">
                  <p className="text-xs font-black text-[#98A2B3]">מיקום</p>
                  <p className="mt-1 text-sm font-bold text-[#020108]">{selectedEvent.location || 'לא נקבע'}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3">
                  <p className="text-xs font-black text-[#98A2B3]">יחידה</p>
                  <p className="mt-1 text-sm font-bold text-[#020108]">{selectedEvent.unitName || 'ללא יחידה'}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3">
                  <p className="text-xs font-black text-[#98A2B3]">אחראי</p>
                  <p className="mt-1 text-sm font-bold text-[#020108]">{selectedEvent.responsibleName || 'טרם הוקצה'}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3">
                  <p className="text-xs font-black text-[#98A2B3]">נוצר על ידי</p>
                  <p className="mt-1 text-sm font-bold text-[#020108]">{selectedEvent.creatorName || 'לא ידוע'}</p>
                </div>
                <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-3 sm:col-span-2">
                  <p className="text-xs font-black text-[#98A2B3]">נוצר בתאריך</p>
                  <p className="mt-1 text-sm font-bold text-[#020108]">{formatDateTime(selectedEvent.created_at)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-[#020108]">משימות קשורות</h3>
                    <p className="mt-1 text-xs font-bold text-[#98A2B3]">
                      {isEventTasksLoading
                        ? 'טוען משימות...'
                        : `${activeEventTasksCount} פתוחות/בתהליך/חסומות · ${completedEventTasksCount} הושלמו`}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#FF6B02]/20 bg-[#FF6B02]/10 px-2.5 py-1 text-xs font-black text-[#C54F00]">
                    {eventTasks.length}
                  </span>
                </div>

                {!isEventTasksLoading && eventTasks.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-dashed border-[rgba(2,1,8,0.10)] bg-white/60 p-3 text-xs font-bold text-[#667085]">
                    אין משימות קשורות למופע זה
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {eventTasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 px-3 py-2">
                        <p className="truncate text-sm font-bold text-[#020108]">{task.title}</p>
                        <StatusBadge status={taskStatusLabels[task.status] ?? task.status} className="min-h-5 shrink-0 px-2 text-[10px]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/64 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-[#020108]">דרישות קשורות</h3>
                    <p className="mt-1 text-xs font-bold text-[#98A2B3]">
                      {isEventRequestsLoading
                        ? 'טוען דרישות...'
                        : `${activeEventRequestsCount} פתוחות/בטיפול · ${completedEventRequestsCount} הושלמו`}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#FF6B02]/20 bg-[#FF6B02]/10 px-2.5 py-1 text-xs font-black text-[#C54F00]">
                    {eventRequests.length}
                  </span>
                </div>

                {!isEventRequestsLoading && eventRequests.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-dashed border-[rgba(2,1,8,0.10)] bg-white/60 p-3 text-xs font-bold text-[#667085]">
                    אין דרישות קשורות למופע זה
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {eventRequests.map(request => (
                      <div key={request.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#020108]">{request.title}</p>
                          <p className="mt-0.5 text-[11px] font-bold text-[#98A2B3]">{request.request_type || 'ללא סוג'}</p>
                        </div>
                        <StatusBadge status={requestStatusLabels[request.status] ?? request.status} className="min-h-5 shrink-0 px-2 text-[10px]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-[rgba(2,1,8,0.08)] bg-white/76 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              {canUpdateEventStatus(selectedEvent) ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#667085]">עדכון סטטוס</span>
                  <select
                    value={selectedEvent.status}
                    onChange={(event) => void handleStatusChange(selectedEvent, event.target.value as EventStatus)}
                    disabled={updatingEventId === selectedEvent.id}
                    className="rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 px-3 py-2 text-xs font-bold text-[#020108] outline-none focus:border-[#FF6B02]/50"
                  >
                    {eventStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                  {updatingEventId === selectedEvent.id && <Loader2 className="h-4 w-4 animate-spin text-[#FF6B02]" />}
                </div>
              ) : (
                <p className="text-xs font-bold text-[#98A2B3]">אין הרשאת עדכון למופע זה</p>
              )}

              <div className="flex flex-wrap gap-2">
                {canDeleteEvent(selectedEvent) && (
                  <GlossyButton
                    variant="slate"
                    size="sm"
                    onClick={() => void handleDeleteEvent(selectedEvent)}
                    disabled={isDeletingEvent}
                    className="text-red-700 hover:border-red-500/30 hover:bg-red-500/10"
                  >
                    {isDeletingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    מחק מופע
                  </GlossyButton>
                )}
                <GlossyButton variant="slate" size="sm" onClick={() => setSelectedEvent(null)}>
                  סגור
                </GlossyButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
