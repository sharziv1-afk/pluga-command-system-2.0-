'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CommandButton } from './CommandButton';

type OverlayVariant = 'dialog' | 'sheet';

interface CommandOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: OverlayVariant;
  className?: string;
  /** When false, backdrop click / Escape will not close (e.g. unsaved guard handled by caller). */
  dismissible?: boolean;
  /**
   * id of an element inside `children` that describes the dialog, for callers
   * that render their own description body instead of passing `description`.
   * Without it such a dialog exposes no accessible description at all.
   */
  describedById?: string;
}

/**
 * Accessible modal built on the native <dialog> element:
 * focus trap, Escape-to-close, top-layer stacking and implicit aria-modal
 * come from the platform — no dependency, RTL-safe.
 * variant="sheet" renders a side sheet (desktop) / bottom sheet (mobile).
 */
export const CommandOverlay: React.FC<CommandOverlayProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'dialog',
  className,
  dismissible = true,
  describedById,
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissible) onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (!dialog.open || event.key !== 'Escape' || !dismissible) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    const handleClose = () => {
      document.body.style.overflow = '';
    };
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('keydown', handleEscape, true);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('keydown', handleEscape, true);
      dialog.removeEventListener('close', handleClose);
      document.body.style.overflow = '';
    };
  }, [onClose, dismissible]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current && dismissible) onClose();
  };

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : describedById}
      className={cn('command-overlay', variant === 'sheet' ? 'command-sheet' : 'command-dialog', className)}
    >
      <div className={cn('flex max-h-[inherit] flex-col', variant === 'sheet' && 'h-full')} dir="rtl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
            {description && (
              <p id={descId} className="mt-1 text-meta leading-relaxed text-[var(--text-muted-accessible)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="touch-target -me-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted-accessible)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', variant === 'sheet' && 'custom-scrollbar')}>
          {children}
        </div>

        {footer && (
          <footer className="safe-bottom flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
};

interface CommandConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}

/** In-app confirm dialog — replaces native window.confirm for a consistent, accessible flow. */
export const CommandConfirmDialog: React.FC<CommandConfirmDialogProps> = ({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  destructive = false,
  loading = false,
}) => {
  const descriptionId = useId();
  // While the confirmed action is in flight, every dismissal path has to be
  // shut — not just the footer buttons. `dismissible={false}` blocks Escape
  // and the backdrop; the guarded onClose blocks the header's X button, which
  // calls onClose directly. Without this, hitting Escape mid-publish hides the
  // dialog while publishAndCloseForum is still closing the company's reports.
  const handleClose = () => {
    if (!loading) onCancel();
  };

  return (
    <CommandOverlay
      open={open}
      onClose={handleClose}
      dismissible={!loading}
      describedById={descriptionId}
      title={title}
      variant="dialog"
      footer={
        <>
          <CommandButton variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </CommandButton>
          <CommandButton
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </CommandButton>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {destructive && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
            <AlertTriangle className="h-5 w-5" />
          </span>
        )}
        <div id={descriptionId} className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {description}
        </div>
      </div>
    </CommandOverlay>
  );
};
