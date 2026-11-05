'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Browser side of Web Push: what this device supports, turning push on and
 * off, and the test notification. The subscription itself is stored through
 * register_push_subscription() (migration 038).
 *
 * iPhone: push exists only for a web app opened from the Home Screen
 * (iOS 16.4+). In Safari itself there is no PushManager at all, so that case
 * gets its own state with install steps instead of a dead button.
 */
export type PushSupport = 'supported' | 'ios_needs_install' | 'unsupported' | 'not_configured';

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function isIosDevice(): boolean {
  const agent = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points give it away.
  return /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
}

export function isStandaloneApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getPushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return 'not_configured';
  if (isIosDevice() && !isStandaloneApp()) return 'ios_needs_install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'supported';
}

function applicationServerKey(): Uint8Array<ArrayBuffer> {
  const base64 = VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const key = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) key[i] = raw.charCodeAt(i);
  return key;
}

export async function getDeviceSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export type EnableResult = 'enabled' | 'denied' | 'failed';

/** Must run from a tap: browsers only show the permission prompt then. */
export async function enablePush(): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(),
    });
  }

  const json = subscription.toJSON();
  const { error } = await createSupabaseBrowserClient().rpc('register_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent,
  });
  return error ? 'failed' : 'enabled';
}

/** Turns push off on this device only. */
export async function disablePush(): Promise<boolean> {
  const subscription = await getDeviceSubscription();
  if (!subscription) return true;
  const { error } = await createSupabaseBrowserClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe().catch(() => false);
  return !error;
}

export type TestPushResult =
  | { ok: true; devices: number; sent: number; removed: number; failed: number }
  | { ok: false; reason: 'rate_limited' | 'not_configured' | 'failed' };

export async function sendTestPush(): Promise<TestPushResult> {
  const { data } = await createSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: 'failed' };

  try {
    const response = await fetch('/api/notifications/send-test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true, ...body };
    if (response.status === 429) return { ok: false, reason: 'rate_limited' };
    if (response.status === 503 && body.error === 'not_configured') return { ok: false, reason: 'not_configured' };
    return { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
