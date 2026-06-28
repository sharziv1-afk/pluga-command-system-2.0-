import {
  CalendarClock,
  CheckSquare,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Shield,
  Table2,
  Truck,
  User,
} from 'lucide-react';

export const navigationItems = [
  {
    name: 'לוח מפקד',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'משימות ובקרה',
    path: '/tasks',
    icon: CheckSquare,
  },
  {
    name: 'לו״ז',
    path: '/schedule',
    icon: CalendarClock,
  },
  {
    name: 'דרישות לוגיסטיקה',
    path: '/requests',
    icon: Truck,
  },
  {
    name: 'פורום מוביל',
    path: '/forum',
    icon: MessageSquare,
  },
  {
    name: 'מעקב',
    path: '/tracking',
    icon: Table2,
  },
  {
    name: 'אישור משתמשים',
    path: '/admin',
    icon: Shield,
  },
  {
    name: 'פרופיל אישי',
    path: '/profile',
    icon: User,
  },
  {
    name: 'עזרה ומדריך',
    path: '/help',
    icon: HelpCircle,
  },
];
