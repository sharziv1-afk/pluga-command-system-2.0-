// Minimal app-shell service worker. Scope: same-origin GET requests only
// (pages, JS/CSS, fonts) — never Supabase API calls (cross-origin, and a
// cached API response would be stale data pretending to be live, which is
// worse than no data). Full offline data caching is a separate, later step
// (see AI_HANDOFF_CHECKPOINT.md) — this only makes sure the app shell itself
// still loads with zero network, so the PIN-gated offline screen has
// something to render instead of the browser's own connection-error page.
// v3 (26.10.2026). v1 cached Next's page payloads (RSC, `?_rsc=`) and served
// them stale-while-revalidate: after a deploy, moving between pages got a
// payload from an older build, so Next either reloaded the whole page or
// showed the error screen — whose retry re-rendered the same stale payload.
// Only a full load (network-first) recovered. v2 never activated: it waited
// for every tab to close, which on a phone can be days.
const CACHE_NAME = 'hamefaked-shell-v3';

// Only content-hashed build assets are worth keeping across versions: an open
// tab from an older build still needs its own chunks, and they never change.
const isStaticAsset = (url) => url.pathname.startsWith('/_next/static/');

self.addEventListener('install', () => {
  // Take over at once. Waiting for every tab to close (the old rule) left a
  // broken worker in charge for days. Taking over is safe because activate
  // keeps the hashed chunks an older open tab still needs (see below).
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge everything but content-hashed build assets from every cache —
  // stale page payloads, documents and any API response — instead of
  // deleting whole caches, which would take an open tab's chunks with them.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map(async (key) => {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        await Promise.all(requests
          .filter((request) => !isStaticAsset(new URL(request.url)))
          .map((request) => cache.delete(request)));
      })))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or other cross-origin calls
  // Never API or OAuth metadata responses: a cached personal calendar feed
  // kept serving after its link was revoked, and API data must be live.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.well-known/')) return;
  // Never Next's page payloads (client navigation and prefetch): they belong
  // to one build, and a cached one from an older build breaks navigation.
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') return;

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

      // Any cache: an older version's cache may still hold this build's chunk.
      const cached = await caches.match(request);
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
