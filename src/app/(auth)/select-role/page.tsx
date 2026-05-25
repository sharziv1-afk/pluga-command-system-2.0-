'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, ShieldCheck, Users } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const roleOptions = ['מ"פ', 'מ"מ', 'מ"כ', 'רס"פ'];
const frameOptions = ['פלוגה', 'מחלקה 1', 'מחלקה 2', 'מחלקה 3', 'מחלקה 4', 'כיתה 1', 'כיתה 2', 'מפל"ג'];
const previewItems = [
  'מ"פ: תמונת מצב פלוגתית',
  'מ"מ: המחלקה שלי',
  'מ"כ: הכיתה שלי',
  'רס"פ: דרישות ולוגיסטיקה',
];

export default function SelectRolePage() {
  const router = useRouter();
  const [role, setRole] = useState(roleOptions[0]);
  const [frame, setFrame] = useState(frameOptions[0]);

  const handleContinue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push('/dashboard');
  };

  return (
    <main className="command-page-shell relative flex items-center justify-center p-4 sm:p-6 lg:p-8 text-right">
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-3xl">
        <GlassCard glow="orange" className="w-full">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02]">
              <Users className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-black text-[#020108]">בחירת תפקיד ומסגרת</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#667085]">
              בחר את התפקיד והמסגרת שלך כדי להמשיך בתהליך הזיהוי
            </p>
          </div>

          <form onSubmit={handleContinue} className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">תפקיד</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="command-select"
                >
                  {roleOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">מסגרת / מחלקה / כיתה</span>
                <select
                  value={frame}
                  onChange={(event) => setFrame(event.target.value)}
                  className="command-select"
                >
                  {frameOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <GlossyButton type="submit" variant="orange" size="lg" className="w-full">
                המשך לאישור
              </GlossyButton>

              <Link
                href="/login"
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-2xl text-xs font-black text-[#667085] transition-colors hover:text-[#FF6B02]"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>חזרה למסך הכניסה</span>
              </Link>
            </div>

            <div className="rounded-[22px] border border-[rgba(2,1,8,0.08)] bg-white/62 p-4">
              <div className="mb-3 flex items-center gap-2 text-[#020108]">
                <Eye className="h-4 w-4 text-[#FF6B02]" />
                <h2 className="text-sm font-black">מה תראה אחרי הכניסה?</h2>
              </div>
              <div className="space-y-2">
                {previewItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[rgba(2,1,8,0.07)] bg-white/70 px-3 py-2 text-sm font-semibold text-[#344054]"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#FF6B02]/18 bg-[#FF6B02]/10 px-3 py-2 text-xs font-bold leading-relaxed text-[#9A4600]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>מצב דמו / זיהוי ראשוני · ללא מידע מבצעי אמיתי</span>
              </div>
            </div>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
