// A tiny "who am I" snapshot kept in localStorage after every successful
// profile load — not the app's data, just enough to render a real name and
// role on the offline lock screen instead of a blank "you're offline" wall.
// Deliberately does not cache tasks/requests/forum content — that's a real
// caching layer for a later phase (see AI_HANDOFF_CHECKPOINT.md), not
// something to bolt on as a side effect of the PIN feature.
import type { Profile } from '../types';

const SNAPSHOT_KEY = 'hamefaked_offline_profile_snapshot';

export interface OfflineProfileSnapshot {
  fullName: string;
  role: string;
  assignedFrame: string;
  cachedAt: string;
}

export function cacheProfileSnapshot(profile: Profile): void {
  const snapshot: OfflineProfileSnapshot = {
    fullName: profile.full_name,
    role: profile.role,
    assignedFrame: profile.assigned_frame,
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
    return JSON.parse(raw) as OfflineProfileSnapshot;
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
