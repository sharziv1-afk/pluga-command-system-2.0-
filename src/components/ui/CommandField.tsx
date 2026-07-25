'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  errorId?: string;
  hintId?: string;
  children: React.ReactNode;
}

const FieldShell: React.FC<FieldShellProps> = ({ label, htmlFor, required, hint, error, errorId, hintId, children }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-[13px] font-bold text-[var(--text-primary)]">
      {label}
      {required && <span className="text-[var(--color-danger)]" aria-hidden> *</span>}
    </label>
    {children}
    {hint && !error && <p id={hintId} className="text-[11px] leading-relaxed text-[var(--text-muted-accessible)]">{hint}</p>}
    {error && <p id={errorId} className="text-[11px] font-semibold text-[var(--color-danger)]" role="alert">{error}</p>}
  </div>
);

const controlBase =
  'w-full min-h-11 rounded-[var(--radius-md)] border bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] text-right outline-none transition ' +
  'placeholder:text-[var(--text-muted-accessible)] focus-visible:border-[var(--action)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]';

function describedBy(error?: string, hint?: string, errorId?: string, hintId?: string) {
  if (error) return errorId;
  if (hint) return hintId;
  return undefined;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
}

export const CommandInput: React.FC<InputProps> = ({ label, required, hint, error, id, className, ...props }) => {
  const auto = useId();
  const fieldId = id ?? auto;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} hint={hint} error={error} errorId={errorId} hintId={hintId}>
      <input
        id={fieldId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, hint, errorId, hintId)}
        className={cn(controlBase, error && 'border-[var(--color-danger)]', !error && 'border-[var(--border-strong)]', className)}
        {...props}
      />
    </FieldShell>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
}

export const CommandTextarea: React.FC<TextareaProps> = ({ label, required, hint, error, id, className, rows = 4, ...props }) => {
  const auto = useId();
  const fieldId = id ?? auto;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} hint={hint} error={error} errorId={errorId} hintId={hintId}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, hint, errorId, hintId)}
        className={cn(controlBase, 'min-h-24 resize-y leading-relaxed', error && 'border-[var(--color-danger)]', !error && 'border-[var(--border-strong)]', className)}
        {...props}
      />
    </FieldShell>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export const CommandSelect: React.FC<SelectProps> = ({ label, required, hint, error, id, className, children, ...props }) => {
  const auto = useId();
  const fieldId = id ?? auto;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} hint={hint} error={error} errorId={errorId} hintId={hintId}>
      <select
        id={fieldId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, hint, errorId, hintId)}
        className={cn(controlBase, 'appearance-none', error && 'border-[var(--color-danger)]', !error && 'border-[var(--border-strong)]', className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
};
