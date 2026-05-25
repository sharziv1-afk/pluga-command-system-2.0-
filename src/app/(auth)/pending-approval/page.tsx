'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock3, LogOut, RefreshCw, UserCheck } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function PendingApprovalPage() {
  const router = useRouter();

  const handleBypassAsCommander = () => {
    router.push('/admin');
  };

  const handleRefresh = () => {
    alert('בודק סטטוס אישור מול השרת...');
  };

  return (
    <main className="command-page-shell relative flex items-center justify-center p-4 sm:p-6 text-right">
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <GlassCard glow="orange" className="w-full">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02]">
              <Clock3 className="h-8 w-8" />
            </div>
            <StatusBadge status="ממתין לאישור" />
            <h1 className="mt-4 text-xl font-black text-[#020108]">הפרופיל שלך ממתין לאישור מנהל</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#667085]">
              הבקשה נרשמה במערכת. לאחר אישור מנהל, תיפתח גישה למסכים הרלוונטיים לפי התפקיד והמסגרת.
            </p>
          </div>

          <div className="mb-6 space-y-3 rounded-[22px] border border-[rgba(2,1,8,0.08)] bg-white/62 p-4">
            <div>
              <span className="block text-[11px] font-black text-[#98A2B3]">סטטוס אישור</span>
              <p className="mt-1 text-sm font-semibold text-[#344054]">
                ממתין לבדיקת מנהל במערכת. אין צורך לפתוח בקשה נוספת.
              </p>
            </div>
            <div>
              <span className="block text-[11px] font-black text-[#98A2B3]">סביבת פיתוח</span>
              <p className="mt-1 text-sm font-semibold text-[#344054]">
                התצוגה שומרת על זרימת הדמו הקיימת עד לאימות Magic Link מלא.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <GlossyButton variant="slate" onClick={handleRefresh} className="w-full">
              <RefreshCw className="h-4 w-4" />
              בדוק סטטוס אישור מחדש
            </GlossyButton>

            <GlossyButton variant="orange" onClick={handleBypassAsCommander} className="w-full">
              <UserCheck className="h-4 w-4" />
              מצב בדיקה: כניסה לאישור מנהל
            </GlossyButton>

            <Link
              href="/login"
              className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 text-xs font-black text-[#667085] transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>התנתקות מהמערכת</span>
            </Link>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
