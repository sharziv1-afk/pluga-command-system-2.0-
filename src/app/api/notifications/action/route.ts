import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isQuickAction } from '@/lib/notifications/actions';
import { getSupabaseEnv } from '@/lib/supabase/env';

// A button on a phone notification ("בוצע", "קיבלתי"…, notifications stage
// 4). The service worker posts here with the site's own session cookies; the
// action itself is notification_quick_action() (migration 044), which runs
// under the user's RLS, so this route can never do more than the person could
// do on the page. No token travels in the notification. Any failure tells the
// worker to open the item instead, where the same action is one tap away.
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  // Same-origin only: the worker's fetch always sends Origin on a POST.
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  }

  let body: { id?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers });
  }
  if (typeof body.id !== 'string' || !UUID.test(body.id) || !isQuickAction(body.action)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers });
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const refreshed: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      // A refreshed session is handed back to the browser below.
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach((cookie) => refreshed.push(cookie));
      },
    },
  });

  const { data: claims } = await supabase.auth.getClaims();
  const finish = (payload: Record<string, unknown>, status: number) => {
    const response = NextResponse.json(payload, { status, headers });
    refreshed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  };
  if (!claims?.claims?.sub) return finish({ error: 'unauthorized' }, 401);

  const { data, error } = await supabase.rpc('notification_quick_action', { p_notification: body.id, p_action: body.action });
  if (error) return finish({ error: error.code === 'P0002' ? 'not_found' : 'not_allowed' }, 403);
  return finish({ ok: true, result: (data as { result?: string } | null)?.result ?? 'done' }, 200);
}
