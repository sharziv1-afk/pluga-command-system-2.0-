import React from 'react';
import { CommandButton } from './CommandButton';

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'cyan' | 'orange' | 'slate';
  size?: 'sm' | 'md' | 'lg';
}

const VARIANT_MAP = {
  cyan: 'teal',
  orange: 'primary',
  slate: 'subtle',
} as const;

/**
 * Legacy button API (cyan/orange/slate) kept for the 13 call sites that use
 * it — DESIGN.md §3.1 makes CommandButton the one styling implementation;
 * this is a thin prop-mapping wrapper, not a second button system. New code
 * should use CommandButton directly.
 */
export const GlossyButton: React.FC<GlossyButtonProps> = ({
  children,
  variant = 'cyan',
  size = 'md',
  ...props
}) => {
  return (
    <CommandButton variant={VARIANT_MAP[variant]} size={size} {...props}>
      {children}
    </CommandButton>
  );
};
