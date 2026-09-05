import React from 'react';
import { cn } from '@/lib/utils';

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

function normalizeStatus(status: string) {
  switch (status) {
    case 'approved':
      return 'הושלם';
    case 'pending':
      return 'ממתין לאישור';
    case 'rejected':
      return 'בוטל';
    default:
      return status;
  }
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'הושלם':
    case 'סופק':
    case 'נסגר':
      return 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/25';
    case 'בתהליך':
    case 'בטיפול':
      return 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/25';
    case 'חדש':
    case 'פתוח':
    case 'נפתחה':
      return 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-strong)]';
    case 'ממתין לאישור':
      return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/25';
    case 'דחוף':
    case 'קריטי':
    case 'תקוע':
      return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/25';
    case 'בוטל':
      return 'bg-[var(--surface-muted)] text-[var(--text-muted-accessible)] border-[var(--border-subtle)]';
    default:
      return 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-strong)]';
  }
}
