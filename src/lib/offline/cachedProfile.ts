// A "who am I" snapshot kept in localStorage after every successful profile
// load, so the app can still identify its user with no network — both to show
// a real name on the offline lock screen and, once unlocked, to run the normal
// shell against the IndexedDB read cache instead of a dead end.
//
// This is identity, not data: the actual rows live in the IndexedDB cache
// (db.ts), scoped per user. Cleared on sign-out via session.ts.
import type { Profile } from '../types';

const SNAPSHOT_KEY = 'hamefaked_offline_profile_snapshot';

export interface OfflineProfileSnapshot {
  /** The full profile as last loaded — enough to render the shell offline. */
  profile: Profile;
  cachedAt: string;
}

export function cacheProfileSnapshot(profile: Profile): void {
  const snapshot: OfflineProfileSnapshot = {
    profile,
    cachedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage unavailable — offline fallback just won't have a snapshot */
  }
}

export function readCachedProfileSnapshot(): OfflineProfileSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineProfileSnapshot>;
    // A snapshot written by an older build has no `profile` — treat it as
    // absent rather than handing the shell a half-built user object.
    if (!parsed?.profile?.id) return null;
    return parsed as OfflineProfileSnapshot;
  } catch {
    return null;
  }
}

export function clearCachedProfileSnapshot(): void {
  try {
    window.localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}
