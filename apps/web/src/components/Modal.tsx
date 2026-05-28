'use client';

import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton, Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-[rgba(14,27,34,0.32)] backdrop-blur-[2px]" />
      <div
        className={`relative w-full ${sizes} bg-white rounded-xl border border-[var(--border)] shadow-[0_24px_60px_-20px_rgba(14,27,34,0.35)] overflow-hidden`}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <div>
            <div className="text-[15px] font-semibold text-[var(--ink)] tracking-tight">{title}</div>
            {subtitle && <div className="text-[12.5px] text-[var(--muted)] mt-0.5">{subtitle}</div>}
          </div>
          {onClose && <IconButton icon={X} onClick={onClose} aria-label="Close" />}
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-soft)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger' }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13px] text-[var(--ink-2)] leading-relaxed">{message}</div>
    </Modal>
  );
}
