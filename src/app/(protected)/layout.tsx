import React from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { PageTransition } from '@/components/layout/PageTransition';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="protected-layout-shell command-page-shell flex flex-col">
      <div className="tactical-overlay" />

      <AppSidebar />

      <div className="protected-content-shell flex flex-1 flex-col">
        <MobileHeader />

        <main className="flex-1 max-w-full overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
