// Hands a file the app built to the user: on a phone or iPad, the share sheet
// (Notability, Excel, WhatsApp are one tap); elsewhere, a download.
// Import-free, so a page can import it statically and call it inside the tap
// itself — Safari allows the share sheet only right after a tap.

export type FileHandoff = 'shared' | 'downloaded' | 'cancelled' | 'needs_tap';

function isTouchDevice(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod|Android/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** A plain browser download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * The share sheet on a touch device, else a download. When Safari refuses the
 * share sheet because too much time passed since the tap, it says
 * NotAllowedError and this returns 'needs_tap'; the caller can offer a second
 * tap or fall back to downloadBlob.
 */
export async function handOffFile(blob: Blob, fileName: string, title: string, mimeType: string): Promise<FileHandoff> {
  const file = new File([blob], fileName, { type: mimeType });
  if (isTouchDevice() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs_tap';
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
