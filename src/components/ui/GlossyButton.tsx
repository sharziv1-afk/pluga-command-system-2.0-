import React from 'react';
import { cn } from '@/lib/utils';

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'cyan' | 'orange' | 'slate';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Legacy button API (cyan/orange/slate) kept for compatibility across screens,
 * restyled to the Light Gloss Operational tokens: accessible action colour,
 * restrained elevation, no plastic gloss overlay.
 */
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
        'touch-target relative font-bold transition duration-[var(--motion-fast)] rounded-xl cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]',

        variant === 'cyan' && 'bg-[var(--color-teal)] hover:bg-[var(--color-teal-hover)] text-white shadow-[var(--shadow-xs)] border border-transparent',
        variant === 'orange' && 'bg-[var(--action)] hover:bg-[var(--action-hover)] text-white shadow-[var(--shadow-xs)] border border-transparent',
        variant === 'slate' && 'bg-[var(--surface)] hover:border-[var(--action)]/30 hover:text-[var(--action)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-[var(--shadow-xs)]',

        size === 'sm' && 'text-xs min-h-9 px-3',
        size === 'md' && 'text-sm min-h-10 px-4',
        size === 'lg' && 'text-sm min-h-11 px-5',

        className,
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  );
};
