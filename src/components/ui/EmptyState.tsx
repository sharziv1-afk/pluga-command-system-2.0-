import React from 'react';
import { GlassCard } from './GlassCard';
import { GlossyButton } from './GlossyButton';
import { Skeleton } from './Skeleton';
import { LucideIcon, HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = HelpCircle,
  title,
  description,
  actionText,
  onAction
}) => {
  return (
    <GlassCard className="flex flex-col items-center justify-center text-center py-14 px-6 max-w-lg mx-auto border-dashed border-[rgba(2,1,8,0.12)] bg-white/70">
      <div className="p-4 rounded-2xl bg-[#FF6B02]/10 border border-[#FF6B02]/20 text-[#FF6B02] mb-4">
        <Icon className="w-10 h-10" />
      </div>

      <span className="mb-3 rounded-full border border-[#FF6B02]/20 bg-[#FF6B02]/10 px-3 py-1 text-[11px] font-black text-[#9A4600]">
        אזור עבודה בשלבי חיבור
      </span>
      
      <h3 className="text-base font-black text-[#020108] mb-2">{title}</h3>
      <p className="text-sm text-[#667085] leading-relaxed mb-6 max-w-sm">
        {description}
      </p>

      <div className="mb-6 grid w-full max-w-sm grid-cols-2 gap-2" aria-hidden="true">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      
      {actionText && onAction && (
        <GlossyButton variant="orange" onClick={onAction}>
          {actionText}
        </GlossyButton>
      )}
    </GlassCard>
  );
};
