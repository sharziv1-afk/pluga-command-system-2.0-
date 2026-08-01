export function snapshotDraftFields<T extends object>(
  draft: T,
  fields: readonly (keyof T)[],
): T {
  return Object.fromEntries(fields.map(field => [field, draft[field]])) as T;
}

export function isDraftDirty<T extends object>(
  draft: T,
  baseline: T,
  fields: readonly (keyof T)[],
) {
  return fields.some(field => draft[field] !== baseline[field]);
}

export function nextDraftBaseline<T extends object>(
  baseline: T,
  draft: T,
  saveSucceeded: boolean,
  fields: readonly (keyof T)[],
) {
  return saveSucceeded ? snapshotDraftFields(draft, fields) : baseline;
}

export function dailyDraftScopeKey(parts: {
  date: string;
  profileId: string;
  nodeId: string;
  ownerId: string;
  reportLevel: string;
  staffRole?: string;
}) {
  return [
    parts.date,
    parts.profileId,
    parts.nodeId,
    parts.ownerId,
    parts.reportLevel,
    parts.staffRole ?? '',
  ].map(encodeURIComponent).join('|');
}

export function shouldHydrateDraft(isDirty: boolean) {
  return !isDirty;
}

export function canTransitionDraft(
  currentScope: string,
  nextScope: string,
  isDirty: boolean,
  confirmDiscard: () => boolean,
) {
  return currentScope === nextScope || !isDirty || confirmDiscard();
}

export function isLatestDailyLoad(loadVersion: number, latestVersion: number) {
  return loadVersion === latestVersion;
}
