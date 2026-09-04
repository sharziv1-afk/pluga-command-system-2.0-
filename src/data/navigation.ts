import {
  CalendarClock,
  CheckSquare,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Shield,
  Table2,
  Truck,
  User,
} from 'lucide-react';

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom navigation (max 4 + "More"). */
  primary?: boolean;
  /** Restricted to company command roles (מ״פ / סמ״פ). */
  adminOnly?: boolean;
  /** Restricted to the מ״פ only — not even סמ״פ. */
  commanderOnly?: boolean;
}

export const navigationItems: NavItem[] = [
  { name: 'לוח מפקד', path: '/dashboard', icon: LayoutDashboard, primary: true },
  { name: 'משימות ובקרה', path: '/tasks', icon: CheckSquare, primary: true },
  { name: 'פערים ודרישות', path: '/requests', icon: Truck, primary: true },
  { name: 'פורום מוביל', path: '/forum', icon: MessageSquare, primary: true },
  { name: 'לו״ז', path: '/schedule', icon: CalendarClock },
  { name: 'מעקב', path: '/tracking', icon: Table2 },
  { name: 'חניכה', path: '/mentoring', icon: GraduationCap, commanderOnly: true },
  { name: 'אישור משתמשים', path: '/admin', icon: Shield, adminOnly: true },
  { name: 'פרופיל אישי', path: '/profile', icon: User },
  { name: 'עזרה ומדריך', path: '/help', icon: HelpCircle },
];

/** Nav items visible to a user, filtered by admin/commander access. */
export function visibleNavItems(isAdmin: boolean, isCompanyCommander = false): NavItem[] {
  return navigationItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.commanderOnly || isCompanyCommander));
}

/** Bottom-nav layout: up to 4 primary items; everything else lives under "More". */
export function bottomNavSplit(isAdmin: boolean, isCompanyCommander = false): { primary: NavItem[]; more: NavItem[] } {
  const items = visibleNavItems(isAdmin, isCompanyCommander);
  return {
    primary: items.filter((item) => item.primary).slice(0, 4),
    more: items.filter((item) => !item.primary),
  };
}
