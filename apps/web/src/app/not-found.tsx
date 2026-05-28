import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--muted)]">404</div>
      <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)] mt-2">Page not found</h1>
      <p className="text-[13px] text-[var(--muted)] mt-2 max-w-sm">
        The page you tried to open doesn&rsquo;t exist or has been moved.
      </p>
      <Link href="/" className="mt-6 text-[13px] text-[var(--brand-700)] hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
