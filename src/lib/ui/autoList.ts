// Lists that continue themselves while typing, as in Word or Notion
// (מ״פ, 28.11.2026), for the forum report fields:
//   * "1. " … Enter → the next line starts with "2. ";
//   * "* " at the start of a line becomes "• ", and Enter continues it
//     ("- " continues as it is);
//   * Enter on an item with nothing written after its marker ends the list,
//     removing that empty marker.
//
// It works on the text change itself (the character just inserted), not on
// key codes, so phone keyboards that report no key — Android's, for one —
// behave the same as a laptop's.
//
// Pure and import-free: AutoGrowTextarea and the node tests load it.

export type AutoListResult = { value: string; caret: number };

const NUMBERED = /^(\s*)(\d{1,3})([.)])\s(.*)$/;
const BULLETED = /^(\s*)([•\-–])\s(.*)$/;

/**
 * Given the value before and after one change and the caret after it, the
 * value to show instead (and where the caret goes) — or null to leave the
 * change as it is. Only a single typed character is acted on; a paste,
 * a deletion or an edit of several characters returns null.
 */
export function applyAutoList(previous: string, next: string, caret: number): AutoListResult | null {
  if (next.length !== previous.length + 1 || caret < 1 || caret > next.length) return null;
  if (next.slice(0, caret - 1) + next.slice(caret) !== previous) return null;
  const typed = next[caret - 1];

  if (typed === ' ') {
    // "*" alone at the start of the line, then a space → "• ".
    const lineStart = next.lastIndexOf('\n', caret - 2) + 1;
    if (/^\s*\*$/.test(next.slice(lineStart, caret - 1))) {
      return { value: `${next.slice(0, caret - 2)}•${next.slice(caret - 1)}`, caret };
    }
    return null;
  }

  if (typed !== '\n') return null;

  const lineStart = previous.lastIndexOf('\n', caret - 2) + 1;
  const lineEnd = previous.indexOf('\n', caret - 1);
  const before = previous.slice(lineStart, caret - 1);
  const after = previous.slice(caret - 1, lineEnd === -1 ? previous.length : lineEnd);

  const numbered = before.match(NUMBERED);
  const bulleted = numbered ? null : before.match(BULLETED);
  if (!numbered && !bulleted) return null;

  const [, indent, marker, separator, text] = numbered
    ? numbered
    : [bulleted![0], bulleted![1], bulleted![2], '', bulleted![3]];

  // An empty item: Enter ends the list and takes the marker away.
  if (!text.trim() && !after.trim()) {
    return { value: previous.slice(0, lineStart) + previous.slice(caret - 1), caret: lineStart };
  }

  const nextMarker = numbered ? `${indent}${Number(marker) + 1}${separator} ` : `${indent}${marker} `;
  return {
    value: next.slice(0, caret) + nextMarker + next.slice(caret),
    caret: caret + nextMarker.length,
  };
}
