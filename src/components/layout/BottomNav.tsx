'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, MoreHorizontal } from 'lucide-react';
import { bottomNavSplit } from '@/data/navigation';
import { hasAdminAccess } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { CommandOverlay } from '@/components/ui/CommandDialog';

function isActivePath(pathname: string, path: string) {
  return pathname === path || (pathname === '/' && path === '/dashboard');
}

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  const { primary, more } = bottomNavSplit(hasAdminAccess(currentUser?.role as string | undefined));
  const moreActive = more.some((item) => isActivePath(pathname, item.path));

  const handleSignOut = async () => {
    const { error } = await createSupabaseBrowserClient().auth.signOut();
    if (error) {
      console.error('Supabase sign out failed:', error.message);
      return;
    }
    setMoreOpen(false);
    router.replace('/login');
    router.refresh();
  };

  const tabCls = (active: boolean) =>
    cn(
      'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-bold transition',
      active ? 'text-[var(--color-action-on-surface)]' : 'text-[var(--text-muted-accessible)]',
    );

  return (
    <>
      <nav
        aria-label="ניווט תחתון"
        className="command-glass-accent safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface)]/95 md:hidden"
      >
        <ul className="flex items-stretch">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.path);
            return (
              <li key={item.path} className="flex-1">
                <Link href={item.path} aria-current={active ? 'page' : undefined} className={tabCls(active)}>
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(tabCls(moreActive), 'w-full')}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>עוד</span>
            </button>
          </li>
        </ul>
      </nav>

      <CommandOverlay open={moreOpen} onClose={() => setMoreOpen(false)} title="עוד" variant="sheet">
        <ul className="space-y-1">
          {more.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.path);
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm font-bold transition',
                    active
                      ? 'border-[var(--action)]/25 bg-[var(--brand)]/10 text-[var(--color-action-on-surface)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active ? 'text-[var(--color-action-on-surface)]' : 'text-[var(--text-muted-accessible)]')} />
                  {item.name}
                </Link>
              </li>
            );
          })}
          <li className="pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-bold text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10"
            >
              <LogOut className="h-5 w-5" />
              התנתק
            </button>
          </li>
        </ul>
      </CommandOverlay>
    </>
  );
};
