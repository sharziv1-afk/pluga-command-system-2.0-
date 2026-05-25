'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ClipboardList, User } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const roles = ['מ"פ', 'סמ"פ', 'מ"מ', 'מ"כ', 'רס"פ'];
const frames = [
  'פלוגה',
  'מפל"ג',
  'מחלקה 1',
  'מחלקה 2',
  'מחלקה 3',
  'מחלקה 4',
  'כיתה 1',
  'כיתה 2',
  'כיתה 3',
  'כיתה 4',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(roles[2]);
  const [frame, setFrame] = useState(frames[2]);
  const [email, setEmail] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push('/pending-approval');
  };

  return (
    <main className="command-page-shell relative flex items-center justify-center p-4 sm:p-6 text-right">
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl">
        <GlassCard glow="orange" className="w-full">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02]">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-black text-[#020108]">השלמת פרופיל פיקודי</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#667085]">
              מלא את פרטי הזיהוי הראשוניים כדי להעביר את הפרופיל לאישור מנהל.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#667085]">
            {['פרטים', 'תפקיד', 'אישור'].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 px-3 py-2"
              >
                <span className={index === 0 ? 'text-[#FF6B02]' : ''}>{index + 1}. {step}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">שם מלא ודרגה</span>
              <span className="relative block">
                <User className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder='לדוגמה: סג"ם רועי לוי'
                  className="command-input pr-11"
                />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">דוא"ל</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@idf.il"
                className="command-input"
              />
            </label>

            <div className="space-y-2">
              <span className="block text-xs font-black text-[#344054]">תפקיד</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {roles.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setRole(item)}
                    className={`min-h-11 rounded-2xl border px-3 text-sm font-black transition-all duration-150 ${
                      role === item
                        ? 'border-[#FF6B02]/35 bg-[#FF6B02]/12 text-[#C54F00] shadow-[0_10px_22px_rgba(255,107,2,0.12)]'
                        : 'border-[rgba(2,1,8,0.10)] bg-white/70 text-[#667085] hover:border-[#FF6B02]/24 hover:bg-[#FF6B02]/8'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">מסגרת / מחלקה / כיתה</span>
              <select
                value={frame}
                onChange={(event) => setFrame(event.target.value)}
                className="command-select"
              >
                {frames.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-3 pt-2">
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
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
