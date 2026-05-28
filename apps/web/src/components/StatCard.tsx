'use client';
import type { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

type Tone = 'neutral' | 'warning' | 'danger' | 'success';

const tones: Record<Tone, { ic: string }> = {
  neutral: { ic: 'text-[var(--brand-700)] bg-[var(--brand-50)]' },
  warning: { ic: 'text-[var(--warning-ink)] bg-[color-mix(in_oklab,var(--warning)_14%,transparent)]' },
  danger: { ic: 'text-[var(--danger-ink)] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]' },
  success: { ic: 'text-[var(--success-ink)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)]' },
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  trend,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  trend?: ReactNode;
}) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tones[tone].ic}`}>
          <Icon size={14} strokeWidth={1.7} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-[28px] font-semibold tracking-tight text-[var(--ink)] tabular-nums">{value}</div>
        {trend && <div className="text-[11.5px] text-[var(--muted)]">{trend}</div>}
      </div>
      {sub && <div className="text-[12px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}
