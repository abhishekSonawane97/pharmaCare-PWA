'use client';

import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  error?: string | boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon: Icon, error, className = '', ...rest },
  ref,
) {
  return (
    <div className="relative w-full">
      {Icon && <Icon size={14} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />}
      <input
        ref={ref}
        className={`w-full h-9 ${Icon ? 'pl-8' : 'pl-3'} pr-3 rounded-md border bg-white text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] outline-none transition-colors ${
          error
            ? 'border-[var(--danger)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--danger)_22%,transparent)]'
            : 'border-[var(--border)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)]'
        } ${className}`}
        {...rest}
      />
    </div>
  );
});

export function Select({ children, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={`appearance-none h-9 pl-3 pr-8 rounded-md border border-[var(--border)] bg-white text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)] ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown size={13} strokeWidth={1.8} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
    </div>
  );
}

export function Textarea({ rows = 3, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={`w-full px-3 py-2 rounded-md border border-[var(--border)] bg-white text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)] resize-none ${className}`}
      {...rest}
    />
  );
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className = '' }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
        {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
      </span>
      {children}
      {hint && !error && <span className="text-[11.5px] text-[var(--muted)]">{hint}</span>}
      {error && <span className="text-[11.5px] text-[var(--danger)]">{error}</span>}
    </label>
  );
}
