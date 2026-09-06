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

    // Ask the browser not to evict our storage.
    //
    // iOS Safari clears a web app's caches, IndexedDB and localStorage after
    // roughly seven days without a visit. For this app that is not a cache
    // miss, it is data loss with consequences: the device PIN lives in
    // localStorage (so offline sign-in stops working) and the offline write
    // queue lives in IndexedDB (so edits made in the field, before the phone
    // got signal again, disappear without telling anyone).
    //
    // A granted persistent-storage request exempts the origin from that
    // eviction. Safari decides heuristically and weights an installed
    // home-screen app heavily, which is exactly our case. It costs one call
    // and there is no downside to being refused.
    if (navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => {
        // Not supported, or declined. Nothing to do — the app already
        // tolerates an empty cache; this only reduces how often that happens.
      });
    }
  }, []);

  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}
