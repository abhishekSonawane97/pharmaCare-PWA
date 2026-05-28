'use client';

export function Logomark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-label="PharmaCare">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--brand-700)" />
      <path d="M16 8.5v15M8.5 16h15" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.6" fill="var(--brand-300)" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Logomark size={size} />
      <div className="flex flex-col leading-none">
        <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.62, color: 'var(--ink)' }}>
          Pharma<span style={{ color: 'var(--brand-700)' }}>Care</span>
        </span>
        <span className="text-[10px] tracking-[0.18em] uppercase mt-0.5" style={{ color: 'var(--muted)' }}>
          Pharmacy OS
        </span>
      </div>
    </div>
  );
}
