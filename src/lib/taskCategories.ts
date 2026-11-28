// The categories a task can carry (metadata.category). It used to be free
// text; the commander asked for a fixed list with "אישי" so a personal task is
// obvious (13.11.2026). On LIVE only "אישי" was in use; the mentoring log
// creates tasks with "חניכה".
//
// A task saved before the list may hold any text. The edit form keeps that
// value as an extra option (taskCategoryOptions), so saving does not wipe it.
// Pure and import-free: the site, the MCP tools and the node tests load it.

export const TASK_CATEGORIES = ['מבצעי', 'לוגיסטיקה', 'מנהלה', 'חניכה', 'אישי', 'אחר'] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const PERSONAL_TASK_CATEGORY: TaskCategory = 'אישי';

export function isTaskCategory(value: unknown): value is TaskCategory {
  return typeof value === 'string' && (TASK_CATEGORIES as readonly string[]).includes(value);
}

/** The dropdown's options: the list, plus an older free-text value the task already has. */
export function taskCategoryOptions(current?: string | null): string[] {
  const value = current?.trim();
  return value && !isTaskCategory(value) ? [...TASK_CATEGORIES, value] : [...TASK_CATEGORIES];
}

/**
 * The assignee after the category changes in a create form: picking "אישי"
 * assigns the task to its creator, which makes it private (taskVisibility.ts).
 * The person can still change the assignee before saving.
 */
export function assigneeForCategoryChange(params: {
  category: string;
  assignedTo: string;
  creatorId: string | null | undefined;
}): string {
  const { category, assignedTo, creatorId } = params;
  return category === PERSONAL_TASK_CATEGORY && creatorId ? creatorId : assignedTo;
}

/**
 * MCP create_task: a personal task with no assignee named goes to the caller.
 * An assignee the caller named explicitly is kept.
 */
export function personalTaskAssignee(params: {
  category: string | null | undefined;
  assignedTo: string | null;
  creatorId: string;
}): string | null {
  const { category, assignedTo, creatorId } = params;
  if (assignedTo) return assignedTo;
  return category === PERSONAL_TASK_CATEGORY ? creatorId : null;
}
