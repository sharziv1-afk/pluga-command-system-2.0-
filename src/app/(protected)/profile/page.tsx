'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApp } from '@/lib/context/AppContext';
import { User, Mail, ShieldAlert, Award, Calendar, FileText, Smartphone, Trash2, Fingerprint } from 'lucide-react';
import { hasDevicePin, setDevicePin, clearDevicePin } from '@/lib/offline/devicePin';
import {
  hasDeviceBiometric,
  isBiometricAvailable,
  registerDeviceBiometric,
  clearDeviceBiometric,
} from '@/lib/offline/deviceBiometric';

function DeviceAccessCodeCard() {
  const { currentUser } = useApp();
  const [hasPin, setHasPin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState(false);

  useEffect(() => {
    setHasPin(hasDevicePin());
    setHasBiometric(hasDeviceBiometric());
    void isBiometricAvailable().then(setBiometricSupported);
  }, []);

  const handleRegisterBiometric = async () => {
    if (!currentUser) return;
    setError(null);
    setIsRegisteringBiometric(true);
    const ok = await registerDeviceBiometric(currentUser.full_name);
    setIsRegisteringBiometric(false);
    if (ok) {
      setHasBiometric(true);
      setSuccess('זיהוי ביומטרי הופעל למכשיר זה.');
    } else {
      setError('לא ניתן היה להפעיל זיהוי ביומטרי במכשיר הזה.');
    }
  };

  const handleRemoveBiometric = () => {
    clearDeviceBiometric();
    setHasBiometric(false);
    setSuccess('זיהוי ביומטרי הוסר מהמכשיר.');
  };

  const resetForm = () => {
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (pin.length < 4) {
      setError('קוד הגישה חייב להיות באורך 4 ספרות לפחות.');
      return;
    }
    if (pin !== confirmPin) {
      setError('הקודים שהוזנו אינם תואמים.');
      return;
    }
    await setDevicePin(pin);
    setHasPin(true);
    setIsEditing(false);
    setSuccess('קוד הגישה נשמר במכשיר זה.');
    resetForm();
  };

  const handleRemove = () => {
    clearDevicePin();
    setHasPin(false);
    setSuccess('קוד הגישה הוסר מהמכשיר.');
  };

  return (
    <div className="max-w-2xl">
      <GlassCard className="p-6 md:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#020108]">קוד גישה מהיר למכשיר (אופליין)</h2>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#667085]">
              מאפשר להיכנס למכשיר הזה כשאין רשת, בלי לחכות לקוד במייל. הקוד נשמר רק על המכשיר הזה, לא בשרת — ולא מחליף את ההתחברות הרגילה.
            </p>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-700">{success}</div>
        )}

        {!isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setIsEditing(true); setSuccess(null); }}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--action)] px-4 text-xs font-black text-white transition hover:bg-[var(--action-hover)]"
            >
              {hasPin ? 'שינוי קוד גישה' : 'הגדרת קוד גישה'}
            </button>
            {hasPin && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-black text-red-600 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ביטול קוד גישה
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="block text-xs font-black text-[#344054]">קוד גישה (4-8 ספרות)</span>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                className="command-input text-center text-lg font-black tracking-[0.3em]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-xs font-black text-[#344054]">אימות קוד</span>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                className="command-input text-center text-lg font-black tracking-[0.3em]"
              />
            </label>
            {error && <p className="text-xs font-bold text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--action)] px-4 text-xs font-black text-white transition hover:bg-[var(--action-hover)]">
                שמירה
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); resetForm(); }}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--border-strong)] px-4 text-xs font-black text-[#667085] transition hover:border-[#FF6B02]/30"
              >
                ביטול
              </button>
            </div>
          </form>
        )}

        {biometricSupported && (
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-[#FF6B02]" />
              <span className="text-xs font-black text-[#344054]">זיהוי ביומטרי (טביעת אצבע / זיהוי פנים)</span>
            </div>
            <p className="mb-3 text-[11px] font-semibold leading-relaxed text-[#98A2B3]">
              משתמש בחיישן הביומטרי של המכשיר במקום קוד גישה. גם זה נשאר על המכשיר בלבד.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={hasBiometric ? handleRemoveBiometric : handleRegisterBiometric}
                disabled={isRegisteringBiometric}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-black transition disabled:opacity-50 ${
                  hasBiometric
                    ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-[var(--action)] text-white hover:bg-[var(--action-hover)]'
                }`}
              >
                {hasBiometric ? <Trash2 className="h-3.5 w-3.5" /> : <Fingerprint className="h-3.5 w-3.5" />}
                {hasBiometric ? 'ביטול זיהוי ביומטרי' : 'הפעלת זיהוי ביומטרי'}
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default function ProfilePage() {
  const { currentUser, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="פרופיל אישי" subtitle="טוען פרטי משתמש..." />
        <div className="max-w-2xl">
          <GlassCard className="p-8 animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-3xl bg-[#EEF1F5]" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 rounded bg-[#EEF1F5]" />
                <div className="h-3 w-48 rounded bg-[#EEF1F5]" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-[#EEF1F5]/60" />
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <PageHeader title="פרופיל אישי" subtitle="ניהול ופרטי משתמש אישיים" />
        <GlassCard className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
          <ShieldAlert className="w-12 h-12 mb-3 text-red-500" />
          <span className="text-sm font-black text-slate-350">לא נמצא פרופיל משתמש מחובר</span>
          <p className="text-xs text-slate-500 mt-1">אנא התחבר מחדש למערכת.</p>
        </GlassCard>
      </div>
    );
  }

  const formattedDate = currentUser.created_at
    ? new Date(currentUser.created_at).toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'לא ידוע';

  // Determine permission description
  let permissionLabel = 'הרשאה בסיסית';
  const role = currentUser.role as string;
  if (role === 'מ״פ' || role === 'מ"פ') permissionLabel = 'הרשאה פלוגתית עליונה (מפקד פלוגה)';
  else if (role === 'סמ״פ' || role === 'סמ"פ') permissionLabel = 'הרשאה פלוגתית גבוהה (סגן מפקד)';
  else if (role === 'מש״ד' || role === 'מש"ד') permissionLabel = 'הרשאת פיקוד ומנהלה (עוזר מ״פ, אחראי הדרכה)';
  else if (role === 'רס״פ / לוגיסטיקה' || role === 'רס"פ') permissionLabel = 'הרשאת ניהול לוגיסטיקה';
  else if (role.startsWith('מ״מ') || role.startsWith('מ"מ')) permissionLabel = 'הרשאת ניהול מחלקה';
  else if (role.startsWith('מ״כ') || role.startsWith('מ"כ')) permissionLabel = 'הרשאה כיתתית';

  return (
    <div className="space-y-6 text-right">
      {/* Page Header */}
      <PageHeader
        title="פרופיל אישי"
        subtitle="פרטי החשבון הצבאי שלך, רמת ההרשאה שנקבעה על ידי המפקד והמסגרת שאליה אתה משויך."
      />

      <div className="max-w-2xl">
        <GlassCard glow="orange" className="p-6 md:p-8">
          {/* Header Profile Info */}
          <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 border-b border-[rgba(2,1,8,0.08)] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 text-[#FF6B02] shadow-[0_14px_30px_rgba(255,107,2,0.14)]">
              <User className="h-8 w-8" />
            </div>
            <div className="text-center sm:text-right space-y-1">
              <h2 className="text-xl font-black text-[#020108]">{currentUser.full_name}</h2>
              <p className="text-xs font-bold text-[#667085]">
                {currentUser.role} · {currentUser.assigned_frame}
              </p>
            </div>
            <div className="sm:mr-auto mt-3 sm:mt-0">
              <StatusBadge status={currentUser.status} />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <Mail className="h-3.5 w-3.5" />
                דואר אלקטרוני
              </span>
              <span className="block text-sm font-semibold text-[#020108] font-mono select-all">
                {currentUser.email}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <Award className="h-3.5 w-3.5" />
                תפקיד צבאי במערכת
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {currentUser.role}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <FileText className="h-3.5 w-3.5" />
                יחידה / מסגרת פעילות
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {currentUser.assigned_frame}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                רמת הרשאה צבאית
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {permissionLabel}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <Calendar className="h-3.5 w-3.5" />
                תאריך הצטרפות למערכת
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                {formattedDate}
              </span>
            </div>

            <div className="rounded-2xl border border-[rgba(2,1,8,0.06)] bg-white/40 p-4">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-[#98A2B3] mb-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                סטטוס פרופיל פיקודי
              </span>
              <span className="block text-sm font-semibold text-[#020108]">
                מאושר ופעיל במפקדה
              </span>
            </div>
          </div>

          {/* Bottom Alert */}
          <div className="mt-8 rounded-2xl border border-[#FF6B02]/14 bg-[#FF6B02]/8 p-4 text-xs font-semibold leading-relaxed text-[#9A4600]">
            שינוי תפקיד, דרגה או מסגרת יכולים להתבצע אך ורק על ידי מפקד הפלוגה (המ״פ) או סגנו דרך פאנל הניהול של המערכת.
          </div>
        </GlassCard>
      </div>

      <DeviceAccessCodeCard />
    </div>
  );
}
