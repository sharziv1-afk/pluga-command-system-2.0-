'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type AuthMode = 'existing' | 'register';
type OtpStep = 'form' | 'code';

type AppUserProfile = {
  id: string;
  auth_user_id: string | null;
  email: string;
  status: 'active' | 'pending' | 'blocked' | 'inactive';
  role_approval_status: 'pending' | 'approved' | 'rejected';
  has_completed_onboarding: boolean;
};

type RoleOption = {
  name: string;
};

type UnitOption = {
  id: string | null;
  name: string;
};

type RegistrationDraft = {
  fullName: string;
  email: string;
  role: string;
  unitId: string | null;
  password?: string;
};

const profileSelect = 'id,auth_user_id,email,status,role_approval_status,has_completed_onboarding';

const fallbackRoles: RoleOption[] = [
  { name: 'מ״פ' },
  { name: 'סמ״פ' },
  { name: 'ע. מ״פ' },
  { name: 'רס״פ / לוגיסטיקה' },
  { name: 'חובש פלוגתי' },
  { name: 'קשר פלוגתי' },
  { name: 'מ״מ 1' },
  { name: 'מ״מ 2' },
  { name: 'מ״מ 3' },
  { name: 'מ״מ 4' },
  { name: 'מ״כ 1א' },
  { name: 'מ״כ 1ב' },
  { name: 'מ״כ 1ג' },
  { name: 'מ״כ 1ד' },
  { name: 'מ״כ 2א' },
  { name: 'מ״כ 2ב' },
  { name: 'מ״כ 2ג' },
  { name: 'מ״כ 2ד' },
  { name: 'מ״כ 3א' },
  { name: 'מ״כ 3ב' },
  { name: 'מ״כ 3ג' },
  { name: 'מ״כ 3ד' },
  { name: 'מ״כ 4א' },
  { name: 'מ״כ 4ב' },
  { name: 'מ״כ 4ג' },
  { name: 'מ״כ 4ד' },
  { name: 'סמל 1' },
  { name: 'סמל 2' },
  { name: 'סמל 3' },
  { name: 'סמל 4' },
  { name: 'ב.קוד / נהג' },
  { name: 'ב.קוד' },
  { name: 'נהג' },
];

const fallbackUnits: UnitOption[] = [
  { id: null, name: 'פלוגה' },
  { id: null, name: 'מחלקה 1' },
  { id: null, name: 'מחלקה 2' },
  { id: null, name: 'מחלקה 3' },
  { id: null, name: 'מחלקה 4' },
  { id: null, name: 'לוגיסטיקה' },
  { id: null, name: 'רפואה' },
  { id: null, name: 'קשר' },
  { id: null, name: 'רכב' },
];

function normalizeIdentityName(value: string) {
  return value.trim().replace(/[״"]/g, '"').replace(/[׳']/g, "'");
}

function getUnitOptionValue(unit: UnitOption) {
  return unit.id ?? `fallback:${unit.name}`;
}

function getPersistableUnitId(unitValue: string) {
  if (unitValue === 'none' || unitValue.startsWith('fallback:')) return null;
  return unitValue;
}

function getPreferredUnitNameForRole(role: string): string | null {
  const normalizedRole = normalizeIdentityName(role);
  const platoonMatch = normalizedRole.match(/^(?:מ"מ|מ"כ|סמל) ([1-4])/);

  if (platoonMatch) return `מחלקה ${platoonMatch[1]}`;
  if (['מ"פ', 'סמ"פ', 'ע. מ"פ'].includes(normalizedRole)) return 'פלוגה';
  if (normalizedRole.includes('רס"פ') || normalizedRole.includes('לוגיסטיקה')) return 'לוגיסטיקה';
  if (normalizedRole === 'חובש פלוגתי') return 'רפואה';
  if (normalizedRole === 'קשר פלוגתי') return 'קשר';
  if (normalizedRole.includes('ב.קוד') || normalizedRole.includes('נהג')) return 'רכב';

  return null;
}

function getProfileRedirectPath(profile: AppUserProfile): string {
  if (!profile.has_completed_onboarding) return '/onboarding';
  if (profile.role_approval_status === 'pending') return '/pending-approval';
  if (profile.status === 'active' && profile.role_approval_status === 'approved') return '/dashboard';

  return '/pending-approval';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRateLimitError(error: { message?: string; code?: string; status?: number } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  const code = error?.code?.toLowerCase() ?? '';

  return error?.status === 429 || code.includes('rate') || message.includes('rate') || message.includes('too many');
}

function logDevelopmentError(message: string, error: { message?: string; code?: string; details?: string; hint?: string } | null) {
  if (process.env.NODE_ENV !== 'development') return;

  console.error(message, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

export default function LoginPage() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const [authMode, setAuthMode] = useState<AuthMode>('existing');
  const [otpStep, setOtpStep] = useState<OtpStep>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState(fallbackRoles[0].name);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(getUnitOptionValue(fallbackUnits[0]));
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft | null>(null);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>(fallbackRoles);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>(fallbackUnits);
  const [devEmail, setDevEmail] = useState(isDevelopment ? 'dev@pluga.local' : '');
  const [devPassword, setDevPassword] = useState(isDevelopment ? 'Dev123456!' : '');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [isDevSubmitting, setIsDevSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadIdentityOptions() {
      const [{ data: roles }, { data: units }] = await Promise.all([
        supabase.from('roles').select('name').order('permission_level', { ascending: false }),
        supabase.from('units').select('id,name').order('created_at', { ascending: true }),
      ]);

      if (roles?.length) {
        setRoleOptions(roles);
        setSelectedRole((currentRole) => roles.some((role) => role.name === currentRole) ? currentRole : roles[0].name);
      }

      if (units?.length) {
        setUnitOptions(units);
        setSelectedUnitId((currentUnitId) => {
          if (units.some((unit) => getUnitOptionValue(unit) === currentUnitId)) return currentUnitId;
          return getUnitOptionValue(units[0]);
        });
      }
    }

    loadIdentityOptions();
  }, []);

  useEffect(() => {
    if (authMode !== 'register') return;

    const preferredUnitName = getPreferredUnitNameForRole(selectedRole);
    const preferredUnit = unitOptions.find((unit) => unit.name === preferredUnitName);

    if (!preferredUnit) return;

    const preferredUnitValue = getUnitOptionValue(preferredUnit);

    setSelectedUnitId((currentUnitId) => currentUnitId === preferredUnitValue ? currentUnitId : preferredUnitValue);
  }, [authMode, selectedRole, unitOptions]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timeout = window.setTimeout(() => {
      setCooldownSeconds((currentValue) => Math.max(0, currentValue - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [cooldownSeconds]);

  const resetOtpState = (nextMode = authMode) => {
    setAuthMode(nextMode);
    setOtpStep('form');
    setOtpCode('');
    setPassword('');
    setConfirmPassword('');
    setShowLoginPassword(false);
    setShowRegPassword(false);
    setShowRegConfirmPassword(false);
    setMessage(null);
    setError(null);
  };

  const handlePasswordResetRequest = async () => {
    if (isSendingReset) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('אימייל לא תקין');
      return;
    }

    setIsSendingReset(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (resetError) {
        logDevelopmentError('Password reset email failed', resetError);
        setError('לא הצלחנו לשלוח קישור איפוס. נסה שוב.');
        return;
      }

      setEmail(normalizedEmail);
      setMessage('אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה');
    } catch (unknownError) {
      logDevelopmentError('Password reset email crashed', unknownError as { message?: string; code?: string; details?: string; hint?: string });
      setError('לא הצלחנו לשלוח קישור איפוס. נסה שוב.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleExistingUserLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoggingIn) return;

    const normalizedEmail = email.trim().toLowerCase();

    setIsLoggingIn(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      if (signInError) {
        const isInvalidCreds = signInError.message.toLowerCase().includes('invalid login credentials') ||
                               signInError.status === 400;
        setError(isInvalidCreds ? 'המייל או הסיסמה אינם נכונים' : `שגיאת התחברות: ${signInError.message}`);
        logDevelopmentError('Existing user login failed', signInError);
        return;
      }

      const authUser = authData.user;
      if (!authUser) {
        setError('המייל או הסיסמה אינם נכונים');
        return;
      }

      let { data: profile, error: profileError } = await supabase
        .from('users')
        .select(profileSelect)
        .eq('auth_user_id', authUser.id)
        .maybeSingle<AppUserProfile>();

      if (!profile && !profileError) {
        const result = await supabase
          .from('users')
          .select(profileSelect)
          .eq('email', normalizedEmail)
          .maybeSingle<AppUserProfile>();

        profile = result.data;
        profileError = result.error;
      }

      if (profileError) {
        setError(`לא ניתן לקרוא פרופיל משתמש: ${profileError.message}`);
        return;
      }

      if (!profile) {
        setError('לא נמצא פרופיל למייל הזה. יש לבצע הרשמה ראשונה.');
        await supabase.auth.signOut();
        return;
      }

      if (profile.status === 'blocked') {
        setError('המשתמש חסום. פנה למנהל המערכת.');
        await supabase.auth.signOut();
        return;
      }

      if (profile.status === 'inactive') {
        setError('המשתמש אינו פעיל. פנה למנהל המערכת.');
        await supabase.auth.signOut();
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (updateError) {
        logDevelopmentError('Existing user last_login_at update failed', updateError);
      }

      window.location.href = getProfileRedirectPath(profile);
    } catch (unknownError) {
      setError(`התחברות נכשלה: ${getErrorMessage(unknownError)}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const sendRegistrationCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSendingOtp || cooldownSeconds > 0) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    const selectedUnit = getPersistableUnitId(selectedUnitId);

    if (!normalizedName) {
      setError('שם מלא הוא שדה חובה');
      return;
    }
    if (!normalizedEmail) {
      setError('דוא״ל הוא שדה חובה');
      return;
    }
    if (!password) {
      setError('סיסמה היא שדה חובה');
      return;
    }
    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן זהות');
      return;
    }
    if (!selectedRole) {
      setError('תפקיד מבוקש הוא שדה חובה');
      return;
    }

    setIsSendingOtp(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });

      if (signInError) {
        setError(
          isRateLimitError(signInError)
            ? 'נשלחו יותר מדי קודים. נסה שוב מאוחר יותר.'
            : `לא הצלחנו לשלוח קוד אימות: ${signInError.message}`
        );
        return;
      }

      setEmail(normalizedEmail);
      setRegistrationDraft({
        fullName: normalizedName,
        email: normalizedEmail,
        role: selectedRole,
        unitId: selectedUnit,
        password: password,
      });
      setOtpStep('code');
      setCooldownSeconds(60);
      setMessage('שלחנו קוד אימות למייל.');
    } catch (unknownError) {
      setError(`לא הצלחנו לשלוח קוד אימות: ${getErrorMessage(unknownError)}`);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyRegistrationCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isVerifyingOtp || !registrationDraft) return;

    const normalizedToken = otpCode.trim();

    setIsVerifyingOtp(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: registrationDraft.email,
        token: normalizedToken,
        type: 'email',
      });

      if (verifyError || !verifyData.user) {
        setError(`קוד האימות לא אושר: ${verifyError?.message ?? 'לא נמצא משתמש מאומת'}`);
        return;
      }

      if (registrationDraft.password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: registrationDraft.password,
        });

        if (passwordError) {
          logDevelopmentError('Password update failed', passwordError);
          setError(`אימות הקוד הצליח, אך הגדרת הסיסמה נכשלה: ${passwordError.message}`);
          return;
        }
      }

      const now = new Date().toISOString();
      const profilePayload = {
        auth_user_id: verifyData.user.id,
        email: registrationDraft.email,
        name: registrationDraft.fullName,
        role: registrationDraft.role,
        unit_id: registrationDraft.unitId,
        permission_level: 0,
        has_completed_onboarding: true,
        role_approval_status: 'pending',
        status: 'pending',
        last_login_at: now,
      };

      const { data: existingProfile, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .eq('email', registrationDraft.email)
        .maybeSingle<{ id: string }>();

      if (lookupError) {
        setError(`לא ניתן לבדוק פרופיל קיים: ${lookupError.message}`);
        return;
      }

      const result = existingProfile
        ? await supabase.from('users').update(profilePayload).eq('id', existingProfile.id).select('id').single()
        : await supabase.from('users').insert(profilePayload).select('id').single();

      if (result.error) {
        logDevelopmentError('Registration profile upsert failed', result.error);
        setError(`לא הצלחנו ליצור או לעדכן פרופיל ב-public.users: ${result.error.message}`);
        return;
      }

      window.location.href = '/onboarding';
    } catch (unknownError) {
      setError(`אימות הקוד נכשל: ${getErrorMessage(unknownError)}`);
    } finally {
      setIsVerifyingOtp(false);
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
        .select(profileSelect)
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
      setDevError(`כניסת פיתוח נכשלה: ${getErrorMessage(unknownError)}`);
    } finally {
      setIsDevSubmitting(false);
    }
  };

  const isCodeStep = otpStep === 'code';
  const cooldownText = cooldownSeconds > 0 ? `אפשר לשלוח קוד נוסף בעוד ${cooldownSeconds} שניות` : null;

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
          <p className="mt-1 text-sm font-semibold text-[#667085]">מערכת ניהול פיקודית לפלוגה</p>
        </div>

        <GlassCard glow="orange" className="auth-dark-card w-full">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-black text-[#020108]">זיהוי וכניסה למערכת</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#667085]">
              קוד אימות חד-פעמי יישלח למייל, ולאחר הזנתו נמשיך לפי סטטוס הפרופיל.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 p-1">
            <button
              type="button"
              onClick={() => resetOtpState('existing')}
              className={`min-h-11 rounded-xl px-3 text-sm font-black transition-all duration-150 ${
                authMode === 'existing'
                  ? 'bg-[#FF6B02] text-white shadow-[0_12px_24px_rgba(255,107,2,0.20)]'
                  : 'text-[#667085] hover:bg-[#FF6B02]/10 hover:text-[#020108]'
              }`}
            >
              כניסה למשתמש קיים
            </button>
            <button
              type="button"
              onClick={() => resetOtpState('register')}
              className={`min-h-11 rounded-xl px-3 text-sm font-black transition-all duration-150 ${
                authMode === 'register'
                  ? 'bg-[#FF6B02] text-white shadow-[0_12px_24px_rgba(255,107,2,0.20)]'
                  : 'text-[#667085] hover:bg-[#FF6B02]/10 hover:text-[#020108]'
              }`}
            >
              הרשמה ראשונה
            </button>
          </div>

          {authMode === 'existing' && (
            <form onSubmit={handleExistingUserLogin} className="space-y-4">
              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">דוא״ל</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="commander@example.com"
                    className="command-input pl-11 text-left"
                    disabled={isLoggingIn}
                  />
                </span>
              </label>

              <label className="block space-y-2">
                <span className="block text-xs font-black text-[#344054]">סיסמה</span>
                <span className="relative block">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="command-input pl-11 pr-11 text-left"
                    disabled={isLoggingIn}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3] hover:text-[#FF6B02] transition-colors focus:outline-none"
                    aria-label={showLoginPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                disabled={isLoggingIn || isSendingReset}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    מתחבר...
                  </>
                ) : (
                  'התחבר למערכת'
                )}
              </GlossyButton>
              <button
                type="button"
                onClick={handlePasswordResetRequest}
                disabled={isSendingReset || isLoggingIn}
                className="flex min-h-10 w-full items-center justify-center rounded-2xl text-xs font-black text-[#667085] transition-colors hover:text-[#FF6B02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingReset ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    שולח קישור לאיפוס סיסמה...
                  </>
                ) : (
                  'שכחתי סיסמה'
                )}
              </button>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={isCodeStep ? verifyRegistrationCode : sendRegistrationCode} className="space-y-4">
              {!isCodeStep && (
                <>
                  <label className="block space-y-2">
                    <span className="block text-xs font-black text-[#344054]">שם מלא</span>
                    <span className="relative block">
                      <UserRound className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="לדוגמה: סג״ם רועי לוי"
                        className="command-input pr-11"
                        disabled={isSendingOtp}
                      />
                    </span>
                  </label>

                  <label className="block space-y-2">
                    <span className="block text-xs font-black text-[#344054]">דוא״ל</span>
                    <span className="relative block">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
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

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="block text-xs font-black text-[#344054]">סיסמה</span>
                      <span className="relative block">
                        <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          dir="ltr"
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="••••••••"
                          className="command-input pl-11 pr-11 text-left"
                          disabled={isSendingOtp}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((prev) => !prev)}
                          className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3] hover:text-[#FF6B02] transition-colors focus:outline-none"
                          aria-label={showRegPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                        >
                          {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </span>
                    </label>

                    <label className="block space-y-2">
                      <span className="block text-xs font-black text-[#344054]">אימות סיסמה</span>
                      <span className="relative block">
                        <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                        <input
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          dir="ltr"
                          required
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="••••••••"
                          className="command-input pl-11 pr-11 text-left"
                          disabled={isSendingOtp}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                          className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3] hover:text-[#FF6B02] transition-colors focus:outline-none"
                          aria-label={showRegConfirmPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                        >
                          {showRegConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </span>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="block text-xs font-black text-[#344054]">תפקיד מבוקש</span>
                      <select
                        value={selectedRole}
                        onChange={(event) => setSelectedRole(event.target.value)}
                        className="command-select"
                        disabled={isSendingOtp}
                      >
                        {roleOptions.map((role) => (
                          <option key={role.name} value={role.name}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="block text-xs font-black text-[#344054]">מסגרת / יחידה</span>
                      <select
                        value={selectedUnitId}
                        onChange={(event) => setSelectedUnitId(event.target.value)}
                        className="command-select"
                        disabled={isSendingOtp}
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit.id ?? unit.name} value={getUnitOptionValue(unit)}>
                            {unit.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}

              {isCodeStep && (
                <>
                  <div className="rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 px-4 py-3 text-sm font-bold text-[#667085]">
                    קוד האימות נשלח אל <span dir="ltr">{registrationDraft?.email}</span>
                  </div>
                  <label className="block space-y-2">
                    <span className="block text-xs font-black text-[#344054]">קוד אימות</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      dir="ltr"
                      required
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="12345678"
                      className="command-input text-center text-lg font-black tracking-[0.28em]"
                      disabled={isVerifyingOtp}
                    />
                  </label>
                </>
              )}

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

              {cooldownText && (
                <div className="rounded-2xl border border-[#FF6B02]/18 bg-[#FF6B02]/10 px-4 py-3 text-center text-xs font-black text-[#9A4600]">
                  {cooldownText}
                </div>
              )}

              <GlossyButton
                type="submit"
                variant="orange"
                size="lg"
                className="w-full justify-center"
                disabled={isSendingOtp || isVerifyingOtp || (!isCodeStep && cooldownSeconds > 0)}
              >
                {isSendingOtp || isVerifyingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isCodeStep ? 'מאמת קוד' : 'שולח קוד'}
                  </>
                ) : isCodeStep ? (
                  'אמת קוד והמשך'
                ) : (
                  'שלח קוד אימות'
                )}
              </GlossyButton>

              {isCodeStep && (
                <button
                  type="button"
                  onClick={() => resetOtpState('register')}
                  className="flex min-h-10 w-full items-center justify-center rounded-2xl text-xs font-black text-[#667085] transition-colors hover:text-[#FF6B02]"
                >
                  שנה פרטים / חזור
                </button>
              )}
            </form>
          )}

          <div className="mt-6 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/58 px-4 py-3 text-center text-xs font-bold text-[#667085]">
            מצב פיתוח · כניסה בסיסמה והרשמה ב-OTP
          </div>

          {isDevelopment && (
            <div className="mt-5 rounded-[22px] border border-[#FF6B02]/20 bg-[#FF6B02]/8 p-4">
              <div className="mb-3">
                <h2 className="text-sm font-black text-[#020108]">כניסת פיתוח זמנית</h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#667085]">
                  מיועד לפיתוח מקומי בלבד, כדי להיכנס בלי לשלוח מיילים בזמן מגבלת Supabase.
                </p>
              </div>

              <form onSubmit={handleDevLogin} className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="block text-[11px] font-black text-[#344054]">email</span>
                  <span className="relative block">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                    <input
                      type="email"
                      dir="ltr"
                      required
                      value={devEmail}
                      onChange={(event) => setDevEmail(event.target.value)}
                      className="command-input min-h-11 pl-11 text-left text-sm"
                      disabled={isDevSubmitting}
                    />
                  </span>
                </label>

                <label className="block space-y-1.5">
                  <span className="block text-[11px] font-black text-[#344054]">password</span>
                  <span className="relative block">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                    <input
                      type="password"
                      dir="ltr"
                      required
                      value={devPassword}
                      onChange={(event) => setDevPassword(event.target.value)}
                      className="command-input min-h-11 pl-11 text-left text-sm"
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
            <span className="text-[#98A2B3]">אין מידע מבצעי אמיתי במערכת</span>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
