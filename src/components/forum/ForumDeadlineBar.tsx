'use client';

import { useEffect, useState } from 'react';
import { AlarmClock, Loader2 } from 'lucide-react';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';

// Matches notifications_tick() in migration 042: no row means 20:00.
export const DEFAULT_FORUM_DEADLINE = '20:00';

/**
 * "מועד הגשה" for one forum day (notifications stage 3). The reminder goes out
 * an hour before it, and the missing list to מ״פ and סמ״פ at it. Only they
 * may change it; RLS (forum_deadlines) enforces the same.
 */
export function ForumDeadlineBar({ date, canEdit }: { date: string; canEdit: boolean }) {
  const { currentUser } = useApp();
  const [deadline, setDeadline] = useState(DEFAULT_FORUM_DEADLINE);
  const [draft, setDraft] = useState(DEFAULT_FORUM_DEADLINE);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: loadError } = await createSupabaseBrowserClient()
        .from('forum_deadlines')
        .select('deadline')
        .eq('report_date', date)
        .maybeSingle<{ deadline: string }>();
      if (!active) return;
      if (loadError) logSupabaseError('Forum deadline load failed', loadError);
      const value = data?.deadline?.slice(0, 5) ?? DEFAULT_FORUM_DEADLINE;
      setDeadline(value);
      setDraft(value);
      setIsEditing(false);
      setError(null);
    })();
    return () => {
      active = false;
    };
  }, [date]);

  const save = async () => {
    if (!currentUser || !/^\d{2}:\d{2}$/.test(draft)) return;
    setIsSaving(true);
    setError(null);
    const { error: saveError } = await createSupabaseBrowserClient()
      .from('forum_deadlines')
      .upsert({ report_date: date, deadline: draft, set_by: currentUser.id, updated_at: new Date().toISOString() });
    setIsSaving(false);
    if (saveError) {
      logSupabaseError('Forum deadline save failed', saveError);
      setError('לא ניתן לשמור את המועד כרגע. נסה שוב.');
      return;
    }
    setDeadline(draft);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] px-4 py-3">
      <AlarmClock className="h-5 w-5 shrink-0 text-[var(--brand)]" />
      {isEditing ? (
        <>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            מועד הגשה
            <input
              type="time"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="command-input min-h-0 w-auto px-3 py-1.5 text-sm"
              disabled={isSaving}
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="touch-target inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--action)] px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            שמור
          </button>
          <button
            type="button"
            onClick={() => { setDraft(deadline); setIsEditing(false); setError(null); }}
            disabled={isSaving}
            className="touch-target min-h-9 rounded-xl border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--text-primary)]"
          >
            ביטול
          </button>
        </>
      ) : (
        <>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            מועד הגשה: <span className="font-bold">{deadline}</span>
          </span>
          <span className="text-caption font-semibold text-[var(--text-muted-accessible)]">תזכורת יוצאת שעה לפני</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="touch-target min-h-9 rounded-xl border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--text-primary)]"
            >
              שנה
            </button>
          )}
        </>
      )}
      {error && <span className="w-full text-xs font-bold text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
