'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldAlert } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { PageTransition } from '@/components/layout/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { useApp } from '@/lib/context/AppContext';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { authStatus, authError } = useApp();

  if (authStatus === 'loading') {
    return (
      <div className="command-page-shell flex h-svh items-center justify-center p-4" dir="rtl">
        <div className="flex items-center gap-3 text-sm font-black text-[#667085]" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-[#FF6B02]" />
          טוען את פרופיל המשתמש...
        </div>
      </div>
    );
  }

  if (authStatus !== 'ready') {
    let title = 'אין משתמש מחובר';
    let message = 'יש להתחבר מחדש כדי להמשיך.';
    let recoveryHref = '/login';
    let recoveryLabel = 'חזרה למסך הכניסה';

    if (authStatus === 'onboarding_required') {
      title = 'נדרש להשלים את ההרשמה';
      message = 'יש להשלים את פרטי המשתמש לפני הכניסה למערכת.';
      recoveryHref = '/onboarding';
      recoveryLabel = 'המשך להרשמה';
    } else if (authStatus === 'pending_approval') {
      title = 'החשבון ממתין לאישור';
      message = 'הגישה למערכת תיפתח לאחר אישור החשבון.';
      recoveryHref = '/pending-approval';
      recoveryLabel = 'צפייה בסטטוס האישור';
    } else if (authStatus === 'access_blocked') {
      title = 'הגישה לחשבון חסומה';
      message = 'החשבון אינו מורשה לגשת למערכת. יש לפנות למנהל המערכת.';
    } else if (authStatus === 'profile_missing') {
      title = 'לא נמצא פרופיל משתמש';
      message = 'לא נמצא פרופיל משתמש לחשבון המחובר. יש לפנות למנהל המערכת.';
    } else if (authStatus === 'error') {
      title = 'טעינת הפרופיל נכשלה';
      message = 'לא ניתן לטעון את פרופיל המשתמש כרגע. יש לרענן ולנסות שוב.';
      recoveryLabel = 'נסה שוב';
    }

    return (
      <div className="command-page-shell flex h-svh items-center justify-center p-4" dir="rtl">
        <GlassCard className="w-full max-w-md text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-red-600" />
          <h1 className="text-lg font-black text-[#020108]">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#667085]">
            {authError ?? message}
          </p>
          {authStatus === 'error' ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FF6B02] px-4 text-sm font-black text-white transition hover:bg-[#E55F00]"
            >
              {recoveryLabel}
            </button>
          ) : (
            <Link
              href={recoveryHref}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FF6B02] px-4 text-sm font-black text-white transition hover:bg-[#E55F00]"
            >
              {recoveryLabel}
            </Link>
          )}
        </GlassCard>
      </div>
    );
  }

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
