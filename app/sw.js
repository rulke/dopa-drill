// Offline shell for the game. Everything it needs is static and self-contained
// (no API, no server state), so the strategy is a plain precache: fill the cache
// on install, then serve from it and only go to the network when a file is not
// cached yet.
//
// Bump CACHE_VERSION on every release. That is what makes an update land: the
// new worker installs a fresh cache, and the old one is dropped once the new
// version claims the clients.
const CACHE_VERSION = 'v12';
const CACHE = `dopa-drill-${CACHE_VERSION}`;

// The whole app. Fonts are in here too - they are the largest files and the
// reason a first offline launch would otherwise show fallback glyphs.
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'style.css',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-180.png',
  'fonts/dela-gothic-one.woff2',
  'fonts/zcool-kuaile.woff2',
  'fonts/zcool-qingke-huangyou.woff2',
  'fonts/zen-maru-gothic-bold.woff2',
  'fonts/zen-maru-gothic-black.woff2',
  'js/main.js',
  'js/core.js',
  'js/i18n.js',
  'js/audio.js',
  'js/bg.js',
  'js/dopakichi.js',
  'js/fx.js',
  'js/growth.js',
  'js/endless.js',
  'js/guide.js',
  'js/problems.js',
  'js/quests.js',
  'js/report.js',
  'js/scoring.js',
  'js/session.js',
  'js/skills.js',
  'js/slips.js',
  'js/store.js',
  'js/trophies.js',
  'js/unlocks.js',
  'js/lang/zh.js',
  'js/lang/en.js',
  'js/lang/ja.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the HTTP cache, so a release never bakes in a
  // stale copy of a file the CDN is still holding on to.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The two dev harnesses must always reach the network: ?pump drives the test
  // tab and ?capture renders video, and either one served from a cache would
  // quietly replay an older build. Every other parameter is an ordinary
  // deep-link option and is matched against the cached shell with ignoreSearch.
  if (url.searchParams.has('pump') || url.searchParams.has('capture')) return;

  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Cache same-origin shells that were not precached (a new module added
      // between releases), but never a redirect or an error page.
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // Offline and not in the cache: navigations fall back to the game itself.
      if (req.mode === 'navigate') {
        const shell = await caches.match('index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
