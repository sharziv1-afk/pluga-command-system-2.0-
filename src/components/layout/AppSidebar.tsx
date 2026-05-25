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

export const AppSidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 right-0 z-30 w-64 select-none flex-col border-e border-[rgba(2,1,8,0.10)] bg-white/72 text-right shadow-[0_18px_50px_rgba(2,1,8,0.08)] backdrop-blur-2xl">
      <div className="border-b border-[rgba(2,1,8,0.08)] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FF6B02]/22 bg-[#FF6B02]/10 text-[#FF6B02]">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-[#020108]">המפקד</h1>
            <p className="mt-0.5 text-[11px] font-bold text-[#667085]">ניהול פיקודי לפלוגה</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <ThemeToggle />
          <QuickHelp />
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5 custom-scrollbar">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');

          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'group flex min-h-11 items-center gap-3 rounded-2xl border px-3 text-sm font-bold transition-all duration-150',
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

      <div className="border-t border-[rgba(2,1,8,0.08)] p-4">
        <div className="mb-3">
          <SystemStatusPanel />
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(2,1,8,0.08)] bg-[#EEF1F5] text-[#667085]">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-black text-[#020108]">משתמש דמו</span>
              <span className="block truncate text-[11px] text-[#667085]">פלוגה ג'</span>
            </div>
          </div>

          <Link
            href="/login"
            title="התנתק"
            className="rounded-xl p-2 text-[#98A2B3] transition-all hover:bg-red-500/10 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
};
