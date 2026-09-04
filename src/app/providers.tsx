'use client';

import React, { useEffect } from 'react';
import { AppProvider } from '@/lib/context/AppContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
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
