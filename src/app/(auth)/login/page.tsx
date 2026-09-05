'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type Step = 'email' | 'code' | 'claim';

type AppUserProfile = {
  id: string;
  status: 'active' | 'pending' | 'blocked' | 'inactive';
  role_approval_status: 'pending' | 'approved' | 'rejected';
  has_completed_onboarding: boolean;
};

function getProfileRedirectPath(profile: AppUserProfile): string {
  // has_completed_onboarding is set true both when a commander creates the
  // invite (admin/page.tsx) and when the invited user claims it
  // (claim_own_profile RPC) — there is no code path left that ever leaves it
  // false, and no row in the database has it false today. This branch is
  // unreachable in practice; /pending-approval is the safe fallback if that
  // ever changes, rather than a dedicated onboarding page nobody can reach.
  if (!profile.has_completed_onboarding) return '/pending-approval';
  if (profile.status === 'active' && profile.role_approval_status === 'approved') return '/dashboard';
  return '/pending-approval';
}

function isRateLimitError(error: { message?: string; code?: string; status?: number } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  const code = error?.code?.toLowerCase() ?? '';
  return error?.status === 429 || code.includes('rate') || message.includes('rate') || message.includes('too many');
}

/**
 * claim_own_profile raises 'no invitation found for this email ...' (errcode
 * P0002) when no commander-created public.users row matches the verified
 * email. That's the invite-only gate — translate it into the real message.
 */
function isNoInvitationError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return error?.code === 'P0002' || message.includes('no invitation found');
}

function logDevelopmentError(message: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') return;
  // Log the raw error directly — narrowing to a fixed shape (message/code/
  // details/hint) silently hides real fields when the thrown value doesn't
  // match that shape, which is exactly what happened here: Supabase's fetch
  // wrapper can throw a plain AuthRetryableFetchError whose useful data
  // (name, status, cause) isn't message/code/details/hint at all.
  console.error(message, error);
}

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timeout = window.setTimeout(() => {
      setCooldownSeconds((currentValue) => Math.max(0, currentValue - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [cooldownSeconds]);

  const backToEmail = () => {
    setStep('email');
    setOtpCode('');
    setMessage(null);
    setError(null);
  };

  const sendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSendingOtp || cooldownSeconds > 0) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('דוא״ל הוא שדה חובה');
      return;
    }

    setIsSendingOtp(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      // shouldCreateUser: true — Supabase Auth may not know this email yet,
      // even if the commander already invited it. The real invite gate is
      // claim_own_profile after verification, not this flag.
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });

      if (signInError) {
        logDevelopmentError('signInWithOtp failed', signInError);
        setError(
          isRateLimitError(signInError)
            ? 'נשלחו יותר מדי קודים. נסה שוב מאוחר יותר.'
            : 'לא הצלחנו לשלוח קוד אימות כרגע. נסה שוב בעוד רגע.'
        );
        return;
      }

      setEmail(normalizedEmail);
      setStep('code');
      setCooldownSeconds(60);
      setMessage('שלחנו קוד אימות למייל.');
    } catch (unknownError) {
      logDevelopmentError('signInWithOtp threw', unknownError);
      setError('לא הצלחנו לשלוח קוד אימות כרגע. נסה שוב בעוד רגע.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isVerifyingOtp) return;

    const normalizedToken = otpCode.trim();
    setIsVerifyingOtp(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: normalizedToken,
        type: 'email',
      });

      if (verifyError || !verifyData.user) {
        setError(`קוד האימות לא אושר: ${verifyError?.message ?? 'לא נמצא משתמש מאומת'}`);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id,status,role_approval_status,has_completed_onboarding')
        .eq('auth_user_id', verifyData.user.id)
        .maybeSingle<AppUserProfile>();

      if (profileError) {
        logDevelopmentError('Profile lookup after verify failed', profileError);
        setError('ההתחברות הצליחה, אך לא ניתן לטעון את הפרופיל כרגע. נסה שוב בעוד רגע.');
        return;
      }

      if (!profile) {
        // First time this auth identity is seen — try to link it to a
        // commander-created invitation via claim_own_profile.
        setStep('claim');
        setMessage(null);
        return;
      }

      await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', profile.id);
      window.location.href = getProfileRedirectPath(profile);
    } catch (unknownError) {
      logDevelopmentError('verifyOtp threw', unknownError);
      setError('אימות הקוד נכשל. בדוק את הקוד ונסה שוב.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const claimProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isClaiming) return;

    const normalizedName = fullName.trim();
    if (!normalizedName) {
      setError('שם מלא הוא שדה חובה');
      return;
    }

    setIsClaiming(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: claimError } = await supabase.rpc('claim_own_profile', {
        p_email: email,
        p_name: normalizedName,
      });

      if (claimError) {
        logDevelopmentError('claim_own_profile failed', claimError);
        if (isNoInvitationError(claimError)) {
          setError('לא נמצאה גישה עבור מייל זה. פנה למפקד הפלוגה לפתיחת משתמש.');
        } else {
          setError('לא הצלחנו לשייך את המשתמש כרגע. נסה שוב בעוד רגע.');
        }
        await supabase.auth.signOut();
        setStep('email');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id,status,role_approval_status,has_completed_onboarding')
        .eq('auth_user_id', user?.id ?? '')
        .maybeSingle<AppUserProfile>();

      if (profileError || !profile) {
        setError('השיוך הצליח, אך לא ניתן לטעון את הפרופיל כרגע. נסה שוב בעוד רגע.');
        return;
      }

      window.location.href = getProfileRedirectPath(profile);
    } catch (unknownError) {
      logDevelopmentError('claim_own_profile threw', unknownError);
      setError('לא הצלחנו לשייך את המשתמש כרגע. נסה שוב בעוד רגע.');
    } finally {
      setIsClaiming(false);
    }
  };

  const cooldownText = cooldownSeconds > 0 ? `אפשר לשלוח קוד נוסף בעוד ${cooldownSeconds} שניות` : null;

  return (
    <main className="command-page-shell relative flex items-center justify-center p-4 text-right sm:p-6">
      <div className="command-auth-overlay pointer-events-none absolute inset-0" />
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/10 text-[var(--brand)] shadow-[0_14px_30px_rgba(255,107,2,0.14)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">המפקד</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-muted-accessible)]">מערכת ניהול פיקודית לפלוגה</p>
        </div>

        <GlassCard glow="orange" className="auth-dark-card w-full">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">כניסה למערכת</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted-accessible)]">
              הזן את כתובת הדוא״ל שלך. קוד אימות חד-פעמי יישלח אליך — אין צורך בסיסמה.
            </p>
          </div>

          {step === 'email' && (
            <form onSubmit={sendCode} className="space-y-4">
              <label className="block space-y-2">
                <span className="block text-xs font-semibold text-[var(--text-secondary)]">דוא״ל</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--command-subtle)]" />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="commander@example.com"
                    className="command-input pl-11 text-left"
                    disabled={isSendingOtp}
                  />
                </span>
              </label>

              {message && (
                <div className="flex items-start gap-2 rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-3 text-sm leading-relaxed text-[var(--color-success)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 py-3 text-sm leading-relaxed text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              <GlossyButton
                type="submit"
                variant="orange"
                size="lg"
                className="w-full justify-center"
                disabled={isSendingOtp || cooldownSeconds > 0}
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    שולח קוד...
                  </>
                ) : (
                  'שלח קוד אימות'
                )}
              </GlossyButton>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-muted-accessible)]">
                קוד האימות נשלח אל <span dir="ltr">{email}</span>
              </div>

              <label className="block space-y-2">
                <span className="block text-xs font-semibold text-[var(--text-secondary)]">קוד אימות</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  dir="ltr"
                  required
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="12345678"
                  className="command-input text-center text-lg font-semibold tracking-[0.28em]"
                  disabled={isVerifyingOtp}
                  autoFocus
                />
              </label>

              {message && (
                <div className="flex items-start gap-2 rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-3 text-sm leading-relaxed text-[var(--color-success)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 py-3 text-sm leading-relaxed text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              {cooldownText && (
                <div className="rounded-2xl border border-[var(--brand)]/18 bg-[var(--brand)]/10 px-4 py-3 text-center text-xs font-semibold text-[var(--color-action-on-surface)]">
                  {cooldownText}
                </div>
              )}

              <GlossyButton
                type="submit"
                variant="orange"
                size="lg"
                className="w-full justify-center"
                disabled={isVerifyingOtp}
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    מאמת קוד
                  </>
                ) : (
                  'אמת קוד והמשך'
                )}
              </GlossyButton>

              <button
                type="button"
                onClick={backToEmail}
                className="flex min-h-10 w-full items-center justify-center rounded-2xl text-xs font-semibold text-[var(--text-muted-accessible)] transition-colors hover:text-[var(--brand)]"
              >
                שנה כתובת מייל / שלח שוב
              </button>
            </form>
          )}

          {step === 'claim' && (
            <form onSubmit={claimProfile} className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] px-4 py-3 text-sm font-bold text-[var(--text-muted-accessible)]">
                כניסה ראשונה עבור <span dir="ltr">{email}</span> — אשר את שמך המלא כדי לשייך את המשתמש.
              </div>

              <label className="block space-y-2">
                <span className="block text-xs font-semibold text-[var(--text-secondary)]">שם מלא ודרגה</span>
                <span className="relative block">
                  <UserRound className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--command-subtle)]" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder='לדוגמה: סג"ם רועי לוי'
                    className="command-input pr-11"
                    disabled={isClaiming}
                    autoFocus
                  />
                </span>
              </label>

              {error && (
                <div className="rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 py-3 text-sm leading-relaxed text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              <GlossyButton
                type="submit"
                variant="orange"
                size="lg"
                className="w-full justify-center"
                disabled={isClaiming}
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    משייך משתמש...
                  </>
                ) : (
                  'המשך למערכת'
                )}
              </GlossyButton>
            </form>
          )}

          <div className="mt-5 flex items-center justify-center border-t border-[var(--border-subtle)] pt-5 text-xs font-bold text-[var(--text-muted-accessible)]">
            <span className="text-[var(--command-subtle)]">גישה למערכת נפתחת על ידי מפקד הפלוגה בלבד</span>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
