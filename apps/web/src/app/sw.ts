/// <reference lib="webworker" />
/**
 * Service worker entry — built by Serwist at production build time
 * (next.config.js wraps the Next config with @serwist/next).
 *
 * Phase 1 (now): minimal SW just to make the app installable. Precaches the
 * default-generated manifest; no runtime caching strategies yet.
 *
 * Phase 2 (later): add Serwist `runtimeCaching` for read-path API calls,
 * Next.js static chunks, images, and a Background Sync queue for failed writes.
 */

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

// Augment the global scope with the Serwist runtime variables.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // Serwist injects the build-time manifest here.
  precacheEntries: self.__SW_MANIFEST,
  // Activate the new SW as soon as it's installed; claim open clients.
  // The UpdateBanner component (Phase 2) will prompt the user to reload.
  skipWaiting: true,
  clientsClaim: true,
  // Phase 1: use Serwist's safe default caching strategy.
  // Phase 2 will replace `defaultCache` with explicit per-route runtime caching.
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
