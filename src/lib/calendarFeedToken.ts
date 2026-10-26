// Calendar subscription link codes: "cal_" + 32 random bytes in base64url.
// Pure and import-free, so the browser (creating a link), the route (reading
// one) and the node tests share the exact same rules.

const TOKEN_PATTERN = /^cal_[A-Za-z0-9_-]{43}$/;

export function isCalendarFeedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A new link code, from the platform's CSPRNG. */
export function createCalendarFeedToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `cal_${base64Url(bytes)}`;
}

/** SHA-256 of the code as lowercase hex — what calendar_feeds.token_hash stores. */
export async function hashCalendarFeedToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** The subscription URL for a code. webcal:// opens the calendar app directly. */
export function calendarFeedUrls(origin: string, token: string) {
  const https = `${origin.replace(/\/$/, '')}/api/calendar/${token}.ics`;
  return { https, webcal: https.replace(/^https?:\/\//, 'webcal://') };
}
