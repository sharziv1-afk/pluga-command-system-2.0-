'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, WifiOff } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { PageTransition } from '@/components/layout/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { OfflineGate } from '@/components/layout/OfflineGate';
import { useApp } from '@/lib/context/AppContext';

function ContentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5" aria-hidden>
      <div className="space-y-2">
        <div className="command-skeleton h-7 w-52 rounded-lg" />
        <div className="command-skeleton h-4 w-72 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="command-skeleton h-20 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="command-skeleton h-64 rounded-[var(--radius-card)]" />
    </div>
  );
}

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { authStatus, authError, refreshProfile, isOfflineSession } = useApp();

  if (authStatus === 'offline') {
    return <OfflineGate onRetry={() => void refreshProfile()} />;
  }

  // Non-authenticated / not-approved states remain standalone (no shell chrome).
  if (authStatus !== 'ready' && authStatus !== 'loading') {
    let title = 'אין משתמש מחובר';
    let message = 'יש להתחבר מחדש כדי להמשיך.';
    let recoveryHref = '/login';
    let recoveryLabel = 'חזרה למסך הכניסה';
    let showReload = false;

    if (authStatus === 'onboarding_required') {
      // Unreachable in the current invite-only model — kept as a defensive
      // fallback (see the comment on getProfileRedirectPath in login/page.tsx).
      title = 'נדרש להשלים את ההרשמה';
      message = 'יש לפנות למפקד הפלוגה להשלמת פתיחת המשתמש.';
      recoveryHref = '/pending-approval';
      recoveryLabel = 'צפייה בסטטוס האישור';
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
      showReload = true;
    }

    return (
      <div className="command-page-shell flex h-svh items-center justify-center p-4" dir="rtl">
        <GlassCard className="w-full max-w-md text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-[var(--color-danger)]" />
          <h1 className="text-lg font-black text-[var(--text-primary)]">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{authError ?? message}</p>
          {showReload ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--action)] px-4 text-sm font-black text-white transition hover:bg-[var(--action-hover)]"
            >
              {recoveryLabel}
            </button>
          ) : (
            <Link
              href={recoveryHref}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--action)] px-4 text-sm font-black text-white transition hover:bg-[var(--action-hover)]"
            >
              {recoveryLabel}
            </Link>
          )}
        </GlassCard>
      </div>
    );
  }

  const loading = authStatus === 'loading';

  return (
    <div className="protected-layout-shell flex h-svh min-w-0 max-w-full overflow-hidden bg-[var(--color-app-bg)]">
      <AppSidebar />

      <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col">
        <MobileHeader />

        {isOfflineSession && (
          <div
            role="status"
            className="flex shrink-0 items-center justify-center gap-2 bg-[var(--color-warning)]/12 px-4 py-2 text-[11px] font-black text-[var(--color-warning)]"
          >
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            מצב אופליין — מוצגים נתונים שנשמרו במכשיר. שינויים יסונכרנו כשהחיבור יחזור.
          </div>
        )}

        <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-24 custom-scrollbar sm:px-5 md:pb-6 xl:px-6">
          {loading ? (
            <ContentSkeleton />
          ) : (
            <PageTransition>{children}</PageTransition>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
