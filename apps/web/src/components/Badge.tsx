'use client';
import { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--bg-soft)] text-[var(--ink-2)] border-[var(--border)]',
  brand: 'bg-[var(--brand-50)] text-[var(--brand-800)] border-[var(--brand-100)]',
  success:
    'bg-[color-mix(in_oklab,var(--success)_10%,transparent)] text-[var(--success-ink)] border-[color-mix(in_oklab,var(--success)_22%,transparent)]',
  warning:
    'bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] text-[var(--warning-ink)] border-[color-mix(in_oklab,var(--warning)_25%,transparent)]',
  danger:
    'bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)] border-[color-mix(in_oklab,var(--danger)_22%,transparent)]',
};

export function Badge({ tone = 'neutral', children, dot = false }: { tone?: BadgeTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] border text-[11px] font-medium tracking-tight whitespace-nowrap ${tones[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
