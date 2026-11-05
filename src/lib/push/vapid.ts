import type { VapidKeys } from '@/lib/push/webPush';

/**
 * The VAPID key pair from the environment, or null while push is not set up.
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY is public by design (the browser subscribes
 * with it); VAPID_PRIVATE_KEY exists only on the server, in Vercel.
 */
export function getVapidKeys(siteOrigin: string): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || siteOrigin };
}
