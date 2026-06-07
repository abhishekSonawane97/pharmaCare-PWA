'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * A thin top strip that appears whenever the browser reports we're offline.
 * Disappears the moment we're back online. Subscribes to the `online` /
 * `offline` window events plus initializes from `navigator.onLine`.
 *
 * The service worker (sw.ts) handles the actual offline UX:
 *   - Reads still work from cache (StaleWhileRevalidate)
 *   - Writes are queued via Background Sync, replayed on reconnect
 *
 * This banner is purely a visual cue so the pharmacist isn't confused when
 * "Save" appears to succeed but the change hasn't propagated yet.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  // Avoid SSR/CSR mismatch by only rendering once mounted on client
  if (!mounted || online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-3 py-1.5 text-[12px] font-medium text-white"
      style={{ background: 'var(--danger, #b3261e)' }}
    >
      <WifiOff size={12} strokeWidth={2} />
      <span>You're offline — changes will sync when reconnected.</span>
    </div>
  );
}
