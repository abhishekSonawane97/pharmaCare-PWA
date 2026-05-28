'use client';
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1.5">{eyebrow}</div>}
        <h1 className="text-[20px] md:text-[22px] font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {subtitle && <p className="text-[13px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--bg-soft)] flex items-center justify-center text-[var(--muted)] mb-3">
        {Icon ? <Icon size={20} strokeWidth={1.6} /> : null}
      </div>
      <div className="text-[14px] font-medium text-[var(--ink)]">{title}</div>
      {body && <div className="text-[12.5px] text-[var(--muted)] mt-1 max-w-xs">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
