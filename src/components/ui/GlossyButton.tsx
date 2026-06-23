import React from 'react';
import { cn } from '@/lib/utils';

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'cyan' | 'orange' | 'slate';
  size?: 'sm' | 'md' | 'lg';
}

export const GlossyButton: React.FC<GlossyButtonProps> = ({
  children,
  className,
  variant = 'cyan',
  size = 'md',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={cn(
        "relative overflow-hidden font-bold transition-all duration-150 rounded-2xl cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6B02]/20",
        
        // Variants
        variant === 'cyan' && "bg-[#0F766E] hover:bg-[#115E59] text-white shadow-[0_12px_26px_rgba(15,118,110,0.16)] border border-[#0F766E]/40",
        variant === 'orange' && "bg-[#FF6B02] hover:bg-[#E65F00] text-white shadow-[0_14px_28px_rgba(255,107,2,0.24)] border border-[#FF6B02]/45",
        variant === 'slate' && "bg-white/76 hover:bg-[#FF6B02]/10 text-[#020108] border border-[rgba(2,1,8,0.10)] hover:border-[#FF6B02]/30 shadow-[0_10px_24px_rgba(2,1,8,0.06)] backdrop-blur-xl",
        
        // Sizes
        size === 'sm' && "text-xs min-h-9 px-3 rounded-xl",
        size === 'md' && "text-sm min-h-10 px-4 rounded-xl",
        size === 'lg' && "text-sm min-h-11 px-5 rounded-2xl",
        
        className
      )}
      {...props}
    >
      {/* Gloss overlay */}
      <span className="absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  );
};
