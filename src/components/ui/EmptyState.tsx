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
    <GlassCard className="flex flex-col items-center justify-center text-center py-14 px-6 max-w-lg mx-auto border-dashed border-[rgba(2,1,8,0.12)] bg-white/70">
      <div className="p-4 rounded-2xl bg-[#FF6B02]/10 border border-[#FF6B02]/20 text-[#FF6B02] mb-4">
        <Icon className="w-10 h-10" />
      </div>

      {badgeLabel && (
        <span className="mb-3 rounded-full border border-[#FF6B02]/20 bg-[#FF6B02]/10 px-3 py-1 text-[11px] font-black text-[#9A4600]">
          {badgeLabel}
        </span>
      )}

      <h3 className="text-base font-black text-[#020108] mb-2">{title}</h3>
      <p className="text-sm text-[#667085] leading-relaxed mb-6 max-w-sm">
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
