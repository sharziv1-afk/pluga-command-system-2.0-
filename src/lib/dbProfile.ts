/**
 * The shape pages use for "the signed-in user, in the form the DB rows use",
 * and the one adapter that builds it from AppContext's currentUser.
 *
 * This was copy-pasted into five pages and had already drifted: the forum's
 * copy omitted `units`, and dashboard's type declared an extra `unit_name`.
 * Nothing depended on the difference — the forum never reads `.units` — but
 * that is luck, not design, and it is exactly how the status-label and
 * timezone bugs in this codebase started.
 *
 * `units` is optional because the forum's copy never set it; call sites that
 * need the frame name already guard for null.
 */
export type DbProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  unit_name?: string | null;
  units?: { name: string } | null;
};

/** Minimal view of AppContext's currentUser that this adapter needs. */
type CurrentUserLike = {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
  assigned_frame: string;
};

export function toDbProfile(user: CurrentUserLike | null | undefined): DbProfile | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    unit_id: user.unit_id,
    permission_level: user.permission_level,
    units: { name: user.assigned_frame },
  };
}
