export function normalizeRole(role: string | null | undefined): string {
  return (role ?? '').trim().replace(/[\u05F4\u05F3"'´“”‘’]/g, '"');
}

export function hasAdminAccess(role: string | null | undefined): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'מ"פ' || normalizedRole === 'סמ"פ';
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
