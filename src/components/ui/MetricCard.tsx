'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'teal' | 'success' | 'warning' | 'danger' | 'info';

const toneStyles: Record<Tone, string> = {
  neutral: 'text-[var(--text-secondary)] bg-[var(--surface-muted)]',
  brand: 'text-[var(--color-action-on-surface)] bg-[var(--brand)]/10',
  teal: 'text-[var(--color-teal)] bg-[var(--color-teal)]/10',
  success: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
  warning: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
  danger: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
  info: 'text-[var(--color-info)] bg-[var(--color-info)]/10',
};

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
}

/** Uniform KPI tile — consistent density, semantic tone (no arbitrary icon colors). */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'neutral',
  onClick,
  active = false,
}) => {
  const interactive = typeof onClick === 'function';
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Wrapper
      {...(interactive ? { type: 'button', onClick } : {})}
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--surface-raised)] p-4 text-right shadow-[var(--shadow-xs)] transition',
        interactive && 'touch-target cursor-pointer hover:shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]',
        active ? 'border-[var(--action)]/40' : 'border-[var(--border-subtle)]',
      )}
    >
      {Icon && (
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneStyles[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="command-kpi text-2xl text-[var(--text-primary)]">{value}</div>
        {/* Not truncated: the label is what names the metric, and at 375px in
            a 2-column grid "דרישות דחופות" clipped to "דרישות דחו…". Grid rows
            equalise height, so wrapping costs nothing in density. The
            sublabel below is supplementary and may still clip. */}
        <div className="mt-0.5 text-meta font-bold text-balance text-[var(--text-secondary)]">{label}</div>
        {sublabel && <div className="mt-0.5 truncate text-caption font-medium text-[var(--text-muted-accessible)]">{sublabel}</div>}
      </div>
    </Wrapper>
  );
};
