'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  FileText,
  HeartPulse,
  ListChecks,
  Lock,
  Megaphone,
  MessageSquare,
  Package,
  Pencil,
  Pin,
  RefreshCw,
  Save,
  Scale,
  Send,
  Shield,
  Star,
  Stethoscope,
  Target,
  Trash2,
  Undo2,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { createAuditLog } from '@/lib/audit';
import type { AuditActionType } from '@/lib/audit';
import { copyTextToClipboard } from '@/lib/clipboard';
import { aggregateCompanyStructured, assignPlatoonReports } from '@/lib/forum/companyReport';
import type { CompanyReportInput, CompanyReportPlatoon } from '@/lib/forum/companyReport';
import { useApp } from '@/lib/context/AppContext';
import { getPermissionLevelForRole } from '@/lib/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { logSupabaseError } from '@/lib/supabase/error';

type ForumTab = 'posts' | 'daily';
type ReportLevel = 'squad' | 'platoon' | 'company' | 'staff';
type ReportStatus = 'draft' | 'in_progress' | 'submitted' | 'closed';
type StaffRole = 'medic' | 'assistant_commander' | 'logistics_nco' | 'deputy_commander';

type DbProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  unit_id: string | null;
  permission_level: number;
};

type ForumPostRow = {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
  unit_id: string | null;
  is_pinned: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ForumPostView = ForumPostRow & {
  authorName: string | null;
  unitName: string | null;
};

type DailyReportRow = {
  id: string;
  report_date: string;
  company_unit_id: string | null;
  platoon_unit_id: string | null;
  squad_unit_id: string | null;
  report_level: ReportLevel;
  staff_role: StaffRole | null;
  parent_report_id: string | null;
  created_by: string | null;
  owner_user_id: string | null;
  status: ReportStatus;
  content: Record<string, unknown>;
  summary_text: string | null;
  whatsapp_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type SquadContent = {
  present_count: string;
  total_count: string;
  personnel: string;
  readiness: string;
  welfare: string;
  medical: string;
  safety: string;
  discipline: string;
  logistics: string;
  personal_requests: string;
  plan_vs_actual: string;
  network_and_knowledge: string;
  daily_lessons: string;
  next_actions: string;
  personal_note: string;
};

type StaffContent = {
  name: string;
  notes: string;
};

type CompanyContent = {
  commander_opening: string;
  tomorrow_schedule: string;
  parallel_schedule: string;
  commander_closing: string;
  company_summary: string;
};

type ReportDraft = SquadContent & StaffContent & CompanyContent;

type DailyNode = {
  id: string;
  label: string;
  description: string;
  level: ReportLevel | 'whatsapp';
  staffRole?: StaffRole;
  group: string;
  owned: boolean;
  reportId?: string;
  ownerUserId?: string | null;
  unitId?: string | null;
  requiresOwnerMapping?: boolean;
};

// Presentation-only grouping over the existing dailyNodes — node identities, ids, and
// report lookup are untouched; this only drives the collapsed/accordion list UI.
type DailyNodeGroupView = {
  name: string;
  nodes: DailyNode[];
  total: number;
  submitted: number;
  inProgress: number;
};

type UserLookup = {
  id: string;
  name: string | null;
  email: string;
};

type UnitLookup = {
  id: string;
  name: string;
};

type ReportOwnerOption = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  unit_id: string | null;
  units: { name: string } | null;
};

const squadManpowerFields: Array<{ key: keyof SquadContent; label: string }> = [
  { key: 'present_count', label: 'נוכחים' },
  { key: 'total_count', label: 'סד״כ' },
];

const squadPrimaryFields: Array<{ key: keyof SquadContent; label: string }> = [
  { key: 'personnel', label: 'כוח אדם' },
  { key: 'readiness', label: 'כוננות' },
  { key: 'welfare', label: 'ת״ש' },
  { key: 'medical', label: 'רפואה' },
  { key: 'safety', label: 'בטיחות' },
  { key: 'discipline', label: 'משמעת' },
  { key: 'logistics', label: 'לוגיסטיקה' },
  { key: 'personal_requests', label: 'בקשות אישיות' },
  { key: 'plan_vs_actual', label: 'תכנון מול ביצוע' },
  { key: 'next_actions', label: 'פעולות להמשך' },
];

const squadSecondaryFields: Array<{ key: keyof SquadContent; label: string; wide?: boolean }> = [
  { key: 'network_and_knowledge', label: 'רשת / ריאלי / פרגון / שימור ידע', wide: true },
  { key: 'daily_lessons', label: 'לקחים יומי' },
  { key: 'personal_note', label: 'התייחסות אישית' },
];

const platoonNodes = [
  { id: 'platoon_1', label: 'מחלקה 1' },
  { id: 'platoon_2', label: 'מחלקה 2' },
  { id: 'platoon_3', label: 'מחלקה 3' },
  { id: 'platoon_4', label: 'מחלקה 4' },
];

const staffNodes: Array<{ id: StaffRole; label: string; roleHints: string[] }> = [
  { id: 'medic', label: 'חופ״ל', roleHints: ['חופ"ל', 'חובש', 'רפואה'] },
  { id: 'assistant_commander', label: 'ע. מ״פ', roleHints: ['ע. מ"פ', 'ע מ"פ', 'עוזר'] },
  { id: 'logistics_nco', label: 'רס״פ', roleHints: ['רס"פ', 'לוגיסט'] },
  { id: 'deputy_commander', label: 'סמ״פ', roleHints: ['סמ"פ'] },
];

const squadReadSections: Array<{ key: keyof SquadContent; label: string; icon: LucideIcon; wide?: boolean }> = [
  { key: 'personnel', label: 'כוח אדם', icon: Users },
  { key: 'readiness', label: 'כוננות', icon: Shield },
  { key: 'welfare', label: 'ת״ש', icon: HeartPulse },
  { key: 'medical', label: 'רפואה', icon: Stethoscope },
  { key: 'safety', label: 'בטיחות', icon: AlertTriangle },
  { key: 'discipline', label: 'משמעת', icon: Scale },
  { key: 'logistics', label: 'לוגיסטיקה', icon: Package },
  { key: 'personal_requests', label: 'בקשות אישיות', icon: MessageSquare },
  { key: 'plan_vs_actual', label: 'תכנון מול ביצוע', icon: BarChart3 },
  { key: 'network_and_knowledge', label: 'רשת / ניהול ריאלי / פרגון / שימור ידע', icon: BookOpen, wide: true },
  { key: 'daily_lessons', label: 'לקחים יומי', icon: Target },
  { key: 'next_actions', label: 'פעולות להמשך', icon: ListChecks },
  { key: 'personal_note', label: 'התייחסות אישית', icon: User, wide: true },
];

const companyReadSections: Array<{ key: keyof CompanyContent; label: string; icon: LucideIcon }> = [
  { key: 'commander_opening', label: 'פתיחת מ״פ', icon: Megaphone },
  { key: 'company_summary', label: 'סיכום פלוגתי', icon: FileText },
  { key: 'tomorrow_schedule', label: 'לו״ז פלוגתי למחר', icon: CalendarDays },
  { key: 'parallel_schedule', label: 'לו״ז מקביל', icon: CalendarClock },
  { key: 'commander_closing', label: 'דגשי מ״פ', icon: Star },
];

function normalizeRole(role: string) {
  return role.replace(/[״׳´"“”]/g, '"');
}

function findPlatoonSummaryOwner(
  owners: ReportOwnerOption[],
  platoonLabel: string,
): ReportOwnerOption | null {
  const platoonNumber = normalizeRole(platoonLabel).match(/מחלקה\s*([1-4])/)?.[1];
  if (!platoonNumber) return null;

  const rolePattern = new RegExp(`מ"מ\\s*${platoonNumber}(?:\\D|$)`);
  const unitPattern = new RegExp(`מחלקה\\s*${platoonNumber}(?:\\D|$)`);

  return owners.find((owner) => {
    const identityLabel = normalizeRole(
      [owner.name, owner.role, owner.units?.name].filter(Boolean).join(' '),
    );
    return rolePattern.test(identityLabel) && unitPattern.test(identityLabel);
  }) ?? null;
}

// Squad slot owner: first מ״כ (any squad-commander role) whose unit is מחלקה N. Mirrors the
// platoon-summary matcher so squad slots resolve from real users like the מ״מ slots do.
function findSquadCommanderOwner(
  owners: ReportOwnerOption[],
  platoonLabel: string,
): ReportOwnerOption | null {
  const platoonNumber = normalizeRole(platoonLabel).match(/מחלקה\s*([1-4])/)?.[1];
  if (!platoonNumber) return null;

  const unitPattern = new RegExp(`מחלקה\\s*${platoonNumber}(?:\\D|$)`);

  return owners.find((owner) => {
    const role = normalizeRole(owner.role ?? '');
    const identityLabel = normalizeRole(
      [owner.name, owner.role, owner.units?.name].filter(Boolean).join(' '),
    );
    return role.includes('מ"כ') && unitPattern.test(identityLabel);
  }) ?? null;
}

const staffUnitHints: Record<StaffRole, string[]> = {
  medic: ['רפואה', 'medical'],
  assistant_commander: ['פלוגה', 'company'],
  logistics_nco: ['לוגיסטיקה', 'logistics'],
  deputy_commander: ['פלוגה', 'company'],
};

// Staff slot owner: match both the role synonym and the expected unit so staff placeholders
// resolve to the right structural owner, not just the first similarly-named role.
function findStaffOwner(
  owners: ReportOwnerOption[],
  staffId: StaffRole,
): ReportOwnerOption | null {
  return owners.find((owner) => {
    const unitName = normalizeRole(owner.units?.name ?? '').toLowerCase();
    const unitMatches = staffUnitHints[staffId].some(hint => unitName.includes(normalizeRole(hint).toLowerCase()));
    return inferStaffRole(owner.role ?? '') === staffId && unitMatches;
  }) ?? null;
}

function isCommanderRole(role: string, permissionLevel: number) {
  const normalizedRole = normalizeRole(role);
  const inferredLevel = getPermissionLevelForRole(normalizedRole);
  return permissionLevel >= 90 || inferredLevel >= 90 || normalizedRole.includes('מ"פ') || normalizedRole.includes('סמ"פ');
}

function isPlatoonCommander(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole.includes('מ"מ');
}

function isSquadCommander(role: string) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole.includes('מ"כ');
}

function inferStaffRole(role: string): StaffRole | null {
  const normalizedRole = normalizeRole(role);
  return staffNodes.find(staff => staff.roleHints.some(hint => normalizedRole.includes(normalizeRole(hint))))?.id ?? null;
}

function getJerusalemDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value ?? '';
  const month = parts.find(part => part.type === 'month')?.value ?? '';
  const day = parts.find(part => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

function shiftDateString(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getJerusalemDateString(date);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

function formatSelectedDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(`${value}T12:00:00`));
}

function emptyReportDraft(): ReportDraft {
  return {
    present_count: '',
    total_count: '',
    personnel: '',
    readiness: '',
    welfare: '',
    medical: '',
    safety: '',
    discipline: '',
    logistics: '',
    personal_requests: '',
    plan_vs_actual: '',
    network_and_knowledge: '',
    daily_lessons: '',
    next_actions: '',
    personal_note: '',
    name: '',
    notes: '',
    commander_opening: '',
    tomorrow_schedule: '',
    parallel_schedule: '',
    commander_closing: '',
    company_summary: '',
  };
}

function draftFromReport(report: DailyReportRow | null): ReportDraft {
  if (!report) return emptyReportDraft();
  return { ...emptyReportDraft(), ...report.content };
}

function truncateForWhatsapp(value: string) {
  const clean = value.trim();
  if (!clean) return '—';
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

function statusLabel(status: ReportStatus | undefined) {
  if (status === 'closed') return 'נסגר';
  if (status === 'submitted') return 'הוגש / מוכן';
  if (status === 'in_progress') return 'בטיפול / נערך';
  if (status === 'draft') return 'לא התחיל / טיוטה';
  return 'לא התחיל / טיוטה';
}

function statusTone(status: ReportStatus | undefined) {
  if (status === 'closed') return 'border-[#020108]/15 bg-white text-[#020108]';
  if (status === 'submitted') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'in_progress') return 'border-[#FF6B02]/25 bg-[#FF6B02]/10 text-[#C75200]';
  return 'border-[rgba(2,1,8,0.08)] bg-white/80 text-[#667085]';
}

function statusDotTone(status: ReportStatus | undefined) {
  if (status === 'closed') return 'bg-[#020108]';
  if (status === 'submitted') return 'bg-emerald-500';
  if (status === 'in_progress') return 'bg-[#FF6B02]';
  return 'bg-[#98A2B3]';
}

function isDateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export default function ForumPage() {
  const { currentUser, isLoading: isContextLoading } = useApp();
  const [dbProfile, setDbProfile] = useState<DbProfile | null>(null);
  const [posts, setPosts] = useState<ForumPostView[]>([]);
  const [activeTab, setActiveTab] = useState<ForumTab>('posts');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostTitle, setEditPostTitle] = useState('');
  const [editPostBody, setEditPostBody] = useState('');
  const [editPostPinned, setEditPostPinned] = useState(false);
  const [editPostError, setEditPostError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => getJerusalemDateString());
  const [dailyDateInputValue, setDailyDateInputValue] = useState(selectedDate);
  const [dailyReports, setDailyReports] = useState<DailyReportRow[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState('own-report');
  // Explicit user expand/collapse overrides per group name; anything not here follows the
  // role default (commanders start collapsed, everyone else starts expanded).
  const [groupToggles, setGroupToggles] = useState<Record<string, boolean>>({});
  const reportPanelRef = useRef<HTMLElement>(null);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(() => emptyReportDraft());
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [isDailySaving, setIsDailySaving] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailySuccess, setDailySuccess] = useState<string | null>(null);
  const [ownerOptions, setOwnerOptions] = useState<ReportOwnerOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [commanderReportLevel, setCommanderReportLevel] = useState<ReportLevel>('squad');
  const [commanderStaffRole, setCommanderStaffRole] = useState<StaffRole>('medic');
  const [whatsappMode, setWhatsappMode] = useState<'short' | 'detailed'>('short');
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [companyManuallyEdited, setCompanyManuallyEdited] = useState(false);
  const [companyGeneratedAt, setCompanyGeneratedAt] = useState<string | null>(null);
  const [companyReportWarnings, setCompanyReportWarnings] = useState<string[]>([]);
  const [isCompanyReportBusy, setIsCompanyReportBusy] = useState(false);
  const [showCompanyRefreshConfirm, setShowCompanyRefreshConfirm] = useState(false);
  const [showCompanyPublishConfirm, setShowCompanyPublishConfirm] = useState(false);
  const lastHydratedCompanyReportId = useRef<string | null | undefined>(undefined);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const profilePermissionLevel = dbProfile?.permission_level ?? getPermissionLevelForRole(currentUser?.role ?? '');
  const canSeeAll = Boolean(currentUser && isCommanderRole(dbProfile?.role ?? currentUser.role, profilePermissionLevel));
  const staffRole = useMemo(() => inferStaffRole(dbProfile?.role ?? currentUser?.role ?? ''), [currentUser?.role, dbProfile?.role]);
  const ownerLabels = useMemo(() => new Map(ownerOptions.map(owner => [
    owner.id,
    `${owner.name || owner.email} · ${owner.role}${owner.units?.name ? ` · ${owner.units.name}` : ''}`,
  ])), [ownerOptions]);

  useEffect(() => {
    setDailyDateInputValue(selectedDate);
  }, [selectedDate]);

  const commitDailyDateInput = useCallback((value = dailyDateInputValue) => {
    const nextDate = value.trim();
    if (isDateInputValue(nextDate)) {
      setDailyDateInputValue(nextDate);
      setSelectedDate(nextDate);
      return;
    }
    setDailyDateInputValue(selectedDate);
  }, [dailyDateInputValue, selectedDate]);

  const dailyNodes = useMemo<DailyNode[]>(() => {
    if (canSeeAll) {
      const platoonSummaryOwners = new Map(
        platoonNodes.map((platoon) => [
          platoon.id,
          findPlatoonSummaryOwner(ownerOptions, platoon.label),
        ]),
      );
      const squadSlotOwners = new Map(
        platoonNodes.map((platoon) => [
          platoon.id,
          findSquadCommanderOwner(ownerOptions, platoon.label),
        ]),
      );
      const staffSlotOwners = new Map(
        staffNodes.map((staff) => [staff.id, findStaffOwner(ownerOptions, staff.id)]),
      );
      const matchedPlatoonSummaryOwnerIds = new Set(
        [...platoonSummaryOwners.values()]
          .filter((owner): owner is ReportOwnerOption => owner !== null)
          .map((owner) => owner.id),
      );
      const matchedSquadOwnerIds = new Set(
        [...squadSlotOwners.values()]
          .filter((owner): owner is ReportOwnerOption => owner !== null)
          .map((owner) => owner.id),
      );
      const matchedStaffOwnerIds = new Set(
        [...staffSlotOwners.values()]
          .filter((owner): owner is ReportOwnerOption => owner !== null)
          .map((owner) => owner.id),
      );
      // Hide a report from "דוחות קיימים" when a structural slot already represents that
      // owner+level (so it shows once, in its slot, not duplicated in the dynamic list).
      const dynamicReportNodes: DailyNode[] = dailyReports
        .filter((report) => {
          if (!report.owner_user_id) return true;
          if (report.report_level === 'platoon') return !matchedPlatoonSummaryOwnerIds.has(report.owner_user_id);
          if (report.report_level === 'squad') return !matchedSquadOwnerIds.has(report.owner_user_id);
          if (report.report_level === 'staff') return !matchedStaffOwnerIds.has(report.owner_user_id);
          return true;
        })
        .map(report => ({
        id: `report-${report.id}`,
        label: ownerLabels.get(report.owner_user_id ?? '') ?? 'דוח קיים',
        description: `${report.report_level === 'staff' ? staffNodes.find(staff => staff.id === report.staff_role)?.label ?? 'מפל״ג' : report.report_level} · ${report.metadata?.created_for_by_commander ? 'נוצר ע״י מפקד' : 'דוח קיים'}`,
        level: report.report_level,
        staffRole: report.staff_role ?? undefined,
        group: report.report_level === 'staff' ? 'מפל״ג · דוחות קיימים' : 'דוחות קיימים',
        owned: report.owner_user_id === dbProfile?.id,
        reportId: report.id,
        ownerUserId: report.owner_user_id,
        unitId: report.platoon_unit_id ?? report.squad_unit_id ?? report.company_unit_id,
        }));

      return [
        ...platoonNodes.flatMap(platoon => {
          const summaryOwner = platoonSummaryOwners.get(platoon.id) ?? null;
          return [
          {
            id: `${platoon.id}-summary`,
            label: `${platoon.label} · סיכום מ״מ`,
            description: 'סיכום מחלקתי',
            level: 'platoon' as const,
            group: platoon.label,
            owned: false,
            ownerUserId: summaryOwner?.id,
            unitId: summaryOwner?.unit_id,
            requiresOwnerMapping: !summaryOwner,
          },
          {
            id: `${platoon.id}-squads`,
            label: `${platoon.label} · דיווחי מ״כים`,
            description: 'דיווחי כיתות קיימים',
            level: 'squad' as const,
            group: platoon.label,
            owned: false,
            ownerUserId: squadSlotOwners.get(platoon.id)?.id,
            unitId: squadSlotOwners.get(platoon.id)?.unit_id,
            requiresOwnerMapping: !squadSlotOwners.get(platoon.id),
          },
          ];
        }),
        ...staffNodes.map(staff => {
          const staffOwner = staffSlotOwners.get(staff.id) ?? null;
          const isOwn = staffRole === staff.id;
          return {
            id: `staff-${staff.id}`,
            label: staff.label,
            description: 'דיווח מפל״ג מקצועי',
            level: 'staff' as const,
            staffRole: staff.id,
            group: 'מפל״ג',
            owned: isOwn,
            ownerUserId: isOwn ? undefined : staffOwner?.id,
            unitId: isOwn ? undefined : staffOwner?.unit_id,
            requiresOwnerMapping: !isOwn && !staffOwner,
          };
        }),
        {
          id: 'company-summary',
          label: 'סיכום פלוגתי',
          description: 'פתיחת מ״פ, לו״ז ודגשים',
          level: 'company',
          group: 'פלוגה',
          owned: true,
        },
        ...dynamicReportNodes,
        {
          id: 'whatsapp',
          label: 'תוצר WhatsApp',
          description: 'תצוגת סיכום יומי מרוכזת',
          level: 'whatsapp',
          group: 'פלוגה',
          owned: false,
        },
      ];
    }

    if (isPlatoonCommander(dbProfile?.role ?? currentUser?.role ?? '')) {
      return [
        {
          id: 'platoon-squads',
          label: 'דיווחי מ״כים במחלקה שלי',
          description: 'מוצג לפי שיוך יחידה זמין',
          level: 'squad',
          group: 'המחלקה שלי',
          owned: false,
        },
        {
          id: 'own-report',
          label: 'סיכום מחלקתי שלי',
          description: 'ריכוז יומי של המחלקה',
          level: 'platoon',
          group: 'המחלקה שלי',
          owned: true,
        },
      ];
    }

    if (isSquadCommander(dbProfile?.role ?? currentUser?.role ?? '')) {
      return [{
        id: 'own-report',
        label: 'הדיווח היומי שלי',
        description: 'דיווח אישי/כיתתי',
        level: 'squad',
        group: 'הכיתה שלי',
        owned: true,
      }];
    }

    if (staffRole) {
      const staff = staffNodes.find(item => item.id === staffRole);
      return [{
        id: 'own-report',
        label: staff?.label ?? 'דיווח מקצועי',
        description: 'החלק המקצועי שלי',
        level: 'staff',
        staffRole,
        group: 'מפל״ג',
        owned: true,
      }];
    }

    return [{
      id: 'own-report',
      label: 'הדיווח היומי שלי',
      description: 'דיווח אישי',
      level: 'squad',
      group: 'אישי',
      owned: true,
    }];
  }, [canSeeAll, currentUser?.role, dailyReports, dbProfile?.id, dbProfile?.role, ownerLabels, ownerOptions, staffRole]);

  const selectedNode = dailyNodes.find(node => node.id === selectedNodeId) ?? dailyNodes[0];

  const handleSelectDailyNode = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nodeId = event.currentTarget.dataset.nodeId;
    if (!nodeId) return;

    setSelectedNodeId(nodeId);
    requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      reportPanelRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    });
  };

  const toggleDailyGroup = (groupName: string, currentlyExpanded: boolean) => {
    setGroupToggles(previous => ({ ...previous, [groupName]: !currentlyExpanded }));
  };

  const findReportForNode = useCallback((node: DailyNode | undefined) => {
    if (!node || node.level === 'whatsapp') return null;
    if (node.reportId) return dailyReports.find(report => report.id === node.reportId) ?? null;
    if (node.ownerUserId) {
      return dailyReports.find(report => (
        report.report_level === node.level
        && report.owner_user_id === node.ownerUserId
        && (node.staffRole ? report.staff_role === node.staffRole : true)
      )) ?? null;
    }
    if (node.owned) {
      return dailyReports.find(report => report.report_level === node.level && report.owner_user_id === dbProfile?.id && (node.staffRole ? report.staff_role === node.staffRole : true)) ?? null;
    }
    if (node.staffRole && !node.requiresOwnerMapping) {
      return dailyReports.find(report => report.report_level === 'staff' && report.staff_role === node.staffRole) ?? null;
    }
    if (node.level === 'company') {
      return dailyReports.find(report => report.report_level === 'company' && report.owner_user_id === dbProfile?.id) ?? null;
    }
    return null;
  }, [dailyReports, dbProfile?.id]);

  // Group the existing nodes by their group label (first-appearance order) and derive per-group
  // submission counters for the accordion headers. The WhatsApp output node is a view, not a
  // report slot, so it never counts toward the group totals.
  const dailyNodeGroups = useMemo<DailyNodeGroupView[]>(() => {
    const groups: DailyNodeGroupView[] = [];
    const byName = new Map<string, DailyNodeGroupView>();
    dailyNodes.forEach(node => {
      let group = byName.get(node.group);
      if (!group) {
        group = { name: node.group, nodes: [], total: 0, submitted: 0, inProgress: 0 };
        byName.set(node.group, group);
        groups.push(group);
      }
      group.nodes.push(node);
      if (node.level === 'whatsapp') return;
      group.total += 1;
      const status = findReportForNode(node)?.status;
      if (status === 'submitted' || status === 'closed') group.submitted += 1;
      else if (status === 'in_progress') group.inProgress += 1;
    });
    return groups;
  }, [dailyNodes, findReportForNode]);

  const selectedReport = findReportForNode(selectedNode);
  const canReopenSelectedReport = Boolean(
    selectedReport?.status === 'closed'
      && dbProfile
      && (selectedReport.created_by === dbProfile.id || selectedReport.owner_user_id === dbProfile.id || canSeeAll),
  );
  const canDeleteSelectedReport = Boolean(
    selectedReport
      && dbProfile
      && (canSeeAll || selectedReport.created_by === dbProfile.id || selectedReport.owner_user_id === dbProfile.id),
  );
  const canResetSelectedReport = canDeleteSelectedReport;
  const canUseDraftFormForSelectedNode = Boolean(
    !selectedReport
      && selectedNode
      && selectedNode.level !== 'whatsapp'
      && !selectedNode.requiresOwnerMapping
      && (selectedNode.owned || selectedNode.ownerUserId || (canSeeAll && selectedNode.level === 'company')),
  );
  const isSelectedReportReadOnly = selectedReport?.status === 'closed' && !canReopenSelectedReport;

  // The commander's own company-level report holds the distributable company summary
  // (the new company_report_* keys live inside its content JSONB).
  const companyReport = useMemo(
    () => dailyReports.find(report => report.report_level === 'company' && report.owner_user_id === dbProfile?.id) ?? null,
    [dailyReports, dbProfile?.id],
  );
  const isCompanyReportLocked = companyReport?.status === 'closed';

  const generateWhatsappText = useCallback((mode: 'short' | 'detailed' = whatsappMode) => {
    const divider = '─'.repeat(22);
    const lines = [`📋 *פורום מוביל פלוגתי — ${formatSelectedDate(selectedDate)}*`];
    if (dbProfile) lines.push(`👤 ${dbProfile.name} · ${dbProfile.role}`);
    lines.push(divider, `סטטוס כללי: ${dailyReports.length} דיווחים נטענו`);

    // Resolve platoon reports the same way the (QA-passed) structured company aggregation
    // does: owner_user_id (מ״מ N role + מחלקה N unit) first, metadata.node_label only as a
    // last-resort fallback. Never by array index/order — that swapped מחלקה 1/2 content.
    const platoons: CompanyReportPlatoon[] = platoonNodes.map((platoon, index) => ({
      number: index + 1,
      label: platoon.label,
      ownerUserId: findPlatoonSummaryOwner(ownerOptions, platoon.label)?.id ?? null,
    }));
    const { byNumber: platoonByNumber, unidentified: unidentifiedPlatoonReports } =
      assignPlatoonReports(dailyReports, platoons);
    const squadReports = dailyReports.filter(report => report.report_level === 'squad');

    // Company manpower overview — sum present/total across the mapped platoons using the same
    // assignPlatoonReports source of truth as the structured aggregation, so the WhatsApp summary
    // leads with the platoon picture (e.g. 124/138) and can never diverge from the aggregated total.
    const sumPlatoonCount = (raw: unknown): number | null => {
      const text = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
      if (!text) return null;
      const parsed = Number(text.replace(/[^\d.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    };
    let companyPresentTotal: number | null = null;
    let companySdkTotal: number | null = null;
    let submittedPlatoonCount = 0;
    platoons.forEach(platoon => {
      const report = platoonByNumber.get(platoon.number);
      if (!report) return;
      if (report.status === 'submitted' || report.status === 'closed') submittedPlatoonCount += 1;
      const present = sumPlatoonCount(report.content.present_count);
      const total = sumPlatoonCount(report.content.total_count);
      if (present !== null) companyPresentTotal = (companyPresentTotal ?? 0) + present;
      if (total !== null) companySdkTotal = (companySdkTotal ?? 0) + total;
    });
    lines.push(
      `מצבה פלוגתית: ${companyPresentTotal ?? '—'}/${companySdkTotal ?? '—'}`,
      `דוחות מחלקה שהוגשו: ${submittedPlatoonCount}/${platoons.length}`,
    );

    if (
      platoonByNumber.size === 0
      && unidentifiedPlatoonReports.length === 0
      && squadReports.length === 0
    ) {
      lines.push('', 'מחלקות: טרם הוגשו דיווחים.');
    }

    const renderPlatoonReport = (label: string, report: { content: Record<string, unknown>; status: ReportStatus }) => {
      const content = { ...emptyReportDraft(), ...report.content };
      const manpower = content.present_count || content.total_count
        ? `${content.present_count || '—'}/${content.total_count || '—'}`
        : '—';

      if (mode === 'short') {
        lines.push(
          '',
          `*${label}* · ${statusLabel(report.status)}`,
          `👥 מצבה: ${manpower}`,
          `🛡️ כוננות: ${truncateForWhatsapp(content.readiness)}`,
          `📦 לוגיסטיקה: ${truncateForWhatsapp(content.logistics)}`,
          `🎯 דגש: ${truncateForWhatsapp(content.next_actions || content.daily_lessons)}`,
        );
      } else {
        lines.push(
          '',
          `*${label}* · ${statusLabel(report.status)}`,
          `👥 מצבה: ${manpower}`,
          `🧍 כוח אדם: ${content.personnel || '—'}`,
          `🩹 ת״ש: ${content.welfare || '—'}`,
          `🏥 רפואה: ${content.medical || '—'}`,
          `📦 לוגיסטיקה: ${content.logistics || '—'}`,
          `🛡️ כוננות: ${content.readiness || '—'}`,
          `📊 תכנון מול ביצוע: ${content.plan_vs_actual || '—'}`,
          `🎯 לקח יומי: ${content.daily_lessons || '—'}`,
          `▶️ פעולות להמשך: ${content.next_actions || '—'}`,
        );
      }
    };

    platoons.forEach(platoon => {
      const report = platoonByNumber.get(platoon.number);
      if (!report) {
        lines.push('', `*${platoon.label}* · טרם הוגש`);
        return;
      }
      renderPlatoonReport(platoon.label, report);
    });
    unidentifiedPlatoonReports.forEach(report => {
      renderPlatoonReport('מחלקה לא מזוהה', report);
    });

    lines.push('', '🧰 *מפל״ג*');
    staffNodes.forEach(staffNode => {
      const report = dailyReports.find(item => item.report_level === 'staff' && item.staff_role === staffNode.id);
      if (!report) {
        lines.push(`${staffNode.label}: טרם הוגש`);
        return;
      }
      const content = { ...emptyReportDraft(), ...report.content };
      const notes = content.notes || 'הוגש';
      lines.push(`${staffNode.label}: ${mode === 'short' ? truncateForWhatsapp(notes) : notes}`);
    });

    const company = dailyReports.find(report => report.report_level === 'company');
    if (company) {
      const content = { ...emptyReportDraft(), ...company.content };
      lines.push(
        '',
        '⭐ *דגשי מ״פ / סיכום פלוגתי*',
        content.company_summary || content.commander_closing || 'טרם מולא',
        '',
        '🗓️ *לו״ז פלוגתי למחר*',
        content.tomorrow_schedule || 'טרם מולא',
      );
      if (mode === 'detailed') {
        lines.push('', '🔁 *לו״ז מקביל*', content.parallel_schedule || 'טרם מולא');
      }
    } else {
      lines.push('', '⭐ *דגשי מ״פ / סיכום פלוגתי*', 'טרם מולא');
    }

    lines.push('', divider, '_"המשימה מעל הכול — והאנשים בראש"_');

    return lines.join('\n');
  }, [dailyReports, dbProfile, ownerOptions, selectedDate, whatsappMode]);

  const copyWhatsappText = async () => {
    const result = await copyTextToClipboard(generateWhatsappText());
    if (result.ok) {
      setDailySuccess('פלט WhatsApp הועתק');
    } else {
      setDailyError('לא ניתן להעתיק אוטומטית. אפשר לסמן ולהעתיק ידנית.');
    }
  };

  const loadPosts = useCallback(async () => {
    if (isContextLoading) return;

    if (!currentUser) {
      setIsLoading(false);
      setError('לא נמצא משתמש מחובר. יש להתחבר מחדש.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('id,name,email,role,unit_id,permission_level')
      .eq('id', currentUser.id)
      .maybeSingle<DbProfile>();

    if (profileError || !profileData) {
      if (profileError) logSupabaseError('Forum profile lookup failed', profileError);
      setDbProfile(null);
      setPosts([]);
      setError('לא נמצא פרופיל משתמש פעיל. יש להתחבר מחדש או לפנות למפקד.');
      setIsLoading(false);
      return;
    }

    setDbProfile(profileData);

    const { data: rawPosts, error: postsError } = await supabase
      .from('forum_posts')
      .select('id,title,body,author_id,unit_id,is_pinned,metadata,created_at,updated_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<ForumPostRow[]>();

    if (postsError) {
      logSupabaseError('Forum posts load failed', postsError);
      setPosts([]);
      setError('לא ניתן לטעון את הפורום כרגע. נסה לרענן את הדף בעוד רגע.');
      setIsLoading(false);
      return;
    }

    const authorIds = [...new Set((rawPosts ?? []).map(post => post.author_id).filter((id): id is string => Boolean(id)))];
    const unitIds = [...new Set((rawPosts ?? []).map(post => post.unit_id).filter((id): id is string => Boolean(id)))];

    const [authorsResult, unitsResult] = await Promise.all([
      authorIds.length
        ? supabase.from('users').select('id,name,email').in('id', authorIds).returns<UserLookup[]>()
        : Promise.resolve({ data: [] as UserLookup[], error: null }),
      unitIds.length
        ? supabase.from('units').select('id,name').in('id', unitIds).returns<UnitLookup[]>()
        : Promise.resolve({ data: [] as UnitLookup[], error: null }),
    ]);

    if (authorsResult.error) logSupabaseError('Forum author lookup failed', authorsResult.error);
    if (unitsResult.error) logSupabaseError('Forum unit lookup failed', unitsResult.error);

    const authorNames = new Map((authorsResult.data ?? []).map(user => [user.id, user.name || user.email]));
    const unitNames = new Map((unitsResult.data ?? []).map(unit => [unit.id, unit.name]));

    setPosts((rawPosts ?? []).map(post => ({
      ...post,
      authorName: post.author_id ? authorNames.get(post.author_id) ?? null : null,
      unitName: post.unit_id ? unitNames.get(post.unit_id) ?? null : null,
    })));
    setIsLoading(false);
  }, [currentUser, isContextLoading, supabase]);

  const loadDailyReports = useCallback(async (date: string) => {
    if (!dbProfile) return;

    setIsDailyLoading(true);
    setDailyError(null);
    setDailySuccess(null);

    const { data, error: loadError } = await supabase
      .from('forum_daily_reports')
      .select('id,report_date,company_unit_id,platoon_unit_id,squad_unit_id,report_level,staff_role,parent_report_id,created_by,owner_user_id,status,content,summary_text,whatsapp_text,metadata,created_at,updated_at')
      .eq('report_date', date)
      .order('report_level', { ascending: true })
      .order('created_at', { ascending: true })
      .returns<DailyReportRow[]>();

    if (loadError) {
      logSupabaseError('Forum daily reports load failed', loadError);
      setDailyReports([]);
      setReportDraft(emptyReportDraft());
      setDailyError('לא ניתן לטעון את הדיווחים היומיים כרגע. נסה שוב בעוד רגע.');
      setIsDailyLoading(false);
      return;
    }

    setDailyReports(data ?? []);
    setIsDailyLoading(false);
  }, [dbProfile, supabase]);

  const loadOwnerOptions = useCallback(async () => {
    if (!canSeeAll) {
      setOwnerOptions([]);
      return;
    }

    const { data, error: usersError } = await supabase
      .from('users')
      .select('id,name,email,role,unit_id')
      .eq('status', 'active')
      .eq('role_approval_status', 'approved')
      .order('name', { ascending: true })
      .returns<ReportOwnerOption[]>();

    if (usersError) {
      logSupabaseError('Forum daily report owner options load failed', usersError);
      setOwnerOptions([]);
      return;
    }

    const rawOwners = data ?? [];
    const ownerUnitIds = [...new Set(rawOwners.map(owner => owner.unit_id).filter((id): id is string => Boolean(id)))];

    let ownerUnitNames: Record<string, string> = {};
    if (ownerUnitIds.length > 0) {
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id,name')
        .in('id', ownerUnitIds)
        .returns<UnitLookup[]>();

      if (unitsError) {
        logSupabaseError('Forum daily report owner unit lookup failed', unitsError);
      } else {
        ownerUnitNames = Object.fromEntries((unitsData ?? []).map(unit => [unit.id, unit.name]));
      }
    }

    setOwnerOptions(rawOwners.map(owner => ({
      ...owner,
      units: owner.unit_id && ownerUnitNames[owner.unit_id] ? { name: ownerUnitNames[owner.unit_id] } : null,
    })));
  }, [canSeeAll, supabase]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (activeTab !== 'daily' || isLoading || !dbProfile) return;
    void loadDailyReports(selectedDate);
  }, [activeTab, dbProfile, isLoading, loadDailyReports, selectedDate]);

  useEffect(() => {
    if (activeTab !== 'daily' || !canSeeAll) return;
    void loadOwnerOptions();
  }, [activeTab, canSeeAll, loadOwnerOptions]);

  useEffect(() => {
    setReportDraft(draftFromReport(selectedReport));
    setIsEditingReport(false);
  }, [selectedReport?.id, selectedReport]);

  // Hydrate the company-report editor meta from its row, but only when the underlying report
  // identity changes — so a content reload (e.g. our own save) never re-flags manual edits or
  // clobbers the commander's in-progress structured edits. The field values themselves live in
  // reportDraft (synced by the effect above, same as a מ״מ report). The "rolled up at" stamp is
  // an in-session indicator only (build fills the form without persisting), so it resets here.
  useEffect(() => {
    const reportId = companyReport?.id ?? null;
    if (lastHydratedCompanyReportId.current === reportId) return;
    lastHydratedCompanyReportId.current = reportId;
    const content = companyReport?.content ?? {};
    setCompanyManuallyEdited(content.company_report_manually_edited === true);
    setCompanyGeneratedAt(null);
    setCompanyReportWarnings([]);
  }, [companyReport]);

  // Close the company report confirm dialogs on Escape (unless an action is in flight).
  useEffect(() => {
    if (!showCompanyRefreshConfirm && !showCompanyPublishConfirm) return;
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCompanyReportBusy) {
        setShowCompanyRefreshConfirm(false);
        setShowCompanyPublishConfirm(false);
      }
    };
    window.addEventListener('keydown', handleDialogKeyDown);
    return () => window.removeEventListener('keydown', handleDialogKeyDown);
  }, [showCompanyRefreshConfirm, showCompanyPublishConfirm, isCompanyReportBusy]);

  useEffect(() => {
    if (dailyNodes.some(node => node.id === selectedNodeId)) return;
    setSelectedNodeId(dailyNodes[0]?.id ?? 'own-report');
  }, [dailyNodes, selectedNodeId]);

  const handleCreatePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle || !cleanBody) {
      setFormError('כותרת ותוכן הם שדות חובה.');
      return;
    }

    if (!dbProfile) {
      setFormError('לא נמצא פרופיל משתמש. יש להתחבר מחדש.');
      return;
    }

    setIsSubmitting(true);

    const nextIsPinned = canSeeAll ? isPinned : false;
    const { data: createdPost, error: insertError } = await supabase
      .from('forum_posts')
      .insert({
        title: cleanTitle,
        body: cleanBody,
        author_id: dbProfile.id,
        unit_id: dbProfile.unit_id,
        is_pinned: nextIsPinned,
        metadata: {},
      })
      .select('id,title,body,is_pinned,unit_id')
      .single<{ id: string; title: string; body: string; is_pinned: boolean; unit_id: string | null }>();

    if (insertError || !createdPost) {
      if (insertError) logSupabaseError('Forum post insert failed', insertError);
      setFormError('לא ניתן לפרסם את הפוסט כרגע. בדוק הרשאות או נסה שוב.');
      setIsSubmitting(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_post_created',
      entityType: 'forum_post',
      entityId: createdPost.id,
      previousValue: null,
      newValue: {
        title: createdPost.title,
        body: createdPost.body,
        is_pinned: createdPost.is_pinned,
        unit_id: createdPost.unit_id,
      },
    });

    setTitle('');
    setBody('');
    setIsPinned(false);
    setSuccessMessage('הפוסט פורסם בהצלחה.');
    setIsSubmitting(false);
    await loadPosts();
  };

  const canEditPost = (post: ForumPostView) => {
    if (!dbProfile) return false;
    if (canSeeAll) return true;
    return post.author_id === dbProfile.id;
  };

  const startEditPost = (post: ForumPostView) => {
    setEditingPostId(post.id);
    setEditPostTitle(post.title);
    setEditPostBody(post.body);
    setEditPostPinned(post.is_pinned);
    setEditPostError(null);
    setSuccessMessage(null);
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditPostTitle('');
    setEditPostBody('');
    setEditPostPinned(false);
    setEditPostError(null);
  };

  const saveEditedPost = async (post: ForumPostView) => {
    if (!dbProfile || !canEditPost(post)) return;

    const cleanTitle = editPostTitle.trim();
    const cleanBody = editPostBody.trim();

    if (!cleanTitle || !cleanBody) {
      setEditPostError('כותרת ותוכן הם שדות חובה.');
      return;
    }

    setIsSubmitting(true);
    setEditPostError(null);

    const updatePayload = {
      title: cleanTitle,
      body: cleanBody,
      is_pinned: canSeeAll ? editPostPinned : post.is_pinned,
    };

    const { error: updateError } = await supabase
      .from('forum_posts')
      .update(updatePayload)
      .eq('id', post.id);

    if (updateError) {
      logSupabaseError('Forum post update failed', updateError);
      setEditPostError('לא ניתן לעדכן את הפוסט כרגע. בדוק הרשאות או נסה שוב.');
      setIsSubmitting(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_post_updated',
      entityType: 'forum_post',
      entityId: post.id,
      previousValue: {
        title: post.title,
        body: post.body,
        is_pinned: post.is_pinned,
      },
      newValue: updatePayload,
    });

    cancelEditPost();
    setSuccessMessage('הפוסט עודכן בהצלחה.');
    setIsSubmitting(false);
    await loadPosts();
  };

  const createOrOpenOwnReport = async (node: DailyNode) => {
    if (!dbProfile || node.level === 'whatsapp') return;

    const existing = findReportForNode(node);
    if (existing) {
      setReportDraft(draftFromReport(existing));
      return;
    }

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    const selectedOwner = canSeeAll && selectedOwnerId
      ? ownerOptions.find(owner => owner.id === selectedOwnerId)
      : null;

    if (canSeeAll && !node.owned && !selectedOwner) {
      setDailyError('כדי ליצור דיווח למחלקה/גורם שאינו משויך עדיין, בחר משתמש פעיל בשדה "צור דוח עבור משתמש".');
      setIsDailySaving(false);
      return;
    }

    const ownerId = selectedOwner?.id ?? dbProfile.id;
    const ownerUnitId = selectedOwner?.unit_id ?? dbProfile.unit_id;
    const nextReportLevel = canSeeAll ? commanderReportLevel : node.level;
    const nextStaffRole = nextReportLevel === 'staff'
      ? (canSeeAll ? commanderStaffRole : node.staffRole ?? null)
      : null;
    const createdForByCommander = canSeeAll && ownerId !== dbProfile.id;
    const existingForOwner = dailyReports.find(report => (
      report.report_date === selectedDate
      && report.report_level === nextReportLevel
      && report.owner_user_id === ownerId
      && (nextReportLevel === 'staff' ? report.staff_role === nextStaffRole : true)
    ));

    if (existingForOwner) {
      setSelectedNodeId(`report-${existingForOwner.id}`);
      setReportDraft(draftFromReport(existingForOwner));
      setDailySuccess('דיווח קיים נפתח.');
      setIsDailySaving(false);
      return;
    }

    const { data: createdReport, error: createError } = await supabase
      .from('forum_daily_reports')
      .insert({
        report_date: selectedDate,
        company_unit_id: ownerUnitId,
        platoon_unit_id: nextReportLevel === 'platoon' || nextReportLevel === 'squad' ? ownerUnitId : null,
        squad_unit_id: nextReportLevel === 'squad' ? ownerUnitId : null,
        report_level: nextReportLevel,
        staff_role: nextStaffRole,
        parent_report_id: null,
        created_by: dbProfile.id,
        owner_user_id: ownerId,
        status: 'draft',
        content: emptyReportDraft(),
        summary_text: '',
        whatsapp_text: '',
        metadata: {
          node_id: node.id,
          node_label: node.label,
          ui_gated_scope: true,
          created_for_by_commander: createdForByCommander,
          created_for_user_name: selectedOwner?.name ?? null,
          created_for_user_role: selectedOwner?.role ?? null,
        },
      })
      .select('id,report_date,report_level,staff_role,status,owner_user_id,metadata')
      .single<{ id: string; report_date: string; report_level: ReportLevel; staff_role: StaffRole | null; status: ReportStatus; owner_user_id: string | null; metadata: Record<string, unknown> | null }>();

    if (createError || !createdReport) {
      if (createError) logSupabaseError('Forum daily report create failed', createError);
      if (createError?.code === '23505') {
        setDailyError('כבר קיים דיווח לתאריך הזה. טוען מחדש.');
        await loadDailyReports(selectedDate);
      } else {
        setDailyError('לא ניתן לפתוח דיווח כרגע. בדוק הרשאות או נסה שוב.');
      }
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_created',
      entityType: 'forum_daily_report',
      entityId: createdReport.id,
      previousValue: null,
      newValue: createdReport,
    });

    setDailySuccess('דיווח יומי נפתח.');
    setSelectedNodeId(`report-${createdReport.id}`);
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const saveSelectedReport = async () => {
    if (!dbProfile || !selectedNode || selectedNode.level === 'whatsapp') return;

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    if (!selectedReport) {
      if (!canUseDraftFormForSelectedNode) {
        setDailyError('נדרש שיוך משתמש לפני פתיחת דוח לגורם הזה.');
        setIsDailySaving(false);
        return;
      }

      const nextReportLevel = selectedNode.level;
      const nextStaffRole = nextReportLevel === 'staff' ? selectedNode.staffRole ?? null : null;
      const ownerId = selectedNode.ownerUserId ?? dbProfile.id;
      const ownerUnitId = selectedNode.unitId ?? dbProfile.unit_id;
      const selectedOwner = selectedNode.ownerUserId
        ? ownerOptions.find(owner => owner.id === selectedNode.ownerUserId) ?? null
        : null;
      const createdForByCommander = ownerId !== dbProfile.id;
      const updatePayload = {
        content: reportDraft,
        status: 'in_progress' as ReportStatus,
        summary_text: selectedNode.level === 'staff' ? reportDraft.notes : reportDraft.personal_note || reportDraft.company_summary,
        whatsapp_text: selectedNode.level === 'company' ? generateWhatsappText('detailed') : null,
      };

      const { data: createdReport, error: createError } = await supabase
        .from('forum_daily_reports')
        .insert({
          report_date: selectedDate,
          company_unit_id: ownerUnitId,
          platoon_unit_id: nextReportLevel === 'platoon' || nextReportLevel === 'squad' ? ownerUnitId : null,
          squad_unit_id: nextReportLevel === 'squad' ? ownerUnitId : null,
          report_level: nextReportLevel,
          staff_role: nextStaffRole,
          parent_report_id: null,
          created_by: dbProfile.id,
          owner_user_id: ownerId,
          status: updatePayload.status,
          content: updatePayload.content,
          summary_text: updatePayload.summary_text,
          whatsapp_text: updatePayload.whatsapp_text,
          metadata: {
            node_id: selectedNode.id,
            node_label: selectedNode.label,
            created_from_draft_form: true,
            ui_gated_scope: true,
            created_for_by_commander: createdForByCommander,
            created_for_user_name: selectedOwner?.name ?? null,
            created_for_user_role: selectedOwner?.role ?? null,
          },
        })
        .select('id,report_date,company_unit_id,platoon_unit_id,squad_unit_id,report_level,staff_role,parent_report_id,created_by,owner_user_id,status,content,summary_text,whatsapp_text,metadata,created_at,updated_at')
        .single<DailyReportRow>();

      if (createError || !createdReport) {
        if (createError) logSupabaseError('Forum daily report draft create failed', createError);
        setDailyError('לא ניתן לשמור את הטיוטה כרגע. בדוק הרשאות או נסה שוב.');
        setIsDailySaving(false);
        return;
      }

      void createAuditLog(supabase, {
        userId: dbProfile.id,
        userName: dbProfile.name,
        userRole: dbProfile.role,
        actionType: 'forum_daily_report_created',
        entityType: 'forum_daily_report',
        entityId: createdReport.id,
        previousValue: null,
        newValue: createdReport,
      });

      setSelectedNodeId(selectedNode.id);
      setDailySuccess('טיוטת הדיווח נשמרה ונפתחה לעבודה.');
      setIsDailySaving(false);
      await loadDailyReports(selectedDate);
      return;
    }

    const updatePayload = {
      content: reportDraft,
      status: selectedReport.status === 'draft' ? 'in_progress' : selectedReport.status,
      summary_text: selectedNode?.level === 'staff' ? reportDraft.notes : reportDraft.personal_note || reportDraft.company_summary,
      whatsapp_text: selectedNode?.level === 'company' ? generateWhatsappText('detailed') : selectedReport.whatsapp_text,
    };

    const { error: updateError } = await supabase
      .from('forum_daily_reports')
      .update(updatePayload)
      .eq('id', selectedReport.id);

    if (updateError) {
      logSupabaseError('Forum daily report update failed', updateError);
      setDailyError('לא ניתן לשמור את הדיווח כרגע. בדוק הרשאות או נסה שוב.');
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_updated',
      entityType: 'forum_daily_report',
      entityId: selectedReport.id,
      previousValue: {
        status: selectedReport.status,
        content: selectedReport.content,
      },
      newValue: updatePayload,
    });

    setDailySuccess('הדיווח נשמר');
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const submitSelectedReport = async () => {
    if (!selectedReport || !dbProfile) return;

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    const { error: submitError } = await supabase
      .from('forum_daily_reports')
      .update({ status: 'submitted', content: reportDraft })
      .eq('id', selectedReport.id);

    if (submitError) {
      logSupabaseError('Forum daily report submit failed', submitError);
      setDailyError('לא ניתן להגיש את הדיווח כרגע.');
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_submitted',
      entityType: 'forum_daily_report',
      entityId: selectedReport.id,
      previousValue: { status: selectedReport.status },
      newValue: { status: 'submitted' },
    });

    setDailySuccess('הדיווח הוגש');
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const carryForwardClosedReport = async (sourceReport: DailyReportRow): Promise<void> => {
    if (!dbProfile || !sourceReport.owner_user_id) return;

    const nextDate = shiftDateString(sourceReport.report_date, 1);

    const sourceMetadata = sourceReport.metadata ?? {};
    const carriedMetadata: Record<string, unknown> = {
      carried_forward_from_report_id: sourceReport.id,
      carried_forward_from_date: sourceReport.report_date,
      carried_forward_created_at: new Date().toISOString(),
    };
    if (typeof sourceMetadata.node_id === 'string') carriedMetadata.node_id = sourceMetadata.node_id;
    if (typeof sourceMetadata.node_label === 'string') carriedMetadata.node_label = sourceMetadata.node_label;
    if (sourceMetadata.ui_gated_scope !== undefined) carriedMetadata.ui_gated_scope = sourceMetadata.ui_gated_scope;

    const { data: carriedReport, error: carryError } = await supabase
      .from('forum_daily_reports')
      .insert({
        report_date: nextDate,
        company_unit_id: sourceReport.company_unit_id,
        platoon_unit_id: sourceReport.platoon_unit_id,
        squad_unit_id: sourceReport.squad_unit_id,
        report_level: sourceReport.report_level,
        staff_role: sourceReport.staff_role,
        parent_report_id: null,
        created_by: dbProfile.id,
        owner_user_id: sourceReport.owner_user_id,
        status: 'draft',
        content: sourceReport.content,
        summary_text: sourceReport.summary_text,
        whatsapp_text: null,
        metadata: carriedMetadata,
      })
      .select('id')
      .single<{ id: string }>();

    if (carryError) {
      // 23505 = unique(report_date, report_level, owner_user_id): a next-day report already
      // exists. Never overwrite it; skip silently. Other errors are logged best-effort only.
      if (carryError.code !== '23505') {
        logSupabaseError('Forum daily report carry-forward failed', carryError);
      }
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_carried_forward',
      entityType: 'forum_daily_report',
      entityId: carriedReport?.id ?? sourceReport.id,
      previousValue: {
        source_report_id: sourceReport.id,
        source_date: sourceReport.report_date,
      },
      newValue: {
        new_report_id: carriedReport?.id ?? null,
        target_date: nextDate,
        owner_user_id: sourceReport.owner_user_id,
        report_level: sourceReport.report_level,
      },
    });
  };

  const closeSelectedReport = async () => {
    if (!selectedReport || !dbProfile || !canSeeAll) return;

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    const { error: closeError } = await supabase
      .from('forum_daily_reports')
      .update({ status: 'closed' })
      .eq('id', selectedReport.id);

    if (closeError) {
      logSupabaseError('Forum daily report close failed', closeError);
      setDailyError('לא ניתן לסגור את הדיווח כרגע.');
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_closed',
      entityType: 'forum_daily_report',
      entityId: selectedReport.id,
      previousValue: { status: selectedReport.status },
      newValue: { status: 'closed' },
    });

    // Auto carry-forward: create tomorrow's draft for the same owner. Fire-and-forget and
    // best-effort only — close must never wait on it, and a rollover failure must never make
    // the close itself appear to fail. The helper handles all of its own errors internally.
    void carryForwardClosedReport(selectedReport).catch(carryError => {
      logSupabaseError('Forum daily report carry-forward threw', carryError);
    });

    setDailySuccess('הדיווח נסגר');
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const reopenSelectedReport = async () => {
    if (!selectedReport || !dbProfile || !canReopenSelectedReport) return;

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    const { error: reopenError } = await supabase
      .from('forum_daily_reports')
      .update({ status: 'in_progress' })
      .eq('id', selectedReport.id);

    if (reopenError) {
      logSupabaseError('Forum daily report reopen failed', reopenError);
      setDailyError('לא ניתן לפתוח את נעילת הדיווח כרגע.');
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_reopened',
      entityType: 'forum_daily_report',
      entityId: selectedReport.id,
      previousValue: { status: selectedReport.status },
      newValue: {
        previous_status: 'closed',
        status: 'in_progress',
        reopened_by: dbProfile.id,
      },
    });

    setDailySuccess('נעילת הדיווח נפתחה');
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const returnSelectedReport = async () => {
    if (!selectedReport || !dbProfile || !canSeeAll || selectedReport.status !== 'submitted') return;

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    const updatePayload = {
      status: 'in_progress' as ReportStatus,
      metadata: {
        ...(selectedReport.metadata ?? {}),
        returned_note: 'הוחזר לדרג מטה ע״י מפקד',
        returned_by: dbProfile.id,
        returned_by_name: dbProfile.name,
        returned_from_status: selectedReport.status,
        returned_at: new Date().toISOString(),
      },
    };

    const { error: returnError } = await supabase
      .from('forum_daily_reports')
      .update(updatePayload)
      .eq('id', selectedReport.id);

    if (returnError) {
      logSupabaseError('Forum daily report return failed', returnError);
      setDailyError('לא ניתן להחזיר את הדיווח לדרג מטה כרגע.');
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_updated',
      entityType: 'forum_daily_report',
      entityId: selectedReport.id,
      previousValue: { status: selectedReport.status },
      newValue: {
        status: 'in_progress',
        returned_note: 'הוחזר לדרג מטה ע״י מפקד',
        returned_by: dbProfile.id,
      },
    });

    setDailySuccess('הדיווח הוחזר לדרג מטה');
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const resetSelectedReport = async () => {
    if (!selectedReport || !dbProfile || !canResetSelectedReport) return;
    if (!window.confirm('האם לאפס את הדוח? התוכן יימחק והדוח יחזור לטיוטה.')) return;

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    const previousSnapshot = {
      id: selectedReport.id,
      report_level: selectedReport.report_level,
      owner_user_id: selectedReport.owner_user_id,
      created_by: selectedReport.created_by,
      status: selectedReport.status,
      report_date: selectedReport.report_date,
      staff_role: selectedReport.staff_role,
      content: selectedReport.content,
      summary_text: selectedReport.summary_text,
      whatsapp_text: selectedReport.whatsapp_text,
      metadata: selectedReport.metadata,
    };
    const resetMetadata = {
      ...(selectedReport.metadata ?? {}),
      reset_at: new Date().toISOString(),
      reset_by: dbProfile.id,
      reset_by_name: dbProfile.name,
      previous_status: selectedReport.status,
      reset_reason: 'איפוס ידני דרך פורום מוביל',
    };
    const updatePayload = {
      status: 'draft' as ReportStatus,
      content: emptyReportDraft(),
      summary_text: null,
      whatsapp_text: null,
      metadata: resetMetadata,
    };

    const { error: resetError } = await supabase
      .from('forum_daily_reports')
      .update(updatePayload)
      .eq('id', selectedReport.id);

    if (resetError) {
      logSupabaseError('Forum daily report reset failed', resetError);
      setDailyError('לא ניתן לאפס את הדיווח כרגע. בדוק הרשאות או נסה שוב.');
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_reset',
      entityType: 'forum_daily_report',
      entityId: selectedReport.id,
      previousValue: previousSnapshot,
      newValue: {
        status: 'draft',
        reset_by: dbProfile.id,
        previous_status: selectedReport.status,
      },
    });

    setReportDraft(emptyReportDraft());
    setDailySuccess('הדוח אופס וחזר לטיוטה.');
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const deleteSelectedReport = async () => {
    if (!selectedReport || !dbProfile || !canDeleteSelectedReport) return;
    if (!window.confirm('האם למחוק את הדוח? פעולה זו לא ניתנת לשחזור.')) return;

    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    const deletedReportSnapshot = {
      id: selectedReport.id,
      report_level: selectedReport.report_level,
      owner_user_id: selectedReport.owner_user_id,
      created_by: selectedReport.created_by,
      status: selectedReport.status,
      report_date: selectedReport.report_date,
      staff_role: selectedReport.staff_role,
      metadata: selectedReport.metadata,
    };

    const { error: deleteError } = await supabase
      .from('forum_daily_reports')
      .delete()
      .eq('id', selectedReport.id);

    if (deleteError) {
      logSupabaseError('Forum daily report delete failed', deleteError);
      setDailyError('לא ניתן למחוק את הדיווח כרגע. נסה שוב בעוד רגע.');
      setIsDailySaving(false);
      return;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_report_deleted',
      entityType: 'forum_daily_report',
      entityId: selectedReport.id,
      previousValue: deletedReportSnapshot,
      newValue: null,
    });

    setDailyReports(current => current.filter(report => report.id !== selectedReport.id));
    setSelectedNodeId(canSeeAll ? 'whatsapp' : 'own-report');
    setReportDraft(emptyReportDraft());
    setDailySuccess('הדוח נמחק.');
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  const updateDraft = (field: keyof ReportDraft, value: string) => {
    setReportDraft(current => ({ ...current, [field]: value }));
  };

  // Same as updateDraft, but on the company report it also flags a manual edit so a later
  // "רענן מהדוחות" asks for confirmation before overwriting the commander's changes.
  const handleStructuredFieldChange = (field: keyof ReportDraft, value: string) => {
    updateDraft(field, value);
    if (selectedNode?.level === 'company') setCompanyManuallyEdited(true);
  };

  // ---- Company structured report (ריכוז פלוגתי בפורמט דוח מ״מ) --------------------------
  const buildCompanyReportInput = (): CompanyReportInput => ({
    reports: dailyReports,
    formattedDate: formatSelectedDate(selectedDate),
    platoons: platoonNodes.map((platoon, index) => ({
      number: index + 1,
      label: platoon.label,
      ownerUserId: findPlatoonSummaryOwner(ownerOptions, platoon.label)?.id ?? null,
    })),
    staff: staffNodes.map(staff => ({ role: staff.id, label: staff.label })),
  });

  // Snapshot the whole company structured form (aggregated + manual fields) for a merge-safe
  // write — used when publishing so the closed company report holds the final structured data.
  const companyContentPatchFromDraft = (): Record<string, unknown> => ({
    present_count: reportDraft.present_count,
    total_count: reportDraft.total_count,
    personnel: reportDraft.personnel,
    readiness: reportDraft.readiness,
    welfare: reportDraft.welfare,
    medical: reportDraft.medical,
    safety: reportDraft.safety,
    discipline: reportDraft.discipline,
    logistics: reportDraft.logistics,
    personal_requests: reportDraft.personal_requests,
    plan_vs_actual: reportDraft.plan_vs_actual,
    next_actions: reportDraft.next_actions,
    network_and_knowledge: reportDraft.network_and_knowledge,
    daily_lessons: reportDraft.daily_lessons,
    personal_note: reportDraft.personal_note,
    commander_closing: reportDraft.commander_closing,
    commander_opening: reportDraft.commander_opening,
    company_summary: reportDraft.company_summary,
    tomorrow_schedule: reportDraft.tomorrow_schedule,
    parallel_schedule: reportDraft.parallel_schedule,
    company_report_manually_edited: companyManuallyEdited,
  });

  // Every write to the company report content is a safe merge ({ ...existing, ...patch }) so
  // commander_opening / tomorrow_schedule / parallel_schedule / commander_closing /
  // company_summary are never overwritten. Creates the row on first use if missing.
  const persistCompanyReportContent = async (
    patch: Record<string, unknown>,
    auditAction: AuditActionType,
  ): Promise<DailyReportRow | null> => {
    if (!dbProfile || !canSeeAll) {
      setDailyError('רק מפקד יכול לבנות ולשמור את הדוח הפלוגתי.');
      return null;
    }

    if (companyReport) {
      const nextContent = { ...companyReport.content, ...patch };
      const { error: updateError } = await supabase
        .from('forum_daily_reports')
        .update({ content: nextContent })
        .eq('id', companyReport.id);
      if (updateError) {
        logSupabaseError('Forum company report save failed', updateError);
        setDailyError('לא ניתן לשמור את הדוח הפלוגתי כרגע. בדוק הרשאות או נסה שוב.');
        return null;
      }
      void createAuditLog(supabase, {
        userId: dbProfile.id,
        userName: dbProfile.name,
        userRole: dbProfile.role,
        actionType: auditAction,
        entityType: 'forum_daily_report',
        entityId: companyReport.id,
        previousValue: { company_report_keys: Object.keys(patch) },
        newValue: patch,
      });
      const updated: DailyReportRow = { ...companyReport, content: nextContent };
      await loadDailyReports(selectedDate);
      return updated;
    }

    // No company report yet — create one, preserving any company fields the commander
    // has already typed in the structured form (reportDraft) and merging the patch on top.
    const baseContent = { ...emptyReportDraft(), ...reportDraft, ...patch };
    const { data: created, error: createError } = await supabase
      .from('forum_daily_reports')
      .insert({
        report_date: selectedDate,
        company_unit_id: dbProfile.unit_id,
        platoon_unit_id: null,
        squad_unit_id: null,
        report_level: 'company',
        staff_role: null,
        parent_report_id: null,
        created_by: dbProfile.id,
        owner_user_id: dbProfile.id,
        status: 'in_progress',
        content: baseContent,
        summary_text: typeof baseContent.company_summary === 'string' ? baseContent.company_summary : '',
        whatsapp_text: null,
        metadata: {
          node_id: 'company-summary',
          node_label: 'סיכום פלוגתי',
          ui_gated_scope: true,
          company_report: true,
        },
      })
      .select('id,report_date,company_unit_id,platoon_unit_id,squad_unit_id,report_level,staff_role,parent_report_id,created_by,owner_user_id,status,content,summary_text,whatsapp_text,metadata,created_at,updated_at')
      .single<DailyReportRow>();

    if (createError || !created) {
      if (createError) logSupabaseError('Forum company report create failed', createError);
      setDailyError('לא ניתן ליצור את הדוח הפלוגתי כרגע. בדוק הרשאות או נסה שוב.');
      return null;
    }

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: auditAction,
      entityType: 'forum_daily_report',
      entityId: created.id,
      previousValue: null,
      newValue: { created: true, company_report_keys: Object.keys(patch) },
    });

    await loadDailyReports(selectedDate);
    return created;
  };

  // Build/refresh: fill the structured company form from the platoon reports. Pure aggregation
  // only — numbers summed, text fields rolled up per platoon. Fills the form in place (no DB
  // write); the manual fields (דגשי מ״פ + the schedule/narrative block) are left untouched, and
  // the commander reviews and persists with the normal "שמור".
  const applyCompanyAggregation = () => {
    if (isCompanyReportLocked) return;
    const result = aggregateCompanyStructured(buildCompanyReportInput());
    setReportDraft(current => ({ ...current, ...result.fields }));
    setCompanyManuallyEdited(false);
    setCompanyGeneratedAt(new Date().toISOString());
    setCompanyReportWarnings(result.warnings);
    setDailyError(null);
    setDailySuccess('הריכוז הפלוגתי עודכן מהדיווחים. בדוק/ערוך לפי הצורך ואז שמור.');
  };

  const handleBuildCompanyReport = () => {
    if (isCompanyReportLocked) return;
    // Guard the commander's manual edits: never silently overwrite an edited form.
    if (companyManuallyEdited) {
      setShowCompanyRefreshConfirm(true);
      return;
    }
    applyCompanyAggregation();
  };

  const confirmCompanyRefresh = () => {
    setShowCompanyRefreshConfirm(false);
    applyCompanyAggregation();
  };

  // Publish & close the whole daily forum: save the final draft, bulk-close every report for
  // the day that is not already closed, then best-effort carry each closed report forward to a
  // next-day draft (reusing the existing carryForwardClosedReport). Single-report close/reopen
  // are untouched; there is no "reopen the whole forum" — reopen stays per-report.
  const publishAndCloseForum = async () => {
    if (!dbProfile || !canSeeAll) return;

    setIsCompanyReportBusy(true);
    setIsDailySaving(true);
    setDailyError(null);
    setDailySuccess(null);

    // 1) Persist the current structured company form so the closed report holds the final data.
    const savedCompany = await persistCompanyReportContent(
      companyContentPatchFromDraft(),
      'forum_company_report_saved',
    );

    if (!savedCompany) {
      setIsCompanyReportBusy(false);
      setIsDailySaving(false);
      setShowCompanyPublishConfirm(false);
      return;
    }

    // 2) Bulk-close every still-open report for this date (RLS limits this to permitted rows).
    const { data: closedRows, error: closeError } = await supabase
      .from('forum_daily_reports')
      .update({ status: 'closed' })
      .eq('report_date', selectedDate)
      .neq('status', 'closed')
      .select('id,report_date,company_unit_id,platoon_unit_id,squad_unit_id,report_level,staff_role,parent_report_id,created_by,owner_user_id,status,content,summary_text,whatsapp_text,metadata,created_at,updated_at');

    if (closeError) {
      logSupabaseError('Forum daily forum publish bulk-close failed', closeError);
      setDailyError('לא ניתן לסגור את כל דוחות היום כרגע. בדוק הרשאות או נסה שוב.');
      setIsCompanyReportBusy(false);
      setIsDailySaving(false);
      setShowCompanyPublishConfirm(false);
      await loadDailyReports(selectedDate);
      return;
    }

    const closed = (closedRows ?? []) as DailyReportRow[];

    // 3) Carry each closed report forward — fire-and-forget, never blocks the publish.
    closed.forEach(row => {
      void carryForwardClosedReport(row).catch(carryError => {
        logSupabaseError('Forum publish carry-forward threw', carryError);
      });
    });

    void createAuditLog(supabase, {
      userId: dbProfile.id,
      userName: dbProfile.name,
      userRole: dbProfile.role,
      actionType: 'forum_daily_forum_published',
      entityType: 'forum_daily_report',
      entityId: savedCompany.id,
      previousValue: { report_date: selectedDate },
      newValue: { report_date: selectedDate, closed_count: closed.length },
    });

    setShowCompanyPublishConfirm(false);
    setDailySuccess(`הפורום הופץ ונסגר. נסגרו ${closed.length} דוחות.`);
    setIsCompanyReportBusy(false);
    setIsDailySaving(false);
    await loadDailyReports(selectedDate);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="פורום מוביל" subtitle="מרכז הודעות ועדכונים פלוגתי" category="פלוגה א׳" />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const renderPostsTab = () => (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.35fr]">
      <form onSubmit={handleCreatePost} className="tactical-glass-card rounded-3xl p-5 shadow-[0_16px_44px_rgba(2,1,8,0.08)]">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#020108]">פרסום פוסט חדש</h2>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#667085]">עדכון קצר וברור למפקדים ולבעלי התפקידים.</p>
          </div>
        </div>

        {formError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{formError}</div>}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#020108]">כותרת *</span>
            <input value={title} onChange={event => setTitle(event.target.value)} className="command-input" placeholder="לדוגמה: עדכון מצב ערב" disabled={isSubmitting} />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#020108]">תוכן *</span>
            <textarea value={body} onChange={event => setBody(event.target.value)} className="command-input min-h-24 resize-none" placeholder="כתוב את העדכון המרכזי, החלטות, פערים או דגשים להמשך." disabled={isSubmitting} />
          </label>

          {canSeeAll && (
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 px-4 py-3">
              <span>
                <span className="block text-sm font-black text-[#020108]">נעץ בראש הפורום</span>
                <span className="text-xs font-bold text-[#667085]">זמין למפקדים בלבד</span>
              </span>
              <input type="checkbox" checked={isPinned} onChange={event => setIsPinned(event.target.checked)} className="h-5 w-5 accent-[#FF6B02]" disabled={isSubmitting} />
            </label>
          )}

          <GlossyButton type="submit" variant="orange" size="lg" disabled={isSubmitting} className="w-full">
            <Send className="h-4 w-4" />
            {isSubmitting ? 'מפרסם...' : 'פרסם לפורום'}
          </GlossyButton>
        </div>
      </form>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-[#020108]">עדכונים אחרונים</h2>
          <p className="text-sm font-bold text-[#667085]">{posts.length} פוסטים זמינים לך</p>
        </div>

        {posts.length === 0 ? (
          <div className="tactical-glass-card rounded-3xl p-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black text-[#020108]">אין עדיין פוסטים בפורום</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed text-[#667085]">פרסם את העדכון הראשון כדי לפתוח את ערוץ הסנכרון הפלוגתי.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <article key={post.id} className="tactical-glass-card rounded-3xl p-5 shadow-[0_14px_36px_rgba(2,1,8,0.07)]">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {post.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#FF6B02]/25 bg-[#FF6B02]/10 px-3 py-1 text-xs font-black text-[#C75200]">
                          <Pin className="h-3.5 w-3.5" />
                          נעוץ
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#667085]">{formatDate(post.created_at)}</span>
                    </div>
                    <h3 className="text-xl font-black leading-tight text-[#020108]">{post.title}</h3>
                  </div>
                  {canEditPost(post) && editingPostId !== post.id && (
                    <GlossyButton variant="slate" size="sm" onClick={() => startEditPost(post)} disabled={isSubmitting} className="min-w-[96px] shrink-0 whitespace-nowrap px-4">
                      <Pencil className="h-4 w-4" />
                      ערוך
                    </GlossyButton>
                  )}
                </div>
                {editingPostId === post.id ? (
                  <div className="space-y-4 rounded-3xl border border-[#FF6B02]/20 bg-white/70 p-4">
                    {editPostError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{editPostError}</div>}
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-[#020108]">כותרת *</span>
                      <input value={editPostTitle} onChange={event => setEditPostTitle(event.target.value)} className="command-input" disabled={isSubmitting} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-[#020108]">תוכן *</span>
                      <textarea value={editPostBody} onChange={event => setEditPostBody(event.target.value)} className="command-input min-h-28 resize-none" disabled={isSubmitting} />
                    </label>
                    {canSeeAll && (
                      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 px-4 py-3">
                        <span className="text-sm font-black text-[#020108]">נעוץ בראש הפורום</span>
                        <input type="checkbox" checked={editPostPinned} onChange={event => setEditPostPinned(event.target.checked)} className="h-5 w-5 accent-[#FF6B02]" disabled={isSubmitting} />
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <GlossyButton variant="orange" size="sm" onClick={() => void saveEditedPost(post)} disabled={isSubmitting}>
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'שומר...' : 'שמור'}
                      </GlossyButton>
                      <GlossyButton variant="slate" size="sm" onClick={cancelEditPost} disabled={isSubmitting}>
                        ביטול
                      </GlossyButton>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-[#344054]">{post.body}</p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[rgba(2,1,8,0.08)] pt-4 text-xs font-black text-[#667085]">
                  <span>מאת: <strong className="text-[#020108]">{post.authorName ?? 'משתמש'}</strong></span>
                  <span>·</span>
                  <span>יחידה: <strong className="text-[#020108]">{post.unitName ?? 'לא שויך'}</strong></span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  // Top-of-form card for the company structured report: explains the auto-aggregation and
  // exposes build/refresh, the "rolled up at" stamp, manual-edit hint, and aggregation warnings.
  const renderCompanyAggregationHeader = () => (
    <div className="tactical-glass-card rounded-3xl p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-[#020108]">ריכוז פלוגתי מהמ״מים</h3>
            <p className="mt-1 text-sm font-bold leading-relaxed text-[#667085]">
              דוח פלוגתי מובנה באותו פורמט כמו דוח מ״מ. השדות מתמלאים אוטומטית מסיכומי המ״מים — בדוק, ערוך לפי הצורך ושמור. "דגשי מ״פ" נכתבים ידנית.
            </p>
          </div>
        </div>
        {companyGeneratedAt && (
          <span className="w-fit shrink-0 rounded-full border border-[rgba(2,1,8,0.08)] bg-white/80 px-3 py-1.5 text-xs font-black text-[#667085]">
            רוכז לאחרונה: {formatDate(companyGeneratedAt)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <GlossyButton variant="orange" size="sm" onClick={handleBuildCompanyReport} disabled={isCompanyReportBusy || isDailySaving || isCompanyReportLocked}>
          <RefreshCw className="h-4 w-4" />
          {companyGeneratedAt ? 'בנה מחדש מהדיווחים' : 'בנה מהדיווחים'}
        </GlossyButton>
        <GlossyButton variant="slate" size="sm" onClick={handleBuildCompanyReport} disabled={isCompanyReportBusy || isDailySaving || isCompanyReportLocked}>
          רענן מהדוחות
        </GlossyButton>
      </div>

      {companyManuallyEdited && !isCompanyReportLocked && (
        <p className="mt-3 text-xs font-black text-[#C75200]">הדוח נערך ידנית — רענון מהדוחות יבקש אישור לפני החלפה.</p>
      )}

      {companyReportWarnings.length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          <div className="mb-1 flex items-center gap-2 font-black">
            <AlertCircle className="h-4 w-4 shrink-0" />
            שים לב — פערים בדיווחים
          </div>
          <ul className="list-disc space-y-1 pr-5">
            {companyReportWarnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      {isCompanyReportLocked && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/80 px-4 py-3 text-sm font-black text-[#020108]">
          <Lock className="h-4 w-4 shrink-0 text-[#FF6B02]" />
          הפורום נסגר. לעריכה נוספת יש לפתוח את נעילת הדוח הפלוגתי.
        </div>
      )}
    </div>
  );

  // Manual schedule/narrative block for the company report — kept for the WhatsApp output and
  // never touched by the aggregation. Collapsed by default so the structured roll-up leads.
  const renderCompanyScheduleSection = () => (
    <details className="tactical-glass-card group rounded-3xl p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="text-lg font-black text-[#020108]">לו״ז ודגשים להפצה <span className="text-sm font-bold text-[#667085]">(ידני)</span></span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-black text-[#667085]">
          <span className="group-open:hidden">פתח ▾</span>
          <span className="hidden group-open:inline">סגור ▴</span>
        </span>
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {([
          ['commander_opening', 'פתיחת מ״פ'],
          ['company_summary', 'סיכום פלוגתי'],
          ['tomorrow_schedule', 'לו״ז פלוגתי למחר'],
          ['parallel_schedule', 'לו״ז מקביל'],
        ] as Array<[keyof ReportDraft, string]>).map(([field, label]) => (
          <label key={field} className="block">
            <span className="mb-2 block text-sm font-black text-[#020108]">{label}</span>
            <textarea value={reportDraft[field]} onChange={event => handleStructuredFieldChange(field, event.target.value)} className="command-input min-h-20 resize-none" disabled={isDailySaving || isSelectedReportReadOnly} />
          </label>
        ))}
      </div>
    </details>
  );

  const renderCompanyPublishBlock = () => (
    <div className="tactical-glass-card rounded-3xl border border-[#FF6B02]/20 bg-[#FF6B02]/5 p-5">
      <div className="mb-1 text-sm font-black text-[#020108]">הפצה וסגירת פורום</div>
      <p className="mb-3 text-xs font-bold leading-relaxed text-[#667085]">
        שמירת הדוח הפלוגתי הסופי וסגירת כל דוחות היום לכלל הפלוגה. הדוחות ננעלים לקריאה בלבד; ניתן עדיין לפתוח דוח בודד מחדש לפי הצורך.
      </p>
      <GlossyButton variant="orange" onClick={() => setShowCompanyPublishConfirm(true)} disabled={isCompanyReportBusy || isDailySaving || isCompanyReportLocked}>
        <Send className="h-4 w-4" />
        הפץ וסגור פורום
      </GlossyButton>
    </div>
  );

  const renderSelectedReportForm = () => {
    if (!selectedNode || selectedNode.level === 'whatsapp') {
      return (
        <div className="tactical-glass-card rounded-3xl p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Clipboard className="h-5 w-5 text-[#FF6B02]" />
              <h3 className="text-lg font-black text-[#020108]">תוצר WhatsApp / סיכום יומי</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <GlossyButton variant={whatsappMode === 'short' ? 'orange' : 'slate'} size="sm" onClick={() => setWhatsappMode('short')}>
                הודעה קצרה
              </GlossyButton>
              <GlossyButton variant={whatsappMode === 'detailed' ? 'orange' : 'slate'} size="sm" onClick={() => setWhatsappMode('detailed')}>
                הודעה מפורטת
              </GlossyButton>
              <GlossyButton variant="orange" size="sm" onClick={() => void copyWhatsappText()}>
                <Clipboard className="h-4 w-4" />
                העתק פלט WhatsApp
              </GlossyButton>
            </div>
          </div>
          <textarea readOnly value={generateWhatsappText()} className="command-input min-h-80 resize-none" dir="rtl" />
        </div>
      );
    }

    if (!selectedReport && !canUseDraftFormForSelectedNode) {
      return (
        <div className="tactical-glass-card rounded-3xl p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
            <FileText className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-black text-[#020108]">נדרש שיוך משתמש</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-[#667085]">
            לא ניתן לפתוח דוח למחלקה בלי מ״מ/משתמש משויך. ניתן ליצור דוח ידנית עבור משתמש דרך "צור דוח עבור משתמש".
          </p>
          {canSeeAll && (
            <div className="mx-auto mt-5 grid max-w-2xl gap-3 rounded-3xl border border-[rgba(2,1,8,0.08)] bg-white/70 p-4 text-right lg:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#020108]">צור דוח עבור משתמש</span>
                <select value={selectedOwnerId} onChange={event => setSelectedOwnerId(event.target.value)} className="command-select">
                  <option value="">עבורי</option>
                  {ownerOptions.map(owner => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name || owner.email} · {owner.role}{owner.units?.name ? ` · ${owner.units.name}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#020108]">סוג דיווח</span>
                <select value={commanderReportLevel} onChange={event => setCommanderReportLevel(event.target.value as ReportLevel)} className="command-select">
                  <option value="squad">squad · מ״כ/כיתה</option>
                  <option value="platoon">platoon · מ״מ/מחלקה</option>
                  <option value="company">company · פלוגה</option>
                  <option value="staff">staff · מפל״ג</option>
                </select>
              </label>
              {commanderReportLevel === 'staff' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-[#020108]">תפקיד מפל״ג</span>
                  <select value={commanderStaffRole} onChange={event => setCommanderStaffRole(event.target.value as StaffRole)} className="command-select">
                    {staffNodes.map(staff => <option key={staff.id} value={staff.id}>{staff.label}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          {canSeeAll && selectedOwnerId && (
            <GlossyButton variant="orange" size="lg" onClick={() => void createOrOpenOwnReport(selectedNode)} disabled={isDailySaving} className="mt-5">
              צור דוח עבור המשתמש שנבחר
            </GlossyButton>
          )}
        </div>
      );
    }

    const displayedStatus = selectedReport?.status ?? 'draft';
    const isReadView = Boolean(selectedReport) && !isEditingReport;
    const readContent = { ...emptyReportDraft(), ...(selectedReport?.content ?? {}) };
    const hasSecondaryContent = squadSecondaryFields.some(field => readContent[field.key].trim().length > 0);
    const returnedInfo = selectedReport && selectedReport.status === 'in_progress' && selectedReport.metadata?.returned_note
      ? {
          note: String(selectedReport.metadata.returned_note),
          byName: typeof selectedReport.metadata.returned_by_name === 'string' ? selectedReport.metadata.returned_by_name : null,
          at: typeof selectedReport.metadata.returned_at === 'string' ? selectedReport.metadata.returned_at : null,
        }
      : null;

    const renderReadSection = (Icon: LucideIcon, label: string, value: string, wide = false) => (
      <div key={label} className={`rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 p-4 ${wide ? 'sm:col-span-2' : ''}`}>
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[#FF6B02]" />
          <span className="text-sm font-black text-[#020108]">{label}</span>
        </div>
        <p className={`whitespace-pre-wrap text-sm leading-6 ${value.trim() ? 'font-semibold text-[#344054]' : 'font-bold text-[#98A2B3]'}`}>
          {value.trim() || '—'}
        </p>
      </div>
    );

    const renderReadView = () => {
      if (selectedNode.level === 'staff') {
        return (
          <div className="tactical-glass-card rounded-3xl p-5">
            <h3 className="mb-4 text-lg font-black text-[#020108]">דיווח מפל״ג מקצועי</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {renderReadSection(User, 'שם', readContent.name)}
              {renderReadSection(FileText, 'התייחסות/דיווח', readContent.notes, true)}
            </div>
          </div>
        );
      }

      if (selectedNode.level === 'company') {
        return (
          <div className="space-y-4">
            <div className="tactical-glass-card rounded-3xl p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-[#667085]">מצבת חיילים פלוגתית</p>
                  <p className="font-mono text-3xl font-black text-[#FF6B02]" dir="ltr">
                    {readContent.present_count.trim() || '—'}/{readContent.total_count.trim() || '—'}
                  </p>
                </div>
                <span className="mr-auto text-sm font-bold text-[#667085]">נוכחים / סד״כ בבסיס</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {squadReadSections.map(section => renderReadSection(section.icon, section.label, readContent[section.key], section.wide))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {renderReadSection(Star, 'דגשי מ״פ', readContent.commander_closing, true)}
              {companyReadSections
                .filter(section => section.key !== 'commander_closing')
                .map(section => renderReadSection(section.icon, section.label, readContent[section.key], section.key === 'company_summary'))}
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <div className="tactical-glass-card rounded-3xl p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-black text-[#667085]">מצבת חיילים</p>
                <p className="font-mono text-3xl font-black text-[#FF6B02]" dir="ltr">
                  {readContent.present_count.trim() || '—'}/{readContent.total_count.trim() || '—'}
                </p>
              </div>
              <span className="mr-auto text-sm font-bold text-[#667085]">נוכחים / סד״כ בבסיס</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {squadReadSections.map(section => renderReadSection(section.icon, section.label, readContent[section.key], section.wide))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#020108]">{selectedNode.label}</h2>
            <p className="text-sm font-bold text-[#667085]">{selectedNode.description} · {formatSelectedDate(selectedDate)}</p>
          </div>
          <span className={`rounded-full border px-4 py-2 text-sm font-black ${statusTone(displayedStatus)}`}>{statusLabel(displayedStatus)}</span>
        </div>

        {returnedInfo && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm font-bold text-amber-800">
              <span className="block font-black">הדוח הוחזר לדרג מטה</span>
              <span>
                {returnedInfo.note}
                {returnedInfo.byName ? ` · ע״י ${returnedInfo.byName}` : ''}
                {returnedInfo.at ? ` · ${formatDate(returnedInfo.at)}` : ''}
              </span>
            </div>
          </div>
        )}

        {isReadView ? renderReadView() : selectedNode.level === 'staff' ? (
          <div className="tactical-glass-card rounded-3xl p-5">
            <h3 className="mb-4 text-lg font-black text-[#020108]">דיווח מפל״ג מקצועי</h3>
            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-black text-[#020108]">שם</span>
              <input value={reportDraft.name} onChange={event => updateDraft('name', event.target.value)} className="command-input" disabled={isDailySaving || isSelectedReportReadOnly} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#020108]">התייחסות/דיווח</span>
              <textarea value={reportDraft.notes} onChange={event => updateDraft('notes', event.target.value)} className="command-input min-h-32 resize-none" disabled={isDailySaving || isSelectedReportReadOnly} />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedNode.level === 'company' && renderCompanyAggregationHeader()}

            <div className="tactical-glass-card rounded-3xl p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
                  <Users className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#020108]">{selectedNode.level === 'company' ? 'מצבת חיילים פלוגתית' : 'מצבת חיילים'}</p>
                  <p className="font-mono text-3xl font-black text-[#FF6B02]" dir="ltr">
                    {reportDraft.present_count.trim() || '—'}/{reportDraft.total_count.trim() || '—'}
                  </p>
                </div>
                <span className="mr-auto hidden text-sm font-bold text-[#667085] sm:block">
                  {selectedNode.level === 'company' ? 'נוכחים / סד״כ — סכום מהמחלקות' : 'נוכחים / סד״כ בבסיס'}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[rgba(2,1,8,0.08)] pt-4">
                {squadManpowerFields.map(field => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block text-xs font-black text-[#667085]">{field.label}</span>
                    <input
                      value={reportDraft[field.key]}
                      onChange={event => handleStructuredFieldChange(field.key, event.target.value)}
                      inputMode="numeric"
                      placeholder="0"
                      className="command-input w-full text-center font-mono text-lg font-black text-[#020108]"
                      disabled={isDailySaving || isSelectedReportReadOnly}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="tactical-glass-card rounded-3xl p-5">
              <h3 className="mb-4 text-lg font-black text-[#020108]">{selectedNode.level === 'company' ? 'ריכוז פלוגתי מהמ״מים' : selectedNode.level === 'platoon' ? 'סיכום מ״מ / מחלקה' : 'דיווח מ״כ / כיתה'}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {squadPrimaryFields.map(field => (
                  <label key={field.key} className="block">
                    <span className="mb-2 block text-sm font-black text-[#020108]">{field.label}</span>
                    <textarea value={reportDraft[field.key]} onChange={event => handleStructuredFieldChange(field.key, event.target.value)} className="command-input min-h-20 resize-none" disabled={isDailySaving || isSelectedReportReadOnly} />
                  </label>
                ))}
              </div>
            </div>

            <details className="tactical-glass-card group rounded-3xl p-5" open={hasSecondaryContent || selectedNode.level === 'company'}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span className="text-lg font-black text-[#020108]">הרחבות וסיכום</span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-black text-[#667085]">
                  <span className="group-open:hidden">פרטים נוספים ▾</span>
                  <span className="hidden group-open:inline">הסתר פרטים ▴</span>
                </span>
              </summary>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {squadSecondaryFields.map(field => (
                  <label key={field.key} className={field.wide ? 'block lg:col-span-2' : 'block'}>
                    <span className="mb-2 block text-sm font-black text-[#020108]">{field.label}</span>
                    <textarea value={reportDraft[field.key]} onChange={event => handleStructuredFieldChange(field.key, event.target.value)} className="command-input min-h-24 resize-none" disabled={isDailySaving || isSelectedReportReadOnly} />
                  </label>
                ))}
                {selectedNode.level === 'company' && (
                  <label className="block lg:col-span-2">
                    <span className="mb-2 block text-sm font-black text-[#020108]">דגשי מ״פ <span className="text-xs font-bold text-[#667085]">(ידני — לא נגזר אוטומטית)</span></span>
                    <textarea value={reportDraft.commander_closing} onChange={event => handleStructuredFieldChange('commander_closing', event.target.value)} className="command-input min-h-24 resize-none" disabled={isDailySaving || isSelectedReportReadOnly} />
                  </label>
                )}
              </div>
            </details>

            {selectedNode.level === 'company' && renderCompanyScheduleSection()}
          </div>
        )}

        {canSeeAll && selectedNode.level === 'company' && renderCompanyPublishBlock()}

        <div className="tactical-glass-card flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-bold text-[#667085]">היררכיית המחלקות המלאה תוצג כאן לאחר שיוך משתמשים ליחידות.</div>
          <div className="flex flex-wrap gap-2">
            {selectedReport?.status === 'closed' && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(2,1,8,0.08)] bg-white/80 px-4 py-2 text-sm font-black text-[#020108]">
                <Lock className="h-4 w-4 text-[#FF6B02]" />
                {canReopenSelectedReport ? 'נסגר' : 'הדוח נעול'}
              </span>
            )}
            {canReopenSelectedReport && (
              <GlossyButton variant="slate" onClick={() => void reopenSelectedReport()} disabled={isDailySaving}>
                פתח נעילה
              </GlossyButton>
            )}
            {selectedReport && canSeeAll && selectedReport.status !== 'closed' && (
              <GlossyButton variant="slate" onClick={() => void closeSelectedReport()} disabled={isDailySaving}>
                סגור
              </GlossyButton>
            )}
            {selectedReport && selectedReport.status !== 'closed' && (
              <GlossyButton variant="slate" onClick={() => void submitSelectedReport()} disabled={isDailySaving}>
                <CheckCircle2 className="h-4 w-4" />
                הגש לדרג הבא
              </GlossyButton>
            )}
            {isReadView ? (
              <GlossyButton variant="orange" onClick={() => setIsEditingReport(true)} disabled={isDailySaving || isSelectedReportReadOnly || selectedReport?.status === 'closed'}>
                <Pencil className="h-4 w-4" />
                ערוך דוח
              </GlossyButton>
            ) : (
              <>
                <GlossyButton variant="orange" onClick={() => void saveSelectedReport()} disabled={isDailySaving || isSelectedReportReadOnly || selectedReport?.status === 'closed'}>
                  <Save className="h-4 w-4" />
                  {isDailySaving ? 'שומר...' : 'שמור'}
                </GlossyButton>
                {selectedReport && (
                  <GlossyButton
                    variant="slate"
                    onClick={() => {
                      setReportDraft(draftFromReport(selectedReport));
                      setIsEditingReport(false);
                    }}
                    disabled={isDailySaving}
                  >
                    ביטול עריכה
                  </GlossyButton>
                )}
              </>
            )}
            {canResetSelectedReport && (
              <GlossyButton variant="slate" onClick={() => void resetSelectedReport()} disabled={isDailySaving}>
                <RefreshCw className="h-4 w-4" />
                אפס דוח
              </GlossyButton>
            )}
            {canSeeAll && (
              <>
                <GlossyButton variant="slate" onClick={() => void closeSelectedReport()} disabled={isDailySaving || selectedReport?.status !== 'submitted'}>
                  אשר ושחרר
                </GlossyButton>
                <GlossyButton variant="slate" onClick={() => void returnSelectedReport()} disabled={isDailySaving || selectedReport?.status !== 'submitted'}>
                  החזר לדרג מטה
                </GlossyButton>
              </>
            )}
          </div>
        </div>
        {canDeleteSelectedReport && (
          <div className="rounded-3xl border border-red-100 bg-red-50/55 p-3">
            <div className="mb-2 text-xs font-black text-red-700">פעולות מתקדמות</div>
            <button
              type="button"
              onClick={() => void deleteSelectedReport()}
              disabled={isDailySaving}
              className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white/70 px-3 text-xs font-black text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחק דוח
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDailyTab = () => (
    <section className="space-y-5">
      <div className="tactical-glass-card rounded-3xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <GlossyButton variant="slate" size="sm" onClick={() => setSelectedDate(current => shiftDateString(current, -1))} disabled={isDailySaving}>
              <ChevronRight className="h-4 w-4" />
              יום קודם
            </GlossyButton>
            <GlossyButton variant="slate" size="sm" onClick={() => setSelectedDate(getJerusalemDateString())} disabled={isDailySaving}>היום</GlossyButton>
            <GlossyButton variant="slate" size="sm" onClick={() => setSelectedDate(current => shiftDateString(current, 1))} disabled={isDailySaving}>
              יום הבא
              <ChevronLeft className="h-4 w-4" />
            </GlossyButton>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/70 px-4 py-3 text-sm font-black text-[#020108]">
            <CalendarDays className="h-5 w-5 text-[#FF6B02]" />
            <span>{formatSelectedDate(selectedDate)}</span>
            <input
              type="date"
              value={dailyDateInputValue}
              onChange={event => {
                const nextDate = event.target.value;
                setDailyDateInputValue(nextDate);
                if (isDateInputValue(nextDate)) setSelectedDate(nextDate);
              }}
              onBlur={() => commitDailyDateInput()}
              onKeyDown={event => {
                if (event.key === 'Enter') commitDailyDateInput(event.currentTarget.value);
              }}
              className="command-input min-h-0 w-auto min-w-36 px-3 py-2 text-sm"
              disabled={isDailySaving}
            />
          </div>
        </div>
      </div>

      {dailyError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{dailyError}</span>
        </div>
      )}

      {dailySuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{dailySuccess}</div>}

      {isDailyLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.42fr_1fr]">
          <aside className="tactical-glass-card rounded-3xl p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
            <div className="mb-4 rounded-3xl border border-[#FF6B02]/20 bg-[#FF6B02]/10 p-4">
              <h2 className="text-lg font-black text-[#020108]">סדר פורום מוביל</h2>
              <p className="mt-1 text-xs font-bold leading-relaxed text-[#667085]">לחיצה על קבוצה פותחת את הגורמים שלה. כל גורם נשמר עם סטטוס עצמאי.</p>
            </div>
            <div className="space-y-2">
              {dailyNodeGroups.map(group => {
                // Commanders start with everything collapsed except the group that holds the
                // current selection; non-commanders keep today's fully expanded list.
                const isExpanded = groupToggles[group.name] ?? (!canSeeAll || group.name === selectedNode?.group);
                const groupDone = group.total > 0 && group.submitted === group.total;
                const groupCountTone = groupDone
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : group.inProgress > 0
                    ? 'border-[#FF6B02]/25 bg-[#FF6B02]/10 text-[#C75200]'
                    : 'border-[rgba(2,1,8,0.08)] bg-white/80 text-[#667085]';
                return (
                  <div key={group.name} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleDailyGroup(group.name, isExpanded)}
                      aria-expanded={isExpanded}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-[rgba(2,1,8,0.08)] bg-white/60 px-3 py-2.5 text-right transition hover:border-[#FF6B02]/24 hover:bg-white"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ChevronDown className={`h-4 w-4 shrink-0 text-[#98A2B3] transition ${isExpanded ? '' : 'rotate-90'}`} />
                        <span className="truncate text-sm font-black text-[#020108]">{group.name}</span>
                      </span>
                      {group.total > 0 && (
                        <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${groupCountTone}`}>
                          {`הוגשו ${group.submitted}/${group.total}`}
                          {group.inProgress > 0 ? ` · ${group.inProgress} בטיפול` : ''}
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="space-y-2 pr-2">
                        {group.nodes.map(node => {
                          const report = findReportForNode(node);
                          const isActive = selectedNode?.id === node.id;
                          const needsMapping = Boolean(node.requiresOwnerMapping && !report);
                          const wasReturned = Boolean(report?.status === 'in_progress' && report.metadata?.returned_note);
                          return (
                            <button
                              key={node.id}
                              type="button"
                              data-node-id={node.id}
                              onClick={handleSelectDailyNode}
                              className={`w-full rounded-2xl border px-4 py-3 text-right transition ${isActive ? 'border-[#FF6B02]/35 bg-[#FF6B02]/10 shadow-[0_12px_28px_rgba(255,107,2,0.12)]' : 'border-[rgba(2,1,8,0.08)] bg-white/70 hover:bg-white'}`}
                            >
                              <span className="flex items-start justify-between gap-3">
                                <span className="min-w-0">
                                  <span className="block text-sm font-black text-[#020108]">{node.label}</span>
                                  <span className="mt-1 block text-xs font-bold leading-relaxed text-[#667085]">
                                    {needsMapping ? 'נדרש שיוך משתמש — עדיין לא משויך בעל תפקיד לגורם הזה' : node.description}
                                  </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                  <span className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${statusTone(needsMapping ? undefined : report?.status)}`}>
                                    <span className={`ml-1 inline-block h-2 w-2 rounded-full ${statusDotTone(needsMapping ? undefined : report?.status)}`} />
                                    {needsMapping ? 'נדרש שיוך' : statusLabel(report?.status)}
                                  </span>
                                  {wasReturned && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                      הוחזר לדרג מטה
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <main ref={reportPanelRef} className="min-w-0 space-y-4">
            {selectedNode && (
              <div className="tactical-glass-card rounded-3xl p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black text-[#667085]">הגורם הנבחר</p>
                    <h2 className="text-xl font-black text-[#020108]">{selectedNode.label}</h2>
                    <p className="text-sm font-bold text-[#667085]">{selectedNode.group} · {selectedNode.description}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-4 py-2 text-sm font-black ${statusTone(selectedReport?.status ?? (canUseDraftFormForSelectedNode ? 'draft' : undefined))}`}>
                    {statusLabel(selectedReport?.status ?? (canUseDraftFormForSelectedNode ? 'draft' : undefined))}
                  </span>
                </div>
              </div>
            )}
            {renderSelectedReportForm()}
            {canSeeAll && selectedNode?.level !== 'whatsapp' && (
              <div className="tactical-glass-card rounded-3xl p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-black text-[#020108]">Preview תוצר WhatsApp</h3>
                  <div className="flex flex-wrap gap-2">
                    <GlossyButton variant={whatsappMode === 'short' ? 'orange' : 'slate'} size="sm" onClick={() => setWhatsappMode('short')}>
                      הודעה קצרה
                    </GlossyButton>
                    <GlossyButton variant={whatsappMode === 'detailed' ? 'orange' : 'slate'} size="sm" onClick={() => setWhatsappMode('detailed')}>
                      הודעה מפורטת
                    </GlossyButton>
                    <GlossyButton variant="slate" size="sm" onClick={() => void copyWhatsappText()}>
                      <Clipboard className="h-4 w-4" />
                      העתק פלט WhatsApp
                    </GlossyButton>
                  </div>
                </div>
                <textarea readOnly value={generateWhatsappText()} className="command-input min-h-40 resize-none text-sm" dir="rtl" />
              </div>
            )}
          </main>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="פורום מוביל"
        subtitle="מרכז עדכונים, סיכומי מפקדים והודעות תיאום לכלל הפלוגה"
        category="פלוגה א׳"
        actions={(
          <GlossyButton variant="slate" size="sm" onClick={() => activeTab === 'posts' ? void loadPosts() : void loadDailyReports(selectedDate)} disabled={isSubmitting || isDailySaving}>
            <RefreshCw className="h-4 w-4" />
            רענן
          </GlossyButton>
        )}
      />

      <div className="flex flex-wrap gap-2 rounded-3xl border border-[rgba(2,1,8,0.08)] bg-white/65 p-2 shadow-[0_14px_36px_rgba(2,1,8,0.05)]">
        {([
          { id: 'posts', label: 'לוח פוסטים' },
          { id: 'daily', label: 'פורום מוביל יומי' },
        ] as Array<{ id: ForumTab; label: string }>).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-black transition ${activeTab === tab.id ? 'bg-[#FF6B02] text-white shadow-[0_10px_22px_rgba(255,107,2,0.22)]' : 'text-[#667085] hover:bg-white hover:text-[#020108]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && activeTab === 'posts' && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{successMessage}</div>}

      {activeTab === 'posts' ? renderPostsTab() : renderDailyTab()}

      {showCompanyRefreshConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#020108]/40 p-4"
          dir="rtl"
          onClick={() => { if (!isCompanyReportBusy) setShowCompanyRefreshConfirm(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-refresh-title"
            aria-describedby="company-refresh-desc"
            className="tactical-glass-card w-full max-w-md rounded-3xl p-6 shadow-[0_24px_60px_rgba(2,1,8,0.25)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h3 id="company-refresh-title" className="text-lg font-black text-[#020108]">רענון הדוח הפלוגתי</h3>
                <p id="company-refresh-desc" className="mt-1 text-sm font-bold leading-relaxed text-[#667085]">
                  ערכת ידנית את הדוח הפלוגתי. רענון מהדוחות יחליף את שדות הריכוז במצב העדכני מהמ״מים (דגשי מ״פ והלו״ז הידני יישמרו). להמשיך?
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <GlossyButton variant="slate" autoFocus onClick={() => setShowCompanyRefreshConfirm(false)} disabled={isCompanyReportBusy}>
                ביטול
              </GlossyButton>
              <GlossyButton variant="orange" onClick={confirmCompanyRefresh} disabled={isCompanyReportBusy}>
                החלף ורענן
              </GlossyButton>
            </div>
          </div>
        </div>
      )}

      {showCompanyPublishConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#020108]/40 p-4"
          dir="rtl"
          onClick={() => { if (!isCompanyReportBusy) setShowCompanyPublishConfirm(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-publish-title"
            aria-describedby="company-publish-desc"
            className="tactical-glass-card w-full max-w-md rounded-3xl p-6 shadow-[0_24px_60px_rgba(2,1,8,0.25)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FF6B02]/10 text-[#FF6B02]">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 id="company-publish-title" className="text-lg font-black text-[#020108]">הפצה וסגירת פורום</h3>
                <p id="company-publish-desc" className="mt-1 text-sm font-bold leading-relaxed text-[#667085]">
                  פעולה זו תשמור את הנוסח הסופי ותסגור את כל דוחות היום לכלל הפלוגה. הדוחות ינעלו לקריאה בלבד. להמשיך?
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <GlossyButton variant="slate" autoFocus onClick={() => setShowCompanyPublishConfirm(false)} disabled={isCompanyReportBusy}>
                ביטול
              </GlossyButton>
              <GlossyButton variant="orange" onClick={() => void publishAndCloseForum()} disabled={isCompanyReportBusy}>
                הפץ וסגור
              </GlossyButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
