'use client';

import React, { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';

const DISMISS_KEY = 'pluga_install_hint_dismissed';

/**
 * One-time hint pointing at iOS's install flow.
 *
 * On iOS, "שתף ← הוסף למסך הבית" is the *only* way to install a web app —
 * Safari shows no install prompt and fires no beforeinstallprompt, so without
 * telling the user the path exists, it is undiscoverable. Shown only where it
 * is actionable: iOS Safari, not already installed, not dismissed before.
 */
export const InstallHint: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
      // iPadOS 13+ reports as a Mac, so the touch-point check is what
      // separates an iPad from a desktop Safari.
      const ua = window.navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua)
        || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
      // navigator.standalone is the iOS-only signal for "launched from the
      // home screen"; the media query covers the standard path.
      const installed = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIOS && isSafari && !installed) setShow(true);
    } catch {
      // Private mode can throw on localStorage access — just don't show it.
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Nothing to do; it reappears next launch, which is acceptable.
    }
  };

  if (!show) return null;

  return (
    <div
      role="note"
      className="safe-bottom fixed inset-x-3 bottom-20 z-40 flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-lg)] md:hidden"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--color-action-on-surface)]">
        <Share className="h-4 w-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-meta font-bold leading-relaxed text-[var(--text-secondary)]">
        להוספת <span className="text-[var(--text-primary)]">המפקד</span> למסך הבית:
        לחץ על <span className="text-[var(--text-primary)]">שתף</span> בסרגל התחתון של ספארי,
        ואז <span className="text-[var(--text-primary)]">הוסף למסך הבית</span>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגור את ההסבר על הוספה למסך הבית"
        className="touch-target -m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted-accessible)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
