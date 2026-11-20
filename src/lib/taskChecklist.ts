// Sub-tasks inside a task (צ׳ק ליסט), like a checklist note on the iPhone or
// Google Tasks: the task is the heading, and each line under it is ticked
// off on its own (מ״פ, 20.11.2026).
//
// Kept in tasks.metadata.checklist as [{ id, text, done }] — no new table.
// The creator and the commanders write the lines (one per line in the task
// form); the assignee may only tick them (migration 048 lets an assignee
// change `done` and nothing else).
//
// Pure and import-free: the tasks page, the MCP tools and the node tests load it.

export type ChecklistItem = { id: string; text: string; done: boolean };

export const CHECKLIST_MAX_ITEMS = 50;
export const CHECKLIST_MAX_TEXT = 200;

const newId = () => Math.random().toString(36).slice(2, 10);

/** The task's checklist, or [] — anything malformed is skipped. */
export function readChecklist(metadata: unknown): ChecklistItem[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const raw = (metadata as Record<string, unknown>).checklist;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, text, done } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof text !== 'string' || !text.trim()) return [];
    return [{ id, text, done: done === true }];
  });
}

/** One line per item, for the task form. */
export function checklistToLines(items: readonly ChecklistItem[]): string {
  return items.map((item) => item.text).join('\n');
}

/**
 * The lines typed in the task form, as checklist items. A leading "*", "-",
 * "•" or "[ ]" is the writer's bullet, not part of the text. A line that was
 * already on the list keeps its id and its tick, so editing the wording of
 * one line does not untick the others.
 */
export function checklistFromLines(
  text: string,
  previous: readonly ChecklistItem[] = [],
  makeId: () => string = newId,
): ChecklistItem[] {
  const unused = [...previous];
  const items: ChecklistItem[] = [];
  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    // Text pasted from Notes or WhatsApp carries invisible joiners (U+2060,
    // U+200B–U+200F, U+FEFF) after the bullet; they are dropped.
    const line = rawLine
      .replace(/[​-‏⁠﻿]/g, '')
      .replace(/^\s*(?:[*•\-–]+|\[[ xX✓]?\])\s*/, '')
      .trim()
      .slice(0, CHECKLIST_MAX_TEXT);
    if (!line) continue;
    if (items.length >= CHECKLIST_MAX_ITEMS) break;
    const matchIndex = unused.findIndex((item) => item.text === line);
    if (matchIndex >= 0) {
      const [kept] = unused.splice(matchIndex, 1);
      items.push({ ...kept, text: line });
    } else {
      items.push({ id: makeId(), text: line, done: false });
    }
  }
  return items;
}

/** Ticks or unticks one item; the rest are unchanged. */
export function toggleChecklistItem(items: readonly ChecklistItem[], id: string, done: boolean): ChecklistItem[] {
  return items.map((item) => (item.id === id ? { ...item, done } : item));
}

export function checklistProgress(items: readonly ChecklistItem[]) {
  return { done: items.filter((item) => item.done).length, total: items.length };
}

/** Merges the checklist into the task's metadata; an empty list removes the key. */
export function withChecklist(metadata: unknown, items: readonly ChecklistItem[]): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  if (items.length === 0) delete base.checklist;
  else base.checklist = items.map(({ id, text, done }) => ({ id, text, done }));
  return base;
}
