'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { MUTE_GROUPS } from '@/lib/notifications/actions';

/**
 * "מה יגיע לטלפון" (notifications stage 5). A muted group still lands in the
 * bell; only the phone stays quiet (muted_kinds, read by
 * claim_pending_pushes in migration 039). A task given to me is never muted.
 */
export function NotificationMuteSettings() {
  const { currentUser } = useApp();
  const [muted, setMuted] = useState<Set<string> | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    void (async () => {
      const { data, error: loadError } = await createSupabaseBrowserClient()
        .from('notification_preferences')
        .select('muted_kinds')
        .eq('user_id', currentUser.id)
        .maybeSingle<{ muted_kinds: string[] }>();
      if (!active) return;
      if (loadError) {
        logSupabaseError('Notification preferences load failed', loadError);
        return;
      }
      setMuted(new Set(data?.muted_kinds ?? []));
    })();
    return () => {
      active = false;
    };
  }, [currentUser]);

  if (!currentUser || muted === null) return null;

  const toggle = async (groupId: string, kinds: string[], on: boolean) => {
    const next = new Set(muted);
    kinds.forEach(kind => (on ? next.delete(kind) : next.add(kind)));
    setSavingGroup(groupId);
    setError(null);
    const { error: saveError } = await createSupabaseBrowserClient()
      .from('notification_preferences')
      .upsert({ user_id: currentUser.id, muted_kinds: [...next].sort(), updated_at: new Date().toISOString() });
    setSavingGroup(null);
    if (saveError) {
      logSupabaseError('Notification preferences save failed', saveError);
      setError('לא ניתן לשמור כרגע. נסה שוב.');
      return;
    }
    setMuted(next);
  };

  return (
    <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
      <h3 className="text-sm font-bold text-[var(--text-primary)]">מה יגיע לטלפון</h3>
      <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
        מה שמכבים כאן עדיין מופיע בפעמון, רק לא מצלצל בטלפון. משימה שקיבלת תמיד מגיעה.
      </p>
      {error && <p role="status" className="mt-2 text-xs font-bold text-[var(--color-danger)]">{error}</p>}
      <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
        {MUTE_GROUPS.map(group => {
          const on = group.kinds.some(kind => !muted.has(kind));
          return (
            <li key={group.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-xs font-bold text-[var(--text-primary)]">{group.label}</span>
                <span className="block text-[11px] font-semibold text-[var(--text-muted-accessible)]">{group.hint}</span>
              </span>
              {/* A 44px hit area around a small track. The knob's white is a hex
                  value on purpose: dark mode turns Tailwind's white background
                  class translucent (globals.css). */}
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={group.label}
                disabled={savingGroup !== null}
                onClick={() => void toggle(group.id, group.kinds, !on)}
                className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className={on
                    ? 'relative h-7 w-12 rounded-full bg-[var(--action)] transition'
                    : 'relative h-7 w-12 rounded-full bg-[var(--border-strong)] transition'}
                >
                  <span
                    className={on
                      ? 'absolute top-1 left-1 h-5 w-5 rounded-full bg-[#ffffff] shadow transition-all'
                      : 'absolute top-1 right-1 h-5 w-5 rounded-full bg-[#ffffff] shadow transition-all'}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
