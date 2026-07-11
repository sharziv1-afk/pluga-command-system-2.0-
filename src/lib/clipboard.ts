export type CopyTextResult = {
  ok: boolean;
  method: 'clipboard-api' | 'textarea-fallback' | 'unsupported';
  error?: unknown;
};

/**
 * Copies text to the clipboard with a fallback for insecure contexts.
 *
 * `navigator.clipboard` only exists in secure contexts (HTTPS/localhost), so on
 * the current HTTP-LAN deployment (phones opening http://<ip>:<port>) it is
 * undefined and a plain `writeText` call always fails (BUG-COPY-001). The
 * fallback copies via a temporary offscreen textarea + `document.execCommand('copy')`,
 * which works in insecure contexts and on iOS Safari when called from a user gesture.
 */
export async function copyTextToClipboard(text: string): Promise<CopyTextResult> {
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, method: 'unsupported' };
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: 'clipboard-api' };
    } catch {
      // Fall through to the textarea fallback (e.g. focus/permission failures).
    }
  }

  if (typeof document === 'undefined') {
    return { ok: false, method: 'unsupported' };
  }

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  try {
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    return copied ? { ok: true, method: 'textarea-fallback' } : { ok: false, method: 'unsupported' };
  } catch (error) {
    return { ok: false, method: 'unsupported', error };
  } finally {
    textarea.remove();
    previousFocus?.focus();
  }
}
