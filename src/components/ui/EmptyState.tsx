import React from 'react';
import { GlassCard } from './GlassCard';
import { GlossyButton } from './GlossyButton';
import { LucideIcon, HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  badgeLabel?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = HelpCircle,
  title,
  description,
  actionText,
  onAction,
  badgeLabel
}) => {
  return (
    <GlassCard className="flex flex-col items-center justify-center text-center py-14 px-6 max-w-lg mx-auto border-dashed border-[var(--border-strong)] bg-[var(--surface)]/70">
      <div className="p-4 rounded-2xl bg-[var(--brand)]/10 border border-[var(--brand)]/20 text-[var(--color-action-on-surface)] mb-4">
        <Icon className="w-10 h-10" />
      </div>

      {badgeLabel && (
        <span className="text-caption text-label-caps mb-3 rounded-full border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-3 py-1 font-semibold text-[var(--color-warning)]">
          {badgeLabel}
        </span>
      )}

      <h3 className="text-subheading mb-2 font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-body-ui mb-6 max-w-sm text-[var(--text-muted-accessible)]">
        {description}
      </p>

      {actionText && onAction && (
        <GlossyButton variant="orange" onClick={onAction}>
          {actionText}
        </GlossyButton>
      )}
    </GlassCard>
  );
};
