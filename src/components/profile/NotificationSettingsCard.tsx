'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { NotificationMuteSettings } from '@/components/profile/NotificationMuteSettings';
import {
  disablePush,
  enablePush,
  getDeviceSubscription,
  getPushSupport,
  isIosDevice,
  sendTestPush,
  type PushSupport,
} from '@/lib/push/client';

type DeviceState = 'checking' | 'on' | 'off' | 'blocked';

const IOS_INSTALL_STEPS = [
  'פותחים את האתר בספארי (לא בכרום).',
  'לוחצים על כפתור השיתוף (ריבוע עם חץ למעלה) ← "הוסף למסך הבית" ← הוסף.',
  'סוגרים את ספארי ופותחים את "המפקד" מהאייקון במסך הבית.',
  'חוזרים לכאן (פרופיל) ולוחצים "הפעל התראות".',
];

/**
 * Turns phone notifications on or off for this device, with a test send.
 * Notifications themselves arrive from stage 2 on (docs/NOTIFICATIONS.md).
 */
export function NotificationSettingsCard() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [device, setDevice] = useState<DeviceState>('checking');
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const nextSupport = getPushSupport();
    setSupport(nextSupport);
    if (nextSupport !== 'supported') return;
    if (Notification.permission === 'denied') {
      setDevice('blocked');
      return;
    }
    const subscription = await getDeviceSubscription().catch(() => null);
    setDevice(subscription && Notification.permission === 'granted' ? 'on' : 'off');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const turnOn = async () => {
    setIsWorking(true);
    setMessage(null);
    try {
      const result = await enablePush();
      if (result === 'enabled') setMessage({ tone: 'ok', text: 'ההתראות הופעלו במכשיר הזה. אפשר לשלוח התראת בדיקה.' });
      else if (result === 'denied') setMessage({ tone: 'error', text: 'לא ניתן אישור להתראות. אפשר לשנות את זה בהגדרות הטלפון.' });
      else setMessage({ tone: 'error', text: 'ההפעלה נכשלה. נסה שוב בעוד רגע.' });
    } catch {
      setMessage({ tone: 'error', text: 'ההפעלה נכשלה. נסה שוב בעוד רגע.' });
    } finally {
      setIsWorking(false);
      await refresh();
    }
  };

  const turnOff = async () => {
    setIsWorking(true);
    setMessage(null);
    const ok = await disablePush().catch(() => false);
    setIsWorking(false);
    setMessage(ok ? { tone: 'ok', text: 'ההתראות כובו במכשיר הזה.' } : { tone: 'error', text: 'הכיבוי נכשל. נסה שוב.' });
    await refresh();
  };

  const test = async () => {
    setIsWorking(true);
    setMessage(null);
    const result = await sendTestPush();
    setIsWorking(false);
    if (result.ok) {
      setMessage(result.sent > 0
        ? { tone: 'ok', text: `נשלחה התראת בדיקה ל־${result.sent} ${result.sent === 1 ? 'מכשיר' : 'מכשירים'}. היא אמורה להופיע תוך כמה שניות.` }
        : { tone: 'error', text: 'לא נמצא מכשיר פעיל לשליחה. כבה והפעל את ההתראות מחדש.' });
    } else if (result.reason === 'rate_limited') {
      setMessage({ tone: 'error', text: 'נשלחה התראת בדיקה לפני רגע. אפשר לנסות שוב בעוד 20 שניות.' });
    } else {
      setMessage({ tone: 'error', text: 'השליחה נכשלה. נסה שוב בעוד רגע.' });
    }
  };

  const buttonCls = 'touch-target inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition disabled:opacity-60';

  return (
    <div className="max-w-2xl">
      <GlassCard className="p-6 md:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/10 text-[var(--brand)]">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">התראות לטלפון</h2>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
              משימה שהוקצתה לך, מופע שמתקרב, דוח שעוד לא הוגש. ההפעלה היא לכל מכשיר בנפרד. כל התראה נשמרת גם בפעמון שבראש המסך.
            </p>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className={message.tone === 'ok'
              ? 'mb-4 rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-2.5 text-xs font-bold text-[var(--color-success)]'
              : 'mb-4 rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 py-2.5 text-xs font-bold text-[var(--color-danger)]'}
          >
            {message.text}
          </div>
        )}

        {support === 'not_configured' && (
          <p className="text-xs font-semibold text-[var(--text-secondary)]">ההתראות לטלפון יופעלו בקרוב.</p>
        )}

        {support === 'ios_needs_install' && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-[var(--text-primary)]">באייפון התראות עובדות רק מתוך האייקון במסך הבית:</p>
            <ol className="list-decimal space-y-1 pr-5 text-xs font-semibold leading-relaxed text-[var(--text-secondary)]">
              {IOS_INSTALL_STEPS.map(step => <li key={step}>{step}</li>)}
            </ol>
          </div>
        )}

        {support === 'unsupported' && (
          <p className="text-xs font-semibold leading-relaxed text-[var(--text-secondary)]">
            הדפדפן הזה לא תומך בהתראות. באנדרואיד: Chrome. באייפון: iOS 16.4 ומעלה, מתוך האייקון במסך הבית.
          </p>
        )}

        {support === 'supported' && device === 'blocked' && (
          <p className="text-xs font-semibold leading-relaxed text-[var(--text-secondary)]">
            ההתראות חסומות במכשיר הזה.
            {isIosDevice()
              ? ' בהגדרות האייפון: הגדרות ← התראות ← המפקד ← אפשר התראות.'
              : ' בכרום: לחיצה על סמל המנעול ליד הכתובת (או הגדרות האתר) ← התראות ← אפשר. אחר כך לרענן את הדף.'}
          </p>
        )}

        {support === 'supported' && device !== 'blocked' && (
          <div className="flex flex-wrap items-center gap-2">
            {device === 'on' ? (
              <>
                <span className="inline-flex min-h-10 items-center rounded-xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-3 text-xs font-bold text-[var(--color-success)]">
                  פעיל במכשיר הזה
                </span>
                <button
                  type="button"
                  onClick={() => void test()}
                  disabled={isWorking}
                  className={`${buttonCls} bg-[var(--action)] text-white hover:bg-[var(--action-hover)]`}
                >
                  {isWorking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  שלח התראת בדיקה
                </button>
                <button
                  type="button"
                  onClick={() => void turnOff()}
                  disabled={isWorking}
                  className={`${buttonCls} border border-[var(--border-strong)] text-[var(--text-primary)]`}
                >
                  כבה במכשיר הזה
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void turnOn()}
                disabled={isWorking || device === 'checking'}
                className={`${buttonCls} bg-[var(--action)] text-white hover:bg-[var(--action-hover)]`}
              >
                {isWorking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                הפעל התראות
              </button>
            )}
          </div>
        )}

        {support !== null && support !== 'not_configured' && <NotificationMuteSettings />}
      </GlassCard>
    </div>
  );
}
