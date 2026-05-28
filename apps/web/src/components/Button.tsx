'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12.5px]',
  md: 'h-9 px-3.5 text-[13px]',
  lg: 'h-10 px-4 text-[13.5px]',
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[var(--brand-700)] text-white hover:bg-[var(--brand-800)]',
  secondary: 'bg-white text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--bg-soft)]',
  ghost: 'text-[var(--ink)] hover:bg-[var(--bg-soft)]',
  danger: 'bg-[var(--danger)] text-white hover:opacity-90',
  success: 'bg-[var(--success)] text-white hover:opacity-90',
  outline: 'border border-[var(--brand-700)] text-[var(--brand-700)] hover:bg-[var(--brand-50)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, className = '', children, ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 13 : 14;
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {Icon ? <Icon size={iconSize} strokeWidth={1.8} /> : null}
      {children}
      {IconRight ? <IconRight size={iconSize} strokeWidth={1.8} /> : null}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  size?: number;
  tone?: 'default' | 'danger' | 'brand';
}

export function IconButton({ icon: Icon, size = 14, tone = 'default', className = '', ...rest }: IconButtonProps) {
  const tones: Record<string, string> = {
    default: 'text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]',
    danger: 'text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] hover:text-[var(--danger)]',
    brand: 'text-[var(--muted)] hover:bg-[var(--brand-50)] hover:text-[var(--brand-700)]',
  };
  return (
    <button className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${tones[tone]} ${className}`} {...rest}>
      <Icon size={size} strokeWidth={1.8} />
    </button>
  );
}
