'use client';

import React, { useEffect } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { logSupabaseError } from '@/lib/supabase/error';

/**
 * There was no error boundary anywhere in this app. Next's default behaviour
 * for an uncaught render error is a bare, unstyled "Application error"
 * screen with no recovery path except a full reload — for a page as complex
 * as the forum (3,400+ lines, a lot of it hand-rolled data shaping), that is
 * a real way to lose whatever a commander was mid-typing, not a hypothetical.
 *
 * This is Next's own App Router convention (error.tsx), not a bespoke
 * mechanism — it wraps everything under the root layout, so Providers (and
 * therefore the offline queue, the theme, the auth context) all keep running
 * underneath it. `reset()` re-renders the segment that threw without a full
 * page reload; offered alongside a real reload for the case where the error
 * came from corrupted state that `reset()` alone won't clear.
 *
 * Deliberately not more sophisticated than this: no remote error reporting
 * service, no retry-with-backoff. Console logging plus a real button beats a
 * white screen; anything past that is a decision to make once the app
 * actually needs an error-tracking product, not before.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Despite the name, this is the app's general "log an error, sanitized,
    // always including production" lane — not Supabase-specific, it just
    // lives in that file. Using it here keeps one lane for this instead of a
    // second raw-console pattern next to it.
    logSupabaseError('Unhandled render error', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="command-page-shell flex min-h-svh items-center justify-center p-4" dir="rtl">
      <GlassCard className="w-full max-w-md text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-[var(--color-danger)]" />
        <h1 className="text-lg font-bold text-[var(--text-primary)]">משהו השתבש</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          קרתה שגיאה בלתי צפויה בעמוד הזה. שום דבר שכבר נשמר לא נפגע — נסה שוב, ואם זה חוזר, רענן את העמוד.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--action-hover)]"
          >
            <RefreshCw className="h-4 w-4" />
            נסה שוב
          </button>
          <a
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--action)]/40"
          >
            <Home className="h-4 w-4" />
            חזרה ללוח מפקד
          </a>
        </div>
      </GlassCard>
    </div>
  );
}
