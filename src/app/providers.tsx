'use client';

import React, { useEffect } from 'react';
import { AppProvider } from '@/lib/context/AppContext';

/**
 * Measured on the reporting device (iPhone, installed to the home screen,
 * portrait), via a temporary on-screen readout — see git history for
 * ViewportDebug.tsx:
 *
 *   innerHeight: 873    visualViewport.height: 873    screen.height: 932
 *   safe-area-inset-bottom: 34
 *
 * 932 − 873 = 59, and this device's top inset is 59 (Dynamic Island model).
 * That is not a coincidence or a stale reading: `innerHeight` here already
 * excludes BOTH safe-area insets from its own count, not only the bottom one
 * `env(safe-area-inset-bottom)` separately reports for CSS padding. Two
 * earlier attempts (a plain `innerHeight` read, then `visualViewport` plus a
 * delayed re-check) both measured that same excluded-both-insets number more
 * precisely each time — neither could have worked, because the number itself
 * was never the full viewport to begin with.
 *
 * The fix: add both insets back. `.protected-layout-shell` is sized to
 * innerHeight + safe-area-inset-top + safe-area-inset-bottom, which is the
 * true full-screen height (873 + 59 = 932, matching screen.height exactly on
 * that device) — the shell now spans edge to edge, and the bottom nav's own
 * `.safe-bottom-nav` padding (already in globals.css) keeps its tap targets
 * clear of the home-indicator gesture area within that.
 *
 * This also explains, instead of merely fitting, why landscape never showed
 * the gap: rotated, both insets move to the left/right edges and contribute
 * ~0 to height, so innerHeight alone already equalled the true height there —
 * nothing needed adding back.
 */
function useRealViewportHeight() {
  useEffect(() => {
    const setViewportHeight = () => {
      const rootStyle = getComputedStyle(document.documentElement);
      const topInset = parseFloat(rootStyle.getPropertyValue('--safe-area-top')) || 0;
      const bottomInset = parseFloat(rootStyle.getPropertyValue('--safe-area-bottom')) || 0;
      const height = window.innerHeight + topInset + bottomInset;
      document.documentElement.style.setProperty('--app-vh', `${height}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useRealViewportHeight();

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
