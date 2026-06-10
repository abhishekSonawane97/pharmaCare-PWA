/// <reference lib="webworker" />
/**
 * Service worker entry — built by Serwist at production build time
 * (next.config.js wraps the Next config with @serwist/next).
 *
 * Phase 2: explicit per-route runtime caching strategies. Read paths are
 * served from cache while offline; writes are queued via the Background
 * Sync API and replayed automatically when connectivity returns.
 *
 * Order of `runtimeCaching` matters — matchers are evaluated top-to-bottom,
 * first match wins. So: auth routes first (NetworkOnly), then writes
 * (NetworkOnly + BackgroundSync), then API reads, then static assets, then
 * navigation. The `fallbacks` config below catches navigation requests that
 * fail in offline mode and serves `/offline` instead.
 */

import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  Serwist,
  NetworkFirst,
  NetworkOnly,
  CacheFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
  BackgroundSyncPlugin,
  CacheableResponsePlugin,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const THIRTY_DAYS = 30 * ONE_DAY;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,

  runtimeCaching: [
    // 1) Auth flows — never cache. The /api proxy may be on a different
    //    host in dev (http://api:4000) but in the deployed app both web
    //    and api share the same origin via Caddy, so a relative path
    //    matcher catches both.
    {
      matcher: /\/api\/auth\/(login|refresh|logout|signup)$/,
      handler: new NetworkOnly(),
    },

    // 2) All non-GET API requests — queue for retry when offline.
    //    Background Sync replays them when connectivity returns.
    {
      matcher: ({ request, url }) =>
        url.pathname.startsWith('/api/') && request.method !== 'GET',
      handler: new NetworkOnly({
        plugins: [
          new BackgroundSyncPlugin('pharmacare-write-queue', {
            maxRetentionTime: 24 * 60, // minutes — keep retrying for 24h
          }),
        ],
      }),
    },

    // 3) API read paths — stale-while-revalidate. Show the cached response
    //    instantly, refresh in the background. Adequate for customer lists,
    //    medicines, today's reminders queue.
    {
      matcher: ({ url }) =>
        url.pathname === '/api/auth/me' ||
        url.pathname.startsWith('/api/dashboard') ||
        url.pathname.startsWith('/api/customers') ||
        url.pathname.startsWith('/api/medicines') ||
        url.pathname.startsWith('/api/reminders') ||
        url.pathname.startsWith('/api/payments') ||
        url.pathname.startsWith('/api/activity') ||
        url.pathname.startsWith('/api/employees') ||
        url.pathname.startsWith('/api/settings'),
      method: 'GET',
      handler: new StaleWhileRevalidate({
        cacheName: 'api-read',
        plugins: [
          // Only cache successful responses — never cache a 401/403/500 which
          // would lock the user out of the read path even after they reconnect.
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxAgeSeconds: ONE_HOUR,
            maxEntries: 50,
          }),
        ],
      }),
    },

    // 4) Next.js static chunks — hash-named, immutable. Cache-first, long TTL.
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'next-static',
        plugins: [
          new ExpirationPlugin({
            maxAgeSeconds: THIRTY_DAYS,
            maxEntries: 64,
          }),
        ],
      }),
    },

    // 5) Generic static assets (icons, manifest, public files) — cache-first.
    {
      matcher: ({ request, url }) =>
        request.destination === 'image' ||
        url.pathname.startsWith('/icons/') ||
        url.pathname.endsWith('.webmanifest'),
      handler: new CacheFirst({
        cacheName: 'static-assets',
        plugins: [
          new ExpirationPlugin({
            maxAgeSeconds: THIRTY_DAYS,
            maxEntries: 32,
          }),
        ],
      }),
    },

    // 6) Google Fonts CSS — network-first (the URL is rotational by font version)
    {
      matcher: ({ url }) => url.origin === 'https://fonts.googleapis.com',
      handler: new StaleWhileRevalidate({
        cacheName: 'gfonts-css',
        plugins: [
          new ExpirationPlugin({ maxAgeSeconds: THIRTY_DAYS, maxEntries: 8 }),
        ],
      }),
    },

    // 7) Google Fonts files — cache-first (immutable woff2 files)
    {
      matcher: ({ url }) => url.origin === 'https://fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'gfonts-files',
        plugins: [
          new ExpirationPlugin({ maxAgeSeconds: THIRTY_DAYS, maxEntries: 16 }),
        ],
      }),
    },

    // 8) Navigation requests (HTML pages) — network-first with a 3s timeout.
    //    Falls back to cache when slow or offline. The `fallbacks` config
    //    below catches the case where neither network nor cache has it.
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({ maxAgeSeconds: ONE_DAY, maxEntries: 32 }),
        ],
      }),
    },
  ],

  // Offline fallback for navigation requests that have no cached version
  // and no network access. Visitors see the friendly /offline page.
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();

// ─── Push notifications (Phase 4) ────────────────────────────────────────
//
// The api sends a JSON payload via web-push; this SW receives it, displays
// a system notification, and (on tap) opens / focuses the relevant page.
//
// Payload shape (matches services/pushNotifications.ts PushPayload):
//   { title, body, url?, tag?, icon?, badge? }

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: any = {};
  try { payload = event.data.json(); } catch { payload = { title: event.data.text() }; }

  const title = payload.title || 'PharmaCare';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag,                  // replaces previous notification with same tag
    data: { url: payload.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl: string = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If the PWA is already open, focus it and navigate.
    for (const c of clientList) {
      if (c instanceof WindowClient) {
        await c.focus();
        try { await c.navigate(targetUrl); } catch { /* cross-origin or not allowed; ignore */ }
        return;
      }
    }
    // Otherwise open a fresh window at the target URL.
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
