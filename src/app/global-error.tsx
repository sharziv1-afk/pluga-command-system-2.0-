'use client';

import React, { useEffect } from 'react';
import { logSupabaseError } from '@/lib/supabase/error';

/**
 * error.tsx (the sibling file) catches everything under the root layout.
 * This one is Next's convention for the rarer case where the root layout
 * ITSELF throws — at which point error.tsx can't help, because there's no
 * layout left to render it inside. Per Next's own contract this file must
 * render its own <html>/<body>, so it avoids the app's component tree and
 * CSS (Providers, GlassCard, globals.css classes) — anything in that tree is
 * exactly what might be broken. Inline styles, on purpose: this is the last
 * line of defence, not a place to be clever. The one import kept is the
 * error-logging helper — a plain function with no React/DOM/Supabase-client
 * dependency of its own — so error logging stays in one place rather than a
 * second raw-console pattern existing only in this file.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logSupabaseError('Unhandled error at the root layout', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#F6F7F9',
          color: '#111827',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            background: '#fff',
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>המפקד לא נטען כרגע</h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: '#4B5563' }}>
            קרתה שגיאה חמורה בטעינת האפליקציה. נסה שוב, ואם זה חוזר — סגור ופתח את האפליקציה מחדש.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: '0 20px',
              borderRadius: 12,
              border: 'none',
              background: '#FF6B02',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            נסה שוב
          </button>
        </div>
      </body>
    </html>
  );
}
