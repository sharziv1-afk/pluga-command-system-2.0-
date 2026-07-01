'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Shield, X } from 'lucide-react';
import { navigationItems } from '@/data/navigation';
import { QuickHelp } from '@/components/layout/QuickHelp';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/context/AppContext';

type MobileHeaderProps = {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
};

export const MobileHeader: React.FC<MobileHeaderProps> = ({ isSidebarOpen = false, onToggleSidebar }) => {
  const pathname = usePathname();
  const { currentUser } = useApp();

  const hasAdminAccess = currentUser && (
    (currentUser.role as string) === 'מ״פ' ||
    (currentUser.role as string) === 'מ"פ' ||
    (currentUser.role as string) === 'סמ״פ' ||
    (currentUser.role as string) === 'סמ"פ'
  );

  const filteredNavigationItems = navigationItems.filter(item => {
    if (item.path === '/admin') {
      return hasAdminAccess;
    }
    return true;
  });

  return (
    <>
      <header className="sticky top-0 z-40 flex w-full select-none items-center justify-between gap-3 border-b border-[rgba(2,1,8,0.08)] bg-white/78 px-3 py-2.5 text-right shadow-[0_10px_26px_rgba(2,1,8,0.05)] backdrop-blur-md xl:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02]">
            <Shield className="h-4 w-4" />
          </div>
          <span className="truncate text-sm font-black text-[#020108]">
            המפקד {currentUser ? `· ${currentUser.assigned_frame}` : ''}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <QuickHelp />
          <button
            onClick={onToggleSidebar}
            className="command-icon-button flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(2,1,8,0.10)] bg-white/70 text-[#667085] transition hover:border-[#FF6B02]/24 hover:text-[#FF6B02] xl:hidden"
            aria-label={isSidebarOpen ? 'סגור תפריט' : 'פתח תפריט'}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {isSidebarOpen && (
        <div className="w-full border-b border-[rgba(2,1,8,0.08)] bg-white/72 px-3 py-2.5 shadow-[0_10px_24px_rgba(2,1,8,0.05)] backdrop-blur-md xl:hidden">
          <nav className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar" aria-label="ניווט ראשי">
            {filteredNavigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onToggleSidebar}
                  className={cn(
                    'flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[13px] font-bold transition duration-150',
                    isActive
                      ? 'border-[#FF6B02]/24 bg-[#FF6B02]/12 text-[#C54F00]'
                      : 'border-[rgba(2,1,8,0.08)] bg-white/58 text-[#667085] hover:border-[#FF6B02]/20 hover:bg-[#FF6B02]/8 hover:text-[#020108]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
};
