'use client';

import { PAGE_HEIGHT, PAGE_WIDTH, buildImagePdf, layoutForumPdf, type ForumPdfModel } from './pdfExport';

// Draws the laid-out pages on a canvas — the browser shapes the Hebrew and
// runs the bidi algorithm, so mixed Hebrew, numbers and English come out as
// they do on screen — and packs them into a PDF (pdfExport.ts).

/** Pixels per point: ~180 DPI, sharp under the pen without a heavy file. */
const SCALE = 2.5;
const JPEG_QUALITY = 0.88;

export async function renderForumPdf(model: ForumPdfModel): Promise<Blob> {
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (size: number, bold: boolean) => `${bold ? 700 : 400} ${size}px ${family}`;
  // Measuring before the font is ready would wrap lines for a fallback font.
  await Promise.all([document.fonts.load(font(12, false), 'א'), document.fonts.load(font(12, true), 'א')]).catch(() => undefined);
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_WIDTH * SCALE);
  canvas.height = Math.round(PAGE_HEIGHT * SCALE);
  canvas.dir = 'rtl';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');

  const measure = (text: string, size: number, bold: boolean) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = font(size, bold);
    return ctx.measureText(text).width;
  };
  const pages = layoutForumPdf(model, measure);

  const images: Array<{ jpeg: Uint8Array; width: number; height: number }> = [];
  for (const ops of pages) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    for (const op of ops) {
      if (op.kind === 'text') {
        ctx.font = font(op.size, op.bold);
        ctx.fillStyle = op.color;
        ctx.fillText(op.text, op.x, op.y);
      } else {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
      }
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('jpeg_failed');
    images.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
  }

  return new Blob([buildImagePdf(images) as BlobPart], { type: 'application/pdf' });
}

export type PdfHandoff = 'shared' | 'downloaded' | 'cancelled' | 'needs_tap';

function isTouchDevice(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod|Android/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/**
 * On a phone or iPad: the share sheet, where Notability is one tap. Elsewhere:
 * a download. Safari allows the share sheet only right after a tap; when
 * building the file took too long it says NotAllowedError, and the caller
 * shows a second button that shares the ready file.
 */
export async function handOffPdf(blob: Blob, fileName: string, title: string): Promise<PdfHandoff> {
  const file = new File([blob], fileName, { type: 'application/pdf' });
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
