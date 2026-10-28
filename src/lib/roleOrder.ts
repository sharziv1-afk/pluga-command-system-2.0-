// Same quote folding as normalizeRole in permissions.ts, inlined so the node
// test runner can load this file on its own.
function normalizeRole(role: string | null | undefined): string {
  return (role ?? '').trim().replace(/[\u05F4\u05F3"'´“”‘’]/g, '"');
}

// Company headquarters, in the order the מ״פ reads it (28.10.2026): מ״פ,
// סמ״פ, מפל״ג first, then the rest of the company staff.
const COMPANY_ROLES = [
  'מ"פ',
  'סמ"פ',
  'מפל"ג',
  'מש"ד',
  'רס"פ / לוגיסטיקה',
  'רס"פ',
  'סרס"פ',
  'סרס"פ א"',
  'סרס"פ ב"',
  'חובש פלוגתי',
  'ע. חובש פלוגתי',
  'קשר פלוגתי',
  'א.קוד',
  'ב.קוד / נהג',
];

// Then each platoon in turn: מ״מ, סמל, and its squad commanders א-ג.
const PLATOON_ROLE = /^(מ"מ|סמל|מ"כ) ?([1-4])([א-ג])?$/;
const PLATOON_ROLE_ORDER = ['מ"מ', 'סמל', 'מ"כ'];

/**
 * Sort key for a role in the company hierarchy. Spacing is not significant
 * ("ב.קוד/נהג", "מ"כ  1א"), and "מ"כ א1" is read the same as "מ"כ 1א".
 * Unknown roles sort last.
 */
export function companyRoleRank(role: string | null | undefined): number {
  const normalized = normalizeRole(role).replace(/\s+/g, ' ').replace(/ ?\/ ?/g, ' / ').replace(/\. /g, '.');
  const companyIndex = COMPANY_ROLES.findIndex(item => item.replace(/\. /g, '.') === normalized);
  if (companyIndex >= 0) return companyIndex;

  const squadFirst = normalized.match(/^מ"כ ?([א-ג]) ?([1-4])$/);
  const match = squadFirst ? ['', 'מ"כ', squadFirst[2], squadFirst[1]] : normalized.match(PLATOON_ROLE);
  if (match) {
    const platoon = Number(match[2]);
    const squad = match[3] ? '-אבג'.indexOf(match[3]) : 0;
    return 100 + platoon * 100 + PLATOON_ROLE_ORDER.indexOf(match[1]) * 10 + squad;
  }

  return 10_000;
}

/** Orders people by company hierarchy, then by name within the same role. */
export function sortByCompanyHierarchy<T extends { role: string | null; name: string | null }>(people: readonly T[]): T[] {
  return [...people].sort((a, b) => (
    companyRoleRank(a.role) - companyRoleRank(b.role)
    || (a.name ?? '').localeCompare(b.name ?? '', 'he')
  ));
}
