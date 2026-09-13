'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { visibleNavItems } from '@/data/navigation';
import { hasAdminAccess, isCompanyCommander } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context/AppContext';

function isActivePath(pathname: string, path: string) {
  return pathname === path || (pathname === '/' && path === '/dashboard');
}

/**
 * One scrollable row instead of 4 fixed tabs + a "More" sheet.
 *
 * The sheet was its own dialog for what was, at most, six extra links —
 * a tap to open a window to tap again for the actual destination. A phone
 * screen isn't wide enough for ten tabs at a comfortable touch size, but it
 * doesn't need to be: the row scrolls, the everyday screens sit first in
 * navigationItems (which is why that array's order is load-bearing — see the
 * note on it) so they need no scrolling at all, and every screen is one tap
 * away instead of two.
 */
export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { currentUser } = useApp();

  const items = visibleNavItems(
    hasAdminAccess(currentUser?.role as string | undefined),
    isCompanyCommander(currentUser?.role as string | undefined),
  );

  const tabCls = (active: boolean) =>
    cn(
      'flex min-h-[52px] min-w-[74px] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-caption font-bold transition',
      active ? 'text-[var(--color-action-on-surface)]' : 'text-[var(--text-muted-accessible)]',
    );

  return (
    <nav
      aria-label="ניווט תחתון"
      className="command-glass-accent safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface)]/95 md:hidden"
    >
      <ul className="flex items-stretch overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.path);
          return (
            <li key={item.path} className="flex flex-1">
              <Link href={item.path} aria-current={active ? 'page' : undefined} className={tabCls(active)}>
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
