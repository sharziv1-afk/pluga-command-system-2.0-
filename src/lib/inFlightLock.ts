export type InFlightLock = { current: boolean };

export function isAmbiguousMutationFailure(status: number | null | undefined): boolean {
  return !status;
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
