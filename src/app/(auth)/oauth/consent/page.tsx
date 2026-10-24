'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'inactive'; details: OAuthAuthorizationDetails }
  | { kind: 'consent'; details: OAuthAuthorizationDetails; profileName: string }
  | { kind: 'redirecting' };

/**
 * OAuth 2.1 consent screen for Supabase Auth's authorization server
 * (Authentication → OAuth Server → authorization path = /oauth/consent).
 *
 * An AI client (Claude, ChatGPT) sends the user here to approve access to
 * their own account. Approving issues the client a token for THIS user, so it
 * sees exactly what the user sees on the site — RLS still applies. A profile
 * that is not active and approved may only deny.
 */
export default function OAuthConsentPage() {
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [isDeciding, setIsDeciding] = useState(false);

  useEffect(() => {
    const run = async () => {
      const authorizationId = new URLSearchParams(window.location.search).get('authorization_id');
      if (!authorizationId) {
        setState({ kind: 'error', message: 'חסר מזהה בקשת הרשאה. התחל את החיבור מחדש מתוך האפליקציה שביקשה גישה.' });
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) {
        setState({ kind: 'error', message: 'בקשת ההרשאה אינה בתוקף או שפג תוקפה. התחל את החיבור מחדש.' });
        return;
      }
      if ('redirect_url' in data && !('authorization_id' in data)) {
        // Already approved earlier for the same scopes.
        setState({ kind: 'redirecting' });
        window.location.assign(data.redirect_url);
        return;
      }

      const details = data as OAuthAuthorizationDetails;
      const { data: profile } = await supabase
        .from('users')
        .select('name,status,role_approval_status')
        .eq('auth_user_id', sessionData.session.user.id)
        .maybeSingle<{ name: string; status: string; role_approval_status: string }>();

      if (!profile || profile.status !== 'active' || profile.role_approval_status !== 'approved') {
        setState({ kind: 'inactive', details });
        return;
      }
      setState({ kind: 'consent', details, profileName: profile.name });
    };

    void run();
  }, []);

  const decide = async (approve: boolean, authorizationId: string) => {
    setIsDeciding(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (error || !data?.redirect_url) {
      setIsDeciding(false);
      setState({ kind: 'error', message: 'לא הצלחנו להשלים את הבקשה. נסה שוב מתוך האפליקציה שביקשה גישה.' });
      return;
    }
    setState({ kind: 'redirecting' });
    window.location.assign(data.redirect_url);
  };

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/10 text-[var(--brand)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">המפקד</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-muted-accessible)]">אישור גישה לאפליקציה חיצונית</p>
        </div>

        <GlassCard glow="orange" className="w-full space-y-5 text-right">
          {(state.kind === 'loading' || state.kind === 'redirecting') && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm font-semibold text-[var(--text-muted-accessible)]">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--color-action-on-surface)]" />
              {state.kind === 'loading' ? 'טוען את פרטי הבקשה…' : 'מעביר בחזרה לאפליקציה…'}
            </div>
          )}

          {state.kind === 'error' && (
            <div role="alert" className="rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 px-4 py-3 text-sm font-bold text-[var(--color-danger)]">
              {state.message}
            </div>
          )}

          {(state.kind === 'consent' || state.kind === 'inactive') && (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)]">
                  <Bot className="h-5 w-5 text-[var(--text-secondary)]" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-lg font-bold text-[var(--text-primary)]">
                    {state.details.client.name || 'אפליקציה חיצונית'} מבקשת גישה לחשבון שלך
                  </h1>
                  {state.details.client.uri && (
                    <p className="text-xs font-mono text-[var(--text-muted-accessible)]" dir="ltr">{state.details.client.uri}</p>
                  )}
                </div>
              </div>

              {state.kind === 'consent' ? (
                <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                  <p>
                    אם תאשר, האפליקציה תוכל לקרוא נתונים מהמערכת <strong>בשמך — {state.profileName}</strong>,
                    ורק את מה שאתה רשאי לראות באתר: דוחות פורום, מצבה, משימות, דרישות, לו״ז, מעקב
                    {' '}ונתונים נוספים לפי ההרשאות שלך.
                  </p>
                  <ul className="list-disc space-y-1 pr-5 text-xs text-[var(--text-muted-accessible)]">
                    <li>ההרשאות שלך באתר חלות גם כאן — האפליקציה לא תראה יותר ממה שאתה רואה.</li>
                    <li>בשלב זה הכלים זמינים לקריאה בלבד ואינם משנים נתונים.</li>
                    <li>אפשר לבטל את הגישה בכל עת דרך מפקד הפלוגה; חסימת המשתמש מבטלת אותה מיד.</li>
                  </ul>
                  <p className="text-xs text-[var(--text-muted-accessible)]">
                    מחובר כ־<span className="font-mono" dir="ltr">{state.details.user.email}</span>
                  </p>
                </div>
              ) : (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-3 text-sm font-bold text-[var(--color-warning)]">
                  <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
                  החשבון שלך עדיין לא פעיל ומאושר במערכת, ולכן לא ניתן לאשר גישה לאפליקציה חיצונית.
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <GlossyButton
                  variant="slate"
                  size="sm"
                  disabled={isDeciding}
                  onClick={() => decide(false, state.details.authorization_id)}
                >
                  דחה
                </GlossyButton>
                {state.kind === 'consent' && (
                  <GlossyButton
                    variant="orange"
                    size="sm"
                    disabled={isDeciding}
                    onClick={() => decide(true, state.details.authorization_id)}
                  >
                    {isDeciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    אשר גישה
                  </GlossyButton>
                )}
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
