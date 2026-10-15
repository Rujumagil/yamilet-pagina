const BUILD = new URL(self.location.href).searchParams.get('build') || '8';
const CACHE_PREFIX = 'yamilet-admin-pwa-';
const CACHE_NAME = CACHE_PREFIX + BUILD;
const BASE = new URL('./', self.location.href);
const OFFLINE_URL = new URL('./offline.html', BASE).href;

const PRECACHE = [
  new URL('./', BASE).href,
  new URL('./index.html', BASE).href,
  new URL('./offline.html', BASE).href,
  new URL('./manifest.webmanifest?build=' + BUILD, BASE).href,
  new URL('./styles.css?v=7', BASE).href,
  new URL('./app.js?v=8', BASE).href,
  new URL('./pwa.js?v=8', BASE).href,
  new URL('../assets/logo-yamilet.png', BASE).href
];

async function cacheOk(request, response) {
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

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
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache:'no-store' })
        .then(res => cacheOk(req, res))
        .catch(async () => (await caches.match(req)) || caches.match(OFFLINE_URL))
    );
    return;
  }

  if (req.destination === 'script' || req.destination === 'style' || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      fetch(req, { cache:'no-store' })
        .then(res => cacheOk(req, res))
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.destination === 'image' || req.destination === 'font') {
    event.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => cacheOk(req, res)).catch(() => null);
        return cached || fresh;
      })
    );
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body:event.data?.text?.() || '' }; }
  const title = data.title || 'Yamilet Admin';
  const options = {
    body: data.body || 'Tienes una nueva actualización.',
    icon: '../assets/logo-yamilet.png',
    badge: '../assets/logo-yamilet.png',
    tag: data.tag || 'yamilet-admin',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/admin/#dashboard' },
    vibrate: [180, 80, 180]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/admin/#dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(async clients => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target).catch(() => null);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
