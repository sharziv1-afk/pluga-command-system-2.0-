'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, PanelRightClose, PanelRightOpen, Shield, User } from 'lucide-react';
import { visibleNavItems } from '@/data/navigation';
import { hasAdminAccess, isCompanyCommander } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { QuickHelp } from '@/components/layout/QuickHelp';
import { SystemStatusPanel } from '@/components/layout/SystemStatusPanel';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ContrastToggle } from '@/components/layout/ContrastToggle';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { clearDeviceSession } from '@/lib/offline/session';

const COLLAPSE_KEY = 'command_sidebar_collapsed';

export const AppSidebar: React.FC<{ className?: string }> = ({ className }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading } = useApp();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const { error } = await createSupabaseBrowserClient().auth.signOut();
    if (error) {
      logSupabaseError('Sign out failed', error);
      setSignOutError('לא ניתן להתנתק כרגע. נסה שוב בעוד רגע.');
      setIsSigningOut(false);
      return;
    }
    await clearDeviceSession();
    router.replace('/login');
    router.refresh();
  };

  const items = visibleNavItems(
    hasAdminAccess(currentUser?.role as string | undefined),
    isCompanyCommander(currentUser?.role as string | undefined),
  );

  // Label/text visibility: hidden in rail (md, or lg-collapsed); shown in full (lg + !collapsed).
  const labelCls = collapsed ? 'hidden' : 'hidden lg:inline';
  const blockCls = collapsed ? 'lg:hidden' : 'hidden lg:block';

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'relative z-30 hidden h-svh shrink-0 select-none flex-col border-e border-[var(--border-subtle)] bg-[var(--surface)] text-right shadow-[var(--shadow-xs)] md:flex md:w-[76px]',
        collapsed ? 'lg:w-[76px]' : 'lg:w-64',
        className,
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] p-3 lg:p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--action)]/25 bg-[var(--brand)]/10 text-[var(--color-action-on-surface)]">
          <Shield className="h-5 w-5" />
        </div>
        <div className={cn('min-w-0', labelCls === 'hidden' ? 'hidden' : 'hidden lg:block')}>
          <h1 className="truncate text-base font-black text-[var(--text-primary)]">המפקד</h1>
          <p className="mt-0.5 truncate text-[11px] font-bold text-[var(--text-muted-accessible)]">ניהול פיקודי לפלוגה</p>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
          title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
          className="ms-auto hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted-accessible)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] lg:flex"
        >
          {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav aria-label="ניווט ראשי" className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4 custom-scrollbar">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');
          return (
            <Link
              key={item.path}
              href={item.path}
              title={item.name}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex min-h-11 items-center gap-3 rounded-xl border px-2.5 text-[13px] font-bold transition duration-[var(--motion-fast)]',
                collapsed ? 'lg:justify-center' : 'lg:justify-start',
                'justify-center lg:justify-start',
                isActive
                  ? 'border-[var(--action)]/25 bg-[var(--brand)]/10 text-[var(--color-action-on-surface)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-[var(--color-action-on-surface)]' : 'text-[var(--text-muted-accessible)] group-hover:text-[var(--color-action-on-surface)]')} />
              <span className={labelCls}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border-subtle)] p-2.5 lg:p-3">
        <div className={cn('mb-2', blockCls)}>
          <SystemStatusPanel />
        </div>

        <div className="mb-2 flex flex-wrap justify-center gap-2 lg:justify-start">
          <ThemeToggle />
          <ContrastToggle />
          <QuickHelp />
        </div>

        <div className={cn('flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2', collapsed ? 'justify-center' : 'justify-center lg:justify-start')}>
          {isLoading ? (
            <div className="flex w-full items-center justify-center gap-2 py-1 lg:justify-start">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-[var(--border-subtle)] command-skeleton" />
              <div className={cn('flex-1 space-y-1', blockCls)}>
                <div className="h-2.5 w-16 rounded bg-[var(--border-subtle)] command-skeleton" />
                <div className="h-2 w-24 rounded bg-[var(--border-subtle)] command-skeleton" />
              </div>
            </div>
          ) : (
            <>
              <div className={cn('h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted-accessible)]', collapsed ? 'hidden' : 'hidden lg:flex')}>
                <User className="h-4 w-4" />
              </div>
              <div className={cn('min-w-0 flex-1', blockCls)}>
                <span className="block truncate text-xs font-black text-[var(--text-primary)]">
                  {currentUser?.full_name || 'משתמש'}
                </span>
                <span className="block truncate text-[10px] font-bold text-[var(--text-muted-accessible)]">
                  {currentUser ? `${currentUser.role} • ${currentUser.assigned_frame}` : 'תפקיד לא הוגדר'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                aria-label="התנתק"
                title="התנתק"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted-accessible)] transition hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {signOutError && !collapsed && (
          <p role="alert" className="mt-2 text-[11px] font-bold text-[var(--color-danger)]">{signOutError}</p>
        )}
      </div>
    </aside>
  );
};
