'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, Shield } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDevelopment = process.env.NODE_ENV === 'development';

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
              : 'לא הצלחנו לשלוח קישור כניסה. Supabase החזיר שגיאה ללא הודעה מפורטת.'
          );
          return;
        }
        setError('לא הצלחנו לשלוח קישור כניסה. בדוק את כתובת הדוא״ל ונסה שוב.');
        return;
      }

      setMessage('שלחנו אליך קישור כניסה מאובטח. פתח את המייל ואשר כניסה למערכת.');
    } catch (unknownError) {
      if (isDevelopment) {
        console.error('Unexpected login error:', unknownError);

        const devMessage = unknownError instanceof Error ? unknownError.message : String(unknownError);
        setError(
          devMessage
            ? `אירעה שגיאה בחיבור למערכת ההזדהות. שגיאת development: ${devMessage}`
            : 'אירעה שגיאה בחיבור למערכת ההזדהות. שגיאת development ללא הודעה מפורטת.'
        );
        return;
      }
      setError('אירעה שגיאה בחיבור למערכת ההזדהות. נסה שוב בעוד רגע.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-navy-shell min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden text-right">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(8,145,178,0.26),transparent_34%),radial-gradient(circle_at_75%_80%,rgba(249,115,22,0.18),transparent_30%)]" />

      <GlassCard className="auth-dark-card w-full max-w-md backdrop-blur-2xl z-10 shadow-2xl" glow="cyan">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="p-3.5 rounded-2xl bg-cyan-400/10 border border-cyan-300/35 text-cyan-200 mb-4 shadow-[0_0_24px_rgba(103,232,249,0.22)]">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-white tracking-wider">המפקד</h1>
          <p className="text-xs text-cyan-100/80 font-bold mt-1">
            כניסה מאובטחת למערכת פיקוד פלוגתית
          </p>
          <p className="text-[11px] text-slate-300 mt-4 leading-relaxed max-w-xs">
            הזן כתובת דוא״ל, ונשלח אליך קישור חד-פעמי לכניסה. לאחר האימות נבדוק את סטטוס האונבורדינג וההרשאה שלך.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase text-slate-300 tracking-wider">
              דואר אלקטרוני
            </label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="commander@example.com"
                className="auth-dark-input w-full rounded-xl py-2.5 pr-10 pl-4 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-300/40 transition-all duration-300 text-right"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {message && (
            <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-[11px] leading-relaxed text-emerald-100">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-[11px] leading-relaxed text-rose-100">
              {error}
            </div>
          )}

          <GlossyButton
            type="submit"
            variant="cyan"
            size="lg"
            className="w-full justify-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                שולח קישור כניסה
              </>
            ) : (
              'שלח קישור כניסה'
            )}
          </GlossyButton>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-300 font-bold">
          <Link href="/onboarding" className="hover:text-cyan-200 transition-colors flex items-center gap-1 group">
            <span>רישום מפקד חדש</span>
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/select-role" className="hover:text-orange-200 transition-colors">
            הדמיית תפקידים
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
