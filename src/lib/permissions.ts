/**
 * Company command roles (מ״פ / סמ״פ) that may access the user-approval / admin area.
 * Normalises both gershayim (״) and straight-quote (") spellings. Single source of
 * truth — previously duplicated inline in AppSidebar and MobileHeader.
 */
export function hasAdminAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  const norm = role.replace(/["״]/g, '"');
  return norm === 'מ"פ' || norm === 'סמ"פ';
}

export function getPermissionLevelForRole(role: string): number {
  const normRole = role.replace(/["״]/g, '"'); // Normalize Hebrew gershayim and normal quotes

  if (normRole === 'מ"פ') return 100;
  if (normRole === 'סמ"פ') return 90;
  if (normRole === 'ע. מ"פ') return 85;
  if (normRole === 'רס"פ / לוגיסטיקה' || normRole === 'רס"פ') return 75;
  if (normRole.startsWith('מ"מ')) return 70;
  if (normRole === 'חובש פלוגתי') return 70;
  if (normRole === 'קשר פלוגתי') return 70;
  if (normRole === 'ב.קוד / נהג' || normRole === 'ב.קוד/נהג') return 60;
  if (normRole.startsWith('סמל')) return 60;
  if (normRole.startsWith('מ"כ')) return 50;
  return 0;
}
