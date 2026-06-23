'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function checkSession() {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !data.session) {
        setHasSession(false);
        setError('קישור האיפוס לא תקין או פג תוקף. בקש קישור חדש ממסך הכניסה.');
      } else {
        setHasSession(true);
      }

      setIsCheckingSession(false);
    }

    void checkSession();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (password.length < 8) {
      setError('סיסמה קצרה מדי. הסיסמה חייבת להכיל לפחות 8 תווים.');
      return;
    }

    if (password !== confirmPassword) {
      setError('סיסמאות לא תואמות.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error('Password reset update failed:', updateError);
        setError('עדכון הסיסמה נכשל. נסה שוב בעוד רגע.');
        return;
      }

      setMessage('הסיסמה עודכנה בהצלחה. מעביר לדשבורד...');
      window.setTimeout(() => router.replace('/dashboard'), 900);
    } catch (unknownError) {
      console.error('Password reset update threw:', unknownError);
      setError('עדכון הסיסמה נכשל. נסה שוב בעוד רגע.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="command-page-shell relative flex items-center justify-center p-4 text-right sm:p-6">
      <div className="command-auth-overlay pointer-events-none absolute inset-0" />
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02] shadow-[0_14px_30px_rgba(255,107,2,0.14)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-2xl font-black text-[#020108]">המפקד</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">איפוס סיסמה</p>
        </div>

        <GlassCard glow="orange" className="auth-dark-card w-full">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-black text-[#020108]">הגדרת סיסמה חדשה</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#667085]">
              הזן סיסמה חדשה ואשר אותה. לאחר העדכון תועבר למערכת.
            </p>
          </div>

          {isCheckingSession ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 px-4 py-5 text-sm font-black text-[#667085]">
              <Loader2 className="h-4 w-4 animate-spin" />
              בודק קישור איפוס...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">סיסמה חדשה</span>
                <span className="relative block">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="command-input pl-11 pr-11 text-left"
                    disabled={!hasSession || isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3] transition-colors hover:text-[#FF6B02] focus:outline-none disabled:opacity-50"
                    aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    disabled={!hasSession}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">אימות סיסמה</span>
                <span className="relative block">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    className="command-input pl-11 pr-11 text-left"
                    disabled={!hasSession || isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3] transition-colors hover:text-[#FF6B02] focus:outline-none disabled:opacity-50"
                    aria-label={showConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    disabled={!hasSession}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              {message && (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-800">
                  {error}
                </div>
              )}

              <GlossyButton
                type="submit"
                variant="orange"
                size="lg"
                className="w-full justify-center"
                disabled={!hasSession || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    מעדכן סיסמה...
                  </>
                ) : (
                  'עדכן סיסמה'
                )}
              </GlossyButton>
            </form>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
