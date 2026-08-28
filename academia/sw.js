const CACHE_PREFIX = 'academia-yamilet-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v67`;
const BASE = new URL('./', self.location.href);
const OFFLINE_URL = new URL('./offline.html', BASE).href;
const PRECACHE = [
  new URL('./', BASE).href,
  new URL('./index.html', BASE).href,
  OFFLINE_URL,
  new URL('./manifest.webmanifest', BASE).href,
  new URL('./app.js?v=66', BASE).href,
  new URL('./academy-navigation.js?v=67', BASE).href,
  new URL('./academy-courses.js?v=66', BASE).href,
  new URL('./academy-module-navigation-v66.js?v=66', BASE).href,
  new URL('./academy-module-navigation-v66.css?v=66', BASE).href,
  new URL('./academy-pwa-v57.css', BASE).href,
  new URL('./academy-pwa-v57.js', BASE).href,
  new URL('./academy-progress-v58.css', BASE).href,
  new URL('./academy-progress-v58.js', BASE).href,
  new URL('./academy-mobile-course-v59.css', BASE).href,
  new URL('./academy-mobile-home-v60.css', BASE).href,
  new URL('./academy-mobile-home-v60.js', BASE).href,
  new URL('./academy-mobile-secondary-v61.css', BASE).href,
  new URL('./academy-mobile-secondary-v61.js', BASE).href,
  new URL('./cloudflare-stream-v28.css', BASE).href,
  new URL('./academy-video-admin-v62.js', BASE).href,
  new URL('../assets/logo-yamilet.png', BASE).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  const isAcademyAsset = url.pathname.includes('/academia/') || url.pathname.includes('/assets/');
  const isStatic = ['style', 'script', 'image', 'font'].includes(request.destination) || url.pathname.endsWith('.webmanifest');
  if (!isAcademyAsset || !isStatic) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});