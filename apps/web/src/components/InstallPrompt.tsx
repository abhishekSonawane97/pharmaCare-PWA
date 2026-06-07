'use client';

/**
 * "Install PharmaCare" prompt — surfaced inside the (app) layout, so only
 * authed users see it. Listens for the browser's `beforeinstallprompt` event,
 * shows a small banner with Install / Not now buttons. Dismissal sticks via
 * localStorage so the user isn't nagged.
 *
 * iOS Safari does NOT fire `beforeinstallprompt`; instead the user must do
 * Share → Add to Home Screen manually. We detect iOS standalone-capable Safari
 * and show a one-time hint pointing at that flow.
 */

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISSED_KEY = 'pc_install_dismissed_at';
const DISMISS_WINDOW_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function recentlyDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return ageDays < DISMISS_WINDOW_DAYS;
}

function dismiss(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // Android / desktop PWA
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari standalone
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua);
  // Exclude in-app browsers (FBAV, Instagram, etc.) where Add-to-Home-Screen doesn't work cleanly.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|FBAN|FBAV|Instagram/.test(ua);
  return iOS && isSafari;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    if (recentlyDismissed()) return; // user said no recently

    // Android / desktop: capture the install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari: no event fires; we show a manual hint after a short delay
    // so it doesn't compete with the page rendering.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIosSafari()) {
      iosTimer = setTimeout(() => {
        setShowIosHint(true);
        setHidden(false);
      }, 1500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setHidden(true);
      setDeferred(null);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    dismiss();
    setHidden(true);
    setDeferred(null);
    setShowIosHint(false);
  }

  if (hidden) return null;

  // Android / desktop variant
  if (deferred) {
    return (
      <div className="fixed bottom-3 left-3 right-3 z-50 md:left-auto md:right-4 md:bottom-4 md:max-w-sm">
        <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center shrink-0">
            <Download size={16} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[var(--ink)]">Install PharmaCare</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5 leading-snug">
              Get a home-screen icon and a fullscreen, app-like experience.
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={install}
                className="h-8 px-3 rounded-md bg-[var(--brand-700)] text-white text-[12.5px] font-medium hover:bg-[var(--brand-800)] transition-colors"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="h-8 px-3 rounded-md border border-[var(--border)] text-[12.5px] text-[var(--ink-2)] hover:bg-[var(--bg-soft)] transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-[var(--muted)] hover:text-[var(--ink)] shrink-0 -mt-0.5 -mr-0.5"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari variant — manual instructions
  if (showIosHint) {
    return (
      <div className="fixed bottom-3 left-3 right-3 z-50 md:left-auto md:right-4 md:bottom-4 md:max-w-sm">
        <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg p-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center shrink-0">
            <Share size={16} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[var(--ink)]">Add PharmaCare to your home screen</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5 leading-snug">
              Tap the Share icon in Safari, then <span className="font-medium text-[var(--ink-2)]">Add to Home Screen</span>.
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={handleDismiss}
                className="h-8 px-3 rounded-md border border-[var(--border)] text-[12.5px] text-[var(--ink-2)] hover:bg-[var(--bg-soft)] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-[var(--muted)] hover:text-[var(--ink)] shrink-0 -mt-0.5 -mr-0.5"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
