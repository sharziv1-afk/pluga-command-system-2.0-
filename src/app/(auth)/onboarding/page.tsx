'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function OnboardingPage() {
  return (
    <main className="command-page-shell relative flex items-center justify-center p-4 text-right sm:p-6" dir="rtl">
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <GlassCard glow="orange" className="w-full max-w-md text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-[#FF6B02]" />
        <h1 className="text-xl font-black text-[#020108]">ההרשמה המצומצמת פעילה כרגע</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#667085]">
          הכניסה לתפקידי מ״מ ומ״כ נמצאת בהולד. בשלב הזה המערכת פתוחה רק לצוות הפיקוד המצומצם.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#FF6B02] px-5 text-sm font-black text-white transition hover:bg-[#E65F00]"
        >
          חזרה למסך הכניסה
        </Link>
      </GlassCard>
    </main>
  );
}
