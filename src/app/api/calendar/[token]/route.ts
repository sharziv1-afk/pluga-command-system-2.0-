import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildFeedCalendar, type CalendarFeedData } from '@/lib/calendarExport';
import { isCalendarFeedToken } from '@/lib/calendarFeedToken';
import { getSupabaseEnv } from '@/lib/supabase/env';

// Personal calendar subscription (ICS) for the phone/Mac calendar widgets.
// The link's code is the credential: only its SHA-256 is stored, and
// calendar_feed() (migration 037) returns exactly what that user may see.
export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const code = token.replace(/\.ics$/i, '');
  if (!isCalendarFeedToken(code)) return notFound();

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const tokenHash = createHash('sha256').update(code).digest('hex');
  const { data, error } = await supabase.rpc('calendar_feed', { p_token_hash: tokenHash });
  if (error) {
    return new Response('Calendar temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!data) return notFound();

  return new Response(buildFeedCalendar(data as CalendarFeedData), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="hamefaked.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
