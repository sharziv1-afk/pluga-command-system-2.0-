import React from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="protected-layout-shell bg-[#030712] flex flex-col">
      {/* Tactical scanline/grid overlay */}
      <div className="tactical-overlay" />

      {/* Sidebar (Fixed on the right on Desktop) */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="protected-content-shell flex flex-1 flex-col">
        {/* Mobile Header (Sticky on small screens) */}
        <MobileHeader />

        {/* Scrollable Dashboard Viewport */}
        <main className="flex-1 max-w-full overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
