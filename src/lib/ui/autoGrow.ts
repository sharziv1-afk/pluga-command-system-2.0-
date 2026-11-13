// Auto-grow for <textarea>: the box follows its content instead of staying a
// few lines tall with an inner scrollbar.
//
// Modern engines do this in CSS alone with `field-sizing: content` (see
// `.auto-grow-textarea` in globals.css). Older Safari/iOS ignore that
// property, so the component falls back to measuring scrollHeight in JS.
// Kept free of React and path aliases so the node test can import it.

export interface AutoGrowTarget {
  style: { height: string };
  scrollHeight: number;
  offsetHeight: number;
  clientHeight: number;
  parentElement?: AutoGrowScrollable | null;
}

interface AutoGrowScrollable {
  scrollTop: number;
  parentElement?: AutoGrowScrollable | null;
}

interface CssSupports {
  supports?: (property: string, value: string) => boolean;
}

/** True when the browser sizes the textarea itself (`field-sizing: content`). */
export function supportsFieldSizing(css: CssSupports | undefined = (globalThis as { CSS?: CssSupports }).CSS): boolean {
  try {
    return typeof css?.supports === 'function' && css.supports('field-sizing', 'content');
  } catch {
    return false;
  }
}

/**
 * Sets the textarea's height to fit its content and returns the new height in
 * px, or null when it is not rendered (e.g. inside a closed <details>), in
 * which case the inline height is cleared and the CSS min-height applies.
 * The CSS min-height still wins over a smaller inline height, so short text
 * keeps a comfortable box.
 */
export function fitTextareaHeight(el: AutoGrowTarget): number | null {
  el.style.height = 'auto';
  if (el.scrollHeight <= 0) {
    el.style.height = '';
    return null;
  }
  // border-box: height = content + padding (scrollHeight) + borders.
  const borders = Math.max(0, el.offsetHeight - el.clientHeight);
  const next = Math.ceil(el.scrollHeight + borders);
  el.style.height = `${next}px`;
  return next;
}

/**
 * Runs `fn` (which briefly collapses the textarea to `auto`) without letting
 * the page jump: collapsing a tall box shrinks the scroll container for a
 * moment and Safari clamps its scrollTop. Every scrolled ancestor is restored.
 */
export function withScrollPreserved(el: AutoGrowTarget, fn: () => void, scrollingElement?: AutoGrowScrollable | null) {
  const saved: Array<[AutoGrowScrollable, number]> = [];
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node.scrollTop > 0) saved.push([node, node.scrollTop]);
  }
  if (scrollingElement && scrollingElement.scrollTop > 0 && !saved.some(([node]) => node === scrollingElement)) {
    saved.push([scrollingElement, scrollingElement.scrollTop]);
  }
  fn();
  for (const [node, top] of saved) {
    if (node.scrollTop !== top) node.scrollTop = top;
  }
}
