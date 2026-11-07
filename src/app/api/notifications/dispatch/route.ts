import { createClient } from '@supabase/supabase-js';
import { getVapidKeys } from '@/lib/push/vapid';
import { sendWebPush } from '@/lib/push/webPush';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { QUICK_ACTION_LABELS, actionsForKind } from '@/lib/notifications/actions';

// Sends pending notifications as Web Push (migration 039). The database pokes
// this route through pg_net with an empty body whenever a notification is
// written; the request itself carries nothing and proves nothing. What makes
// it work is NOTIFICATIONS_DISPATCH_KEY, which lives only here (Vercel) — the
// database keeps just its SHA-256. claim_pending_pushes() hands over what is
// due and marks it in the same step, so a stranger calling this route, or two
// pokes at once, can only send what was already waiting, once.
export const dynamic = 'force-dynamic';

const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

type PendingPush = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
};

type PushResult = { subscription_id: string; ok: boolean; gone: boolean };

export async function POST(request: Request) {
  const key = process.env.NOTIFICATIONS_DISPATCH_KEY;
  const vapid = getVapidKeys(new URL(request.url).origin);
  if (!key || !vapid) return reply({ error: 'not_configured' }, 503);

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.rpc('claim_pending_pushes', { p_key: key, p_limit: 200 });
  if (error) return reply({ error: 'unavailable' }, 503);
  const pending = (data ?? []) as PendingPush[];
  if (pending.length === 0) return reply({ notifications: 0, sent: 0, failed: 0, removed: 0 });

  const results: PushResult[] = await Promise.all(pending.flatMap((item) => {
    // Up to two buttons (Android shows them; iPhone opens the item instead).
    const actions = actionsForKind(item.kind).slice(0, 2).map((action) => ({ action, title: QUICK_ACTION_LABELS[action] }));
    const payload = JSON.stringify({ id: item.id, title: item.title, body: item.body, url: item.url, tag: item.id, actions });
    return item.subscriptions.map(async (subscription): Promise<PushResult> => {
      try {
        const result = await sendWebPush(subscription, payload, vapid, { ttl: 24 * 60 * 60 });
        return { subscription_id: subscription.id, ok: result.ok, gone: result.gone };
      } catch {
        return { subscription_id: subscription.id, ok: false, gone: false };
      }
    });
  }));

  // Dead devices are dropped and failures counted; a failed bookkeeping call
  // must not turn a delivered batch into an error.
  await supabase.rpc('record_push_results', { p_key: key, p_results: results });

  return reply({
    notifications: pending.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok && !r.gone).length,
    removed: results.filter((r) => r.gone).length,
  });
}
