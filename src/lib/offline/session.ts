// Everything this app leaves on a device, cleared in one place.
//
// Sign-out used to call supabase.auth.signOut() and nothing else, which left
// the previous user's cached rows, their identity snapshot, and their device
// unlock credentials sitting on the phone. On a shared device the next person
// could read the previous one's data offline and unlock the offline gate with
// a PIN that was never theirs.
//
// The write queue is intentionally NOT cleared: those are unsaved edits, and
// each one carries its authorUserId so it can only ever replay under the
// account that actually made it (see syncEngine.ts).
import { cacheClear } from './db';
import { clearCachedProfileSnapshot } from './cachedProfile';
import { clearDevicePin } from './devicePin';
import { clearDeviceBiometric } from './deviceBiometric';

export async function clearDeviceSession(): Promise<void> {
  clearCachedProfileSnapshot();
  clearDevicePin();
  clearDeviceBiometric();
  await cacheClear();
}
