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

export interface CompanyReportResult {
  text: string;
  generatedFromReportIds: string[];
  stats: CompanyReportStats;
  warnings: string[];
}

const MISSING_REPORT = '[לא הוגש דוח]';
const IN_PROGRESS_TAG = '[בטיפול — טרם הוגש סופית]';
const DASH = '—';
const DIVIDER = '─'.repeat(24);

function getString(content: Record<string, unknown>, key: string): string {
  const value = content[key];
  return typeof value === 'string' ? value.trim() : '';
}

function valueOrDash(content: Record<string, unknown>, key: string): string {
  return getString(content, key) || DASH;
}

function parseCount(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function isFinalStatus(status: CompanyReportStatus): boolean {
  return status === 'submitted' || status === 'closed';
}

function statusText(status: CompanyReportStatus): string {
  switch (status) {
    case 'closed':
      return 'נסגר';
    case 'submitted':
      return 'הוגש';
    case 'in_progress':
      return 'בטיפול';
    default:
      return 'טרם הוגש';
  }
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

function manpowerText(content: Record<string, unknown>): string {
  const present = getString(content, 'present_count');
  const total = getString(content, 'total_count');
  if (!present && !total) return DASH;
  return `${present || DASH}/${total || DASH}`;
}

/**
 * Build the deterministic company summary text from already-loaded daily reports.
 */
export function buildCompanyReport(input: CompanyReportInput): CompanyReportResult {
  const { reports, formattedDate, platoons, staff, keyGaps } = input;
  const warnings: string[] = [];
  const usedIds = new Set<string>();

  // --- Assign platoon reports to platoon numbers (deterministic, never guesses by unit). ---
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

  const orderedPlatoons = [...platoons].sort((a, b) => a.number - b.number);

  // --- Company report (commander's own report) for tomorrow's schedule + closing notes. ---
  const companyReport = reports.find((report) => report.report_level === 'company') ?? null;
  if (companyReport) usedIds.add(companyReport.id);

  // --- Header + overview ----------------------------------------------------------------
  const lines: string[] = [];
  lines.push('📋 פורום מוביל יומי — סיכום פלוגתי');
  lines.push(`תאריך: ${formattedDate}`);
  lines.push('');
  lines.push(DIVIDER);
  lines.push('תמונת מצב כללית');

  let presentTotal: number | null = null;
  let sdkTotal: number | null = null;
  for (const platoon of orderedPlatoons) {
    const report = byNumber.get(platoon.number);
    if (!report) continue;
    const present = parseCount(getString(report.content, 'present_count'));
    const total = parseCount(getString(report.content, 'total_count'));
    if (present !== null) presentTotal = (presentTotal ?? 0) + present;
    if (total !== null) sdkTotal = (sdkTotal ?? 0) + total;
  }

  const platoonSubmitted = orderedPlatoons.filter((platoon) => {
    const report = byNumber.get(platoon.number);
    return report ? isFinalStatus(report.status) : false;
  }).length;

  const staffReports = staff.map((slot) => ({
    slot,
    report:
      reports.find(
        (report) => report.report_level === 'staff' && report.staff_role === slot.role,
      ) ?? null,
  }));
  const staffSubmitted = staffReports.filter(
    ({ report }) => report !== null && isFinalStatus(report.status),
  ).length;

  lines.push(
    `• מצבה: ${presentTotal ?? DASH}/${sdkTotal ?? DASH}`,
    `• דוחות מחלקה שהוגשו: ${platoonSubmitted}/${orderedPlatoons.length}`,
    `• דוחות מפל״ג שהוגשו: ${staffSubmitted}/${staff.length}`,
  );

  // --- Per-platoon detail ---------------------------------------------------------------
  for (const platoon of orderedPlatoons) {
    lines.push('', DIVIDER, platoon.label);
    const report = byNumber.get(platoon.number);
    if (!report) {
      lines.push(`• סטטוס: ${MISSING_REPORT}`);
      warnings.push(`${platoon.label}: לא הוגש דוח.`);
      continue;
    }
    usedIds.add(report.id);
    const content = report.content;
    const final = isFinalStatus(report.status);
    const withContent = hasPlatoonContent(content);
    const tag = !final && withContent ? ` · ${IN_PROGRESS_TAG}` : '';
    lines.push(`• סטטוס: ${statusText(report.status)}${tag}`);
    if (!final && withContent) {
      warnings.push(`${platoon.label}: הדוח עדיין בטיפול וטרם הוגש סופית.`);
    }

    if (final || withContent) {
      lines.push(
        `• מצבה: ${manpowerText(content)}`,
        `• כוננות: ${valueOrDash(content, 'readiness')}`,
        `• ת״ש: ${valueOrDash(content, 'welfare')}`,
        `• רפואה: ${valueOrDash(content, 'medical')}`,
        `• לוגיסטיקה: ${valueOrDash(content, 'logistics')}`,
        `• רצוי מול מצוי: ${valueOrDash(content, 'plan_vs_actual')}`,
        `• לקח יומי: ${valueOrDash(content, 'daily_lessons')}`,
        `• פעולות להמשך: ${valueOrDash(content, 'next_actions')}`,
      );
    } else {
      lines.push('• טרם מולא תוכן.');
    }
  }

  // --- Unidentified platoon reports (never dropped) -------------------------------------
  if (unidentified.length > 0) {
    lines.push('', DIVIDER, 'מחלקה לא מזוהה');
    warnings.push(`${unidentified.length} דוחות מחלקה לא מזוהים (אין שיוך מ״מ/מחלקה).`);
    unidentified.forEach((report, index) => {
      usedIds.add(report.id);
      const content = report.content;
      const final = isFinalStatus(report.status);
      const withContent = hasPlatoonContent(content);
      const tag = !final && withContent ? ` · ${IN_PROGRESS_TAG}` : '';
      lines.push(
        `• דוח ${index + 1} · סטטוס: ${statusText(report.status)}${tag}`,
        `  מצבה: ${manpowerText(content)} · כוננות: ${valueOrDash(content, 'readiness')} · לוגיסטיקה: ${valueOrDash(content, 'logistics')}`,
      );
    });
  }

  // --- Staff / מפל״ג --------------------------------------------------------------------
  lines.push('', DIVIDER, 'מפל״ג / בעלי תפקידים');
  for (const { slot, report } of staffReports) {
    if (!report) {
      lines.push(`• ${slot.label}: טרם הוגש`);
      continue;
    }
    usedIds.add(report.id);
    const notes = getString(report.content, 'notes');
    const final = isFinalStatus(report.status);
    const tag = !final && notes ? ` ${IN_PROGRESS_TAG}` : '';
    lines.push(`• ${slot.label}: ${notes || 'טרם הוגש'}${tag}`);
  }

  // --- Company roll-ups -----------------------------------------------------------------
  const rollup = (title: string, key: string) => {
    lines.push('', DIVIDER, title);
    for (const platoon of orderedPlatoons) {
      const report = byNumber.get(platoon.number);
      if (!report) {
        lines.push(`• ${platoon.label}: ${MISSING_REPORT}`);
        continue;
      }
      lines.push(`• ${platoon.label}: ${valueOrDash(report.content, key)}`);
    }
  };

  rollup('כוננות פלוגתית', 'readiness');
  rollup('רצוי מול מצוי פלוגתי', 'plan_vs_actual');
  rollup('לקחים מרכזיים', 'daily_lessons');

  // משימות להמשך / מחר — platoon next_actions + the company tomorrow_schedule.
  lines.push('', DIVIDER, 'משימות להמשך / מחר');
  for (const platoon of orderedPlatoons) {
    const report = byNumber.get(platoon.number);
    if (!report) {
      lines.push(`• ${platoon.label}: ${MISSING_REPORT}`);
      continue;
    }
    lines.push(`• ${platoon.label}: ${valueOrDash(report.content, 'next_actions')}`);
  }
  if (companyReport) {
    lines.push(`• לו״ז פלוגתי למחר: ${valueOrDash(companyReport.content, 'tomorrow_schedule')}`);
  } else {
    lines.push(`• לו״ז פלוגתי למחר: ${DASH}`);
  }

  // --- פערים מרכזיים — manual only, never auto-derived. ---------------------------------
  lines.push('', DIVIDER, 'פערים מרכזיים');
  const cleanGaps = (keyGaps ?? '').trim();
  lines.push(cleanGaps || '(למילוי ידני — לא נגזר אוטומטית)');

  // --- דגשי מ״פ -------------------------------------------------------------------------
  lines.push('', DIVIDER, 'דגשי מ״פ');
  if (companyReport) {
    const closing = getString(companyReport.content, 'commander_closing');
    lines.push(closing || '(למילוי ידני)');
  } else {
    lines.push('(למילוי ידני)');
    warnings.push('טרם נוצר דוח פלוגתי של המ״פ — דגשי מ״פ ולו״ז למחר ריקים.');
  }

  lines.push('', DIVIDER, '_"המשימה מעל הכול — והאנשים בראש"_');

  return {
    text: lines.join('\n'),
    generatedFromReportIds: [...usedIds],
    stats: {
      presentTotal,
      sdkTotal,
      platoonSubmitted,
      platoonTotal: orderedPlatoons.length,
      staffSubmitted,
      staffTotal: staff.length,
    },
    warnings,
  };
}
