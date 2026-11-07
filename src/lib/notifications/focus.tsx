'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Opening a notification lands on its page with ?item=<id> (the task, event,
 * request, gap or entry) and ?n=<notification id> (notifications stage 4).
 * Pages read them through this watcher, in its own Suspense boundary so
 * useSearchParams never pulls a whole page out of prerendering, and so it
 * follows the bell's in-app navigation, not just the first load.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ITEM_CHANGED_EVENT = 'hamefaked:item-changed';
export const NOTIFICATIONS_CHANGED_EVENT = 'hamefaked:notifications-changed';

export type ItemChangedDetail = { entityType: string | null; entityId: string | null };

export function uuidParam(params: URLSearchParams, name: string): string | null {
  const value = params.get(name);
  return value && UUID.test(value) ? value : null;
}

function Watcher({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const params = useSearchParams();
  const key = params.toString();
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });
  useEffect(() => {
    callback.current(new URLSearchParams(key));
  }, [key]);
  return null;
}

export function SearchParamsWatcher({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  return (
    <Suspense fallback={null}>
      <Watcher onChange={onChange} />
    </Suspense>
  );
}

/** Scrolls to the element marked data-item-id and highlights it briefly. */
export function focusItemElement(id: string) {
  let tries = 0;
  const attempt = () => {
    const element = document.querySelector(`[data-item-id="${CSS.escape(id)}"]`);
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('item-focus');
      window.setTimeout(() => element.classList.remove('item-focus'), 4000);
      return;
    }
    tries += 1;
    if (tries < 40) window.setTimeout(attempt, 100);
  };
  attempt();
}

/** Re-runs `reload` when a quick action changed something on this page. */
export function useItemChanged(entityTypes: string[], reload: () => void) {
  const callback = useRef(reload);
  useEffect(() => {
    callback.current = reload;
  });
  const types = entityTypes.join(',');
  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ItemChangedDetail>).detail;
      if (!detail?.entityType || types.split(',').includes(detail.entityType)) callback.current();
    };
    window.addEventListener(ITEM_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ITEM_CHANGED_EVENT, onChange);
  }, [types]);
}
