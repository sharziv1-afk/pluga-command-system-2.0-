'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApp } from '@/lib/context/AppContext';
import { getPermissionLevelForRole } from '@/lib/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type RequestStatus = 'open' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled';
type RequestCategory = 'לוגיסטיקה' | 'רפואה' | 'קשר' | 'רכב' | 'כוח אדם' | 'אחר';
type RequestPriority = 'נמוכה' | 'רגילה' | 'גבוהה' | 'דחופה';

type DbProfile = {
  id: string;
  name: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  units: { name: string } | null;
};

type RequestMetadata = {
  category?: RequestCategory;
  priority?: RequestPriority;
  creator_name?: string;
  creator_role?: string;
  creator_unit?: string;
};

type DbRequest = {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  request_type: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  unit_id: string | null;
  metadata: RequestMetadata | null;
  created_at: string;
  updated_at: string;
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

function normalizeRole(role: string) {
  return role.replace(/[״׳´"]/g, '"');
}

function isCommanderRole(role: string, permissionLevel: number) {
  const normalizedRole = normalizeRole(role);

  return permissionLevel >= 90 || normalizedRole.includes('מ"פ') || normalizedRole.includes('סמ"פ');
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

function logSupabaseError(message: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  if (process.env.NODE_ENV !== 'development') return;

  console.error(message, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export default function RequestsPage() {
  const { currentUser, isLoading: isContextLoading } = useApp();
  const [dbProfile, setDbProfile] = useState<DbProfile | null>(null);
  const [requests, setRequests] = useState<DbRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RequestCategory>('לוגיסטיקה');
  const [priority, setPriority] = useState<RequestPriority>('רגילה');

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && isCommanderRole(dbProfile?.role ?? currentUser.role, profilePermissionLevel));
  const categoryAccess = professionalCategories(dbProfile?.role ?? currentUser?.role ?? '');

  const loadRequests = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

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

      const { data: requestData, error: requestsError } = await supabase
        .from('requests')
        .select('id,title,description,status,request_type,requested_by,assigned_to,unit_id,metadata,created_at,updated_at')
        .order('created_at', { ascending: false })
        .returns<DbRequest[]>();

      if (requestsError) {
        logSupabaseError('Requests load failed', requestsError);
        setError('לא ניתן לטעון בקשות. ייתכן שנדרשת מדיניות RLS מתאימה ב-Supabase.');
        return;
      }

      setRequests(requestData ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isContextLoading) {
      loadRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContextLoading, currentUser?.id]);

  const visibleRequests = useMemo(() => {
    if (!dbProfile || !currentUser) return [];

    return requests.filter((request) => {
      if (canSeeAll) return true;
      if (request.requested_by === currentUser.id) return true;
      if (dbProfile.unit_id && request.unit_id === dbProfile.unit_id) return true;
      if (categoryAccess.includes(getRequestCategory(request))) return true;

      return false;
    });
  }, [canSeeAll, categoryAccess, currentUser, dbProfile, requests]);

  const openRequestsCount = visibleRequests.filter((request) => request.status === 'open' || request.status === 'in_progress').length;
  const urgentRequestsCount = visibleRequests.filter((request) => getRequestPriority(request) === 'דחופה').length;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('לוגיסטיקה');
    setPriority('רגילה');
  };

  const handleCreateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser || !dbProfile) {
      setError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
      return;
    }

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

    const { error: insertError } = await supabase
      .from('requests')
      .insert({
        title: title.trim(),
        description: description.trim(),
        status: 'open',
        request_type: category,
        requested_by: currentUser.id,
        unit_id: dbProfile.unit_id,
        metadata,
      });

    setIsSubmitting(false);

    if (insertError) {
      logSupabaseError('Request create failed', insertError);
      setError('לא הצלחנו לפתוח בקשה. אם זו שגיאת הרשאות, יש לעדכן RLS ב-Supabase.');
      return;
    }

    resetForm();
    setIsFormOpen(false);
    setSuccess('הבקשה נפתחה ונשמרה במערכת.');
    await loadRequests();
  };

  const canUpdateRequestStatus = (request: DbRequest) => {
    if (!currentUser) return false;
    if (canSeeAll) return true;
    return categoryAccess.includes(getRequestCategory(request));
  };

  const handleStatusChange = async (requestId: string, nextStatus: RequestStatus) => {
    setUpdatingStatusId(requestId);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from('requests')
      .update({ status: nextStatus })
      .eq('id', requestId);

    setUpdatingStatusId(null);

    if (updateError) {
      logSupabaseError('Request status update failed', updateError);
      setError('לא ניתן לעדכן סטטוס. ייתכן שנדרשת מדיניות RLS מתאימה ב-Supabase.');
      return;
    }

    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId ? { ...request, status: nextStatus } : request
      )
    );
    setSuccess('סטטוס הבקשה עודכן.');
  };

  if (isContextLoading || isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="דרישות ובקשות" subtitle="פתיחה, מעקב וטיפול בבקשות מהשטח" />
        <div className="grid gap-4 md:grid-cols-3">
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
        <PageHeader title="דרישות ובקשות" subtitle="פתיחה, מעקב וטיפול בבקשות מהשטח" />
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
        subtitle="פתיחה, מעקב וטיפול בבקשות מהשטח"
        actions={
          <GlossyButton variant="orange" size="sm" onClick={() => setIsFormOpen((value) => !value)}>
            <Plus className="h-4 w-4" />
            פתיחת בקשה חדשה
          </GlossyButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="min-h-28">
          <span className="text-xs font-black text-[#667085]">בקשות פתוחות</span>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-3xl font-black text-[#020108]">{openRequestsCount}</span>
            <Clock3 className="h-7 w-7 text-[#FF6B02]" />
          </div>
        </GlassCard>
        <GlassCard className="min-h-28">
          <span className="text-xs font-black text-[#667085]">בקשות דחופות</span>
          <div className="mt-2 flex items-end justify-between gap-3">
            <span className="text-3xl font-black text-[#020108]">{urgentRequestsCount}</span>
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
        </GlassCard>
        <GlassCard className="min-h-28">
          <span className="text-xs font-black text-[#667085]">טווח תצוגה</span>
          <p className="mt-3 text-sm font-black text-[#020108]">
            {canSeeAll ? 'כל הבקשות' : categoryAccess.length ? `בקשות שלי + ${categoryAccess.join(', ')}` : 'הבקשות שלי והיחידה שלי'}
          </p>
        </GlassCard>
      </div>

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
                onChange={(event) => setTitle(event.target.value)}
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
                onChange={(event) => setDescription(event.target.value)}
                className="command-input min-h-28 resize-none"
                placeholder="פרט מה נדרש, למה, ועד מתי."
                disabled={isSubmitting}
              />
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">קטגוריה</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as RequestCategory)}
                className="command-select"
                disabled={isSubmitting}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">עדיפות</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as RequestPriority)}
                className="command-select"
                disabled={isSubmitting}
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2 lg:col-span-2 sm:flex-row">
              <GlossyButton type="submit" variant="orange" size="lg" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                שמור בקשה
              </GlossyButton>
              <GlossyButton
                type="button"
                variant="slate"
                size="lg"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting}
                className="flex-1"
              >
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

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-[#020108]">רשימת בקשות</h2>
        <GlossyButton variant="slate" size="sm" onClick={loadRequests}>
          <RefreshCw className="h-4 w-4" />
          רענון
        </GlossyButton>
      </div>

      {visibleRequests.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={Truck}
            title="אין עדיין בקשות פתוחות"
            description="אין עדיין בקשות פתוחות. ניתן לפתוח בקשה חדשה."
            actionText="פתח בקשה חדשה"
            onAction={() => setIsFormOpen(true)}
          />
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleRequests.map((request) => {
            const requestCategory = getRequestCategory(request);
            const requestPriority = getRequestPriority(request);
            const metadata = request.metadata ?? {};

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

                  <span className="shrink-0 text-xs font-bold text-[#98A2B3]">{formatDate(request.created_at)}</span>
                </div>

                <div className="grid gap-2 border-t border-[rgba(2,1,8,0.08)] pt-3 text-xs font-bold text-[#667085] sm:grid-cols-3">
                  <span>יוצר: <strong className="text-[#020108]">{metadata.creator_name || 'לא ידוע'}</strong></span>
                  <span>תפקיד: <strong className="text-[#020108]">{metadata.creator_role || 'לא ידוע'}</strong></span>
                  <span>יחידה: <strong className="text-[#020108]">{metadata.creator_unit || 'לא ידוע'}</strong></span>
                </div>

                {canUpdateRequestStatus(request) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black text-[#98A2B3]">עדכון סטטוס</span>
                    <select
                      value={request.status}
                      onChange={(event) => handleStatusChange(request.id, event.target.value as RequestStatus)}
                      className="command-select min-h-10 max-w-xs text-xs"
                      disabled={updatingStatusId === request.id}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{statusLabels[status]}</option>
                      ))}
                    </select>
                    {updatingStatusId === request.id && <Loader2 className="h-4 w-4 animate-spin text-[#FF6B02]" />}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
