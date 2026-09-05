// Minimal app-shell service worker. Scope: same-origin GET requests only
// (pages, JS/CSS, fonts) — never Supabase API calls (cross-origin, and a
// cached API response would be stale data pretending to be live, which is
// worse than no data). Full offline data caching is a separate, later step
// (see AI_HANDOFF_CHECKPOINT.md) — this only makes sure the app shell itself
// still loads with zero network, so the PIN-gated offline screen has
// something to render instead of the browser's own connection-error page.
const CACHE_NAME = 'hamefaked-shell-v1';

self.addEventListener('install', (event) => {
  // Deliberately NOT skipWaiting(). A deploy replaces the content-hashed JS
  // chunks; taking over a live session mid-work means the page asks for a
  // chunk name that no longer exists and dies with a chunk-load error in the
  // middle of what the commander was doing. Waiting until every tab is closed
  // costs a slightly later update and avoids that entirely.
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
      // Documents are network-first. CACHE_NAME is a constant, so the activate
      // handler's cleanup never fires across deploys — a cached HTML shell
      // would otherwise be served forever, pointing at chunk names from an
      // old build. Static assets below are content-hashed, so they stay
      // cache-first safely.
      if (request.mode === 'navigate') {
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(request)) ?? Response.error();
        }
      }

      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      // Stale-while-revalidate: serve the cached shell instantly if we have
      // one, refresh it in the background; fall through to the network when
      // there's nothing cached yet.
      //
      // `await network` matters. `network` is a Promise, so it is never
      // nullish — `cached ?? network ?? Response.error()` made the last
      // branch unreachable and handed respondWith a promise resolving to
      // undefined whenever the cache missed and the fetch failed, which is
      // exactly the cold-start-offline case. The browser then showed its own
      // connection-error page instead of the app shell.
      return cached ?? (await network) ?? Response.error();
    }),
  );
});
