'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, Shield, X } from 'lucide-react';
import { navigationItems } from '@/data/navigation';
import { QuickHelp } from '@/components/layout/QuickHelp';
import { SystemStatusPanel } from '@/components/layout/SystemStatusPanel';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/utils';

export const MobileHeader: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-40 flex w-full select-none items-center justify-between gap-3 border-b border-[rgba(2,1,8,0.08)] bg-white/78 px-4 py-3 text-right shadow-[0_10px_26px_rgba(2,1,8,0.05)] backdrop-blur-2xl lg:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02]">
          <Shield className="h-4 w-4" />
        </div>
        <span className="truncate text-sm font-black text-[#020108]">המפקד · פלוגה ג&apos;</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <QuickHelp />
        <button
          onClick={() => setIsOpen((value) => !value)}
          className="command-icon-button flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(2,1,8,0.10)] bg-white/70 text-[#667085] transition-all hover:border-[#FF6B02]/24 hover:text-[#FF6B02]"
          aria-label={isOpen ? 'סגור תפריט' : 'פתח תפריט'}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 top-[65px] z-30 flex justify-start lg:hidden">
          <button
            aria-label="סגור תפריט"
            onClick={closeMenu}
            className="fixed inset-0 bg-[#020108]/24 backdrop-blur-sm"
          />

          <div className="relative z-10 flex h-full w-72 max-w-[82vw] flex-col border-s border-[rgba(2,1,8,0.10)] bg-white/92 p-4 shadow-2xl backdrop-blur-2xl">
            <SystemStatusPanel className="mb-3" />

            <nav className="mt-2 flex-1 space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={closeMenu}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-2xl border px-3 text-sm font-bold transition-all duration-150',
                      isActive
                        ? 'border-[#FF6B02]/24 bg-[#FF6B02]/12 text-[#C54F00]'
                        : 'border-transparent text-[#667085] hover:bg-[#FF6B02]/8 hover:text-[#020108]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[rgba(2,1,8,0.08)] pt-4">
              <Link
                href="/login"
                onClick={closeMenu}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 text-sm font-bold text-[#667085] transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                התנתק מהמערכת
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
