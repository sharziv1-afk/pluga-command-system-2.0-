export type InFlightLock = { current: boolean };

export type MutationFailureClassification = 'definitive_failure' | 'ambiguous_completion';

const ambiguousMutationStatuses = new Set([408, 502, 503, 504]);

export const ambiguousMutationMessage = 'לא התקבלה תשובה סופית מהשרת. ייתכן שהפריט נוצר. בדוק את הרשימה לפני ניסיון נוסף.';

export function classifyMutationFailure(
  status: number | null | undefined,
): MutationFailureClassification {
  return !status || ambiguousMutationStatuses.has(status)
    ? 'ambiguous_completion'
    : 'definitive_failure';
}

export function isAmbiguousMutationFailure(status: number | null | undefined): boolean {
  return classifyMutationFailure(status) === 'ambiguous_completion';
}

export function mutationFailureMessage(
  status: number | null | undefined,
  definitiveMessage: string,
) {
  return isAmbiguousMutationFailure(status) ? ambiguousMutationMessage : definitiveMessage;
}

export async function runQuickCreateMutation<T>(
  lock: InFlightLock,
  setBusy: (busy: boolean) => void,
  mutation: () => Promise<{ data: T | null; error: unknown; status?: number | null }>,
  definitiveMessage: string,
  setFailure: (message: string) => void,
  onSuccess: (data: T) => Promise<void> | void,
) {
  return runWithInFlightLock(lock, setBusy, async () => {
    const { data, error, status } = await mutation();
    if (error || !data) {
      setFailure(mutationFailureMessage(status, definitiveMessage));
      return;
    }
    await onSuccess(data);
  });
}

export async function runWithInFlightLock(
  lock: InFlightLock,
  setBusy: (busy: boolean) => void,
  operation: () => Promise<void>,
): Promise<boolean> {
  if (lock.current) return false;

  lock.current = true;
  setBusy(true);

  try {
    await operation();
    return true;
  } finally {
    lock.current = false;
    setBusy(false);
  }
}
