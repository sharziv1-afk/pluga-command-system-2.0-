'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ClipboardCheck, GraduationCap, ListChecks, ShieldAlert, Sparkles, Users2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { MetricCard } from '@/components/ui/MetricCard';
import { FieldPrivacyHint } from '@/components/ui/FieldPrivacyHint';
import { CommandOverlay } from '@/components/ui/CommandDialog';
import { CommandButton } from '@/components/ui/CommandButton';
import { CommandInput, CommandTextarea } from '@/components/ui/CommandField';
import { createAuditLog } from '@/lib/audit';
import { useApp } from '@/lib/context/AppContext';
import { isCompanyCommander, normalizeRole } from '@/lib/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { formatDate } from '@/lib/datetime';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';

type Mentee = {
  id: string;
  name: string;
  role: string;
  unitName: string | null;
};

type MentoringEntry = {
  id: string;
  mentee_user_id: string;
  occurred_on: string;
  observation: string | null;
  focus: string;
  agreed_action: string;
  next_check_at: string | null;
  task_id: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function MentoringPanel() {
  const { currentUser } = useApp();
  const isCommanderOnly = Boolean(currentUser && isCompanyCommander(currentUser.role));

  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [entries, setEntries] = useState<MentoringEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWritePending, setIsWritePending] = useState(false);

  const [occurredOn, setOccurredOn] = useState(today());
  const [observation, setObservation] = useState('');
  const [focus, setFocus] = useState('');
  const [agreedAction, setAgreedAction] = useState('');
  const [nextCheckAt, setNextCheckAt] = useState('');

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loadData = async () => {
    if (!currentUser || !isCommanderOnly) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id,name,role,unit_id,status,role_approval_status')
        .eq('status', 'active')
        .eq('role_approval_status', 'approved');

      if (usersError) {
        logSupabaseError('Mentoring: users load failed', usersError);
        setError('לא ניתן לטעון את רשימת המ״מים כרגע.');
        return;
      }

      const menteeRows = (users ?? []).filter(u => {
        const role = normalizeRole(u.role);
        return role.startsWith('מ"מ') || role === 'סמ"פ';
      });
      const unitIds = [...new Set(menteeRows.map(u => u.unit_id).filter((id): id is string => Boolean(id)))];
      const { data: unitsData } = unitIds.length
        ? await supabase.from('units').select('id,name').in('id', unitIds)
        : { data: [] as Array<{ id: string; name: string }> };
      const unitById = new Map((unitsData ?? []).map(u => [u.id, u.name]));

      const nextMentees = menteeRows
        .map(u => ({ id: u.id, name: u.name, role: u.role, unitName: u.unit_id ? unitById.get(u.unit_id) ?? null : null }))
        .sort((a, b) => a.role.localeCompare(b.role, 'he'));
      setMentees(nextMentees);

      const menteeIds = nextMentees.map(m => m.id);
      const { data: entriesData, error: entriesError } = menteeIds.length
        ? await supabase
            .from('mentoring_entries')
            .select('id,mentee_user_id,occurred_on,observation,focus,agreed_action,next_check_at,task_id')
            .in('mentee_user_id', menteeIds)
            .order('occurred_on', { ascending: false })
        : { data: [] as MentoringEntry[], error: null };

      if (entriesError) {
        logSupabaseError('Mentoring: entries load failed', entriesError);
        setError('לא ניתן לטעון את יומני החניכה כרגע.');
        return;
      }

      setEntries(entriesData ?? []);
    } catch (loadError) {
      logSupabaseError('Mentoring: load failed unexpectedly', loadError);
      setError('לא ניתן לטעון את מסך החניכה כרגע. נסה לרענן בעוד רגע.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isCommanderOnly]);

  const resetForm = () => {
    setOccurredOn(today());
    setObservation('');
    setFocus('');
    setAgreedAction('');
    setNextCheckAt('');
  };

  const openFormFor = (menteeId: string) => {
    setSelectedMenteeId(menteeId);
    resetForm();
    setIsFormOpen(true);
  };

  const entriesByMentee = useMemo(() => {
    const map = new Map<string, MentoringEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.mentee_user_id);
      if (list) list.push(entry);
      else map.set(entry.mentee_user_id, [entry]);
    }
    for (const list of map.values()) list.sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
    return map;
  }, [entries]);

  const entriesFor = (menteeId: string) => entriesByMentee.get(menteeId) ?? [];

  const handleSaveEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isWritePending || !currentUser || !selectedMenteeId) return;
    if (!focus.trim() || !agreedAction.trim()) return;

    setIsSubmitting(true);
    setIsWritePending(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: created, error: insertError } = await supabase
        .from('mentoring_entries')
        .insert({
          mentee_user_id: selectedMenteeId,
          created_by: currentUser.id,
          occurred_on: occurredOn || today(),
          observation: observation.trim() || null,
          focus: focus.trim(),
          agreed_action: agreedAction.trim(),
          next_check_at: nextCheckAt || null,
        })
        .select('id')
        .single<{ id: string }>();

      if (insertError || !created) {
        logSupabaseError('Mentoring entry create failed', insertError);
        setError('לא הצלחנו לשמור את שיחת החניכה. נסה שוב בעוד רגע.');
        return;
      }

      void createAuditLog(supabase, {
        userId: currentUser.id,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'mentoring_entry_created',
        entityType: 'mentoring_entry',
        entityId: created.id,
        previousValue: null,
        newValue: { mentee_user_id: selectedMenteeId, focus: focus.trim() },
      });

      setIsFormOpen(false);
      resetForm();
      setSuccess('שיחת החניכה נשמרה.');
      await loadData();
    } catch (createError) {
      logSupabaseError('Mentoring entry create failed unexpectedly', createError);
      setError('לא הצלחנו לשמור את שיחת החניכה. נסה שוב בעוד רגע.');
    } finally {
      setIsSubmitting(false);
      setIsWritePending(false);
    }
  };

  const convertToTask = async (entry: MentoringEntry) => {
    if (isWritePending || !currentUser || entry.task_id) return;
    setIsWritePending(true);
    setError(null);

    try {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: entry.agreed_action,
          status: 'open',
          priority: 'normal',
          assigned_to: entry.mentee_user_id,
          created_by: currentUser.id,
          unit_id: currentUser.unit_id,
          due_at: entry.next_check_at ? new Date(`${entry.next_check_at}T09:00:00`).toISOString() : null,
          metadata: { category: 'חניכה', mentoring_entry_id: entry.id },
        })
        .select('id')
        .single<{ id: string }>();

      if (taskError || !task) {
        logSupabaseError('Mentoring entry to task conversion failed', taskError);
        setError('לא ניתן ליצור משימה כרגע.');
        return;
      }

      // Same 204-on-RLS-denial problem: without .select('id') a denied link
      // is indistinguishable from a successful one, and the entry silently
      // stays unlinked from the task that was just created for it.
      const { data: linkedRows, error: updateError } = await supabase
        .from('mentoring_entries')
        .update({ task_id: task.id })
        .eq('id', entry.id)
        .select('id');
      if (updateError || !didRowsUpdate(linkedRows)) {
        logSupabaseError('Mentoring entry task_id update failed', updateError);
        setError('המשימה נוצרה, אך לא ניתן היה לקשר אותה לרשומת החניכה.');
      }

      void createAuditLog(supabase, {
        userId: currentUser.id,
        userName: currentUser.full_name,
        userRole: currentUser.role,
        actionType: 'mentoring_entry_converted_to_task',
        entityType: 'mentoring_entry',
        entityId: entry.id,
        previousValue: null,
        newValue: { task_id: task.id },
      });

      setSuccess('נפתחה משימה למעקב — ניתן למצוא אותה בטאב "משימות".');
      await loadData();
    } catch (convertError) {
      logSupabaseError('Mentoring entry to task conversion failed unexpectedly', convertError);
      setError('לא ניתן ליצור משימה כרגע.');
    } finally {
      setIsWritePending(false);
    }
  };

  if (!currentUser || !isCommanderOnly) {
    return (
      <GlassCard className="flex flex-col items-center justify-center py-12 text-center">
        <ShieldAlert className="mb-3 h-10 w-10 text-[var(--color-danger)]" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">מסך זה זמין למ״פ בלבד</h2>
        <p className="mt-1 max-w-sm text-xs font-semibold text-[var(--text-muted-accessible)]">יומן החניכה הוא כלי אישי של המ״פ למעקב אחרי המ״מים והסמ״פ.</p>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const totalEntries = entries.length;
  const dueForCheck = entries.filter(e => e.next_check_at && e.next_check_at <= today()).length;
  const neverMentored = mentees.filter(m => entriesFor(m.id).length === 0).length;

  const selectedMentee = mentees.find(m => m.id === selectedMenteeId) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <MetricCard label="שיחות חניכה שתועדו" value={totalEntries} icon={ListChecks} tone="brand" />
        <MetricCard label="בדיקה חוזרת דרושה" value={dueForCheck} icon={CalendarClock} tone="danger" />
        <MetricCard label="עדיין ללא שיחת חניכה" value={neverMentored} icon={Sparkles} tone="info" />
      </div>

      {success && (
        <div className="rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-3 text-sm font-bold text-[var(--color-success)]">{success}</div>
      )}
      {error && (
        <div className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm font-bold text-[var(--color-danger)]">{error}</div>
      )}

      {mentees.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="אין עדיין מ״מים או סמ״פ פעילים במערכת"
          description="ברגע שיהיו משתמשים מאושרים בתפקידי מ״מ/סמ״פ, הם יופיעו כאן."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mentees.map(mentee => {
            const menteeEntries = entriesFor(mentee.id);
            const latest = menteeEntries[0] ?? null;
            const first = menteeEntries[menteeEntries.length - 1] ?? null;
            return (
              <GlassCard key={mentee.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)]">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{mentee.name}</h3>
                    <p className="text-xs font-bold text-[var(--text-muted-accessible)]">{mentee.role}{mentee.unitName ? ` · ${mentee.unitName}` : ''}</p>
                  </div>
                </div>

                {latest ? (
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs font-semibold leading-relaxed text-[var(--text-secondary)]">
                    <span className="block text-caption font-semibold text-[var(--command-subtle)]">שיחה אחרונה · {formatDate(latest.occurred_on)}</span>
                    <span className="mt-1 block truncate">{latest.focus}</span>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-[var(--command-subtle)]">עדיין לא נרשמה שיחת חניכה.</p>
                )}

                <div className="mt-auto flex items-center gap-2 pt-1">
                  <GlossyButton variant="orange" size="sm" onClick={() => openFormFor(mentee.id)} className="flex-1 justify-center">
                    רישום שיחה
                  </GlossyButton>
                  <GlossyButton variant="slate" size="sm" onClick={() => setSelectedMenteeId(mentee.id)}>
                    <ClipboardCheck className="h-4 w-4" />
                    יומן ({menteeEntries.length})
                  </GlossyButton>
                </div>
                {first && first.id !== latest?.id && (
                  <p className="text-caption font-bold text-[var(--command-subtle)]">שיחה ראשונה: {formatDate(first.occurred_on)}</p>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      <CommandOverlay
        open={Boolean(selectedMentee) && !isFormOpen}
        onClose={() => setSelectedMenteeId(null)}
        title={selectedMentee ? `יומן חניכה — ${selectedMentee.name}` : ''}
        description="תצפית ← מוקד ← פעולה מוסכמת ← בדיקה חוזרת."
        variant="sheet"
        footer={
          selectedMentee && (
            <CommandButton variant="primary" onClick={() => openFormFor(selectedMentee.id)}>רישום שיחת חניכה</CommandButton>
          )
        }
      >
        {selectedMentee && (
          <div className="space-y-3">
            {entriesFor(selectedMentee.id).length === 0 ? (
              <p className="text-sm font-bold text-[var(--command-subtle)]">עדיין לא נרשמה שיחת חניכה עם {selectedMentee.name}.</p>
            ) : (
              entriesFor(selectedMentee.id).map(entry => (
                <div key={entry.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[var(--command-subtle)]">{formatDate(entry.occurred_on)}</span>
                    {entry.next_check_at && (
                      <span className="rounded-full border border-[var(--action)]/20 bg-[var(--action)]/10 px-2.5 py-0.5 text-caption font-bold text-[var(--color-action-on-surface)]">
                        בדיקה: {formatDate(entry.next_check_at)}
                      </span>
                    )}
                  </div>
                  {entry.observation && <p className="mb-1"><strong className="font-semibold">תצפית:</strong> {entry.observation}</p>}
                  <p className="mb-1"><strong className="font-semibold">מוקד:</strong> {entry.focus}</p>
                  <p><strong className="font-semibold">פעולה מוסכמת:</strong> {entry.agreed_action}</p>
                  {entry.task_id ? (
                    <p className="mt-2 text-xs font-bold text-[var(--color-success)]">נפתחה משימה למעקב</p>
                  ) : (
                    <button type="button" onClick={() => void convertToTask(entry)} disabled={isWritePending} className="mt-2 text-xs font-semibold text-[var(--color-action-on-surface)] hover:underline">
                      הפוך למשימה
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </CommandOverlay>

      <CommandOverlay
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedMentee ? `רישום שיחת חניכה — ${selectedMentee.name}` : 'רישום שיחת חניכה'}
        description="לפי המודל שאושר: תצפית מבוססת נתונים, מוקד לחניכה, ופעולה מוסכמת עם מועד בדיקה."
        variant="sheet"
        footer={
          <>
            <CommandButton variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>ביטול</CommandButton>
            <CommandButton type="submit" form="mentoring-create-form" variant="primary" loading={isSubmitting}>שמירת שיחה</CommandButton>
          </>
        }
      >
        <form id="mentoring-create-form" onSubmit={handleSaveEntry} className="space-y-4">
          <CommandInput label="תאריך" type="date" required value={occurredOn} onChange={e => setOccurredOn(e.target.value)} disabled={isSubmitting} />
          <div>
            <CommandTextarea label="תצפית / ראיה" value={observation} onChange={e => setObservation(e.target.value)} disabled={isSubmitting} />
            <FieldPrivacyHint />
          </div>
          <CommandTextarea label="מוקד חניכה" required value={focus} onChange={e => setFocus(e.target.value)} disabled={isSubmitting} />
          <CommandTextarea label="פעולה מוסכמת" required value={agreedAction} onChange={e => setAgreedAction(e.target.value)} disabled={isSubmitting} />
          <CommandInput label="מועד בדיקה חוזרת" type="date" value={nextCheckAt} onChange={e => setNextCheckAt(e.target.value)} disabled={isSubmitting} />
        </form>
      </CommandOverlay>
    </div>
  );
}
