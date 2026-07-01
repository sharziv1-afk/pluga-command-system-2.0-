'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Shield, User } from 'lucide-react';
import { navigationItems } from '@/data/navigation';
import { cn } from '@/lib/utils';
import { QuickHelp } from '@/components/layout/QuickHelp';
import { SystemStatusPanel } from '@/components/layout/SystemStatusPanel';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useApp } from '@/lib/context/AppContext';

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export const AppSidebar: React.FC<AppSidebarProps> = ({ className, onNavigate }) => {
  const pathname = usePathname();
  const { currentUser, isLoading } = useApp();

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
    <aside className={cn('relative z-30 flex h-svh shrink-0 select-none flex-col border-e border-[rgba(2,1,8,0.10)] bg-white/72 text-right shadow-[0_18px_50px_rgba(2,1,8,0.08)] backdrop-blur-2xl', className)}>
      <div className="border-b border-[rgba(2,1,8,0.08)] p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#FF6B02]/22 bg-[#FF6B02]/10 text-[#FF6B02]">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-[#020108]">המפקד</h1>
            <p className="mt-0.5 text-[11px] font-bold text-[#667085]">ניהול פיקודי לפלוגה</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ThemeToggle />
          <QuickHelp />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4 custom-scrollbar">
        {filteredNavigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={onNavigate}
              className={cn(
                'group flex min-h-10 items-center gap-2.5 rounded-xl border px-3 text-[13px] font-bold transition duration-150',
                isActive
                  ? 'border-[#FF6B02]/24 bg-[#FF6B02]/12 text-[#C54F00] shadow-[0_10px_24px_rgba(255,107,2,0.10)]'
                  : 'border-transparent text-[#667085] hover:border-[rgba(2,1,8,0.08)] hover:bg-white/72 hover:text-[#020108]'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors duration-150',
                  isActive ? 'text-[#FF6B02]' : 'text-[#98A2B3] group-hover:text-[#FF6B02]'
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[rgba(2,1,8,0.08)] p-3">
        <div className="mb-2">
          <SystemStatusPanel />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[rgba(2,1,8,0.08)] bg-white/70 p-2.5">
          {isLoading ? (
            <div className="flex w-full items-center gap-2 animate-pulse py-1">
              <div className="h-8 w-8 rounded-xl bg-[#EEF1F5]" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 w-16 rounded bg-[#EEF1F5]" />
                <div className="h-2 w-24 rounded bg-[#EEF1F5]" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[rgba(2,1,8,0.08)] bg-[#EEF1F5] text-[#667085]">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-black text-[#020108]">
                    {currentUser?.full_name || 'משתמש'}
                  </span>
                  <span className="block truncate text-[10px] font-bold text-[#667085]">
                    {currentUser ? `${currentUser.role} • ${currentUser.assigned_frame}` : 'תפקיד לא הוגדר'}
                  </span>
                </div>
              </div>

              <Link
                href="/login"
                title="התנתק"
                className="rounded-xl p-2 text-[#98A2B3] transition hover:bg-red-500/10 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
