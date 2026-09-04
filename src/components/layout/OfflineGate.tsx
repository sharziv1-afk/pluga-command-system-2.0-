'use client';

import React, { useState } from 'react';
import { Fingerprint, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { hasDevicePin, verifyDevicePin } from '@/lib/offline/devicePin';
import { hasDeviceBiometric, verifyDeviceBiometric } from '@/lib/offline/deviceBiometric';
import { readCachedProfileSnapshot } from '@/lib/offline/cachedProfile';

/**
 * Shown instead of the generic error card when the app can't reach Supabase
 * and the browser itself reports no connectivity. A correct device PIN
 * re-opens the last cached identity — it does not re-authenticate against
 * Supabase, and it does not (yet) show real task/request/forum data; that's
 * a separate offline-data-caching phase. This screen's whole job is: don't
 * dead-end on a blank error when the commander is offline in the field and
 * already logged in on this device.
 */
export function OfflineGate({ onRetry }: { onRetry: () => void }) {
  const snapshot = readCachedProfileSnapshot();
  const pinConfigured = hasDevicePin();
  const biometricConfigured = hasDeviceBiometric();
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsChecking(true);
    const ok = await verifyDevicePin(pin);
    setIsChecking(false);
    if (ok) {
      setUnlocked(true);
    } else {
      setError('קוד שגוי. נסה שוב.');
      setPin('');
    }
  };

  const handleBiometricUnlock = async () => {
    setError(null);
    setIsChecking(true);
    const ok = await verifyDeviceBiometric();
    setIsChecking(false);
    if (ok) {
      setUnlocked(true);
    } else {
      setError('האימות הביומטרי נכשל. נסה שוב או השתמש בקוד הגישה.');
    }
  };

  if (unlocked && snapshot) {
    return (
      <div className="command-page-shell flex h-svh items-center justify-center p-4" dir="rtl">
        <GlassCard className="w-full max-w-md text-center">
          <WifiOff className="mx-auto mb-3 h-10 w-10 text-[var(--color-warning)]" />
          <h1 className="text-lg font-black text-[var(--text-primary)]">מצב אופליין</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            מחובר כ<strong>{snapshot.fullName}</strong> · {snapshot.role} · {snapshot.assignedFrame}
          </p>
          <p className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
            אין כרגע חיבור לרשת — לא ניתן להציג נתונים עדכניים או לשמור שינויים. ברגע שהחיבור יחזור, המערכת תתחבר מחדש אוטומטית.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-black text-white transition hover:bg-[var(--action-hover)]"
          >
            <RefreshCw className="h-4 w-4" />
            נסה להתחבר שוב
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="command-page-shell flex h-svh items-center justify-center p-4" dir="rtl">
      <GlassCard className="w-full max-w-md text-center">
        <WifiOff className="mx-auto mb-3 h-10 w-10 text-[var(--color-warning)]" />
        <h1 className="text-lg font-black text-[var(--text-primary)]">אין חיבור לרשת</h1>

        {(pinConfigured || biometricConfigured) && snapshot ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {biometricConfigured ? 'אמת באמצעות זיהוי ביומטרי או קוד הגישה כדי להיכנס במצב אופליין.' : 'הזן את קוד הגישה המהיר של המכשיר כדי להיכנס במצב אופליין.'}
            </p>
            {biometricConfigured && (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isChecking}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-black text-white transition hover:bg-[var(--action-hover)] disabled:opacity-50"
              >
                <Fingerprint className="h-4 w-4" />
                זיהוי ביומטרי
              </button>
            )}
            {pinConfigured && (
              <form onSubmit={handleUnlock} className="mt-4 space-y-3">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus={!biometricConfigured}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="קוד גישה"
                  className="command-input text-center text-lg font-black tracking-[0.3em]"
                  disabled={isChecking}
                />
                <button
                  type="submit"
                  disabled={isChecking || !pin}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-black text-white transition hover:bg-[var(--action-hover)] disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  כניסה
                </button>
              </form>
            )}
            {error && <p className="mt-3 text-xs font-bold text-[var(--color-danger)]">{error}</p>}
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            לא הוגדר קוד גישה מהיר למכשיר הזה, ולכן לא ניתן להיכנס במצב אופליין. ברגע שיש רשת שוב, אפשר להגדיר קוד גישה בעמוד הפרופיל.
          </p>
        )}

        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 text-sm font-black text-[var(--text-secondary)] transition hover:border-[var(--action)]/40"
        >
          <RefreshCw className="h-4 w-4" />
          נסה להתחבר שוב
        </button>
      </GlassCard>
    </div>
  );
}
