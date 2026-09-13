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
  /** Restricted to company command roles (מ״פ / סמ״פ). */
  adminOnly?: boolean;
  /** Restricted to the מ״פ only — not even סמ״פ. */
  commanderOnly?: boolean;
}

/**
 * Order matters and is not cosmetic: the mobile bottom nav renders this list
 * as one scrollable row, so whatever sits at the top here is what a
 * commander can reach without scrolling. The first four are the
 * everyday screens; reordering this array reorders that row.
 */
export const navigationItems: NavItem[] = [
  { name: 'לוח מפקד', path: '/dashboard', icon: LayoutDashboard },
  { name: 'משימות ובקרה', path: '/tasks', icon: CheckSquare },
  { name: 'דרישות', path: '/requests', icon: Truck },
  { name: 'פורום מוביל', path: '/forum', icon: MessageSquare },
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
