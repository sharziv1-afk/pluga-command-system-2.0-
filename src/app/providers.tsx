'use client';

import React, { useEffect } from 'react';
import { AppProvider } from '@/lib/context/AppContext';

/**
 * iOS Safari's `100svh` is meant to be "the smallest the viewport can ever
 * be", but in a standalone (home-screen) launch on some iOS versions it
 * measures short in **portrait only** — confirmed on a real device: the
 * gap below the bottom nav vanished in landscape and came straight back in
 * portrait, and its colour is our own body gradient, not Safari chrome. That
 * rules out both "it's the browser's toolbar" and "the positioning is wrong"
 * at once — the CSS unit itself is under-measuring.
 *
 * First attempt read `window.innerHeight` once on mount plus on resize /
 * orientationchange, and it did not fix it — reported back, on the same
 * device, still short. That is consistent with a further-documented iOS
 * quirk: right after a standalone launch, `innerHeight` itself can report
 * the safe-area-excluded height for a beat before the OS finishes settling
 * the layout, with no resize event firing to say so — nothing beyond the
 * numbers changed.
 *
 * Fixed by not trusting one read at one moment:
 *   - `visualViewport.height` where it exists — it is the API iOS itself
 *     recommends for exactly this, tracks the actual visible area rather
 *     than a layout box, and fires its own `resize` independent of window's.
 *   - re-measured again after a short delay on mount, specifically to catch
 *     the silent post-launch correction that fires no event at all.
 *   - `window.innerHeight` stays as the fallback where visualViewport is
 *     unsupported (older WebKit, non-Safari browsers).
 */
function useRealViewportHeight() {
  useEffect(() => {
    const setViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-vh', `${height}px`);
    };

    setViewportHeight();
    // iOS has settled its safe-area layout by ~300ms after mount in every
    // case observed; re-checking here catches the silent post-launch
    // correction even when nothing fires a resize event for it.
    const settleTimeout = window.setTimeout(setViewportHeight, 300);

    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    window.visualViewport?.addEventListener('resize', setViewportHeight);

    return () => {
      window.clearTimeout(settleTimeout);
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
      window.visualViewport?.removeEventListener('resize', setViewportHeight);
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
