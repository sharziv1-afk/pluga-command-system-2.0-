// No runtime imports: tests load this file directly with --experimental-strip-types.

/** The fields of a public.users row that /admin decisions depend on. */
export interface ManagedUser {
  id: string;
  auth_user_id: string | null;
  role: string;
  permission_level: number;
  status: 'active' | 'pending' | 'blocked' | 'inactive';
  role_approval_status: 'pending' | 'approved' | 'rejected';
}

/** The signed-in admin, as far as these rules care. */
export interface AdminActor {
  id: string;
  permission_level: number;
  /** isCompanyCommander(role) — the מ"פ, not the סמ"פ. */
  isCompanyCommander: boolean;
}

/**
 * Whether the actor may edit or block this user from /admin.
 *
 * RLS ("users: commander update all") lets any commander write any row, so
 * this is the only place the two cases below are stopped:
 * - your own row: editing it can demote or lock out the only admin, and
 *   there is nobody left in the app to undo it;
 * - a סמ"פ touching the מ"פ or a peer at the same level: the deputy must not
 *   be able to demote or block the commander.
 * The מ"פ may manage every row except their own.
 */
export function canManageUser(actor: AdminActor, target: Pick<ManagedUser, 'id' | 'permission_level'>): boolean {
  if (actor.id === target.id) return false;
  if (actor.isCompanyCommander) return true;
  return target.permission_level < actor.permission_level;
}

/**
 * An email may change only while no Auth account is linked. claim_own_profile
 * matches the verified login email to this column, so after linking, the
 * column is the identity of a real account and must not drift from it.
 */
export function canEditEmail(target: Pick<ManagedUser, 'auth_user_id'>): boolean {
  return target.auth_user_id === null;
}

/** Same normalization the invite form applies before insert. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Only approved accounts are blocked/unblocked; pending ones are rejected instead. */
export function canToggleBlock(target: Pick<ManagedUser, 'role_approval_status' | 'status'>): boolean {
  return target.role_approval_status === 'approved' && (target.status === 'active' || target.status === 'blocked');
}

export function nextBlockStatus(status: ManagedUser['status']): 'active' | 'blocked' {
  return status === 'blocked' ? 'active' : 'blocked';
}

/**
 * The approval guardrail, applied to edits of already-approved users too: an
 * approved profile without a unit or with level 0 would keep access with no
 * scope, so the edit is refused instead of saved.
 */
export function approvedEditIsValid(
  target: Pick<ManagedUser, 'role_approval_status'>,
  unitId: string | null,
  permissionLevel: number,
): boolean {
  if (target.role_approval_status !== 'approved') return true;
  return Boolean(unitId) && permissionLevel > 0;
}
