// Infinite Voidsong — service worker
//
// Plain JS, not built by Vite. Precaches the build's asset manifest
// (written at build time by the swManifestPlugin in vite.config.ts),
// serves HTML network-first, and serves fonts cache-first. Registered
// only in production (see src/main.ts).

const CACHE_PREFIX = 'voidsong-';
let CACHE_NAME = CACHE_PREFIX + 'v0';
// Recorded audio loops: cached at runtime on first play, never precached, and kept
// across version bumps (the recordings do not change with the app build).
const AUDIO_CACHE = CACHE_PREFIX + 'audio-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      let manifest = { version: '0', assets: [] };
      try {
        const res = await fetch('/sw-manifest.json', { cache: 'no-store' });
        if (res.ok) manifest = await res.json();
      } catch {
        // No manifest (e.g. dev build) — install with an empty cache.
      }
      CACHE_NAME = CACHE_PREFIX + manifest.version;
      const cache = await caches.open(CACHE_NAME);
      const urls = Array.from(new Set(['/', '/sw-manifest.json', ...manifest.assets]));
      await Promise.all(
        urls.map((url) => cache.add(url).catch(() => {})),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== AUDIO_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isFontRequest(request) {
  return request.destination === 'font' || /\.woff2?$/.test(new URL(request.url).pathname);
}

function isAudioRequest(request) {
  return new URL(request.url).pathname.startsWith('/audio/');
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || cache.match('/');
  }
}

async function cacheFirst(request, cacheName = CACHE_NAME, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const put = cache.put(request, response.clone());
    if (event) event.waitUntil(put); else put.catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isAudioRequest(request)) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE, event));
    return;
  }

  if (isFontRequest(request)) {
    event.respondWith(cacheFirst(request, CACHE_NAME, event));
    return;
  }
});
