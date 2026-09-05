'use client';

import dynamic from 'next/dynamic';
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
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FieldPrivacyHint } from '@/components/ui/FieldPrivacyHint';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { priorityClass, requestStatusLabels as statusLabels } from '@/lib/statusLabels';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MetricCard } from '@/components/ui/MetricCard';
import { CommandOverlay, CommandConfirmDialog } from '@/components/ui/CommandDialog';
import { CommandButton } from '@/components/ui/CommandButton';
import { CommandInput, CommandSelect, CommandTextarea } from '@/components/ui/CommandField';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { getPermissionLevelForRole, hasCompanyWideUiAccess, normalizeRole } from '@/lib/permissions';
import { getScheduleDisplayStatus } from '@/lib/schedule';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { LIST_FETCH_LIMIT, TRUNCATION_NOTICE, isTruncated } from '@/lib/queryLimits';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';
import { formatDate, formatDateTime, formatTime } from '@/lib/datetime';
import { toDbProfile, type DbProfile } from '@/lib/dbProfile';

// Loaded on demand: GapsPanel is ~500 lines behind the פערים toggle, and
// viewMode defaults to 'requests', so most visits never render it. ssr:false
// because it is client-only anyway and this keeps it out of the server bundle
// too. The skeleton matches what the panel shows while it loads its own data,
// so the swap is not a visible jump.
const GapsPanel = dynamic(
  () => import('@/components/gaps/GapsPanel').then(m => ({ default: m.GapsPanel })),
  { ssr: false, loading: () => <SkeletonCard /> },
);

type RequestStatus = 'open' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled';
type RequestCategory = 'לוגיסטיקה' | 'רפואה' | 'קשר' | 'רכב' | 'כוח אדם' | 'אחר';
type RequestPriority = 'נמוכה' | 'רגילה' | 'גבוהה' | 'דחופה';
type TabId = 'all' | 'mine' | 'open' | 'urgent' | 'in_progress' | 'completed' | 'closed';


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
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
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

function formatEventTimeLabel(startsAt: string | null, endsAt: string | null) {
  const start = formatTime(startsAt);
  if (!start) return null;

  const end = formatTime(endsAt);
  return end ? `${start}–${end}` : start;
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
    case 'mine': return { title: 'אין דרישות שלך', description: 'לא פתחת דרישות עדיין. ניתן לפתוח דרישה חדשה.' };
    case 'open': return { title: 'אין דרישות פתוחות', description: 'כל הדרישות הפתוחות טופלו.' };
    case 'urgent': return { title: 'אין דרישות דחופות', description: 'לא קיימות דרישות בעדיפות דחופה כרגע.' };
    case 'in_progress': return { title: 'אין דרישות בטיפול', description: 'לא קיימות דרישות בטיפול פעיל.' };
    case 'completed': return { title: 'אין דרישות שהושלמו', description: 'עדיין לא הושלמו דרישות.' };
    case 'closed': return { title: 'אין דרישות סגורות', description: 'אין דרישות שנדחו או בוטלו.' };
    default: return { title: 'אין עדיין דרישות', description: 'ניתן לפתוח דרישה חדשה.' };
  }
}

type ViewMode = 'requests' | 'gaps';

export default function RequestsPage() {
  const { currentUser, isLoading: isContextLoading, refreshProfile } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('requests');
  const [requestsTruncated, setRequestsTruncated] = useState(false);
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
  const [confirmDeleteRequest, setConfirmDeleteRequest] = useState<DbRequest | null>(null);
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
  const dbProfile = useMemo(() => toDbProfile(currentUser), [currentUser]);

  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && hasCompanyWideUiAccess(dbProfile?.role ?? currentUser.role, profilePermissionLevel));
  const categoryAccess = professionalCategories(dbProfile?.role ?? currentUser?.role ?? '');
  // ponytail: one page-wide write lock; split by request only if concurrent edits become necessary.
  const isRequestWritePending = isSubmitting
    || isEditSubmitting
    || Boolean(updatingStatusId || updatingAssigneeId || deletingRequestId || submittingCommentId);

  const loadRequests = async () => {
    if (!currentUser) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    setAssigneeLoadError(null);

    try {
      const profileData = dbProfile;
      if (!profileData) {
        setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
        return;
      }

      const canAssign = hasCompanyWideUiAccess(profileData.role, profileData.permission_level);

      // Round 1: three independent queries in parallel — none need each other's results.
      const [assignableUsersResult, { data: requestData, error: requestsError }, { data: visibleEvents, error: eventsError }] = await Promise.all([
        canAssign
          ? supabase
              .from('users')
              .select('id,name,email,role,unit_id')
              .eq('status', 'active')
              .eq('role_approval_status', 'approved')
              .order('name', { ascending: true })
              .returns<AssigneeUser[]>()
          : Promise.resolve({ data: [] as AssigneeUser[], error: null }),
        supabase
          .from('requests')
          .select('id,title,description,status,request_type,requested_by,assigned_to,unit_id,event_id,metadata,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(LIST_FETCH_LIMIT)
          .returns<RawRequest[]>(),
        supabase
          .from('events')
          .select('id,title,starts_at,ends_at,status')
          .in('status', ['scheduled', 'in_progress'])
          .order('starts_at', { ascending: true })
          .returns<EventOption[]>(),
      ]);

      if (requestsError) {
        logSupabaseError('Requests load failed', requestsError);
        setError('לא ניתן לטעון את הדרישות כרגע. נסה לרענן את הדף בעוד רגע.');
        return;
      }

      let assignableUsers: AssigneeUser[] = [];
      if (canAssign && assignableUsersResult.error) {
        logSupabaseError('Assignable users load failed', assignableUsersResult.error);
        setAssigneeLoadError('לא ניתן לטעון רשימת מטפלים');
      } else {
        assignableUsers = assignableUsersResult.data ?? [];
      }

      const raw = requestData ?? [];
      const assignableById = new Map(assignableUsers.map(user => [user.id, user]));
      const assigneeIds = [...new Set(raw.filter(r => r.assigned_to).map(r => r.assigned_to as string))];
      const eventIds = [...new Set(raw.map(request => request.event_id).filter((id): id is string => Boolean(id)))];
      const missingAssigneeIds = assigneeIds.filter(id => !assignableById.has(id));
      const assignableUnitIds = [
        ...new Set(assignableUsers.map(user => user.unit_id).filter((id): id is string => Boolean(id))),
      ];

      // Round 2: keyed off round-1 results, but independent of each other — parallelize.
      const [{ data: assignableUnitsData }, { data: assigneeData }, { data: eventsData }] = await Promise.all([
        assignableUnitIds.length > 0
          ? supabase.from('units').select('id,name').in('id', assignableUnitIds).returns<Array<{ id: string; name: string }>>()
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
        missingAssigneeIds.length > 0
          ? supabase.from('users').select('id,name,email,role').in('id', missingAssigneeIds).returns<Array<Pick<AssigneeUser, 'id' | 'name' | 'email' | 'role'>>>()
          : Promise.resolve({ data: [] as Array<Pick<AssigneeUser, 'id' | 'name' | 'email' | 'role'>> }),
        eventIds.length > 0
          ? supabase.from('events').select('id,title,starts_at,ends_at').in('id', eventIds).returns<Array<Pick<EventOption, 'id' | 'title' | 'starts_at' | 'ends_at'>>>()
          : Promise.resolve({ data: [] as Array<Pick<EventOption, 'id' | 'title' | 'starts_at' | 'ends_at'>> }),
      ]);

      const assignableUnitNames = Object.fromEntries((assignableUnitsData ?? []).map(unit => [unit.id, unit.name]));
      assignableUsers = assignableUsers.map(user => ({
        ...user,
        units: user.unit_id && assignableUnitNames[user.unit_id] ? { name: assignableUnitNames[user.unit_id] } : null,
      }));
      setAssigneeUsers(assignableUsers);

      const assigneeNames: Record<string, { name: string; role: string | null }> = {};
      for (const user of assignableUsers) {
        assigneeNames[user.id] = { name: getAssigneeDisplayName(user), role: user.role };
      }
      for (const u of assigneeData ?? []) {
        assigneeNames[u.id] = { name: getAssigneeDisplayName(u), role: u.role };
      }

      const eventDetails: Record<string, { title: string; timeLabel: string | null }> = {};
      for (const event of eventsData ?? []) {
        eventDetails[event.id] = {
          title: event.title,
          timeLabel: formatEventTimeLabel(event.starts_at, event.ends_at ?? null),
        };
      }

      if (eventsError) {
        logSupabaseError('Request event options load failed', eventsError);
        setEventOptions([]);
      } else {
        setEventOptions((visibleEvents ?? []).filter(event => getScheduleDisplayStatus({
          status: event.status,
          starts_at: event.starts_at ?? '',
          ends_at: event.ends_at ?? null,
        }) !== 'completed'));
      }

      setRequestsTruncated(isTruncated(raw));
      setRequests(raw.map(r => ({
        ...r,
        assigneeName: r.assigned_to ? (assigneeNames[r.assigned_to]?.name ?? null) : null,
        assigneeRole: r.assigned_to ? (assigneeNames[r.assigned_to]?.role ?? null) : null,
        eventTitle: r.event_id ? (eventDetails[r.event_id]?.title ?? null) : null,
        eventTimeLabel: r.event_id ? (eventDetails[r.event_id]?.timeLabel ?? null) : null,
      })));
    } catch (loadError) {
      logSupabaseError('Requests load failed unexpectedly', loadError);
      setError('לא ניתן לטעון את הדרישות כרגע. נסה לרענן את הדף בעוד רגע.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isContextLoading) { loadRequests(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContextLoading, currentUser]);

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

  const { openCount, inProgressCount, urgentCount, completedCount } = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let urgent = 0;
    let completed = 0;
    for (const r of visibleRequests) {
      if (r.status === 'open') open += 1;
      if (r.status === 'in_progress') inProgress += 1;
      if (r.status === 'completed') completed += 1;
      if (getRequestPriority(r) === 'דחופה') urgent += 1;
    }
    return { openCount: open, inProgressCount: inProgress, urgentCount: urgent, completedCount: completed };
  }, [visibleRequests]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('לוגיסטיקה');
    setPriority('רגילה');
    setSelectedEventId('none');
  };

  const resolveRequestUnitId = async () => dbProfile?.unit_id ?? null;

  const handleCreateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRequestWritePending) return;
    if (!currentUser || !dbProfile) { setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.'); return; }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
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

    if (insertError || !createdRequest) {
      if (insertError) {
        logSupabaseError('Request create failed', insertError);
      }
      setError('לא הצלחנו לפתוח את הדרישה. בדוק שיש לך הרשאה לפעולה זו ונסה שוב.');
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
    setSuccess('הדרישה נפתחה ונשמרה במערכת.');
    await loadRequests();
    } catch (createError) {
      logSupabaseError('Request create failed unexpectedly', createError);
      setError('לא הצלחנו לפתוח את הדרישה. נסה שוב בעוד רגע.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEditRequest = (request: DbRequest) =>
    Boolean(dbProfile && (canSeeAll || request.requested_by === dbProfile.id));

  const openEditRequest = (request: DbRequest) => {
    if (isRequestWritePending || !canEditRequest(request)) return;
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
    if (!dbProfile || isRequestWritePending || !editingRequest || !canEditRequest(editingRequest)) return;

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

    try {
    const { data: updatedRows, error: updateError } = await supabase
      .from('requests')
      .update({
        title: cleanTitle,
        description: cleanDescription || null,
        request_type: editCategory,
        event_id: nextEventId,
        metadata: mergedMetadata,
      })
      .eq('id', editingRequest.id)
      .select('id');

    if (updateError) {
      logSupabaseError('Request edit failed', updateError);
      setEditError('לא ניתן לעדכן את הדרישה כרגע. נסה שוב בעוד רגע.');
      return;
    }
    if (!didRowsUpdate(updatedRows)) {
      setEditError('לא ניתן לעדכן את הדרישה — אין לך הרשאה לכך, או שהדרישה השתנתה. רענן ונסה שוב.');
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
    } catch (updateError) {
      logSupabaseError('Request edit failed unexpectedly', updateError);
      setEditError('לא ניתן לעדכן את הדרישה כרגע. נסה שוב בעוד רגע.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const canUpdateRequestStatus = (request: DbRequest) => {
    if (!currentUser) return false;
    if (canSeeAll) return true;
    return categoryAccess.includes(getRequestCategory(request));
  };

  const handleStatusChange = async (requestId: string, nextStatus: RequestStatus) => {
    if (isRequestWritePending) return;
    const request = requests.find(item => item.id === requestId);
    if (!request || !dbProfile) return;
    const oldStatus = request.status;

    setUpdatingStatusId(requestId);
    setError(null);
    setSuccess(null);

    try {
    const { data: updatedRows, error: updateError } = await supabase
      .from('requests')
      .update({ status: nextStatus })
      .eq('id', requestId)
      .select('id');

    if (updateError) {
      logSupabaseError('Request status update failed', updateError);
      setError('לא ניתן לעדכן את הסטטוס כרגע. נסה שוב בעוד רגע.');
      return;
    }
    if (!didRowsUpdate(updatedRows)) {
      setError('לא ניתן לעדכן את הסטטוס — אין לך הרשאה לכך, או שהדרישה השתנתה. רענן ונסה שוב.');
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
    setSuccess('סטטוס הדרישה עודכן.');
    } catch (updateError) {
      logSupabaseError('Request status update failed unexpectedly', updateError);
      setError('לא ניתן לעדכן את הסטטוס כרגע. נסה שוב בעוד רגע.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const hasActiveFilters = searchText !== '' || filterCategory !== 'הכל' || filterPriority !== 'הכל';
  const handleAssigneeChange = async (request: DbRequest, value: string) => {
    if (!canSeeAll || !dbProfile || isRequestWritePending) return;
    const nextAssigneeId = value === 'none' ? null : value;
    const oldAssigneeId = request.assigned_to;
    setUpdatingAssigneeId(request.id);
    setError(null);
    setSuccess(null);

    try {
    const { data: updatedRows, error: updateError } = await supabase
      .from('requests')
      .update({ assigned_to: nextAssigneeId })
      .eq('id', request.id)
      .select('id');

    if (updateError) {
      logSupabaseError('Request assignee update failed', updateError);
      setError('לא ניתן לעדכן מטפל לדרישה');
      return;
    }
    if (!didRowsUpdate(updatedRows)) {
      setError('לא ניתן לעדכן מטפל לדרישה — אין לך הרשאה לכך, או שהדרישה השתנתה. רענן ונסה שוב.');
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
    } catch (updateError) {
      logSupabaseError('Request assignee update failed unexpectedly', updateError);
      setError('לא ניתן לעדכן מטפל לדרישה');
    } finally {
      setUpdatingAssigneeId(null);
    }
  };

  const canDeleteRequest = (request: DbRequest) => {
    if (!dbProfile) return false;
    const isClosed = ['completed', 'rejected', 'cancelled'].includes(request.status);
    if (!isClosed) return false;
    return canSeeAll || request.requested_by === dbProfile.id;
  };

  const handleDeleteClosedRequest = async (request: DbRequest) => {
    if (!dbProfile || isRequestWritePending || !canDeleteRequest(request)) return;
    setConfirmDeleteRequest(null);

    setDeletingRequestId(request.id);
    setError(null);
    setSuccess(null);

    try {
    const { error: deleteError } = await supabase
      .from('requests')
      .delete()
      .eq('id', request.id);

    if (deleteError) {
      logSupabaseError('Request delete failed', deleteError);
      setError('לא ניתן למחוק את הדרישה. בדוק שיש לך הרשאה למחוק דרישה זו.');
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
    } catch (deleteError) {
      logSupabaseError('Request delete failed unexpectedly', deleteError);
      setError('לא ניתן למחוק את הדרישה. בדוק שיש לך הרשאה למחוק דרישה זו.');
    } finally {
      setDeletingRequestId(null);
    }
  };

  const loadComments = async (requestId: string) => {
    if (loadingCommentsId) return;
    setLoadingCommentsId(requestId);
    setCommentErrors(current => ({ ...current, [requestId]: null }));

    try {
    const { data, error: commentsError } = await supabase
      .from('comments')
      .select('id,entity_type,entity_id,user_id,body,metadata,created_at,updated_at,users:user_id(name,email,role)')
      .eq('entity_type', 'request')
      .eq('entity_id', requestId)
      .order('created_at', { ascending: true })
      .returns<DbComment[]>();

    if (commentsError) {
      logSupabaseError('Request comments load failed', commentsError);
      setCommentErrors(current => ({ ...current, [requestId]: 'לא ניתן לטעון את היסטוריית הטיפול' }));
      return;
    }

    setCommentsByRequest(current => ({ ...current, [requestId]: data ?? [] }));
    } catch (commentsError) {
      logSupabaseError('Request comments load failed unexpectedly', commentsError);
      setCommentErrors(current => ({ ...current, [requestId]: 'לא ניתן לטעון את היסטוריית הטיפול' }));
    } finally {
      setLoadingCommentsId(null);
    }
  };

  const toggleComments = async (requestId: string) => {
    if (loadingCommentsId) return;
    const nextOpen = !openComments[requestId];
    setOpenComments(current => ({ ...current, [requestId]: nextOpen }));
    if (nextOpen && !commentsByRequest[requestId]) {
      await loadComments(requestId);
    }
  };

  const handleAddComment = async (request: DbRequest) => {
    if (!currentUser || !dbProfile || isRequestWritePending) return;
    const body = (commentDrafts[request.id] ?? '').trim();
    if (!body) {
      setCommentErrors(current => ({ ...current, [request.id]: 'יש לכתוב עדכון טיפול לפני השליחה' }));
      return;
    }

    setSubmittingCommentId(request.id);
    setCommentErrors(current => ({ ...current, [request.id]: null }));
    setError(null);
    setSuccess(null);

    try {
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
    } catch (insertError) {
      logSupabaseError('Request comment insert failed unexpectedly', insertError);
      setCommentErrors(current => ({ ...current, [request.id]: 'לא ניתן להוסיף עדכון טיפול' }));
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const emptyText = getTabEmptyText(activeTab);

  if (isContextLoading || isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="פערים ודרישות" subtitle="מוקד פתיחה, תיעדוף וטיפול בדרישות ופערים מהשטח" />
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
        <PageHeader title="פערים ודרישות" subtitle="מוקד פתיחה, תיעדוף וטיפול בדרישות ופערים מהשטח" />
        <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldAlert className="mb-3 h-10 w-10 text-[var(--color-danger)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">לא נמצא פרופיל משתמש</h2>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
            יש להתחבר מחדש כדי לפתוח או לצפות בדרישות.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="פערים ודרישות"
        subtitle="מוקד פתיחה, תיעדוף וטיפול בדרישות ופערים מהשטח"
        actions={
          viewMode === 'requests' ? (
            <GlossyButton variant="orange" size="sm" onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4" />
              פתיחת דרישה חדשה
            </GlossyButton>
          ) : undefined
        }
      />

      <div className="flex items-center gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
        {([
          { id: 'requests', label: 'דרישות' },
          { id: 'gaps', label: 'פערים' },
        ] as const).map(mode => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={`touch-target flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition duration-150 ${
              viewMode === mode.id
                ? 'bg-[var(--action)] text-white shadow-[0_4px_12px_rgba(255,107,2,0.28)]'
                : 'text-[var(--text-muted-accessible)] hover:bg-[var(--action)]/10 hover:text-[var(--text-primary)]'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {viewMode === 'gaps' && <GapsPanel />}

      {viewMode === 'requests' && (
      <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="דרישות פתוחות" value={openCount} icon={Clock3} tone="brand" />
        <MetricCard label="דרישות דחופות" value={urgentCount} icon={AlertTriangle} tone="danger" />
        <MetricCard label="בטיפול" value={inProgressCount} icon={RefreshCw} tone="info" />
        <MetricCard label="הושלמו" value={completedCount} icon={CheckCircle2} tone="success" />
      </div>

      {/* New Request — side sheet (desktop) / bottom sheet (mobile) */}
      <CommandOverlay
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="פתיחת דרישה חדשה"
        description="פרטי הדרישה יישלחו למטפלים הרלוונטיים לפי קטגוריה."
        variant="sheet"
        footer={
          <>
            <CommandButton variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
              ביטול
            </CommandButton>
            <CommandButton
              type="submit"
              form="request-create-form"
              variant="primary"
              loading={isSubmitting}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              שמור דרישה
            </CommandButton>
          </>
        }
      >
        <form id="request-create-form" onSubmit={handleCreateRequest} className="space-y-4">
          <CommandInput
            label="כותרת"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="לדוגמה: השלמת ציוד קשר למחלקה"
            disabled={isSubmitting}
          />
          <CommandTextarea
            label="פירוט"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="פרט מה נדרש, למה, ועד מתי."
            disabled={isSubmitting}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CommandSelect label="קטגוריה" value={category} onChange={e => setCategory(e.target.value as RequestCategory)} disabled={isSubmitting}>
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </CommandSelect>
            <CommandSelect label="עדיפות" value={priority} onChange={e => setPriority(e.target.value as RequestPriority)} disabled={isSubmitting}>
              {priorities.map(item => <option key={item} value={item}>{item}</option>)}
            </CommandSelect>
          </div>
          <CommandSelect label="שייך למופע" value={selectedEventId} onChange={event => setSelectedEventId(event.target.value)} disabled={isSubmitting}>
            <option value="none">ללא שיוך</option>
            {eventOptions.map(event => (
              <option key={event.id} value={event.id}>
                {event.title} — {event.starts_at ? formatDateTime(event.starts_at) : 'ללא זמן'}
              </option>
            ))}
          </CommandSelect>
        </form>
      </CommandOverlay>

      {success && (
        <div className="rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-3 text-sm font-bold text-[var(--color-success)]">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm font-bold text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-1">
        {TABS.map(tab => {
          const count = tabCounts[tab.id] ?? 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`touch-target flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition duration-150 ${
                isActive
                  ? 'bg-[var(--action)] text-white shadow-[0_4px_12px_rgba(255,107,2,0.28)]'
                  : 'text-[var(--text-muted-accessible)] hover:bg-[var(--action)]/10 hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-caption leading-none font-semibold ${
                  isActive ? 'bg-[var(--tactical-glass)] text-white' : 'bg-[var(--surface-muted)] text-[var(--text-muted-accessible)]'
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--command-subtle)]" />
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
        <GlossyButton variant="slate" size="sm" onClick={() => void refreshProfile()} className="w-full sm:col-span-2 xl:col-span-1 xl:w-auto">
          <RefreshCw className="h-4 w-4" />
          רענון
        </GlossyButton>
      </div>

      {/* Request list */}
      {requestsTruncated && (
        <p role="status" className="rounded-[var(--radius-card)] border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-3 text-meta font-bold text-[var(--color-warning)]">
          {TRUNCATION_NOTICE}
        </p>
      )}

      {filteredRequests.length === 0 ? (
        <div className="py-8">
          {hasActiveFilters ? (
            <EmptyState
              icon={Search}
              title="לא נמצאו דרישות לפי הסינון"
              description="נסה לשנות את הסינון או לנקות את שדה החיפוש."
              actionText="נקה סינון"
              onAction={() => { setSearchText(''); setFilterCategory('הכל'); setFilterPriority('הכל'); }}
            />
          ) : (
            <EmptyState
              icon={Truck}
              title={emptyText.title}
              description={emptyText.description}
              actionText="פתח דרישה חדשה"
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
                      <span className={`rounded-full border px-2.5 py-0.5 text-caption font-bold ${priorityClass('request', requestPriority)}`}>
                        {requestPriority}
                      </span>
                      <span className="rounded-full border border-[var(--action)]/20 bg-[var(--action)]/10 px-2.5 py-0.5 text-caption font-bold text-[var(--color-action-on-surface)]">
                        {requestCategory}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{request.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
                      {request.description || 'לא נוסף פירוט לדרישה.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-bold text-[var(--command-subtle)]">{formatDate(request.created_at)}</span>
                    {request.updated_at !== request.created_at && (
                      <span className="text-caption font-semibold text-[var(--command-subtle)]">עודכן: {formatDate(request.updated_at)}</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 border-t border-[var(--border-subtle)] pt-3 text-xs font-bold text-[var(--text-muted-accessible)] sm:grid-cols-2 lg:grid-cols-4">
                  <span>יוצר: <strong className="text-[var(--text-primary)]">{metadata.creator_name || 'לא ידוע'}</strong></span>
                  <span>תפקיד: <strong className="text-[var(--text-primary)]">{metadata.creator_role || 'לא ידוע'}</strong></span>
                  <span>יחידה: <strong className="text-[var(--text-primary)]">{metadata.creator_unit || 'לא ידוע'}</strong></span>
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 shrink-0" />
                    מטפל: <strong className="text-[var(--text-primary)]">
                      {request.assigneeName ? `${request.assigneeName}${request.assigneeRole ? ` · ${request.assigneeRole}` : ''}` : 'טרם הוקצה'}
                    </strong>
                  </span>
                </div>

                {request.event_id && request.eventTitle && (
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--action)]/15 bg-[var(--action)]/8 px-3 py-2 text-xs font-bold text-[var(--color-action-on-surface)]">
                    <Clock3 className="h-4 w-4" />
                    <span>מופע: {request.eventTitle}{request.eventTimeLabel ? ` · ${request.eventTimeLabel}` : ''}</span>
                  </div>
                )}

                {canSeeAll && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-3 sm:flex-row sm:items-center">
                    <span className="shrink-0 text-caption font-semibold text-[var(--command-subtle)]">שיוך מטפל</span>
                    <select
                      value={request.assigned_to ?? 'none'}
                      onChange={event => handleAssigneeChange(request, event.target.value)}
                      className="touch-target command-select min-h-10 flex-1 text-xs"
                      disabled={isRequestWritePending || (assigneeUsers.length === 0 && !request.assigned_to)}
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
                    {isUpdatingAssignee && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-action-on-surface)]" />}
                    {assigneeLoadError && (
                      <span className="text-caption font-bold text-[var(--color-danger)]">{assigneeLoadError}</span>
                    )}
                  </div>
                )}

                {canUpdate && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {showActionButtons ? (
                      <>
                        <span className="text-caption font-semibold text-[var(--command-subtle)]">פעולות</span>
                        {actions.map(action => (
                          <GlossyButton
                            key={action.nextStatus}
                            variant={action.tone}
                            size="sm"
                            onClick={() => handleStatusChange(request.id, action.nextStatus)}
                            disabled={isRequestWritePending}
                          >
                            {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                            {action.label}
                          </GlossyButton>
                        ))}
                      </>
                    ) : (
                      <>
                        <span className="text-caption font-semibold text-[var(--command-subtle)]">עדכון סטטוס</span>
                        <select
                          value={request.status}
                          onChange={e => handleStatusChange(request.id, e.target.value as RequestStatus)}
                          className="touch-target command-select min-h-10 max-w-xs text-xs"
                          disabled={isRequestWritePending}
                        >
                          {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                        </select>
                        {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-action-on-surface)]" />}
                      </>
                    )}
                  </div>
                )}

                {(canEdit || canDeleteClosed) && (
                  <div className="flex flex-wrap justify-start gap-2 border-t border-[var(--border-subtle)] pt-3">
                    {canEdit && (
                      <GlossyButton
                        type="button"
                        variant="slate"
                        size="sm"
                        onClick={() => openEditRequest(request)}
                        disabled={isRequestWritePending}
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
                      onClick={() => setConfirmDeleteRequest(request)}
                      disabled={isRequestWritePending}
                      className="text-[var(--color-danger)] hover:border-[var(--color-danger)]/25 hover:bg-[var(--color-danger)]/10"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      מחק
                    </GlossyButton>
                    )}
                  </div>
                )}

                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <button
                    type="button"
                    onClick={() => toggleComments(request.id)}
                    disabled={Boolean(loadingCommentsId)}
                    className="touch-target inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--tactical-glass)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition duration-150 hover:border-[var(--action)]/30 hover:bg-[var(--action)]/10"
                  >
                    <MessageSquareText className="h-4 w-4 text-[var(--color-action-on-surface)]" />
                    {isCommentsOpen ? 'הסתר היסטוריית טיפול' : 'הצג היסטוריית טיפול'}
                    {comments.length > 0 && (
                      <span className="rounded-full bg-[var(--action)]/12 px-2 py-0.5 text-caption text-[var(--color-action-on-surface)]">
                        {comments.length}
                      </span>
                    )}
                  </button>

                  {isCommentsOpen && (
                    <div className="mt-3 space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">היסטוריית טיפול</h4>
                        {isLoadingComments && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-action-on-surface)]" />}
                      </div>

                      {commentError && (
                        <div className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-xs font-bold text-[var(--color-danger)]">
                          {commentError}
                        </div>
                      )}

                      {!isLoadingComments && !commentError && comments.length === 0 && (
                        <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] px-3 py-3 text-xs font-bold text-[var(--text-muted-accessible)]">
                          אין עדיין עדכוני טיפול לדרישה זו
                        </p>
                      )}

                      {comments.length > 0 && (
                        <div className="space-y-2">
                          {comments.map(comment => {
                            const authorName = comment.metadata?.author_name || comment.users?.name || comment.users?.email || 'משתמש';
                            const authorRole = comment.metadata?.author_role || comment.users?.role;
                            return (
                              <div key={comment.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-3">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                                    {authorName}{authorRole ? ` · ${authorRole}` : ''}
                                  </span>
                                  <span className="text-caption font-bold text-[var(--command-subtle)]">{formatDateTime(comment.created_at)}</span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
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
                          disabled={isRequestWritePending}
                        />
                        <FieldPrivacyHint />
                        <div className="flex justify-end">
                          <GlossyButton
                            type="button"
                            variant="orange"
                            size="sm"
                            onClick={() => handleAddComment(request)}
                            disabled={isRequestWritePending}
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

      <CommandOverlay
        open={Boolean(editingRequest)}
        onClose={closeEditRequest}
        title="עריכת דרישה"
        description="עדכון פרטי הדרישה בלי לשנות סטטוס, מטפל או היסטוריית טיפול."
        variant="sheet"
        dismissible={!isEditSubmitting}
        footer={
          <>
            <CommandButton variant="ghost" onClick={closeEditRequest} disabled={isEditSubmitting}>
              ביטול
            </CommandButton>
            <CommandButton
              type="submit"
              form="request-edit-form"
              variant="primary"
              loading={isEditSubmitting}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              שמור שינויים
            </CommandButton>
          </>
        }
      >
        {editingRequest && (
          <form id="request-edit-form" onSubmit={handleEditRequest} className="space-y-4">
            {editError && (
              <div className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3.5 py-2.5 text-sm font-bold text-[var(--color-danger)]" role="alert">
                {editError}
              </div>
            )}
            <CommandInput label="כותרת" required value={editTitle} onChange={event => setEditTitle(event.target.value)} disabled={isEditSubmitting} />
            <CommandTextarea label="פירוט" value={editDescription} onChange={event => setEditDescription(event.target.value)} disabled={isEditSubmitting} />
            <div className="grid gap-4 sm:grid-cols-2">
              <CommandSelect label="קטגוריה" value={editCategory} onChange={event => setEditCategory(event.target.value as RequestCategory)} disabled={isEditSubmitting}>
                {categories.map(item => <option key={item} value={item}>{item}</option>)}
              </CommandSelect>
              <CommandSelect label="עדיפות" value={editPriority} onChange={event => setEditPriority(event.target.value as RequestPriority)} disabled={isEditSubmitting}>
                {priorities.map(item => <option key={item} value={item}>{item}</option>)}
              </CommandSelect>
            </div>
            <CommandSelect label="שייך למופע" value={editEventId} onChange={event => setEditEventId(event.target.value)} disabled={isEditSubmitting}>
              <option value="none">ללא שיוך</option>
              {editingRequest.event_id && !eventOptions.some(event => event.id === editingRequest.event_id) && (
                <option value={editingRequest.event_id}>מופע נוכחי</option>
              )}
              {eventOptions.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title} — {event.starts_at ? formatDateTime(event.starts_at) : 'ללא זמן'}
                </option>
              ))}
            </CommandSelect>
          </form>
        )}
      </CommandOverlay>

      <CommandConfirmDialog
        open={Boolean(confirmDeleteRequest)}
        onCancel={() => setConfirmDeleteRequest(null)}
        onConfirm={() => confirmDeleteRequest && handleDeleteClosedRequest(confirmDeleteRequest)}
        title="מחיקת דרישה סגורה"
        description={`למחוק לצמיתות את הדרישה "${confirmDeleteRequest?.title ?? ''}"? לא ניתן לשחזר פעולה זו.`}
        confirmLabel="מחק דרישה"
        destructive
        loading={Boolean(deletingRequestId)}
      />
      </>
      )}
    </div>
  );
}
