'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'teal' | 'ghost' | 'subtle' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const base =
  'touch-target relative inline-flex items-center justify-center gap-2 rounded-xl font-bold select-none transition ' +
  'duration-[var(--motion-fast)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--action)] text-white shadow-[var(--shadow-xs)] hover:bg-[var(--action-hover)]',
  teal:
    'bg-[var(--color-teal)] text-white shadow-[var(--shadow-xs)] hover:bg-[var(--color-teal-hover)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]',
  subtle:
    'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-[var(--shadow-xs)] hover:border-[var(--action)] hover:text-[var(--color-action-on-surface)]',
  // --color-danger-solid, not --color-danger: the latter is the on-surface ink
  // that lightens in dark mode for text-on-tint, which would leave this
  // button's white label at ~2:1. This one backs white text in every theme.
  danger:
    'bg-[var(--color-danger-solid)] text-white shadow-[var(--shadow-xs)] hover:brightness-95',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-sm',
};

export const CommandButton = React.forwardRef<HTMLButtonElement, CommandButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
        {children && <span>{children}</span>}
      </button>
    );
  },
);
CommandButton.displayName = 'CommandButton';
