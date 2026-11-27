'use client';

import { handOffFile, type FileHandoff } from '../fileHandoff';
import { PAGE_HEIGHT, PAGE_WIDTH, buildImagePdf, layoutForumPdf, type ForumPdfModel } from './pdfExport';

// Draws the laid-out pages on a canvas — the browser shapes the Hebrew and
// runs the bidi algorithm, so mixed Hebrew, numbers and English come out as
// they do on screen — and packs them into a PDF (pdfExport.ts).

/** Pixels per point: ~180 DPI, sharp under the pen without a heavy file. */
const SCALE = 2.5;
const JPEG_QUALITY = 0.88;

/** The battalion emblem, drawn when the model asks for it and the file loads. */
export const EMBLEM_SRC = '/brand/emblem-601.png';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export async function renderForumPdf(model: ForumPdfModel): Promise<Blob> {
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (size: number, bold: boolean) => `${bold ? 700 : 400} ${size}px ${family}`;
  // Measuring before the font is ready would wrap lines for a fallback font.
  await Promise.all([document.fonts.load(font(12, false), 'א'), document.fonts.load(font(12, true), 'א')]).catch(() => undefined);
  await document.fonts.ready;
  const emblem = model.emblem ? await loadImage(EMBLEM_SRC) : null;

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
        ctx.textAlign = op.align === 'center' ? 'center' : 'right';
        ctx.fillText(op.text, op.x, op.y);
      } else if (op.kind === 'line') {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.width ?? 0.6;
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
      } else if (op.kind === 'rect') {
        ctx.beginPath();
        if (op.radius) ctx.roundRect(op.x, op.y, op.w, op.h, op.radius);
        else ctx.rect(op.x, op.y, op.w, op.h);
        if (op.fill) {
          ctx.fillStyle = op.fill;
          ctx.fill();
        }
        if (op.stroke) {
          ctx.strokeStyle = op.stroke;
          ctx.lineWidth = op.lineWidth ?? 1;
          ctx.stroke();
        }
      } else if (op.kind === 'poly') {
        ctx.beginPath();
        op.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = op.fill;
        ctx.fill();
      } else if (op.kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(op.cx, op.cy, op.rx, op.ry, op.rotation, 0, Math.PI * 2);
        ctx.fillStyle = op.fill;
        ctx.fill();
      } else if (op.kind === 'image' && emblem) {
        // Kept in proportion, centred in its square.
        const ratio = Math.min(op.w / emblem.naturalWidth, op.h / emblem.naturalHeight);
        const w = emblem.naturalWidth * ratio;
        const h = emblem.naturalHeight * ratio;
        ctx.drawImage(emblem, op.x + (op.w - w) / 2, op.y + (op.h - h) / 2, w, h);
      }
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('jpeg_failed');
    images.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
  }

  return new Blob([buildImagePdf(images) as BlobPart], { type: 'application/pdf' });
}

export type PdfHandoff = FileHandoff;

/**
 * On a phone or iPad: the share sheet, where Notability is one tap. Elsewhere:
 * a download. Safari allows the share sheet only right after a tap; when
 * building the file took too long it returns 'needs_tap', and the caller
 * shows a second button that shares the ready file (src/lib/fileHandoff.ts).
 */
export function handOffPdf(blob: Blob, fileName: string, title: string): Promise<PdfHandoff> {
  return handOffFile(blob, fileName, title, 'application/pdf');
}
