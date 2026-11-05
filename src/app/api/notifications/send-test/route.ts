import { createClient } from '@supabase/supabase-js';
import { getVapidKeys } from '@/lib/push/vapid';
import { sendWebPush } from '@/lib/push/webPush';
import { getSupabaseEnv } from '@/lib/supabase/env';

// "שלח התראת בדיקה" in the profile: one notification to every device the
// signed-in user enabled. Runs under the user's own token, so RLS decides
// which devices are reached (their own) and send_test_notification()
// (migration 038) rate-limits and records it in their bell.
// Not under a folder named "test": node --test would load it as a test file.
export const dynamic = 'force-dynamic';

const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

type TestNotification = { id: string; title: string; body: string | null; url: string | null };
type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

export async function POST(request: Request) {
  const vapid = getVapidKeys(new URL(request.url).origin);
  if (!vapid) return reply({ error: 'not_configured' }, 503);

  const token = /^Bearer\s+(\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return reply({ error: 'unauthorized' }, 401);

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.rpc('send_test_notification');
  if (error) {
    return error.hint === 'rate_limited' ? reply({ error: 'rate_limited' }, 429) : reply({ error: 'not_allowed' }, 403);
  }
  const notification = data as TestNotification;

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .returns<SubscriptionRow[]>();
  if (subscriptionsError) return reply({ error: 'unavailable' }, 503);

  const payload = JSON.stringify({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    tag: 'test',
  });

  const results = await Promise.all((subscriptions ?? []).map(async (subscription) => {
    try {
      const result = await sendWebPush(subscription, payload, vapid, { ttl: 10 * 60, urgency: 'high' });
      if (result.gone) await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
      return result.ok ? 'sent' : result.gone ? 'removed' : 'failed';
    } catch {
      return 'failed';
    }
  }));

  return reply({
    devices: results.length,
    sent: results.filter((r) => r === 'sent').length,
    removed: results.filter((r) => r === 'removed').length,
    failed: results.filter((r) => r === 'failed').length,
  });
}
