'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Loader2, Plus, Search, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MetricCard } from '@/components/ui/MetricCard';
import { CommandOverlay, CommandConfirmDialog } from '@/components/ui/CommandDialog';
import { CommandButton } from '@/components/ui/CommandButton';
import { CommandInput, CommandSelect, CommandTextarea } from '@/components/ui/CommandField';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { hasCompanyWideUiAccess } from '@/lib/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';

type GapCategory = 'לוגיסטי' | 'הדרכתי' | 'לו"זי';
type GapUrgency = 'רגיל' | 'חשוב' | 'דחוף' | 'קריטי';
type GapStatus = 'פתוח' | 'בטיפול' | 'ממתין לאישור' | 'נסגר';

type DbGap = {
  id: string;
  title: string;
  description: string | null;
  category: GapCategory;
  reported_by: string | null;
  unit_id: string | null;
  urgency: GapUrgency;
  status: GapStatus;
  handler_id: string | null;
  requires_commander_decision: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  reporterName: string | null;
  unitName: string | null;
};

const CATEGORIES: GapCategory[] = ['לוגיסטי', 'הדרכתי', 'לו"זי'];
const URGENCIES: GapUrgency[] = ['רגיל', 'חשוב', 'דחוף', 'קריטי'];
const STATUSES: GapStatus[] = ['פתוח', 'בטיפול', 'ממתין לאישור', 'נסגר'];

const ROUTING: Record<GapCategory, string> = {
  לוגיסטי: 'רס״פ / לוגיסטיקה / סמ״פ',
  הדרכתי: 'מ״מ / סמ״פ / מ״פ',
  'לו"זי': 'סמ״פ / מ״פ',
};

const urgencyStyles: Record<GapUrgency, string> = {
  רגיל: 'border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)]',
  חשוב: 'border-sky-400/25 bg-sky-400/10 text-sky-700',
  דחוף: 'border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  קריטי: 'border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function GapsPanel() {
  const { currentUser } = useApp();
  const [gaps, setGaps] = useState<DbGap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWritePending, setIsWritePending] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<GapCategory | 'הכל'>('הכל');
  const [searchText, setSearchText] = useState('');
  const [confirmConvert, setConfirmConvert] = useState<DbGap | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GapCategory>('לוגיסטי');
  const [urgency, setUrgency] = useState<GapUrgency>('חשוב');
  const [requiresDecision, setRequiresDecision] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const permissionLevel = currentUser?.permission_level ?? 0;
  const canSeeAll = Boolean(currentUser && hasCompanyWideUiAccess(currentUser.role, permissionLevel));

  const loadGaps = async () => {
    if (!currentUser) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: gapsError } = await supabase
        .from('gaps')
        .select('id,title,description,category,reported_by,unit_id,urgency,status,handler_id,requires_commander_decision,notes,created_by,created_at,updated_at')
        .order('created_at', { ascending: false });

      if (gapsError) {
        logSupabaseError('Gaps load failed', gapsError);
        setError('לא ניתן לטעון את הפערים כרגע. נסה לרענן בעוד רגע.');
        return;
      }

      const rows = data ?? [];
      const userIds = [...new Set(rows.map(g => g.created_by).filter((id): id is string => Boolean(id)))];
      const unitIds = [...new Set(rows.map(g => g.unit_id).filter((id): id is string => Boolean(id)))];

      const [{ data: usersData }, { data: unitsData }] = await Promise.all([
        userIds.length
          ? supabase.from('users').select('id,name,email').in('id', userIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; email: string }> }),
        unitIds.length
          ? supabase.from('units').select('id,name').in('id', unitIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      ]);

      const nameById = new Map((usersData ?? []).map(u => [u.id, u.name || u.email]));
      const unitById = new Map((unitsData ?? []).map(u => [u.id, u.name]));

      setGaps(rows.map(g => ({
        ...g,
        reporterName: g.created_by ? nameById.get(g.created_by) ?? null : null,
        unitName: g.unit_id ? unitById.get(g.unit_id) ?? null : null,
      })));
    } catch (loadError) {
      logSupabaseError('Gaps load failed unexpectedly', loadError);
      setError('לא ניתן לטעון את הפערים כרגע. נסה לרענן בעוד רגע.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('לוגיסטי');
    setUrgency('חשוב');
    setRequiresDecision(false);
  };

  const handleCreateGap = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isWritePending || !currentUser) return;
    setIsSubmitting(true);
    setIsWritePending(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: created, error: insertError } = await supabase
        .from('gaps')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          category,
          urgency,
          status: 'פתוח',
          requires_commander_decision: requiresDecision,
          created_by: currentUser.id,
          reported_by: currentUser.id,
          unit_id: currentUser.unit_id,
        })
        .select('id,title,status')
        .single<{ id: string; title: string; status: string }>();

      if (insertError || !created) {
        logSupabaseError('Gap create failed', insertError);
        setError('לא הצלחנו לפתוח את הפער. נסה שוב בעוד רגע.');
        return;
      }

      void createAuditLog(supabase, {
        userId: currentUser.id,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'gap_created',
        entityType: 'gap',
        entityId: created.id,
        previousValue: null,
        newValue: { title: created.title, status: created.status },
      });

      resetForm();
      setIsFormOpen(false);
      setSuccess('הפער נפתח ונשמר במערכת.');
      await loadGaps();
    } catch (createError) {
      logSupabaseError('Gap create failed unexpectedly', createError);
      setError('לא הצלחנו לפתוח את הפער. נסה שוב בעוד רגע.');
    } finally {
      setIsSubmitting(false);
      setIsWritePending(false);
    }
  };

  const canEditGap = (gap: DbGap) => Boolean(currentUser && (canSeeAll || gap.created_by === currentUser.id));

  const handleStatusChange = async (gap: DbGap, nextStatus: GapStatus) => {
    if (isWritePending || !canEditGap(gap) || !currentUser) return;
    setIsWritePending(true);
    setError(null);

    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from('gaps')
        .update({ status: nextStatus })
        .eq('id', gap.id)
        .select('id');
      if (updateError) {
        logSupabaseError('Gap status update failed', updateError);
        setError('לא ניתן לעדכן את סטטוס הפער כרגע.');
        return;
      }
      if (!didRowsUpdate(updatedRows)) {
        setError('לא ניתן לעדכן את סטטוס הפער — אין לך הרשאה לכך, או שהפער השתנה. רענן ונסה שוב.');
        return;
      }
      void createAuditLog(supabase, {
        userId: currentUser.id,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'gap_status_changed',
        entityType: 'gap',
        entityId: gap.id,
        previousValue: { status: gap.status },
        newValue: { status: nextStatus },
      });
      setGaps(current => current.map(g => g.id === gap.id ? { ...g, status: nextStatus } : g));
    } catch (updateError) {
      logSupabaseError('Gap status update failed unexpectedly', updateError);
      setError('לא ניתן לעדכן את סטטוס הפער כרגע.');
    } finally {
      setIsWritePending(false);
    }
  };

  const handleConvertToRequest = async (gap: DbGap) => {
    if (isWritePending || !currentUser) return;
    setConfirmConvert(null);
    setIsWritePending(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase.from('requests').insert({
        title: gap.title,
        description: gap.description,
        status: 'open',
        request_type: 'לוגיסטיקה',
        requested_by: currentUser.id,
        unit_id: gap.unit_id,
        metadata: {
          category: 'לוגיסטיקה',
          priority: gap.urgency === 'קריטי' ? 'דחופה' : gap.urgency === 'דחוף' ? 'גבוהה' : 'רגילה',
          creator_name: currentUser.full_name,
          creator_role: currentUser.role,
          creator_unit: currentUser.assigned_frame,
          converted_from_gap_id: gap.id,
        },
      });

      if (insertError) {
        logSupabaseError('Gap to request conversion failed', insertError);
        setError('לא ניתן להמיר את הפער לדרישה כרגע.');
        return;
      }

      void createAuditLog(supabase, {
        userId: currentUser.id,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'gap_converted_to_request',
        entityType: 'gap',
        entityId: gap.id,
        previousValue: null,
        newValue: { title: gap.title },
      });

      setSuccess('הפער הומר לדרישה לוגיסטית — ניתן למצוא אותה בטאב "דרישות".');
    } catch (convertError) {
      logSupabaseError('Gap to request conversion failed unexpectedly', convertError);
      setError('לא ניתן להמיר את הפער לדרישה כרגע.');
    } finally {
      setIsWritePending(false);
    }
  };

  const filteredGaps = useMemo(() => {
    return gaps.filter(gap => {
      if (categoryFilter !== 'הכל' && gap.category !== categoryFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!gap.title.toLowerCase().includes(q) && !(gap.description ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [gaps, categoryFilter, searchText]);

  const openCount = gaps.filter(g => g.status !== 'נסגר').length;
  const criticalCount = gaps.filter(g => g.urgency === 'קריטי' && g.status !== 'נסגר').length;
  const decisionCount = gaps.filter(g => g.requires_commander_decision && g.status !== 'נסגר').length;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
        <ShieldAlert className="mb-3 h-10 w-10 text-[var(--color-danger)]" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">לא נמצא פרופיל משתמש</h2>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--text-muted-accessible)]">
          פערים אינם בהכרח משימות — פער לוגיסטי ניתן להמיר לדרישה בלחיצה אחת.
        </p>
        <GlossyButton variant="orange" size="sm" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          פתיחת פער חדש
        </GlossyButton>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <MetricCard label="פערים פתוחים" value={openCount} icon={AlertTriangle} tone="brand" />
        <MetricCard label="פערים קריטיים" value={criticalCount} icon={AlertTriangle} tone="danger" />
        <MetricCard label="דורשים החלטת מ״פ" value={decisionCount} icon={ShieldAlert} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CATEGORIES.map(c => {
          const count = gaps.filter(g => g.category === c && g.status !== 'נסגר').length;
          const isActive = categoryFilter === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(isActive ? 'הכל' : c)}
              className={`rounded-2xl border p-4 text-right transition duration-150 ${
                isActive ? 'border-[var(--action)] shadow-[0_4px_16px_rgba(255,107,2,0.18)]' : 'border-[var(--border-subtle)] hover:border-[var(--action)]/40'
              } bg-[var(--surface)]`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-[var(--action)]/20 bg-[var(--action)]/10 px-2.5 py-0.5 text-caption font-bold text-[var(--color-action-on-surface)]">{c}</span>
                <span className="font-mono text-xl font-semibold text-[var(--text-primary)]">{count}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-caption font-bold text-[var(--text-muted-accessible)]">
                <ArrowLeftRight className="h-3 w-3" />
                ניתוב: {ROUTING[c]}
              </div>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--command-subtle)]" />
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="command-input pl-10 pr-4"
          placeholder="חיפוש פער…"
        />
      </div>

      {success && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700">{success}</div>
      )}
      {error && (
        <div className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm font-bold text-[var(--color-danger)]">{error}</div>
      )}

      {filteredGaps.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="אין פערים להצגה"
          description="לא נמצאו פערים לפי הסינון הנוכחי."
          actionText="פתח פער חדש"
          onAction={() => setIsFormOpen(true)}
        />
      ) : (
        <div className="grid gap-3">
          {filteredGaps.map(gap => {
            const canEdit = canEditGap(gap);
            return (
              <GlassCard key={gap.id} className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={gap.status} />
                      <span className={`rounded-full border px-2.5 py-0.5 text-caption font-bold ${urgencyStyles[gap.urgency]}`}>{gap.urgency}</span>
                      <span className="rounded-full border border-[var(--action)]/20 bg-[var(--action)]/10 px-2.5 py-0.5 text-caption font-bold text-[var(--color-action-on-surface)]">{gap.category}</span>
                      {gap.requires_commander_decision && (
                        <span className="rounded-full border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-2.5 py-0.5 text-caption font-bold text-[var(--color-danger)]">
                          דורש החלטת מ״פ
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">{gap.title}</h3>
                    {gap.description && (
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-[var(--text-muted-accessible)]">{gap.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[var(--command-subtle)]">{formatDate(gap.created_at)}</span>
                </div>

                <div className="grid gap-2 border-t border-[rgba(2,1,8,0.08)] pt-3 text-xs font-bold text-[var(--text-muted-accessible)] sm:grid-cols-2">
                  <span>דווח על ידי: <strong className="text-[var(--text-primary)]">{gap.reporterName || 'לא ידוע'}</strong></span>
                  <span>מסגרת: <strong className="text-[var(--text-primary)]">{gap.unitName || 'לא ידוע'}</strong></span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {gap.category === 'לוגיסטי' && gap.status !== 'נסגר' && (
                    <GlossyButton variant="slate" size="sm" onClick={() => setConfirmConvert(gap)} disabled={isWritePending}>
                      <ArrowLeftRight className="h-4 w-4" />
                      המר לדרישה
                    </GlossyButton>
                  )}
                  {canEdit && (
                    <>
                      <span className="text-caption font-semibold text-[var(--command-subtle)]">עדכון סטטוס</span>
                      <select
                        value={gap.status}
                        onChange={e => handleStatusChange(gap, e.target.value as GapStatus)}
                        className="command-select min-h-10 max-w-xs text-xs"
                        disabled={isWritePending}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <CommandOverlay
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="פתיחת פער חדש"
        description="פער אינו בהכרח משימה — חלקם יהפכו למשימות או דרישות בהמשך."
        variant="sheet"
        footer={
          <>
            <CommandButton variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>ביטול</CommandButton>
            <CommandButton type="submit" form="gap-create-form" variant="primary" loading={isSubmitting}>שמור פער</CommandButton>
          </>
        }
      >
        <form id="gap-create-form" onSubmit={handleCreateGap} className="space-y-4">
          <CommandInput label="כותרת" required value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting} />
          <CommandTextarea label="תיאור" value={description} onChange={e => setDescription(e.target.value)} disabled={isSubmitting} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CommandSelect label="קטגוריה" value={category} onChange={e => setCategory(e.target.value as GapCategory)} disabled={isSubmitting}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </CommandSelect>
            <CommandSelect label="דחיפות" value={urgency} onChange={e => setUrgency(e.target.value as GapUrgency)} disabled={isSubmitting}>
              {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
            </CommandSelect>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
            <input type="checkbox" checked={requiresDecision} onChange={e => setRequiresDecision(e.target.checked)} className="h-4 w-4" disabled={isSubmitting} />
            דורש החלטת מ״פ
          </label>
        </form>
      </CommandOverlay>

      <CommandConfirmDialog
        open={Boolean(confirmConvert)}
        onCancel={() => setConfirmConvert(null)}
        onConfirm={() => confirmConvert && handleConvertToRequest(confirmConvert)}
        title="המרת פער לדרישה"
        description={`להמיר את הפער "${confirmConvert?.title ?? ''}" לדרישה לוגיסטית פורמלית?`}
        confirmLabel="המר לדרישה"
        loading={isWritePending}
      />
    </div>
  );
}
