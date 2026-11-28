'use client';

import React from 'react';
import { QuickHelp } from '@/components/layout/QuickHelp';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ContrastToggle } from '@/components/layout/ContrastToggle';
import { RefreshButton } from '@/components/layout/RefreshButton';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { useApp } from '@/lib/context/AppContext';

/** Slim mobile top bar. Navigation lives in the bottom nav; this only carries
 *  brand, current context and global toggles. Hidden from tablet up (md+). */
export const MobileHeader: React.FC = () => {
  const { currentUser } = useApp();

  return (
    <header className="command-glass-accent safe-top sticky top-0 z-30 flex w-full select-none items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface)]/90 px-3 pb-2.5 text-right md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <img src="/brand/app-logo.png" alt="סמל גדוד 601" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="truncate text-sm font-bold text-[var(--text-primary)]">
          המפקד {currentUser?.assigned_frame ? `· ${currentUser.assigned_frame}` : ''}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <NotificationBell />
        <RefreshButton />
        <ThemeToggle />
        <ContrastToggle />
        <QuickHelp />
      </div>
    </header>
  );
};
