// No runtime imports: tests load this file directly with --experimental-strip-types.

/**
 * The ?next= value the login page may follow after sign-in, or null.
 *
 * Only same-origin absolute paths pass. "//evil.com", "/\\evil.com",
 * "https://…", "javascript:…" and anything with control characters are
 * rejected, so a crafted login link cannot bounce a freshly signed-in user
 * to another site (open redirect). The OAuth consent page depends on this to
 * return the user to /oauth/consent?authorization_id=… after login.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith('/')) return null;
  if (next.startsWith('//') || next.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  try {
    const url = new URL(next, 'https://same-origin.invalid');
    if (url.origin !== 'https://same-origin.invalid') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
