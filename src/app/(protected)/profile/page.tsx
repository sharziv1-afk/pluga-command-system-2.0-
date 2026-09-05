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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/10 text-[var(--brand)]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">קוד גישה מהיר למכשיר (אופליין)</h2>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
              מאפשר להיכנס למכשיר הזה כשאין רשת, בלי לחכות לקוד במייל. הקוד נשמר רק על המכשיר הזה, לא בשרת — ולא מחליף את ההתחברות הרגילה.
            </p>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-2.5 text-xs font-bold text-[var(--color-success)]">{success}</div>
        )}

        {!isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setIsEditing(true); setSuccess(null); }}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--action)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--action-hover)]"
            >
              {hasPin ? 'שינוי קוד גישה' : 'הגדרת קוד גישה'}
            </button>
            {hasPin && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 text-xs font-semibold text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ביטול קוד גישה
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">קוד גישה (4-8 ספרות)</span>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                className="command-input text-center text-lg font-semibold tracking-[0.3em]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-xs font-semibold text-[var(--text-secondary)]">אימות קוד</span>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                className="command-input text-center text-lg font-semibold tracking-[0.3em]"
              />
            </label>
            {error && <p className="text-xs font-bold text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--action)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--action-hover)]">
                שמירה
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); resetForm(); }}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--border-strong)] px-4 text-xs font-semibold text-[var(--text-muted-accessible)] transition hover:border-[var(--action)]/30"
              >
                ביטול
              </button>
            </div>
          </form>
        )}

        {biometricSupported && (
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-[var(--brand)]" />
              <span className="text-xs font-semibold text-[var(--text-secondary)]">זיהוי ביומטרי (טביעת אצבע / זיהוי פנים)</span>
            </div>
            <p className="mb-3 text-caption font-semibold leading-relaxed text-[var(--command-subtle)]">
              משתמש בחיישן הביומטרי של המכשיר במקום קוד גישה. גם זה נשאר על המכשיר בלבד.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={hasBiometric ? handleRemoveBiometric : handleRegisterBiometric}
                disabled={isRegisteringBiometric}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition disabled:opacity-50 ${
                  hasBiometric
                    ? 'border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
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
              <div className="h-16 w-16 rounded-3xl bg-[var(--surface-muted)]" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
                <div className="h-3 w-48 rounded bg-[var(--surface-muted)]" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-[var(--surface-muted)]/60" />
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
        <GlassCard className="py-12 flex flex-col items-center justify-center text-center text-[var(--text-muted-accessible)]">
          <ShieldAlert className="w-12 h-12 mb-3 text-[var(--color-danger)]" />
          <span className="text-sm font-semibold text-[var(--text-muted-accessible)]">לא נמצא פרופיל משתמש מחובר</span>
          <p className="text-xs text-[var(--text-muted-accessible)] mt-1">אנא התחבר מחדש למערכת.</p>
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
          <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 border-b border-[var(--border-subtle)] pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--brand)]/20 bg-[var(--brand)]/10 text-[var(--brand)] shadow-[0_14px_30px_rgba(255,107,2,0.14)]">
              <User className="h-8 w-8" />
            </div>
            <div className="text-center sm:text-right space-y-1">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{currentUser.full_name}</h2>
              <p className="text-xs font-bold text-[var(--text-muted-accessible)]">
                {currentUser.role} · {currentUser.assigned_frame}
              </p>
            </div>
            <div className="sm:mr-auto mt-3 sm:mt-0">
              <StatusBadge status={currentUser.status} />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-4">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-[var(--command-subtle)] mb-1">
                <Mail className="h-3.5 w-3.5" />
                דואר אלקטרוני
              </span>
              <span className="block text-sm font-semibold text-[var(--text-primary)] font-mono select-all">
                {currentUser.email}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-4">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-[var(--command-subtle)] mb-1">
                <Award className="h-3.5 w-3.5" />
                תפקיד צבאי במערכת
              </span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {currentUser.role}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-4">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-[var(--command-subtle)] mb-1">
                <FileText className="h-3.5 w-3.5" />
                יחידה / מסגרת פעילות
              </span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {currentUser.assigned_frame}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-4">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-[var(--command-subtle)] mb-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                רמת הרשאה צבאית
              </span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {permissionLabel}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-4">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-[var(--command-subtle)] mb-1">
                <Calendar className="h-3.5 w-3.5" />
                תאריך הצטרפות למערכת
              </span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                {formattedDate}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--tactical-glass)] p-4">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-[var(--command-subtle)] mb-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                סטטוס פרופיל פיקודי
              </span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">
                מאושר ופעיל במפקדה
              </span>
            </div>
          </div>

          {/* Bottom Alert */}
          <div className="mt-8 rounded-2xl border border-[var(--brand)]/14 bg-[var(--brand)]/8 p-4 text-xs font-semibold leading-relaxed text-[var(--color-action-on-surface)]">
            שינוי תפקיד, דרגה או מסגרת יכולים להתבצע אך ורק על ידי מפקד הפלוגה (המ״פ) או סגנו דרך פאנל הניהול של המערכת.
          </div>
        </GlassCard>
      </div>

      <DeviceAccessCodeCard />
    </div>
  );
}
