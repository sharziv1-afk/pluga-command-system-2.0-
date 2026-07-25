import React from 'react';
import { Shield } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  category?: string;
  brief?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  category = "מפקדת פלוגה ג'",
  brief,
  actions,
}) => {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted-accessible)]">
          <Shield className="h-3.5 w-3.5 text-[var(--color-action-on-surface)]" />
          <span>{category}</span>
          <span aria-hidden>·</span>
          <span className="text-[var(--color-action-on-surface)]">{title}</span>
        </div>

        <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)] sm:text-sm">{subtitle}</p>
        {brief && (
          <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-[var(--text-secondary)]">
            {brief}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 self-start md:self-end">
          {actions}
        </div>
      )}
    </div>
  );
};
