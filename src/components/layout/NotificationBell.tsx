'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Trash2, X } from 'lucide-react';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { notificationHref } from '@/lib/notifications/actions';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notifications/focus';

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  created_at: string;
  read_at: string | null;
};

const REFRESH_MS = 60_000;

// `now` is when the list was loaded, passed in so render stays pure.
function timeAgo(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

/**
 * The in-app inbox (notifications, migration 038). Every notification lands
 * here whether or not the device has push, so nothing is lost for someone
 * who never enabled it. Hidden entirely when the table is not reachable —
 * a missing bell is better than a broken one.
 */
export const NotificationBell: React.FC = () => {
  const { currentUser } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser) return;
    const { data, error } = await createSupabaseBrowserClient()
      .from('notifications')
      .select('id,kind,title,body,url,created_at,read_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .returns<NotificationRow[]>();
    if (error) {
      logSupabaseError('Notifications load failed', error);
      setItems(null);
      return;
    }
    setItems(data ?? []);
    setLoadedAt(Date.now());
  }, [currentUser]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    // The service worker posts this when a push arrives while the app is open.
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'notifications-updated') void load();
    };
    // The action bar (stage 4) read or acted on one.
    const onChanged = () => void load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
    };
  }, [load]);

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const readAt = new Date().toISOString();
    setItems(current => current?.map(item => (ids.includes(item.id) ? { ...item, read_at: item.read_at ?? readAt } : item)) ?? null);
    const { error } = await createSupabaseBrowserClient()
      .from('notifications')
      .update({ read_at: readAt })
      .in('id', ids)
      .is('read_at', null);
    if (error) logSupabaseError('Notifications mark read failed', error);
  };

  // Deleting a notification never touches the task, event or request it
  // points at (migration 041). "נקה הכל" clears every one of the user's
  // notifications, not just the 30 on screen.
  const deleteItems = async (ids: string[] | 'all') => {
    if (!currentUser) return;
    setItems(current => (ids === 'all' ? [] : current?.filter(item => !ids.includes(item.id)) ?? null));
    const query = createSupabaseBrowserClient().from('notifications').delete();
    const { error } = ids === 'all' ? await query.eq('user_id', currentUser.id) : await query.in('id', ids);
    if (error) {
      logSupabaseError('Notifications delete failed', error);
      void load();
    }
  };

  const closePanel = () => {
    setOpen(false);
    setConfirmClear(false);
  };

  if (!currentUser || items === null) return null;

  const unread = items.filter(item => !item.read_at);

  const openItem = (item: NotificationRow) => {
    void markRead([item.id]);
    closePanel();
    // The link carries the notification id: the page opens the item itself
    // and shows its quick actions (stage 4).
    const href = notificationHref(item.url, item.id);
    if (href) router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? closePanel() : setOpen(true))}
        className="command-icon-button relative"
        aria-label={unread.length ? `התראות, ${unread.length} חדשות` : 'התראות'}
        aria-expanded={open}
        title="התראות"
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute -top-1 -left-1 flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold leading-[1.1rem] text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" dir="rtl">
          <button type="button" aria-label="סגירת ההתראות" className="absolute inset-0 bg-black/20" onClick={closePanel} />
          <div
            role="dialog"
            aria-label="התראות"
            className="safe-top absolute inset-x-3 top-3 flex max-h-[75svh] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--shadow-lg)] md:inset-x-auto md:left-1/2 md:top-16 md:w-[26rem] md:-translate-x-1/2"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">התראות</h2>
              <div className="flex items-center gap-1">
                {unread.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void markRead(unread.map(item => item.id))}
                    className="touch-target min-h-9 rounded-lg px-2 text-xs font-semibold text-[var(--color-action-on-surface)]"
                  >
                    סמן הכל כנקרא
                  </button>
                )}
                {items.length > 0 && (
                  // Two taps, so one stray tap cannot wipe the list.
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmClear) {
                        setConfirmClear(true);
                        return;
                      }
                      setConfirmClear(false);
                      void deleteItems('all');
                    }}
                    className={confirmClear
                      ? 'touch-target min-h-9 rounded-lg bg-[var(--color-danger)]/10 px-2 text-xs font-bold text-[var(--color-danger)]'
                      : 'touch-target min-h-9 rounded-lg px-2 text-xs font-semibold text-[var(--color-danger)]'}
                  >
                    {confirmClear ? 'לחץ שוב לניקוי' : 'נקה הכל'}
                  </button>
                )}
                <button type="button" onClick={closePanel} className="command-icon-button" aria-label="סגירה">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs font-semibold text-[var(--text-muted-accessible)]">
                אין התראות עדיין. אפשר להפעיל התראות לטלפון בעמוד הפרופיל.
              </p>
            ) : (
              <ul className="custom-scrollbar flex-1 divide-y divide-[var(--border-subtle)] overflow-y-auto">
                {items.map(item => (
                  <li key={item.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex min-w-0 flex-1 items-start gap-3 py-3 pr-4 text-right transition hover:bg-[var(--surface-muted)]"
                    >
                      <span
                        aria-hidden
                        className={item.read_at ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent' : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-action-on-surface)]'}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={item.read_at ? 'block text-xs font-semibold text-[var(--text-secondary)]' : 'block text-xs font-bold text-[var(--text-primary)]'}>
                          {item.title}
                        </span>
                        {item.body && <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-secondary)]">{item.body}</span>}
                        <span className="mt-1 block text-[11px] font-semibold text-[var(--text-muted-accessible)]">{timeAgo(item.created_at, loadedAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteItems([item.id])}
                      className="touch-target flex w-11 shrink-0 items-center justify-center text-[var(--text-muted-accessible)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--color-danger)]"
                      aria-label={`מחק התראה: ${item.title}`}
                      title="מחק"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
};
