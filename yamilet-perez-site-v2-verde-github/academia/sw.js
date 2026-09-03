const CACHE_PREFIX = 'academia-yamilet-pwa-';
const params = new URL(self.location.href).searchParams;
const BUILD = params.get('build') || '124';
const CACHE_NAME = `${CACHE_PREFIX}v${BUILD}`;
const BASE = new URL('./', self.location.href);
const OFFLINE_URL = new URL('./offline.html', BASE).href;

const versioned = path => {
  const url = new URL(path, BASE);
  url.searchParams.set('build', BUILD);
  return url.href;
};

// La instalación sólo precarga la superficie mínima. El resto se guarda bajo demanda.
const PRECACHE = [
  new URL('./', BASE).href,
  new URL('./index.html', BASE).href,
  new URL('./catalogo.html', BASE).href,
  OFFLINE_URL,
  versioned('./manifest.webmanifest'),
  versioned('./styles.css'),
  versioned('./academy-shell-v21.css'),
  versioned('./academy-dashboard.css'),
  versioned('./academy-pwa-v57.css'),
  versioned('../imagenes-academia-yamilet-final/04-favicon.png'),
  versioned('../imagenes-academia-yamilet-final/03-yamilet-logo-header.png')
];

const isAcademyAsset = url =>
  url.pathname.includes('/academia/') ||
  url.pathname.includes('/assets/') ||
  url.pathname.includes('/imagenes-academia-yamilet-final/');

const cacheResponse = async (request, response) => {
  if (response?.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async request => {
  try {
    const response = await fetch(request);
    return cacheResponse(request, response);
  } catch {
    return caches.match(request);
  }
};

const staleWhileRevalidate = async request => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => cacheResponse(request, response))
    .catch(() => null);
  return cached || network;
};

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
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
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
      fetch(request, { cache: 'no-store' })
        .then(response => cacheResponse(request, response))
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL))
    );
    return;
  }

  if (!isAcademyAsset(url)) return;

  // JS, CSS y manifiesto siempre consultan red primero para evitar ejecutar builds antiguos.
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Imágenes y fuentes pueden aparecer inmediatamente desde caché y actualizarse en segundo plano.
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'ACADEMY_BUILD') {
    event.source?.postMessage?.({ type: 'ACADEMY_BUILD', build: BUILD });
  }
});
