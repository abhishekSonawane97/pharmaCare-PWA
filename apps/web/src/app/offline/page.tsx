'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCcw } from 'lucide-react';

/**
 * Offline fallback page — shown by the service worker when a navigation
 * request fails (no network, no cached HTML for this route). Most cached
 * routes will still load while offline; this is the safety net.
 *
 * It's a normal Next.js page; it has to render without any API access
 * because by definition we have no network when it shows.
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center bg-[var(--brand-50)] text-[var(--brand-700)]">
          <WifiOff size={28} strokeWidth={1.7} />
        </div>
        <h1 className="text-[20px] font-semibold tracking-tight text-[var(--ink)]">
          You're offline
        </h1>
        <p className="text-[13.5px] text-[var(--muted)] mt-2 leading-relaxed">
          This page hasn't been visited yet, so we couldn't load it from cache.
          Anything you've opened before is still available — head back and try
          again once you're connected.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            disabled={!online}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-[var(--brand-700)] text-white text-[12.5px] font-medium hover:bg-[var(--brand-800)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCcw size={13} strokeWidth={1.9} />
            {online ? 'Retry' : 'Waiting for network…'}
          </button>
          <button
            onClick={() => window.history.back()}
            className="h-9 px-3.5 rounded-md border border-[var(--border)] text-[12.5px] text-[var(--ink-2)] hover:bg-[var(--bg-soft)] transition-colors"
          >
            Go back
          </button>
        </div>
        <div className="mt-5 text-[11.5px] text-[var(--muted)]">
          {online ? 'Connected — you can retry now.' : 'Disconnected.'}
        </div>
      </div>
    </div>
  );
}
