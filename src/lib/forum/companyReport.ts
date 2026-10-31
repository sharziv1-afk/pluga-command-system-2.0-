/**
 * Deterministic company-report generator for the forum daily ("פורום מוביל").
 *
 * This module is intentionally PURE: no React, no Supabase, no Date.now(), no
 * other side effects. It takes the daily reports that are already loaded in the
 * page plus a small amount of mapping/label context, and returns a ready-to-edit
 * Hebrew company summary string together with the report ids it aggregated, a few
 * coarse stats, and human-readable warnings.
 *
 * Product rules encoded here (locked decisions):
 *  - The report is aggregated mainly from `submitted` and `closed` platoon/staff
 *    reports. A `draft`/`in_progress` report that already has content may be
 *    included, but it is clearly tagged "[בטיפול — טרם הוגש סופית]" so an
 *    in-progress report is never presented as final.
 *  - A platoon with no report at all is shown as "[לא הוגש דוח]".
 *  - "פערים מרכזיים" is NEVER auto-derived. The commander's free-text value
 *    (`keyGaps`) is injected verbatim; otherwise a manual-fill placeholder shows.
 *  - Nothing is invented. Platoons are matched by their mapped owner id or by the
 *    deterministic `metadata.node_label` ("מחלקה N"); unit_id is not used as a
 *    guess. Unmatched platoon reports are surfaced under "מחלקה לא מזוהה" and
 *    never crash the generator.
 */

export type CompanyReportLevel = 'squad' | 'platoon' | 'company' | 'staff';
export type CompanyReportStatus = 'draft' | 'in_progress' | 'submitted' | 'closed';

/** Structural shape of a `forum_daily_reports` row — kept loose on purpose so the
 *  page's richer `DailyReportRow` is structurally assignable without importing it. */
export interface CompanyReportSource {
  id: string;
  report_level: CompanyReportLevel;
  staff_role: string | null;
  owner_user_id: string | null;
  status: CompanyReportStatus;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
}

export interface CompanyReportPlatoon {
  /** 1-4 */
  number: number;
  /** e.g. "מחלקה 1" */
  label: string;
  /** Mapped מ״מ user id, when a user is matched to this platoon; otherwise null. */
  ownerUserId: string | null;
}

export interface CompanyReportStaffSlot {
  /** matches `staff_role` on the report, e.g. "medic" */
  role: string;
  /** display label, e.g. "חופ״ל" */
  label: string;
}

export interface CompanyReportInput {
  reports: CompanyReportSource[];
  /** Pretty Hebrew date for the header (caller formats it). */
  formattedDate: string;
  /** Platoons 1-4 with optional mapped owner. */
  platoons: CompanyReportPlatoon[];
  /** Staff / מפל״ג roles with labels. */
  staff: CompanyReportStaffSlot[];
  /** Commander free-text "פערים מרכזיים". Injected verbatim, never derived. */
  keyGaps?: string;
}

export interface CompanyReportStats {
  presentTotal: number | null;
  sdkTotal: number | null;
  platoonSubmitted: number;
  platoonTotal: number;
  staffSubmitted: number;
  staffTotal: number;
}

const MISSING_REPORT = '[לא הוגש דוח]';
const IN_PROGRESS_TAG = '[בטיפול — טרם הוגש סופית]';

function getString(content: Record<string, unknown>, key: string): string {
  const value = content[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseCount(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function isFinalStatus(status: CompanyReportStatus): boolean {
  return status === 'submitted' || status === 'closed';
}

/** Fields that count as "this report has real content" for tagging purposes. */
const PLATOON_CONTENT_KEYS = [
  'personnel',
  'readiness',
  'welfare',
  'medical',
  'safety',
  'discipline',
  'logistics',
  'plan_vs_actual',
  'daily_lessons',
  'next_actions',
  'personal_note',
  'present_count',
  'total_count',
];

function hasPlatoonContent(content: Record<string, unknown>): boolean {
  return PLATOON_CONTENT_KEYS.some((key) => getString(content, key).length > 0);
}

function resolvePlatoonNumber(
  report: CompanyReportSource,
  platoons: CompanyReportPlatoon[],
): number | null {
  if (report.owner_user_id) {
    const matched = platoons.find(
      (platoon) => platoon.ownerUserId && platoon.ownerUserId === report.owner_user_id,
    );
    if (matched) return matched.number;
  }
  const label =
    report.metadata && typeof report.metadata.node_label === 'string'
      ? report.metadata.node_label
      : '';
  const fromLabel = label.match(/מחלקה\s*([1-4])/);
  if (fromLabel) return Number(fromLabel[1]);
  return null;
}

/**
 * Resolve `report_level === 'platoon'` reports to their מ״מ 1-4 slot using the same
 * owner-role/unit source of truth as `aggregateCompanyStructured` (owner_user_id first,
 * `metadata.node_label` only as a last-resort fallback). Shared with the WhatsApp preview
 * generator so both surfaces can never disagree on which report belongs to which platoon.
 */
export function assignPlatoonReports(
  reports: CompanyReportSource[],
  platoons: CompanyReportPlatoon[],
): { byNumber: Map<number, CompanyReportSource>; unidentified: CompanyReportSource[] } {
  const platoonReports = reports.filter((report) => report.report_level === 'platoon');
  const byNumber = new Map<number, CompanyReportSource>();
  const unidentified: CompanyReportSource[] = [];
  for (const report of platoonReports) {
    const number = resolvePlatoonNumber(report, platoons);
    if (number && !byNumber.has(number)) {
      byNumber.set(number, report);
    } else {
      unidentified.push(report);
    }
  }
  return { byNumber, unidentified };
}

/** Squad-style text fields that the company report aggregates per platoon. */
export const COMPANY_AGGREGATED_TEXT_FIELDS = [
  'personnel',
  'readiness',
  'welfare',
  'medical',
  'safety',
  'discipline',
  'logistics',
  'personal_requests',
  'plan_vs_actual',
  'next_actions',
  'network_and_knowledge',
  'daily_lessons',
  'personal_note',
] as const;

export interface CompanyStructuredResult {
  /** Aggregated squad-style field values, ready to fill the company structured form. */
  fields: Record<string, string>;
  stats: CompanyReportStats;
  warnings: string[];
  generatedFromReportIds: string[];
}

/**
 * Roll up a single text field across the four platoons (plus any unidentified platoon
 * reports). Present-but-empty platoons are skipped to reduce clutter; a platoon with no
 * report at all is shown as "[לא הוגש דוח]" — but only when at least one platoon actually
 * contributed a value, so an all-empty field stays empty for the commander to fill.
 */
function rollupTextField(
  key: string,
  orderedPlatoons: CompanyReportPlatoon[],
  byNumber: Map<number, CompanyReportSource>,
  unidentified: CompanyReportSource[],
): string {
  const parts: string[] = [];
  let anyValue = false;

  for (const platoon of orderedPlatoons) {
    const report = byNumber.get(platoon.number);
    if (!report) {
      parts.push(`${platoon.label} — ${MISSING_REPORT}`);
      continue;
    }
    const value = getString(report.content, key);
    if (!value) continue;
    anyValue = true;
    const tag = !isFinalStatus(report.status) && hasPlatoonContent(report.content)
      ? ` ${IN_PROGRESS_TAG}`
      : '';
    parts.push(`${platoon.label} — ${value}${tag}`);
  }

  for (const report of unidentified) {
    const value = getString(report.content, key);
    if (!value) continue;
    anyValue = true;
    const tag = !isFinalStatus(report.status) && hasPlatoonContent(report.content)
      ? ` ${IN_PROGRESS_TAG}`
      : '';
    parts.push(`מחלקה לא מזוהה — ${value}${tag}`);
  }

  // Drop the trailing "[לא הוגש דוח]" markers if no real value was contributed at all.
  return anyValue ? parts.join('\n') : '';
}

/**
 * Aggregate the platoon reports into a structured, per-field company report (same fields as
 * a מ״מ report). Numbers (present/total) are summed; text fields are rolled up per platoon.
 * Pure and deterministic — never invents content, never guesses platoons by unit_id.
 * "דגשי מ״פ" (commander_closing) is intentionally NOT produced here — it stays manual.
 */
export function aggregateCompanyStructured(input: CompanyReportInput): CompanyStructuredResult {
  const { reports, platoons, staff } = input;
  const warnings: string[] = [];
  const usedIds = new Set<string>();

  const orderedPlatoons = [...platoons].sort((a, b) => a.number - b.number);
  const { byNumber, unidentified } = assignPlatoonReports(reports, platoons);

  let presentTotal: number | null = null;
  let sdkTotal: number | null = null;
  for (const platoon of orderedPlatoons) {
    const report = byNumber.get(platoon.number);
    if (!report) {
      warnings.push(`${platoon.label}: לא הוגש דוח.`);
      continue;
    }
    usedIds.add(report.id);
    const present = parseCount(getString(report.content, 'present_count'));
    const total = parseCount(getString(report.content, 'total_count'));
    if (present !== null) presentTotal = (presentTotal ?? 0) + present;
    if (total !== null) sdkTotal = (sdkTotal ?? 0) + total;
    if (!isFinalStatus(report.status) && hasPlatoonContent(report.content)) {
      warnings.push(`${platoon.label}: הדוח עדיין בטיפול וטרם הוגש סופית.`);
    }
  }
  for (const report of unidentified) usedIds.add(report.id);
  if (unidentified.length > 0) {
    warnings.push(`${unidentified.length} דוחות מחלקה לא מזוהים (אין שיוך מ״מ/מחלקה).`);
  }

  const fields: Record<string, string> = {
    present_count: presentTotal !== null ? String(presentTotal) : '',
    total_count: sdkTotal !== null ? String(sdkTotal) : '',
  };
  for (const key of COMPANY_AGGREGATED_TEXT_FIELDS) {
    fields[key] = rollupTextField(key, orderedPlatoons, byNumber, unidentified);
  }

  const platoonSubmitted = orderedPlatoons.filter((platoon) => {
    const report = byNumber.get(platoon.number);
    return report ? isFinalStatus(report.status) : false;
  }).length;
  const staffSubmitted = staff.filter((slot) =>
    reports.some(
      (report) =>
        report.report_level === 'staff' &&
        report.staff_role === slot.role &&
        isFinalStatus(report.status),
    ),
  ).length;

  return {
    fields,
    stats: {
      presentTotal,
      sdkTotal,
      platoonSubmitted,
      platoonTotal: orderedPlatoons.length,
      staffSubmitted,
      staffTotal: staff.length,
    },
    warnings,
    generatedFromReportIds: [...usedIds],
  };
}
