'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Copy, Check, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useApp } from '@/lib/context/AppContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';
import { didRowsUpdate } from '@/lib/supabase/assertUpdated';
import { calendarFeedUrls, createCalendarFeedToken, hashCalendarFeedToken } from '@/lib/calendarFeedToken';

type FeedRow = { id: string; label: string | null; created_at: string; last_used_at: string | null };

const DEVICE_STEPS: Array<{ device: string; steps: string }> = [
  { device: 'אייפון', steps: 'לחיצה על "פתח ביומן" ← הירשם. אחר כך: הגדרות ← יומן ← חשבונות ← "שליפה" כל 15 דקות. ווידג׳ט: לחיצה ארוכה על המסך ← + ← יומן ← "רשימה" בגודל גדול.' },
  { device: 'מק', steps: 'יומן ← קובץ ← מינוי חדש ליומן ← הדבקת הקישור ← רענון אוטומטי "כל 5 דקות". ווידג׳ט: לחיצה ימנית על שולחן העבודה ← עריכת ווידג׳טים ← יומן.' },
  { device: 'גלקסי', steps: 'ב-Google Calendar במחשב: יומנים נוספים ← + ← "מכתובת URL" ← הדבקת הקישור. הווידג׳ט של יומן Google או Samsung יציג אותו. Google מרענן מינויים לאט (עד כמה שעות).' },
];

// A hint for the "active links" list, so a person can tell which link to revoke.
function deviceLabel(): string | null {
  const agent = navigator.userAgent;
  if (/iPhone|iPad/.test(agent)) return 'אייפון';
  if (/Android/.test(agent)) return 'אנדרואיד';
  if (/Macintosh|Mac OS X/.test(agent)) return 'מק';
  if (/Windows/.test(agent)) return 'מחשב';
  return null;
}

/**
 * Personal calendar subscription for the phone/Mac calendar widgets. The code
 * is made in the browser and shown once; only its SHA-256 goes to the
 * database (calendar_feeds, migration 037). Revoking a link stops it at once.
 */
export function CalendarFeedCard() {
  const { currentUser } = useApp();
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeeds = useCallback(async () => {
    const { data, error: loadError } = await createSupabaseBrowserClient()
      .from('calendar_feeds')
      .select('id,label,created_at,last_used_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (loadError) {
      logSupabaseError('Calendar feeds load failed', loadError);
      return;
    }
    setFeeds((data ?? []) as FeedRow[]);
  }, []);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  const createLink = async () => {
    if (!currentUser || isWorking) return;
    setIsWorking(true);
    setError(null);
    setCopied(false);
    try {
      const token = createCalendarFeedToken();
      const { error: insertError } = await createSupabaseBrowserClient()
        .from('calendar_feeds')
        .insert({ user_id: currentUser.id, token_hash: await hashCalendarFeedToken(token), label: deviceLabel() });
      if (insertError) {
        logSupabaseError('Calendar feed create failed', insertError);
        setError('לא ניתן ליצור קישור כרגע. נסה שוב בעוד רגע.');
        return;
      }
      setNewToken(token);
      await loadFeeds();
    } finally {
      setIsWorking(false);
    }
  };

  const revoke = async (feedId: string) => {
    setIsWorking(true);
    setError(null);
    const { data, error: revokeError } = await createSupabaseBrowserClient()
      .from('calendar_feeds')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', feedId)
      .select('id');
    setIsWorking(false);
    if (revokeError || !didRowsUpdate(data)) {
      if (revokeError) logSupabaseError('Calendar feed revoke failed', revokeError);
      setError('לא ניתן לבטל את הקישור כרגע. נסה שוב.');
      return;
    }
    setNewToken(null);
    await loadFeeds();
  };

  const urls = newToken ? calendarFeedUrls(window.location.origin, newToken) : null;

  const copyLink = async () => {
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls.https);
      setCopied(true);
    } catch {
      setError('ההעתקה נכשלה. אפשר לסמן את הקישור ולהעתיק ידנית.');
    }
  };

  return (
    <div className="max-w-2xl">
      <GlassCard className="p-6 md:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/10 text-[var(--brand)]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">יומן אישי לווידג׳טים</h2>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[var(--text-muted-accessible)]">
              קישור מינוי ליומן של הטלפון או המק: הלו״ז שלך, ובראש כל יום שורת מצב של הפורום המוביל. ווידג׳ט היומן המובנה מציג את זה ומתעדכן לבד. הקישור אישי — מי שמחזיק בו רואה את מה שאתה רואה, אז לא לשתף אותו.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 py-2.5 text-xs font-bold text-[var(--color-danger)]">{error}</div>
        )}

        {urls && (
          <div className="mb-4 space-y-3 rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 p-4">
            <p className="text-xs font-bold text-[var(--color-success)]">הקישור נוצר. הוא מוצג עכשיו בלבד — העתק אותו או פתח אותו ביומן.</p>
            <p dir="ltr" className="select-all break-all rounded-xl bg-[var(--surface)] px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]">{urls.https}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={urls.webcal}
                className="touch-target inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--action)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--action-hover)]"
              >
                פתח ביומן
              </a>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="touch-target inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] px-4 text-xs font-semibold text-[var(--text-primary)]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'הועתק' : 'העתק קישור'}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void createLink()}
          disabled={isWorking || !currentUser}
          className="touch-target inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--action)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--action-hover)] disabled:opacity-60"
        >
          {isWorking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          צור קישור יומן חדש
        </button>

        <ul className="mt-5 space-y-2 text-xs font-semibold leading-relaxed text-[var(--text-secondary)]">
          {DEVICE_STEPS.map(item => (
            <li key={item.device}>
              <span className="font-bold text-[var(--text-primary)]">{item.device}: </span>
              {item.steps}
            </li>
          ))}
        </ul>

        {feeds.length > 0 && (
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <p className="mb-2 text-xs font-bold text-[var(--text-muted-accessible)]">קישורים פעילים</p>
            <ul className="space-y-2">
              {feeds.map(feed => (
                <li key={feed.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs">
                  <span className="text-[var(--text-secondary)]">
                    נוצר {new Date(feed.created_at).toLocaleDateString('he-IL')}
                    {feed.label ? ` · ${feed.label}` : ''}
                    {' · '}
                    {feed.last_used_at ? `עודכן לאחרונה ${new Date(feed.last_used_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}` : 'עוד לא בשימוש'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void revoke(feed.id)}
                    disabled={isWorking}
                    className="touch-target min-h-9 rounded-lg border border-[var(--color-danger)]/30 px-3 font-semibold text-[var(--color-danger)] disabled:opacity-60"
                  >
                    בטל קישור
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
