import React from 'react';
import { cn } from '@/lib/utils';
import { accountStatusLabels, statusTones, toneClasses } from '@/lib/statusLabels';

export type BadgeStatusType =
  | 'חדש'
  | 'דחוף'
  | 'קריטי'
  | 'בתהליך'
  | 'ממתין לאישור'
  | 'הושלם'
  | 'תקוע'
  | 'בוטל'
  | 'פתוח'
  | 'נסגר'
  | 'בטיפול'
  | 'נפתחה'
  | 'סופק'
  | 'approved'
  | 'pending'
  | 'rejected'
  | string;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatusType;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  ...props
}) => {
  const normalizedStatus = normalizeStatus(status);

  return (
    <span
      className={cn(
        'text-caption inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 font-semibold',
        getStatusStyles(normalizedStatus),
        className
      )}
      {...props}
    >
      {normalizedStatus}
    </span>
  );
};

// Any raw value that reaches this component must map to Hebrew. The default
// branch renders the value as-is, so an unmapped English status (account
// status was the case: /profile showed a literal "active"/"blocked") leaks
// straight to the user.
function normalizeStatus(status: string) {
  return accountStatusLabels[status] ?? status;
}

function getStatusStyles(status: string) {
  return toneClasses[statusTones[status] ?? 'neutral'];
}
