'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { fitTextareaHeight, supportsFieldSizing, withScrollPreserved } from '@/lib/ui/autoGrow';

type AutoGrowTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * A plain <textarea> that grows with its text: no inner scrollbar while
 * typing, and the min-height from `className` stays the floor.
 *
 * CSS `field-sizing: content` does the work where supported; otherwise the
 * height is measured on every value change (typing, load, carry-over from an
 * earlier report), when the box's width changes (window resize, rotation,
 * a <details> opening) and after web fonts load.
 */
export function AutoGrowTextarea({ className, value, rows = 2, ...props }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el || supportsFieldSizing()) return;
    withScrollPreserved(el, () => fitTextareaHeight(el), document.scrollingElement);
  }, []);

  // Before paint, so a new line never flashes a scrollbar.
  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

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

  return <textarea ref={ref} rows={rows} value={value} className={cn('auto-grow-textarea', className)} {...props} />;
}
