'use client';

import { api, ApiError } from './api';

/**
 * Browser push helpers — registering, unregistering, and querying the
 * current state. The actual SW push event handlers live in src/app/sw.ts.
 *
 * Why all this fiddly base64 conversion: the Web Push spec requires the
 * VAPID public key to be passed to PushManager.subscribe() as a Uint8Array,
 * not a base64url string. So we convert before passing.
 */

const PUBLIC_KEY_KEY = 'pc_vapid_public_key_cache';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export interface PushSupport {
  pushApi: boolean;          // browser supports PushManager + Notification
  serviceWorker: boolean;    // SW registered
  permission: NotificationPermission;
  currentSubscription: PushSubscription | null;
}

export function isPushApiSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function checkPushSupport(): Promise<PushSupport> {
  const pushApi = isPushApiSupported();
  let serviceWorker = false;
  let permission: NotificationPermission = 'default';
  let currentSubscription: PushSubscription | null = null;

  if (pushApi) {
    permission = Notification.permission;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      serviceWorker = !!reg;
      if (reg) {
        currentSubscription = await reg.pushManager.getSubscription();
      }
    } catch { /* ignore */ }
  }
  return { pushApi, serviceWorker, permission, currentSubscription };
}

async function fetchVapidPublicKey(): Promise<string | null> {
  // Try cache first (publicKey is stable across deploys until rotated)
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(PUBLIC_KEY_KEY);
    if (cached) return cached;
  }
  try {
    const data = await api<{ publicKey: string | null; configured: boolean }>('/push/public-key', { skipAuth: true });
    if (data.publicKey && typeof window !== 'undefined') {
      sessionStorage.setItem(PUBLIC_KEY_KEY, data.publicKey);
    }
    return data.publicKey;
  } catch {
    return null;
  }
}

/**
 * Full subscribe flow: ask for permission, register with PushManager, POST to api.
 * Returns true on success. Throws if the browser denies permission or the api
 * can't be reached.
 */
export async function subscribePush(): Promise<boolean> {
  if (!isPushApiSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }
  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    throw new Error('Server has not configured push notifications yet');
  }

  // Permission must be granted explicitly
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      throw new Error('Notification permission was not granted');
    }
  } else if (Notification.permission === 'denied') {
    throw new Error(
      'Notifications are blocked for this site. Re-enable them in your browser settings to continue.'
    );
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // TS 5.7+ narrows Uint8Array's generic param to ArrayBufferLike, which
      // can include SharedArrayBuffer; PushManager only accepts BufferSource
      // backed by ArrayBuffer. Cast is safe — we always allocate a fresh
      // ArrayBuffer in urlBase64ToUint8Array.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Subscription object missing fields');
  }

  await api('/push/subscribe', {
    method: 'POST',
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
  });

  return true;
}

/**
 * Cancel the current subscription on this device.
 * Best-effort — proceeds even if the server delete fails (the SW
 * unsubscribe still happens so the browser stops receiving pushes).
 */
export async function unsubscribePush(): Promise<void> {
  if (!isPushApiSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    try {
      await api('/push/unsubscribe', { method: 'DELETE', body: { endpoint } });
    } catch (err) {
      // Ignore 404 (subscription already removed server-side)
      if (!(err instanceof ApiError) || err.status !== 404) {
        console.warn('[push] server unsubscribe failed:', err);
      }
    }
    await sub.unsubscribe();
  } catch (err) {
    console.warn('[push] unsubscribe error:', err);
  }
}
