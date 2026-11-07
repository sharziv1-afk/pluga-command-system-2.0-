'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2, Loader2, X } from 'lucide-react';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { QUICK_ACTION_DONE, QUICK_ACTION_LABELS, actionsForKind, type QuickAction } from '@/lib/notifications/actions';
import {
  ITEM_CHANGED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
  SearchParamsWatcher,
  uuidParam,
  type ItemChangedDetail,
} from '@/lib/notifications/focus';

type OpenedNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
};

/**
 * The bar at the top of the page after tapping a notification (stage 4).
 * On iPhone it is how "בוצע" stays one tap away, since a web app's
 * notification has no reliable buttons there. The action runs through
 * notification_quick_action() (migration 044), under the user's own RLS.
 */
export const NotificationActionBar: React.FC = () => {
  const { currentUser } = useApp();
  const [item, setItem] = useState<OpenedNotification | null>(null);
  const [busy, setBusy] = useState<QuickAction | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const onParams = (params: URLSearchParams) => {
    const id = uuidParam(params, 'n');
    if (!id || !currentUser || id === item?.id || id === dismissed) {
      if (!id) setItem(null);
      return;
    }
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('id,kind,title,body,entity_type,entity_id,read_at')
        .eq('id', id)
        .maybeSingle<OpenedNotification>();
      if (error) logSupabaseError('Opened notification load failed', error);
      if (!data) return;
      setItem(data);
      setMessage(null);
      // Tapping it on the phone counts as reading it.
      if (!data.read_at) {
        const { error: readError } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', data.id)
          .is('read_at', null);
        if (readError) logSupabaseError('Opened notification mark read failed', readError);
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      }
    })();
  };

  const run = async (action: QuickAction) => {
    if (!item) return;
    setBusy(action);
    setMessage(null);
    const { data, error } = await createSupabaseBrowserClient().rpc('notification_quick_action', {
      p_notification: item.id,
      p_action: action,
    });
    setBusy(null);
    if (error) {
      logSupabaseError('Quick action failed', error);
      setMessage({ tone: 'error', text: 'לא ניתן לבצע את זה מכאן. אפשר לעדכן בפריט עצמו.' });
      return;
    }
    const result = (data as { result?: string } | null)?.result;
    setMessage({ tone: 'ok', text: result === 'already' ? 'כבר עודכן קודם' : QUICK_ACTION_DONE[action] });
    window.dispatchEvent(new CustomEvent<ItemChangedDetail>(ITEM_CHANGED_EVENT, {
      detail: { entityType: item.entity_type, entityId: item.entity_id },
    }));
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  };

  const actions = item ? actionsForKind(item.kind) : [];
  const visible = item && item.id !== dismissed;

  return (
    <>
      <SearchParamsWatcher onChange={onParams} />
      {visible && (
        <div
          role="region"
          aria-label="פעולה מההתראה"
          dir="rtl"
          className="mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center gap-3 rounded-2xl border border-[var(--action)]/35 bg-[var(--action)]/8 px-4 py-3"
        >
          <Bell className="h-4 w-4 shrink-0 text-[var(--color-action-on-surface)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--text-primary)]">{item.title}</p>
            {item.body && <p className="truncate text-xs text-[var(--text-secondary)]">{item.body}</p>}
            {message && (
              <p
                role="status"
                className={message.tone === 'ok'
                  ? 'mt-1 flex items-center gap-1 text-xs font-bold text-[var(--color-success)]'
                  : 'mt-1 text-xs font-bold text-[var(--color-danger)]'}
              >
                {message.tone === 'ok' && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                {message.text}
              </p>
            )}
          </div>
          {message?.tone !== 'ok' && actions.map(action => (
            <button
              key={action}
              type="button"
              onClick={() => void run(action)}
              disabled={busy !== null}
              className="touch-target inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--action)] px-4 text-sm font-bold text-white transition hover:bg-[var(--action-hover)] disabled:opacity-60"
            >
              {busy === action && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {QUICK_ACTION_LABELS[action]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDismissed(item.id)}
            className="command-icon-button"
            aria-label="סגירה"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
};
