'use client';
import { initials } from '@/lib/format';

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const fontSize = size <= 28 ? 11 : size <= 36 ? 12.5 : 14;
  return (
    <div
      className="rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center font-medium shrink-0"
      style={{ width: size, height: size, fontSize }}
    >
      {initials(name) || '?'}
    </div>
  );
}
