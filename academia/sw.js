const CACHE_PREFIX = 'academia-yamilet-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v84`;
// CI compatibility markers from previous stable caches: v69 v71 v72 v73 v74 v75 v76 v77 v78 v79 v80 v81 v82 v82.1 v83
const BASE = new URL('./', self.location.href);
const OFFLINE_URL = new URL('./offline.html', BASE).href;
const PRECACHE = [
  new URL('./', BASE).href,
  new URL('./index.html', BASE).href,
  new URL('./catalogo.html', BASE).href,
  OFFLINE_URL,
  new URL('./manifest.webmanifest', BASE).href,
  new URL('./app.js?v=66', BASE).href,
  new URL('./content-admin-p15.css?v=80', BASE).href,
  new URL('./content-admin-p15.js?v=80', BASE).href,
  new URL('./academy-content-cms-v80.css?v=80', BASE).href,
  new URL('./academy-content-cms-v80.js?v=80', BASE).href,
  new URL('./academy-content-runtime-v80.js?v=80', BASE).href,
  new URL('./students-p16.css?v=81', BASE).href,
  new URL('./students-p16.js?v=81', BASE).href,
  new URL('./academy-students-runtime-v81.js?v=81', BASE).href,
  new URL('./academy-navigation.js?v=68', BASE).href,
  new URL('./academy-courses.js?v=68', BASE).href,
  new URL('./academy-explore.js?v=68', BASE).href,
  new URL('./academy-evaluations.css?v=1', BASE).href,
  new URL('./academy-evaluations.js?v=1', BASE).href,
  new URL('./academy-profile.css?v=1', BASE).href,
  new URL('./academy-profile.js?v=1', BASE).href,
  new URL('./academy-support.css?v=1', BASE).href,
  new URL('./academy-support.js?v=1', BASE).href,
  new URL('./academy-admin.css?v=1', BASE).href,
  new URL('./academy-admin.js?v=1&build=2', BASE).href,
  new URL('./academy-admin-operations.css?v=1&build=2', BASE).href,
  new URL('./academy-admin-operations.js?v=1&build=2', BASE).href,
  new URL('./academy-assessment-admin.css?v=82', BASE).href,
  new URL('./academy-assessment-admin.js?v=82', BASE).href,
  new URL('./academy-assessment-runtime-v82.js?v=82', BASE).href,
  new URL('./academy-assessment-review-v83.css?v=83', BASE).href,
  new URL('./academy-assessment-review-v83.js?v=83', BASE).href,
  new URL('./academy-certificate-runtime-v84.js?v=84', BASE).href,
  new URL('./academy-certificate-admin-v84.css?v=84', BASE).href,
  new URL('./academy-certificate-admin-v84.js?v=84', BASE).href,
  new URL('./academy-event-admin.css?v=1&build=1', BASE).href,
  new URL('./academy-event-admin.js?v=1&build=1', BASE).href,
  new URL('./academy-course-hub-v68.css?v=68', BASE).href,
  new URL('./academy-public-catalog-v68.css?v=68', BASE).href,
  new URL('./academy-public-catalog-v68.js?v=68', BASE).href,
  new URL('./academy-aula-clone-v69.css?v=69', BASE).href,
  new URL('./academy-aula-clone-v69-user.css?v=69', BASE).href,
  new URL('./academy-aula-clone-v69.js?v=69', BASE).href,
  new URL('./academy-hash-router-v70.css?v=70', BASE).href,
  new URL('./academy-hash-router-v70.js?v=70', BASE).href,
  new URL('./academy-aula-pages-v71.css?v=71', BASE).href,
  new URL('./academy-aula-pages-v71.js?v=71', BASE).href,
  new URL('./academy-v72-refinement.css?v=72', BASE).href,
  new URL('./academy-courses-refinement-v73.css?v=73', BASE).href,
  new URL('./academy-library-refinement-v74.css?v=74', BASE).href,
  new URL('./academy-agenda-refinement-v75.css?v=75', BASE).href,
  new URL('./academy-certificates-refinement-v76.css?v=76', BASE).href,
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
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
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