'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';

/**
 * Detects when a new service worker version has been installed and is
 * waiting to activate. Shows a small banner with a "Reload" button that
 * activates the new SW and refreshes the page.
 *
 * Serwist's SW uses `skipWaiting + clientsClaim`, so technically the new
 * SW activates immediately on next page load. But existing open tabs
 * still run on the OLD bundled JS until they reload. This banner makes
 * that reload explicit and one-tap rather than silent.
 *
 * If the user dismisses, we don't auto-show again until the *next* new
 * SW arrives. (A new `controllerchange` fires for each new SW activation.)
 */
export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    // When the controlling SW changes (i.e. a new SW took over), prompt to reload.
    const onControllerChange = () => {
      if (cancelled) return;
      // Avoid prompting on the very first SW install (no previous controller)
      // — the page just loaded fresh, no stale JS yet.
      if (!document.querySelector('meta[name="sw-first-control"]')) {
        const tag = document.createElement('meta');
        tag.setAttribute('name', 'sw-first-control');
        document.head.appendChild(tag);
        return;
      }
      setUpdateAvailable(true);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Also detect a waiting SW that's installed but hasn't taken over yet
    // (in case the user landed on the page before skipWaiting fired).
    navigator.serviceWorker.getRegistration().then(reg => {
      if (cancelled || !reg) return;
      if (reg.waiting) setUpdateAvailable(true);
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    }).catch(() => { /* ignore */ });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 left-3 right-3 z-[60] md:left-auto md:right-4 md:max-w-sm"
    >
      <div className="bg-[var(--ink)] text-white rounded-lg shadow-lg p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center shrink-0">
          <RefreshCcw size={15} strokeWidth={1.9} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold">A new version is available</div>
          <div className="text-[11px] opacity-80 mt-0.5">
            Reload to get the latest. Your unsaved changes will be lost.
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="h-8 px-3 rounded-md bg-white text-[var(--ink)] text-[12px] font-medium hover:bg-white/90 transition-colors shrink-0"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
