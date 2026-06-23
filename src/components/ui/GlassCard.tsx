import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: 'cyan' | 'orange' | 'none';
  glossHighlight?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glow = 'none',
  glossHighlight = true,
  ...props
}) => {
  return (
    <div
      className={cn(
        "tactical-glass-card p-4 sm:p-5",
        glossHighlight && "tactical-gloss-highlight",
        glow === 'cyan' && "tactical-glow-cyan",
        glow === 'orange' && "tactical-glow-orange",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
