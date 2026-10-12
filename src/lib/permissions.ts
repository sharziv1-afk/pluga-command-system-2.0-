export function normalizeRole(role: string | null | undefined): string {
  return (role ?? '').trim().replace(/[\u05F4\u05F3"'´“”‘’]/g, '"');
}

const BRIEF_EXACT_ROLES = new Set([
  'מ"פ',
  'סמ"פ',
  'מש"ד',
  'רס"פ / לוגיסטיקה',
  'רס"פ',
  'סרס"פ',
  'חובש פלוגתי',
  'קשר פלוגתי',
  'ב.קוד / נהג',
]);
// 4 platoons, 3 squads each (א-ג) — migration 021 removed the 4th squad.
const BRIEF_NUMBERED_ROLE = /^(?:מ"מ [1-4]|סמל [1-4]|מ"כ [1-4][א-ג])$/;

/**
 * Dashboard brief title for the signed-in role, e.g. "תדריך מ״מ 2".
 * An explicit list, not getPermissionLevelForRole: that returns 0 for
 * סרס"פ, which is a real role. Empty or unknown roles get "תדריך יומי".
 */
export function getCommandBriefTitle(role: string | null | undefined): string {
  // Spacing is not significant in a stored role: "מ"מ  2" and "ב.קוד/נהג"
  // are the same roles as "מ"מ 2" and "ב.קוד / נהג", and display the same.
  const normalizedRole = normalizeRole(role).replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ');
  const isKnown = BRIEF_EXACT_ROLES.has(normalizedRole) || BRIEF_NUMBERED_ROLE.test(normalizedRole);
  return isKnown ? `תדריך ${normalizedRole.replace(/"/g, '״')}` : 'תדריך יומי';
}

export function hasAdminAccess(role: string | null | undefined): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'מ"פ' || normalizedRole === 'סמ"פ';
}

/** Stricter than hasAdminAccess — מ"פ only, not סמ"פ. For tools that are the
 * commander's personal instrument (e.g. the מ"מ/סמ"פ mentoring log), where
 * even the deputy shouldn't see notes written about him or his peers. */
export function isCompanyCommander(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'מ"פ';
}

export function getPermissionLevelForRole(role: string | null | undefined): number {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'מ"פ') return 100;
  if (normalizedRole === 'סמ"פ') return 90;
  if (normalizedRole === 'מש"ד') return 85;
  if (normalizedRole === 'רס"פ / לוגיסטיקה' || normalizedRole === 'רס"פ') return 75;
  if (normalizedRole.startsWith('מ"מ')) return 70;
  if (normalizedRole === 'חובש פלוגתי') return 70;
  if (normalizedRole === 'קשר פלוגתי') return 70;
  if (normalizedRole === 'ב.קוד / נהג' || normalizedRole === 'ב.קוד/נהג') return 60;
  if (normalizedRole.startsWith('סמל')) return 60;
  if (normalizedRole.startsWith('מ"כ')) return 50;
  return 0;
}

/**
 * Existing UI visibility rule. Database RLS remains the authorization boundary.
 * This intentionally includes company-command roles containing מ"פ, plus
 * מש"ד (עוזר מ"פ) explicitly — its title doesn't contain that substring.
 */
export function hasCompanyWideUiAccess(
  role: string | null | undefined,
  storedPermissionLevel = 0,
): boolean {
  const normalizedRole = normalizeRole(role);
  return storedPermissionLevel >= 90
    || getPermissionLevelForRole(normalizedRole) >= 90
    || normalizedRole.includes('מ"פ')
    || normalizedRole.includes('סמ"פ')
    || normalizedRole === 'מש"ד';
}

export function isActiveApprovedProfile(
  accountStatus: string | null | undefined,
  approvalStatus: string | null | undefined,
): boolean {
  return accountStatus === 'active' && approvalStatus === 'approved';
}
