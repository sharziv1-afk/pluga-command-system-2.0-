// Minimal app-shell service worker. Scope: same-origin GET requests only
// (pages, JS/CSS, fonts) — never Supabase API calls (cross-origin, and a
// cached API response would be stale data pretending to be live, which is
// worse than no data). Full offline data caching is a separate, later step
// (see AI_HANDOFF_CHECKPOINT.md) — this only makes sure the app shell itself
// still loads with zero network, so the PIN-gated offline screen has
// something to render instead of the browser's own connection-error page.
const CACHE_NAME = 'hamefaked-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or other cross-origin calls

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      // Stale-while-revalidate: serve the cached shell instantly if we have
      // one, refresh it in the background; fall through to the network (or
      // its rejection) when there's nothing cached yet.
      return cached ?? network ?? Response.error();
    }),
  );
});
