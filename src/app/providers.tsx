'use client';

import React, { useEffect } from 'react';
import { AppProvider } from '@/lib/context/AppContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Never register in dev: Turbopack's dev bundles aren't content-hashed
      // the way a production build is, so a service-worker cache surviving a
      // dev-server restart can serve JS from a previous run alongside a
      // fresh HTML shell — the page fails to load with no useful error. A
      // device that already has the dev SW cached from an earlier session
      // needs it removed once (browser settings > site data > delete).
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => void registration.unregister());
        }).catch(() => undefined);
      }
      return;
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline shell caching is a nice-to-have, not a hard dependency —
        // fail silently if the browser or environment blocks it.
      });
    }
  }, []);

  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}
