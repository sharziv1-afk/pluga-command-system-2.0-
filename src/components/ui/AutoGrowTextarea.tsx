'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { fitTextareaHeight, supportsFieldSizing, withScrollPreserved } from '@/lib/ui/autoGrow';
import { applyAutoList } from '@/lib/ui/autoList';

type AutoGrowTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Lists continue themselves: "1." → "2.", "* " → "• " (src/lib/ui/autoList.ts). */
  autoList?: boolean;
};

/**
 * A plain <textarea> that grows with its text: no inner scrollbar while
 * typing, and the min-height from `className` stays the floor.
 *
 * CSS `field-sizing: content` does the work where supported; otherwise the
 * height is measured on every value change (typing, load, carry-over from an
 * earlier report), when the box's width changes (window resize, rotation,
 * a <details> opening) and after web fonts load.
 *
 * With `autoList`, numbered and bulleted lists continue on Enter.
 */
export function AutoGrowTextarea({ className, value, rows = 2, autoList = false, onChange, ...props }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const previousValue = useRef(String(value ?? ''));
  const pendingCaret = useRef<number | null>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el || supportsFieldSizing()) return;
    withScrollPreserved(el, () => fitTextareaHeight(el), document.scrollingElement);
  }, []);

  // Before paint, so a new line never flashes a scrollbar.
  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  // Remembers the value the next change starts from, and puts back the caret
  // an auto-list change moved (React would otherwise leave it at the end).
  useLayoutEffect(() => {
    previousValue.current = String(value ?? '');
    const el = ref.current;
    if (el && pendingCaret.current !== null && document.activeElement === el) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || supportsFieldSizing()) return;
    let lastWidth = el.clientWidth;
    // Width only: reacting to height changes would loop on our own resize.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      resize();
    });
    observer?.observe(el);
    window.addEventListener('resize', resize);
    void document.fonts?.ready.then(resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [resize]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = event.target;
    if (autoList && !(event.nativeEvent as InputEvent).isComposing) {
      const listed = applyAutoList(previousValue.current, el.value, el.selectionStart ?? el.value.length);
      if (listed) {
        el.value = listed.value;
        el.setSelectionRange(listed.caret, listed.caret);
        pendingCaret.current = listed.caret;
      }
    }
    onChange?.(event);
  };

  return <textarea ref={ref} rows={rows} value={value} onChange={handleChange} className={cn('auto-grow-textarea', className)} {...props} />;
}
