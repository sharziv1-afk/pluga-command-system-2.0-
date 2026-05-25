'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type AppUserProfile = {
  id: string;
  status: 'active' | 'pending' | 'blocked' | 'inactive';
  role_approval_status: 'pending' | 'approved' | 'rejected';
  has_completed_onboarding: boolean;
};

function getProfileRedirectPath(profile: AppUserProfile): string {
  if (!profile.has_completed_onboarding) return '/onboarding';
  if (profile.role_approval_status === 'pending') return '/pending-approval';
  if (profile.status === 'active' && profile.role_approval_status === 'approved') return '/dashboard';

  return '/pending-approval';
}

export default function LoginPage() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const [email, setEmail] = useState('');
  const [devEmail, setDevEmail] = useState(isDevelopment ? 'dev@pluga.local' : '');
  const [devPassword, setDevPassword] = useState(isDevelopment ? 'Dev123456!' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDevSubmitting, setIsDevSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (signInError) {
        if (isDevelopment) {
          console.error('Supabase signInWithOtp failed:', signInError);

          const devDetails = [
            signInError.message,
            'status' in signInError && signInError.status ? `status: ${signInError.status}` : null,
            'code' in signInError && signInError.code ? `code: ${signInError.code}` : null,
          ].filter(Boolean).join(' | ');

          setError(
            devDetails
              ? `לא הצלחנו לשלוח קישור כניסה. שגיאת Supabase: ${devDetails}`
              : 'לא הצלחנו לשלוח קישור כניסה. Supabase החזיר שגיאה ללא פירוט.'
          );
          return;
        }
        setError('לא הצלחנו לשלוח קישור כניסה. בדוק את כתובת הדוא"ל ונסה שוב.');
        return;
      }

      setMessage('שלחנו אליך קישור כניסה מאובטח. פתח את הדוא"ל ואשר כניסה למערכת.');
    } catch (unknownError) {
      if (isDevelopment) {
        console.error('Unexpected login error:', unknownError);

        const devMessage = unknownError instanceof Error ? unknownError.message : String(unknownError);
        setError(
          devMessage
            ? `אירעה שגיאה בחיבור למערכת ההזדהות. שגיאת development: ${devMessage}`
            : 'אירעה שגיאה בחיבור למערכת ההזדהות. שגיאת development ללא פירוט.'
        );
        return;
      }
      setError('אירעה שגיאה בחיבור למערכת ההזדהות. נסה שוב בעוד רגע.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isDevelopment) return;

    setIsDevSubmitting(true);
    setDevError(null);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: devEmail.trim(),
        password: devPassword,
      });

      if (signInError) {
        setDevError(`כניסת פיתוח נכשלה: ${signInError.message}`);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const authUser = userData.user;

      if (userError || !authUser) {
        setDevError('כניסת פיתוח הצליחה, אבל לא נמצא משתמש Supabase תקין.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id,status,role_approval_status,has_completed_onboarding')
        .eq('auth_user_id', authUser.id)
        .maybeSingle<AppUserProfile>();

      if (profileError) {
        setDevError(`לא ניתן לקרוא פרופיל מ-public.users: ${profileError.message}`);
        return;
      }

      if (!profile) {
        setDevError('לא נמצא פרופיל ב-public.users');
        return;
      }

      window.location.href = getProfileRedirectPath(profile);
    } catch (unknownError) {
      const devMessage = unknownError instanceof Error ? unknownError.message : String(unknownError);
      setDevError(`כניסת פיתוח נכשלה: ${devMessage}`);
    } finally {
      setIsDevSubmitting(false);
    }
  };

  return (
    <main className="command-page-shell relative flex items-center justify-center p-4 sm:p-6 text-right">
      <div className="command-auth-overlay pointer-events-none absolute inset-0" />
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02] shadow-[0_14px_30px_rgba(255,107,2,0.14)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-2xl font-black text-[#020108]">המפקד</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">מערכת ניהול פיקודית לפלוגה</p>
        </div>

        <GlassCard glow="orange" className="auth-dark-card w-full">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-black text-[#020108]">כניסה למערכת</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#667085]">
              הזן דוא"ל כדי לקבל קישור כניסה מאובטח
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block space-y-2">
              <span className="block text-xs font-black text-[#344054]">דוא"ל</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="commander@example.com"
                  className="command-input pr-11"
                  disabled={isSubmitting}
                />
              </span>
            </label>

            {message && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-800">
                {message}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  שולח קישור כניסה
                </>
              ) : (
                'קבל קישור כניסה'
              )}
            </GlossyButton>
          </form>

          <div className="mt-6 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 px-4 py-3 text-center text-xs font-bold text-[#667085]">
            מצב פיתוח · Supabase Magic Link
          </div>

          {isDevelopment && (
            <div className="mt-5 rounded-[22px] border border-[#FF6B02]/20 bg-[#FF6B02]/8 p-4">
              <div className="mb-3">
                <h2 className="text-sm font-black text-[#020108]">כניסת פיתוח זמנית</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#667085]">
                  מיועד לפיתוח מקומי בלבד, כדי לעקוף זמנית את מגבלת שליחת המיילים.
                </p>
              </div>

              <form onSubmit={handleDevLogin} className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="block text-[11px] font-black text-[#344054]">email</span>
                  <span className="relative block">
                    <Mail className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                    <input
                      type="email"
                      required
                      value={devEmail}
                      onChange={(event) => setDevEmail(event.target.value)}
                      className="command-input min-h-11 pr-11 text-sm"
                      disabled={isDevSubmitting}
                    />
                  </span>
                </label>

                <label className="block space-y-1.5">
                  <span className="block text-[11px] font-black text-[#344054]">password</span>
                  <span className="relative block">
                    <KeyRound className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                    <input
                      type="password"
                      required
                      value={devPassword}
                      onChange={(event) => setDevPassword(event.target.value)}
                      className="command-input min-h-11 pr-11 text-sm"
                      disabled={isDevSubmitting}
                    />
                  </span>
                </label>

                {devError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-800">
                    {devError}
                  </div>
                )}

                <GlossyButton
                  type="submit"
                  variant="slate"
                  size="md"
                  className="w-full justify-center"
                  disabled={isDevSubmitting}
                >
                  {isDevSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      מתחבר כמשתמש פיתוח
                    </>
                  ) : (
                    'התחבר כמשתמש פיתוח'
                  )}
                </GlossyButton>
              </form>
            </div>
          )}

          <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-[rgba(2,1,8,0.08)] pt-5 text-xs font-bold text-[#667085] sm:flex-row">
            <Link href="/onboarding" className="flex items-center gap-1 transition-colors hover:text-[#FF6B02]">
              <span>רישום ראשוני</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <Link href="/select-role" className="transition-colors hover:text-[#FF6B02]">
              בחירת תפקיד דמו
            </Link>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
