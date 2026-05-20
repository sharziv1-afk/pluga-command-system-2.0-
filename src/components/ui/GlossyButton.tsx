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
        "relative overflow-hidden font-bold transition-all duration-300 rounded-xl cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-slate-950 flex items-center justify-center gap-2",
        
        // Variants
        variant === 'cyan' && "bg-[#00e5ff] hover:bg-[#00d4eb] shadow-[0_0_12px_rgba(0,229,255,0.25)] border border-[#00e5ff]/50",
        variant === 'orange' && "bg-[#ff6b02] hover:bg-[#ee6300] shadow-[0_0_12px_rgba(255,107,2,0.25)] border border-[#ff6b02]/50 text-slate-950",
        variant === 'slate' && "bg-white hover:bg-slate-50 text-slate-950 border border-slate-300/80 hover:border-slate-400/80 shadow-md",
        
        // Sizes
        size === 'sm' && "text-[10px] py-1 px-3 rounded-lg",
        size === 'md' && "text-xs py-2 px-5 rounded-xl",
        size === 'lg' && "text-sm py-2.5 px-6 rounded-xl",
        
        className
      )}
      {...props}
    >
      {/* Gloss overlay */}
      <span className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  );
};
