'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { checkPushSupport, subscribePush } from '@/lib/push';
import { useToast } from '@/components/Toast';

/**
 * Non-intrusive opt-in for daily reminder notifications.
 *
 * Where: on the Reminders page (so we're asking right where the value
 * shows up — "want this list to ping you daily?").
 *
 * When: only if push is supported AND not already subscribed AND the user
 * hasn't dismissed recently AND notifications aren't already denied.
 *
 * UX:
 *   - First show: small card with Enable / Not now buttons. Tapping Enable
 *     fires the browser permission prompt, then POSTs the subscription.
 *   - Dismissal sticks for 30 days via localStorage.
 *   - Already-subscribed state: hidden (user can manage subscriptions
 *     from a future Settings page if needed).
 */

const DISMISSED_KEY = 'pc_push_dismissed_at';
const DISMISS_WINDOW_DAYS = 30;

function recentlyDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return ageDays < DISMISS_WINDOW_DAYS;
}

function rememberDismiss() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}

export function PushPermissionPrompt() {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (recentlyDismissed()) return;
    let cancelled = false;
    (async () => {
      const s = await checkPushSupport();
      if (cancelled) return;
      if (!s.pushApi) return;
      if (s.permission === 'denied') return;     // already denied permanently — no point asking
      if (s.currentSubscription) return;          // already subscribed
      // Don't fire the moment the page mounts — wait a beat so the user
      // sees the actual Reminders content first.
      const timer = setTimeout(() => { if (!cancelled) setShow(true); }, 1200);
      return () => clearTimeout(timer);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      await subscribePush();
      toast({ message: 'Notifications enabled — you\'ll be pinged at 10 AM daily', tone: 'success' });
      setShow(false);
    } catch (err: any) {
      toast({ message: err?.message || 'Could not enable notifications', tone: 'danger' });
      // Don't auto-dismiss on failure — let the user retry or close manually.
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    rememberDismiss();
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mb-4 bg-white border border-[var(--border)] rounded-lg p-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-md bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center shrink-0">
        <Bell size={16} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[var(--ink)]">
          Get reminded daily
        </div>
        <div className="text-[12px] text-[var(--muted)] mt-0.5 leading-snug">
          We'll send a push notification each morning summarizing which customers
          are due that day. You can disable this anytime.
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={handleEnable}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--brand-700)] text-white text-[12.5px] font-medium hover:bg-[var(--brand-800)] disabled:opacity-60 transition-colors"
          >
            <Bell size={12} strokeWidth={2} />
            {busy ? 'Enabling…' : 'Enable notifications'}
          </button>
          <button
            onClick={handleDismiss}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[var(--border)] text-[12.5px] text-[var(--ink-2)] hover:bg-[var(--bg-soft)] transition-colors"
          >
            <BellOff size={12} strokeWidth={1.8} />
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
  );
}
