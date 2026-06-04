'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
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

type RequestStatus = 'open' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled';
type RequestCategory = 'לוגיסטיקה' | 'רפואה' | 'קשר' | 'רכב' | 'כוח אדם' | 'אחר';
type RequestPriority = 'נמוכה' | 'רגילה' | 'גבוהה' | 'דחופה';
type TabId = 'all' | 'mine' | 'open' | 'urgent' | 'in_progress' | 'completed' | 'closed';

type DbProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  units: { name: string } | null;
};

type AssigneeUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  unit_id: string | null;
  units: { name: string } | null;
};

type EventOption = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at?: string | null;
};

type RequestMetadata = {
  category?: RequestCategory;
  priority?: RequestPriority;
  creator_name?: string;
  creator_role?: string;
  creator_unit?: string;
};

type CommentMetadata = {
  author_name?: string;
  author_role?: string;
};

type RawRequest = {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  request_type: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  unit_id: string | null;
  event_id: string | null;
  metadata: RequestMetadata | null;
  created_at: string;
  updated_at: string;
};

type DbRequest = RawRequest & {
  assigneeName: string | null;
  assigneeRole: string | null;
  eventTitle: string | null;
  eventTimeLabel: string | null;
};

type DbComment = {
  id: string;
  entity_type: 'request';
  entity_id: string;
  user_id: string | null;
  body: string;
  metadata: CommentMetadata | null;
  created_at: string;
  updated_at: string;
  users: { name: string | null; email: string | null; role: string | null } | null;
};

const categories: RequestCategory[] = ['לוגיסטיקה', 'רפואה', 'קשר', 'רכב', 'כוח אדם', 'אחר'];
const priorities: RequestPriority[] = ['נמוכה', 'רגילה', 'גבוהה', 'דחופה'];
const statusOptions: RequestStatus[] = ['open', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled'];

const statusLabels: Record<RequestStatus, string> = {
  open: 'פתוח',
  in_progress: 'בתהליך',
  approved: 'אושר',
  rejected: 'נדחה',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const priorityStyles: Record<RequestPriority, string> = {
  נמוכה: 'border-slate-500/20 bg-slate-500/10 text-slate-700',
  רגילה: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
  גבוהה: 'border-[#FF6B02]/25 bg-[#FF6B02]/10 text-[#C54F00]',
  דחופה: 'border-red-500/20 bg-red-500/10 text-red-700',
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'mine', label: 'שלי' },
  { id: 'open', label: 'פתוחות' },
  { id: 'urgent', label: 'דחופות' },
  { id: 'in_progress', label: 'בטיפול' },
  { id: 'completed', label: 'הושלמו' },
  { id: 'closed', label: 'נדחו/בוטלו' },
];

const STATUS_ACTIONS: Partial<Record<RequestStatus, Array<{ label: string; nextStatus: RequestStatus; tone: 'orange' | 'slate' }>>> = {
  open: [
    { label: 'קבל לטיפול', nextStatus: 'in_progress', tone: 'slate' },
    { label: 'אשר', nextStatus: 'approved', tone: 'orange' },
    { label: 'דחה', nextStatus: 'rejected', tone: 'slate' },
    { label: 'בטל', nextStatus: 'cancelled', tone: 'slate' },
  ],
  in_progress: [
    { label: 'אשר', nextStatus: 'approved', tone: 'orange' },
    { label: 'סמן הושלם', nextStatus: 'completed', tone: 'orange' },
    { label: 'דחה', nextStatus: 'rejected', tone: 'slate' },
    { label: 'בטל', nextStatus: 'cancelled', tone: 'slate' },
  ],
  approved: [
    { label: 'סמן הושלם', nextStatus: 'completed', tone: 'orange' },
    { label: 'בטל', nextStatus: 'cancelled', tone: 'slate' },
  ],
};

function normalizeRole(role: string) {
  return role.replace(/[״׳´"“”]/g, '"');
}

function isCommanderRole(role: string, permissionLevel: number) {
  const normalizedRole = normalizeRole(role);
  const inferredLevel = getPermissionLevelForRole(normalizedRole);
  return permissionLevel >= 90 || inferredLevel >= 90 || normalizedRole.includes('מ"פ') || normalizedRole.includes('סמ"פ');
}

function professionalCategories(role: string): RequestCategory[] {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole.includes('רס"פ') || role.includes('לוגיסטיקה')) return ['לוגיסטיקה', 'רכב'];
  if (role.includes('חובש') || role.includes('רפואה')) return ['רפואה'];
  if (role.includes('קשר')) return ['קשר'];
  if (role.includes('נהג') || role.includes('רכב')) return ['רכב'];
  return [];
}

function getRequestCategory(request: DbRequest): RequestCategory {
  const category = request.metadata?.category ?? request.request_type;
  return categories.includes(category as RequestCategory) ? (category as RequestCategory) : 'אחר';
}

function getRequestPriority(request: DbRequest): RequestPriority {
  const priority = request.metadata?.priority;
  return priorities.includes(priority as RequestPriority) ? (priority as RequestPriority) : 'רגילה';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
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

function logSupabaseError(message: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  if (process.env.NODE_ENV !== 'development') return;
  console.error(message, { message: error.message, code: error.code, details: error.details, hint: error.hint });
}

function getAssigneeDisplayName(user: Pick<AssigneeUser, 'name' | 'email'>) {
  return user.name || user.email;
}

function filterByTab(request: DbRequest, tab: TabId, profileId: string | undefined): boolean {
  switch (tab) {
    case 'all': return true;
    case 'mine': return request.requested_by === profileId;
    case 'open': return request.status === 'open';
    case 'urgent': return getRequestPriority(request) === 'דחופה';
    case 'in_progress': return request.status === 'in_progress';
    case 'completed': return request.status === 'completed';
    case 'closed': return request.status === 'rejected' || request.status === 'cancelled';
    default: return true;
  }
}

function getTabEmptyText(tab: TabId): { title: string; description: string } {
  switch (tab) {
    case 'mine': return { title: 'אין בקשות שלך', description: 'לא פתחת בקשות עדיין. ניתן לפתוח בקשה חדשה.' };
    case 'open': return { title: 'אין בקשות פתוחות', description: 'כל הבקשות הפתוחות טופלו.' };
    case 'urgent': return { title: 'אין בקשות דחופות', description: 'לא קיימות בקשות בעדיפות דחופה כרגע.' };
    case 'in_progress': return { title: 'אין בקשות בטיפול', description: 'לא קיימות בקשות בטיפול פעיל.' };
    case 'completed': return { title: 'אין בקשות שהושלמו', description: 'עדיין לא הושלמו בקשות.' };
    case 'closed': return { title: 'אין בקשות סגורות', description: 'אין בקשות שנדחו או בוטלו.' };
    default: return { title: 'אין עדיין בקשות', description: 'ניתן לפתוח בקשה חדשה.' };
  }
}

export default function RequestsPage() {
  const { currentUser, isLoading: isContextLoading } = useApp();
  const [dbProfile, setDbProfile] = useState<DbProfile | null>(null);
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [assigneeUsers, setAssigneeUsers] = useState<AssigneeUser[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRequest, setEditingRequest] = useState<DbRequest | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingAssigneeId, setUpdatingAssigneeId] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByRequest, setCommentsByRequest] = useState<Record<string, DbComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loadingCommentsId, setLoadingCommentsId] = useState<string | null>(null);
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [commentErrors, setCommentErrors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [assigneeLoadError, setAssigneeLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RequestCategory>('לוגיסטיקה');
  const [priority, setPriority] = useState<RequestPriority>('רגילה');
  const [selectedEventId, setSelectedEventId] = useState('none');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<RequestCategory>('לוגיסטיקה');
  const [editPriority, setEditPriority] = useState<RequestPriority>('רגילה');
  const [editEventId, setEditEventId] = useState('none');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<RequestCategory | 'הכל'>('הכל');
  const [filterPriority, setFilterPriority] = useState<RequestPriority | 'הכל'>('הכל');

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && isCommanderRole(dbProfile?.role ?? currentUser.role, profilePermissionLevel));
  const categoryAccess = professionalCategories(dbProfile?.role ?? currentUser?.role ?? '');

  const loadRequests = async () => {
    if (!currentUser) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    setAssigneeLoadError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id,name,role,unit_id,permission_level,units(name)')
        .eq('id', currentUser.id)
        .maybeSingle<DbProfile>();

      if (profileError) {
        logSupabaseError('Requests profile lookup failed', profileError);
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }
      if (!profileData) {
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }
      setDbProfile(profileData);

      let assignableUsers: AssigneeUser[] = [];
      if (isCommanderRole(profileData.role, profileData.permission_level)) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id,name,email,role,unit_id,units(name)')
          .eq('status', 'active')
          .eq('role_approval_status', 'approved')
          .order('name', { ascending: true })
          .returns<AssigneeUser[]>();

        if (usersError) {
          logSupabaseError('Assignable users load failed', usersError);
          setAssigneeLoadError('לא ניתן לטעון רשימת מטפלים');
        } else {
          assignableUsers = usersData ?? [];
        }
      }
      setAssigneeUsers(assignableUsers);

      const { data: requestData, error: requestsError } = await supabase
        .from('requests')
        .select('id,title,description,status,request_type,requested_by,assigned_to,unit_id,event_id,metadata,created_at,updated_at')
        .order('created_at', { ascending: false })
        .returns<RawRequest[]>();

      if (requestsError) {
        logSupabaseError('Requests load failed', requestsError);
        setError('לא ניתן לטעון בקשות. ייתכן שנדרשת מדיניות RLS מתאימה ב-Supabase.');
        return;
      }

      const raw = requestData ?? [];

      // Lookup assignee display names; falls back to null if RLS blocks access
      const assignableById = new Map(assignableUsers.map(user => [user.id, user]));
      const assigneeIds = [...new Set(raw.filter(r => r.assigned_to).map(r => r.assigned_to as string))];
      const eventIds = [...new Set(raw.map(request => request.event_id).filter((id): id is string => Boolean(id)))];
      const assigneeNames: Record<string, { name: string; role: string | null }> = {};
      for (const user of assignableUsers) {
        assigneeNames[user.id] = { name: getAssigneeDisplayName(user), role: user.role };
      }
      const missingAssigneeIds = assigneeIds.filter(id => !assignableById.has(id));
      if (missingAssigneeIds.length > 0) {
        const { data: assigneeData } = await supabase
          .from('users')
          .select('id,name,email,role')
          .in('id', missingAssigneeIds)
          .returns<Array<Pick<AssigneeUser, 'id' | 'name' | 'email' | 'role'>>>();
        if (assigneeData) {
          for (const u of assigneeData) assigneeNames[u.id] = { name: getAssigneeDisplayName(u), role: u.role };
        }
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

      const { data: visibleEvents, error: eventsError } = await supabase
        .from('events')
        .select('id,title,starts_at,ends_at')
        .in('status', ['scheduled', 'in_progress'])
        .order('starts_at', { ascending: true })
        .returns<EventOption[]>();

      if (eventsError) {
        logSupabaseError('Request event options load failed', eventsError);
        setEventOptions([]);
      } else {
        setEventOptions(visibleEvents ?? []);
      }

      setRequests(raw.map(r => ({
        ...r,
        assigneeName: r.assigned_to ? (assigneeNames[r.assigned_to]?.name ?? null) : null,
        assigneeRole: r.assigned_to ? (assigneeNames[r.assigned_to]?.role ?? null) : null,
        eventTitle: r.event_id ? (eventDetails[r.event_id]?.title ?? null) : null,
        eventTimeLabel: r.event_id ? (eventDetails[r.event_id]?.timeLabel ?? null) : null,
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isContextLoading) { loadRequests(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContextLoading, currentUser?.id]);

  const visibleRequests = useMemo(() => {
    if (!dbProfile || !currentUser) return [];
    return requests.filter(request => {
      if (canSeeAll) return true;
      if (request.requested_by === currentUser.id) return true;
      if (dbProfile.unit_id && request.unit_id === dbProfile.unit_id) return true;
      if (categoryAccess.includes(getRequestCategory(request))) return true;
      return false;
    });
  }, [canSeeAll, categoryAccess, currentUser, dbProfile, requests]);

  const tabbedRequests = useMemo(
    () => visibleRequests.filter(r => filterByTab(r, activeTab, dbProfile?.id)),
    [activeTab, visibleRequests, dbProfile?.id],
  );

  const filteredRequests = useMemo(() => {
    return tabbedRequests.filter(request => {
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!request.title.toLowerCase().includes(q) && !(request.description ?? '').toLowerCase().includes(q)) return false;
      }
      if (filterCategory !== 'הכל' && getRequestCategory(request) !== filterCategory) return false;
      if (filterPriority !== 'הכל' && getRequestPriority(request) !== filterPriority) return false;
      return true;
    });
  }, [tabbedRequests, searchText, filterCategory, filterPriority]);

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<TabId, number>> = {};
    for (const tab of TABS) {
      counts[tab.id] = visibleRequests.filter(r => filterByTab(r, tab.id, dbProfile?.id)).length;
    }
    return counts;
  }, [visibleRequests, dbProfile?.id]);

  const openCount = visibleRequests.filter(r => r.status === 'open').length;
  const inProgressCount = visibleRequests.filter(r => r.status === 'in_progress').length;
  const urgentCount = visibleRequests.filter(r => getRequestPriority(r) === 'דחופה').length;
  const completedCount = visibleRequests.filter(r => r.status === 'completed').length;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('לוגיסטיקה');
    setPriority('רגילה');
    setSelectedEventId('none');
  };

  const resolveRequestUnitId = async () => {
    if (!dbProfile) return null;
    if (dbProfile.unit_id) return dbProfile.unit_id;

    const fallbackUnitName = dbProfile.units?.name || currentUser?.assigned_frame;
    if (!fallbackUnitName) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[requests] user profile has no unit_id or unit name; request.unit_id will be null');
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
        console.warn('[requests] could not resolve unit_id for request:', unitError?.message ?? fallbackUnitName);
      }
      return null;
    }

    return unit.id;
  };

  const handleCreateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !dbProfile) { setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.'); return; }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const metadata: RequestMetadata = {
      category,
      priority,
      creator_name: dbProfile.name || currentUser.full_name,
      creator_role: dbProfile.role || currentUser.role,
      creator_unit: dbProfile.units?.name || currentUser.assigned_frame,
    };
    const requestUnitId = await resolveRequestUnitId();

    const { data: createdRequest, error: insertError } = await supabase.from('requests').insert({
      title: title.trim(),
      description: description.trim(),
      status: 'open',
      request_type: category,
      requested_by: currentUser.id,
      unit_id: requestUnitId,
      event_id: selectedEventId === 'none' ? null : selectedEventId,
      metadata,
    })
      .select('id,title,status,request_type,event_id')
      .single<Pick<RawRequest, 'id' | 'title' | 'status' | 'request_type' | 'event_id'>>();

    setIsSubmitting(false);
    if (insertError || !createdRequest) {
      if (insertError) {
        logSupabaseError('Request create failed', insertError);
      }
      setError('לא הצלחנו לפתוח בקשה. אם זו שגיאת הרשאות, יש לעדכן RLS ב-Supabase.');
      return;
    }
    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'request_created',
      entityType: 'request',
      entityId: createdRequest.id,
      previousValue: null,
      newValue: {
        title: createdRequest.title,
        status: createdRequest.status,
        request_type: createdRequest.request_type,
        event_id: createdRequest.event_id ?? null,
      },
    });
    resetForm();
    setIsFormOpen(false);
    setSuccess('הבקשה נפתחה ונשמרה במערכת.');
    await loadRequests();
  };

  const canEditRequest = (request: DbRequest) =>
    Boolean(dbProfile && (canSeeAll || request.requested_by === dbProfile.id));

  const openEditRequest = (request: DbRequest) => {
    if (!canEditRequest(request)) return;
    const metadata = request.metadata ?? {};

    setEditingRequest(request);
    setEditTitle(request.title);
    setEditDescription(request.description ?? '');
    setEditCategory((metadata.category ?? request.request_type ?? 'לוגיסטיקה') as RequestCategory);
    setEditPriority((metadata.priority ?? 'רגילה') as RequestPriority);
    setEditEventId(request.event_id ?? 'none');
    setEditError(null);
    setError(null);
    setSuccess(null);
  };

  const closeEditRequest = () => {
    if (isEditSubmitting) return;
    setEditingRequest(null);
    setEditError(null);
  };

  const handleEditRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dbProfile || !editingRequest || !canEditRequest(editingRequest)) return;

    const cleanTitle = editTitle.trim();
    const cleanDescription = editDescription.trim();
    const nextEventId = editEventId === 'none' ? null : editEventId;

    if (!cleanTitle) {
      setEditError('כותרת הדרישה היא שדה חובה.');
      return;
    }

    const previousMetadata = editingRequest.metadata ?? {};
    const mergedMetadata: RequestMetadata = {
      ...previousMetadata,
      category: editCategory || undefined,
      priority: editPriority || undefined,
    };

    setIsEditSubmitting(true);
    setEditError(null);

    const { error: updateError } = await supabase
      .from('requests')
      .update({
        title: cleanTitle,
        description: cleanDescription || null,
        request_type: editCategory,
        event_id: nextEventId,
        metadata: mergedMetadata,
      })
      .eq('id', editingRequest.id);

    setIsEditSubmitting(false);

    if (updateError) {
      logSupabaseError('Request edit failed', updateError);
      setEditError('לא ניתן לעדכן את הדרישה. ייתכן שנדרשת מדיניות RLS מתאימה ב-Supabase.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'request_updated',
      entityType: 'request',
      entityId: editingRequest.id,
      previousValue: {
        title: editingRequest.title,
        description: editingRequest.description,
        request_type: editingRequest.request_type,
        priority: editingRequest.metadata?.priority ?? null,
        event_id: editingRequest.event_id ?? null,
      },
      newValue: {
        title: cleanTitle,
        description: cleanDescription || null,
        request_type: editCategory,
        priority: editPriority,
        event_id: nextEventId,
      },
    });

    setEditingRequest(null);
    setSuccess('הדרישה עודכנה.');
    await loadRequests();
  };

  const canUpdateRequestStatus = (request: DbRequest) => {
    if (!currentUser) return false;
    if (canSeeAll) return true;
    return categoryAccess.includes(getRequestCategory(request));
  };

  const handleStatusChange = async (requestId: string, nextStatus: RequestStatus) => {
    const request = requests.find(item => item.id === requestId);
    if (!request || !dbProfile) return;
    const oldStatus = request.status;

    setUpdatingStatusId(requestId);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase.from('requests').update({ status: nextStatus }).eq('id', requestId);

    setUpdatingStatusId(null);
    if (updateError) {
      logSupabaseError('Request status update failed', updateError);
      setError('לא ניתן לעדכן סטטוס. ייתכן שנדרשת מדיניות RLS מתאימה ב-Supabase.');
      return;
    }
    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'request_status_changed',
      entityType: 'request',
      entityId: request.id,
      previousValue: { status: oldStatus },
      newValue: { status: nextStatus },
    });
    setRequests(current => current.map(r => r.id === requestId ? { ...r, status: nextStatus } : r));
    setSuccess('סטטוס הבקשה עודכן.');
  };

  const hasActiveFilters = searchText !== '' || filterCategory !== 'הכל' || filterPriority !== 'הכל';
  const handleAssigneeChange = async (request: DbRequest, value: string) => {
    if (!canSeeAll || !dbProfile) return;
    const nextAssigneeId = value === 'none' ? null : value;
    const oldAssigneeId = request.assigned_to;
    setUpdatingAssigneeId(request.id);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from('requests')
      .update({ assigned_to: nextAssigneeId })
      .eq('id', request.id);

    setUpdatingAssigneeId(null);
    if (updateError) {
      logSupabaseError('Request assignee update failed', updateError);
      setError('לא ניתן לעדכן מטפל לבקשה');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'request_assigned',
      entityType: 'request',
      entityId: request.id,
      previousValue: { assigned_to: oldAssigneeId },
      newValue: { assigned_to: nextAssigneeId },
    });

    const selectedUser = nextAssigneeId ? assigneeUsers.find(user => user.id === nextAssigneeId) : null;
    setRequests(current => current.map(item => (
      item.id === request.id
        ? {
            ...item,
            assigned_to: nextAssigneeId,
            assigneeName: selectedUser ? getAssigneeDisplayName(selectedUser) : null,
            assigneeRole: selectedUser?.role ?? null,
          }
        : item
    )));
    setSuccess('המטפל עודכן');
  };

  const canDeleteRequest = (request: DbRequest) => {
    if (!dbProfile) return false;
    const isClosed = ['completed', 'rejected', 'cancelled'].includes(request.status);
    if (!isClosed) return false;
    return canSeeAll || request.requested_by === dbProfile.id;
  };

  const handleDeleteClosedRequest = async (request: DbRequest) => {
    if (!dbProfile || !canDeleteRequest(request)) return;
    const confirmed = window.confirm('האם למחוק דרישה סגורה זו?');
    if (!confirmed) return;

    setDeletingRequestId(request.id);
    setError(null);
    setSuccess(null);

    const { error: deleteError } = await supabase
      .from('requests')
      .delete()
      .eq('id', request.id);

    setDeletingRequestId(null);
    if (deleteError) {
      logSupabaseError('Request delete failed', deleteError);
      setError('לא ניתן למחוק את הדרישה. ייתכן שנדרשת מדיניות RLS למחיקת בקשות סגורות.');
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'request_deleted',
      entityType: 'request',
      entityId: request.id,
      previousValue: {
        id: request.id,
        title: request.title,
        status: request.status,
        request_type: request.request_type,
        assigned_to: request.assigned_to,
        unit_id: request.unit_id,
        event_id: request.event_id ?? null,
      },
      newValue: null,
    });

    setRequests(current => current.filter(item => item.id !== request.id));
    setSuccess('הדרישה הסגורה נמחקה.');
  };

  const loadComments = async (requestId: string) => {
    setLoadingCommentsId(requestId);
    setCommentErrors(current => ({ ...current, [requestId]: null }));

    const { data, error: commentsError } = await supabase
      .from('comments')
      .select('id,entity_type,entity_id,user_id,body,metadata,created_at,updated_at,users:user_id(name,email,role)')
      .eq('entity_type', 'request')
      .eq('entity_id', requestId)
      .order('created_at', { ascending: true })
      .returns<DbComment[]>();

    setLoadingCommentsId(null);
    if (commentsError) {
      logSupabaseError('Request comments load failed', commentsError);
      setCommentErrors(current => ({ ...current, [requestId]: 'לא ניתן לטעון את היסטוריית הטיפול' }));
      return;
    }

    setCommentsByRequest(current => ({ ...current, [requestId]: data ?? [] }));
  };

  const toggleComments = async (requestId: string) => {
    const nextOpen = !openComments[requestId];
    setOpenComments(current => ({ ...current, [requestId]: nextOpen }));
    if (nextOpen && !commentsByRequest[requestId]) {
      await loadComments(requestId);
    }
  };

  const handleAddComment = async (request: DbRequest) => {
    if (!currentUser || !dbProfile) return;
    const body = (commentDrafts[request.id] ?? '').trim();
    if (!body) {
      setCommentErrors(current => ({ ...current, [request.id]: 'יש לכתוב עדכון טיפול לפני השליחה' }));
      return;
    }

    setSubmittingCommentId(request.id);
    setCommentErrors(current => ({ ...current, [request.id]: null }));
    setError(null);
    setSuccess(null);

    const metadata: CommentMetadata = {
      author_name: dbProfile.name || currentUser.full_name,
      author_role: dbProfile.role || currentUser.role,
    };

    const { data, error: insertError } = await supabase
      .from('comments')
      .insert({
        entity_type: 'request',
        entity_id: request.id,
        user_id: dbProfile.id,
        body,
        metadata,
      })
      .select('id,entity_type,entity_id,user_id,body,metadata,created_at,updated_at,users:user_id(name,email,role)')
      .single<DbComment>();

    setSubmittingCommentId(null);
    if (insertError) {
      logSupabaseError('Request comment insert failed', insertError);
      setCommentErrors(current => ({ ...current, [request.id]: 'לא ניתן להוסיף עדכון טיפול' }));
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'request_comment_added',
      entityType: 'request',
      entityId: request.id,
      previousValue: null,
      newValue: {
        body_length: body.length,
      },
    });

    if (data) {
      setCommentsByRequest(current => ({ ...current, [request.id]: [...(current[request.id] ?? []), data] }));
    }
    setCommentDrafts(current => ({ ...current, [request.id]: '' }));
    setSuccess('עדכון הטיפול נשמר');
  };

  const emptyText = getTabEmptyText(activeTab);

  if (isContextLoading || isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="דרישות ובקשות" subtitle="מוקד פתיחה, תיעדוף וטיפול בבקשות מהשטח" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!currentUser || !dbProfile) {
    return (
      <div className="space-y-6">
        <PageHeader title="דרישות ובקשות" subtitle="מוקד פתיחה, תיעדוף וטיפול בבקשות מהשטח" />
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldAlert className="mb-3 h-10 w-10 text-red-500" />
          <h2 className="text-sm font-black text-[#020108]">לא נמצא פרופיל משתמש</h2>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-[#667085]">
            יש להתחבר מחדש כדי לפתוח או לצפות בבקשות.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="דרישות ובקשות"
        subtitle="מוקד פתיחה, תיעדוף וטיפול בבקשות מהשטח"
        actions={
          <GlossyButton variant="orange" size="sm" onClick={() => setIsFormOpen(v => !v)}>
            <Plus className="h-4 w-4" />
            פתיחת בקשה חדשה
          </GlossyButton>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="min-h-28">
          <span className="text-xs font-black text-[#667085]">בקשות פתוחות</span>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-3xl font-black text-[#020108]">{openCount}</span>
            <Clock3 className="h-7 w-7 text-[#FF6B02]" />
          </div>
        </GlassCard>
        <GlassCard className="min-h-28">
          <span className="text-xs font-black text-[#667085]">בקשות דחופות</span>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-3xl font-black text-[#020108]">{urgentCount}</span>
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
        </GlassCard>
        <GlassCard className="min-h-28">
          <span className="text-xs font-black text-[#667085]">בטיפול</span>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-3xl font-black text-[#020108]">{inProgressCount}</span>
            <RefreshCw className="h-7 w-7 text-blue-500" />
          </div>
        </GlassCard>
        <GlassCard className="min-h-28">
          <span className="text-xs font-black text-[#667085]">הושלמו</span>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-3xl font-black text-[#020108]">{completedCount}</span>
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
        </GlassCard>
      </div>

      {/* New Request Form */}
      {isFormOpen && (
        <GlassCard glow="orange" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[rgba(2,1,8,0.08)] pb-3">
            <Truck className="h-4 w-4 text-[#FF6B02]" />
            <h2 className="text-sm font-black text-[#020108]">פתיחת בקשה חדשה</h2>
          </div>
          <form onSubmit={handleCreateRequest} className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2 lg:col-span-2">
              <span className="block text-xs font-black text-[#344054]">כותרת</span>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="command-input"
                placeholder="לדוגמה: השלמת ציוד קשר למחלקה"
                disabled={isSubmitting}
              />
            </label>
            <label className="block space-y-2 lg:col-span-2">
              <span className="block text-xs font-black text-[#344054]">פירוט</span>
              <textarea
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="command-input min-h-28 resize-none"
                placeholder="פרט מה נדרש, למה, ועד מתי."
                disabled={isSubmitting}
              />
            </label>
            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">קטגוריה</span>
              <select value={category} onChange={e => setCategory(e.target.value as RequestCategory)} className="command-select" disabled={isSubmitting}>
                {categories.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">עדיפות</span>
              <select value={priority} onChange={e => setPriority(e.target.value as RequestPriority)} className="command-select" disabled={isSubmitting}>
                {priorities.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-2 lg:col-span-2">
              <span className="block text-xs font-black text-[#344054]">שייך למופע</span>
              <select
                value={selectedEventId}
                onChange={event => setSelectedEventId(event.target.value)}
                className="command-select"
                disabled={isSubmitting}
              >
                <option value="none">ללא שיוך</option>
                {eventOptions.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} — {event.starts_at ? formatDateTime(event.starts_at) : 'ללא זמן'}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2 lg:col-span-2 sm:flex-row">
              <GlossyButton type="submit" variant="orange" size="lg" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                שמור בקשה
              </GlossyButton>
              <GlossyButton type="button" variant="slate" size="lg" onClick={() => setIsFormOpen(false)} disabled={isSubmitting} className="flex-1">
                ביטול
              </GlossyButton>
            </div>
          </form>
        </GlassCard>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/60 p-1 backdrop-blur-xl">
        {TABS.map(tab => {
          const count = tabCounts[tab.id] ?? 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-all duration-150 ${
                isActive
                  ? 'bg-[#FF6B02] text-white shadow-[0_4px_12px_rgba(255,107,2,0.28)]'
                  : 'text-[#667085] hover:bg-[#FF6B02]/10 hover:text-[#020108]'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-black ${
                  isActive ? 'bg-white/25 text-white' : 'bg-[rgba(2,1,8,0.07)] text-[#667085]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(20rem,1fr)_minmax(10rem,12rem)_minmax(10rem,12rem)_auto] xl:items-center">
        <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="command-input pl-10 pr-4"
            placeholder="חיפוש לפי כותרת או פירוט"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as RequestCategory | 'הכל')}
          className="command-select min-w-0"
        >
          <option value="הכל">כל הקטגוריות</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value as RequestPriority | 'הכל')}
          className="command-select min-w-0"
        >
          <option value="הכל">כל העדיפויות</option>
          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <GlossyButton variant="slate" size="sm" onClick={loadRequests} className="w-full sm:col-span-2 xl:col-span-1 xl:w-auto">
          <RefreshCw className="h-4 w-4" />
          רענון
        </GlossyButton>
      </div>

      {/* Request list */}
      {filteredRequests.length === 0 ? (
        <div className="py-8">
          {hasActiveFilters ? (
            <EmptyState
              icon={Search}
              title="לא נמצאו בקשות לפי הסינון"
              description="נסה לשנות את הסינון או לנקות את שדה החיפוש."
              actionText="נקה סינון"
              onAction={() => { setSearchText(''); setFilterCategory('הכל'); setFilterPriority('הכל'); }}
            />
          ) : (
            <EmptyState
              icon={Truck}
              title={emptyText.title}
              description={emptyText.description}
              actionText="פתח בקשה חדשה"
              onAction={() => setIsFormOpen(true)}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map(request => {
            const requestCategory = getRequestCategory(request);
            const requestPriority = getRequestPriority(request);
            const metadata = request.metadata ?? {};
            const isUpdating = updatingStatusId === request.id;
            const isUpdatingAssignee = updatingAssigneeId === request.id;
            const canUpdate = canUpdateRequestStatus(request);
            const actions = STATUS_ACTIONS[request.status] ?? [];
            const showActionButtons = canSeeAll && actions.length > 0;
            const isCommentsOpen = Boolean(openComments[request.id]);
            const comments = commentsByRequest[request.id] ?? [];
            const commentError = commentErrors[request.id];
            const isLoadingComments = loadingCommentsId === request.id;
            const isSubmittingComment = submittingCommentId === request.id;
            const canDeleteClosed = canDeleteRequest(request);
            const canEdit = canEditRequest(request);
            const isDeleting = deletingRequestId === request.id;

            return (
              <GlassCard key={request.id} className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={statusLabels[request.status]} />
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${priorityStyles[requestPriority]}`}>
                        {requestPriority}
                      </span>
                      <span className="rounded-full border border-[#FF6B02]/20 bg-[#FF6B02]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#C54F00]">
                        {requestCategory}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-[#020108]">{request.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667085]">
                      {request.description || 'לא נוסף פירוט לבקשה.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-bold text-[#98A2B3]">{formatDate(request.created_at)}</span>
                    {request.updated_at !== request.created_at && (
                      <span className="text-[11px] font-semibold text-[#98A2B3]">עודכן: {formatDate(request.updated_at)}</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 border-t border-[rgba(2,1,8,0.08)] pt-3 text-xs font-bold text-[#667085] sm:grid-cols-2 lg:grid-cols-4">
                  <span>יוצר: <strong className="text-[#020108]">{metadata.creator_name || 'לא ידוע'}</strong></span>
                  <span>תפקיד: <strong className="text-[#020108]">{metadata.creator_role || 'לא ידוע'}</strong></span>
                  <span>יחידה: <strong className="text-[#020108]">{metadata.creator_unit || 'לא ידוע'}</strong></span>
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 shrink-0" />
                    מטפל: <strong className="text-[#020108]">
                      {request.assigneeName ? `${request.assigneeName}${request.assigneeRole ? ` · ${request.assigneeRole}` : ''}` : 'טרם הוקצה'}
                    </strong>
                  </span>
                </div>

                {request.event_id && request.eventTitle && (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#FF6B02]/15 bg-[#FF6B02]/8 px-3 py-2 text-xs font-bold text-[#C54F00]">
                    <Clock3 className="h-4 w-4" />
                    <span>מופע: {request.eventTitle}{request.eventTimeLabel ? ` · ${request.eventTimeLabel}` : ''}</span>
                  </div>
                )}

                {canSeeAll && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 p-3 sm:flex-row sm:items-center">
                    <span className="shrink-0 text-[11px] font-black text-[#98A2B3]">שיוך מטפל</span>
                    <select
                      value={request.assigned_to ?? 'none'}
                      onChange={event => handleAssigneeChange(request, event.target.value)}
                      className="command-select min-h-10 flex-1 text-xs"
                      disabled={isUpdatingAssignee || (assigneeUsers.length === 0 && !request.assigned_to)}
                    >
                      <option value="none">{request.assigned_to ? 'הסר שיוך' : 'בחר מטפל'}</option>
                      {request.assigned_to && !assigneeUsers.some(user => user.id === request.assigned_to) && (
                        <option value={request.assigned_to}>
                          {request.assigneeName ? `${request.assigneeName}${request.assigneeRole ? ` · ${request.assigneeRole}` : ''}` : 'מטפל לא זמין'}
                        </option>
                      )}
                      {assigneeUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {getAssigneeDisplayName(user)} · {user.role}{user.units?.name ? ` · ${user.units.name}` : ''}
                        </option>
                      ))}
                    </select>
                    {isUpdatingAssignee && <Loader2 className="h-4 w-4 animate-spin text-[#FF6B02]" />}
                    {assigneeLoadError && (
                      <span className="text-[11px] font-bold text-red-700">{assigneeLoadError}</span>
                    )}
                  </div>
                )}

                {canUpdate && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {showActionButtons ? (
                      <>
                        <span className="text-[11px] font-black text-[#98A2B3]">פעולות</span>
                        {actions.map(action => (
                          <GlossyButton
                            key={action.nextStatus}
                            variant={action.tone}
                            size="sm"
                            onClick={() => handleStatusChange(request.id, action.nextStatus)}
                            disabled={isUpdating}
                          >
                            {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                            {action.label}
                          </GlossyButton>
                        ))}
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] font-black text-[#98A2B3]">עדכון סטטוס</span>
                        <select
                          value={request.status}
                          onChange={e => handleStatusChange(request.id, e.target.value as RequestStatus)}
                          className="command-select min-h-10 max-w-xs text-xs"
                          disabled={isUpdating}
                        >
                          {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                        </select>
                        {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-[#FF6B02]" />}
                      </>
                    )}
                  </div>
                )}

                {(canEdit || canDeleteClosed) && (
                  <div className="flex flex-wrap justify-start gap-2 border-t border-[rgba(2,1,8,0.08)] pt-3">
                    {canEdit && (
                      <GlossyButton
                        type="button"
                        variant="slate"
                        size="sm"
                        onClick={() => openEditRequest(request)}
                      >
                        <Pencil className="h-4 w-4" />
                        ערוך
                      </GlossyButton>
                    )}
                    {canDeleteClosed && (
                    <GlossyButton
                      type="button"
                      variant="slate"
                      size="sm"
                      onClick={() => handleDeleteClosedRequest(request)}
                      disabled={isDeleting}
                      className="text-red-700 hover:border-red-500/25 hover:bg-red-500/10"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      מחק
                    </GlossyButton>
                    )}
                  </div>
                )}

                <div className="border-t border-[rgba(2,1,8,0.08)] pt-3">
                  <button
                    type="button"
                    onClick={() => toggleComments(request.id)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/60 px-3 py-2 text-xs font-black text-[#020108] transition-all duration-150 hover:border-[#FF6B02]/30 hover:bg-[#FF6B02]/10"
                  >
                    <MessageSquareText className="h-4 w-4 text-[#FF6B02]" />
                    {isCommentsOpen ? 'הסתר היסטוריית טיפול' : 'הצג היסטוריית טיפול'}
                    {comments.length > 0 && (
                      <span className="rounded-full bg-[#FF6B02]/12 px-2 py-0.5 text-[10px] text-[#C54F00]">
                        {comments.length}
                      </span>
                    )}
                  </button>

                  {isCommentsOpen && (
                    <div className="mt-3 space-y-3 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/52 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-xs font-black text-[#020108]">היסטוריית טיפול</h4>
                        {isLoadingComments && <Loader2 className="h-4 w-4 animate-spin text-[#FF6B02]" />}
                      </div>

                      {commentError && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700">
                          {commentError}
                        </div>
                      )}

                      {!isLoadingComments && !commentError && comments.length === 0 && (
                        <p className="rounded-xl border border-[rgba(2,1,8,0.08)] bg-white/50 px-3 py-3 text-xs font-bold text-[#667085]">
                          אין עדיין עדכוני טיפול לבקשה זו
                        </p>
                      )}

                      {comments.length > 0 && (
                        <div className="space-y-2">
                          {comments.map(comment => {
                            const authorName = comment.metadata?.author_name || comment.users?.name || comment.users?.email || 'משתמש';
                            const authorRole = comment.metadata?.author_role || comment.users?.role;
                            return (
                              <div key={comment.id} className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/62 p-3">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs font-black text-[#020108]">
                                    {authorName}{authorRole ? ` · ${authorRole}` : ''}
                                  </span>
                                  <span className="text-[11px] font-bold text-[#98A2B3]">{formatDateTime(comment.created_at)}</span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#667085]">
                                  {comment.body}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-2">
                        <textarea
                          value={commentDrafts[request.id] ?? ''}
                          onChange={event => setCommentDrafts(current => ({ ...current, [request.id]: event.target.value }))}
                          className="command-input min-h-24 resize-none text-sm"
                          placeholder="כתוב עדכון טיפול..."
                          disabled={isSubmittingComment}
                        />
                        <div className="flex justify-end">
                          <GlossyButton
                            type="button"
                            variant="orange"
                            size="sm"
                            onClick={() => handleAddComment(request)}
                            disabled={isSubmittingComment}
                          >
                            {isSubmittingComment && <Loader2 className="h-4 w-4 animate-spin" />}
                            הוסף עדכון
                          </GlossyButton>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {editingRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/20 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-edit-title"
          onClick={closeEditRequest}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-white/72 bg-white/92 shadow-[0_24px_70px_rgba(2,1,8,0.18)] backdrop-blur-2xl"
            onClick={event => event.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(2,1,8,0.08)] px-5 py-4">
              <div>
                <h2 id="request-edit-title" className="text-lg font-black text-[#020108]">עריכת דרישה</h2>
                <p className="mt-1 text-xs font-semibold text-[#667085]">עדכון פרטי הדרישה בלי לשנות סטטוס, מטפל או היסטוריית טיפול.</p>
              </div>
              <button
                type="button"
                onClick={closeEditRequest}
                disabled={isEditSubmitting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/80 text-[#020108] transition hover:border-[#FF6B02]/30 hover:bg-[#FF6B02]/10 disabled:opacity-50"
                aria-label="סגירת עריכת דרישה"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditRequest} className="grid max-h-[75vh] gap-4 overflow-y-auto px-5 py-5 lg:grid-cols-2">
              {editError && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-700 lg:col-span-2">
                  {editError}
                </div>
              )}

              <label className="block space-y-2 lg:col-span-2">
                <span className="block text-xs font-black text-[#344054]">כותרת</span>
                <input
                  required
                  value={editTitle}
                  onChange={event => setEditTitle(event.target.value)}
                  className="command-input"
                  disabled={isEditSubmitting}
                />
              </label>

              <label className="block space-y-2 lg:col-span-2">
                <span className="block text-xs font-black text-[#344054]">פירוט</span>
                <textarea
                  value={editDescription}
                  onChange={event => setEditDescription(event.target.value)}
                  className="command-input min-h-28 resize-none"
                  disabled={isEditSubmitting}
                />
              </label>

              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">קטגוריה</span>
                <select value={editCategory} onChange={event => setEditCategory(event.target.value as RequestCategory)} className="command-select" disabled={isEditSubmitting}>
                  {categories.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">עדיפות</span>
                <select value={editPriority} onChange={event => setEditPriority(event.target.value as RequestPriority)} className="command-select" disabled={isEditSubmitting}>
                  {priorities.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <label className="block space-y-2 lg:col-span-2">
                <span className="block text-xs font-black text-[#344054]">שייך למופע</span>
                <select
                  value={editEventId}
                  onChange={event => setEditEventId(event.target.value)}
                  className="command-select"
                  disabled={isEditSubmitting}
                >
                  <option value="none">ללא שיוך</option>
                  {editingRequest.event_id && !eventOptions.some(event => event.id === editingRequest.event_id) && (
                    <option value={editingRequest.event_id}>מופע נוכחי</option>
                  )}
                  {eventOptions.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title} — {event.starts_at ? formatDateTime(event.starts_at) : 'ללא זמן'}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-2 border-t border-[rgba(2,1,8,0.08)] pt-4 lg:col-span-2 sm:flex-row">
                <GlossyButton type="submit" variant="orange" size="lg" disabled={isEditSubmitting} className="flex-1">
                  {isEditSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  שמור שינויים
                </GlossyButton>
                <GlossyButton type="button" variant="slate" size="lg" onClick={closeEditRequest} disabled={isEditSubmitting} className="flex-1">
                  ביטול
                </GlossyButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
