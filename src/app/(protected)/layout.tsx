'use client';

import React, { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { PageTransition } from '@/components/layout/PageTransition';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="protected-layout-shell command-page-shell flex h-svh overflow-hidden">
      <div className="tactical-overlay" />

      <AppSidebar className="hidden w-64 xl:flex" />

      <div className="protected-content-shell flex min-h-0 flex-1 flex-col">
        <MobileHeader
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((value) => !value)}
        />

        <main className="min-h-0 flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto p-4 sm:p-5 xl:p-6 custom-scrollbar">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
