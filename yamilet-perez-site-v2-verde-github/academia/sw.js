const CACHE_PREFIX = 'academia-yamilet-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v108`;
// v108 stabilization: route aliases, current mobile UI, corrected PWA assets and clean cache rotation.
const BASE = new URL('./', self.location.href);
const OFFLINE_URL = new URL('./offline.html', BASE).href;

const PRECACHE = [
  new URL('./', BASE).href,
  new URL('./index.html', BASE).href,
  new URL('./catalogo.html', BASE).href,
  OFFLINE_URL,
  new URL('./manifest.webmanifest?v=108', BASE).href,
  new URL('../assets/logo-yamilet.png?v=57', BASE).href,
  new URL('../imagenes-academia-yamilet-final/01-yamilet-logo-master.png', BASE).href,
  new URL('../imagenes-academia-yamilet-final/02-yamilet-isotipo.png', BASE).href,
  new URL('../imagenes-academia-yamilet-final/03-yamilet-logo-header.png', BASE).href,
  new URL('../imagenes-academia-yamilet-final/04-favicon.png', BASE).href,
  new URL('../imagenes-academia-yamilet-final/05-academia-hero-desktop.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/06-academia-hero-tablet.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/07-academia-hero-mobile.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/08-yamilet-academia.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/09-yamilet-academia-horizontal.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/11-metodo-mes-cover-vertical.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/12-metodo-mes-thumb.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/13-continuar-aprendiendo.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/14-comunidad-acompanamiento.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/15-recursos-descargables.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/16-certificados.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/17-academia-fondo-claro.webp', BASE).href,
  new URL('../imagenes-academia-yamilet-final/18-avatar-alumno-generico.webp', BASE).href,
  new URL('./styles.css?v=5', BASE).href,
  new URL('./auth-p0.css?v=2', BASE).href,
  new URL('./learning-p1.css?v=1', BASE).href,
  new URL('./private-media-p15.css?v=1', BASE).href,
  new URL('./academy-shell-v21.css?v=34', BASE).href,
  new URL('./academy-navigation.css?v=1', BASE).href,
  new URL('./academy-dashboard.css?v=91', BASE).href,
  new URL('./academy-visuals-v91.css?v=108', BASE).href,
  new URL('./academy-courses.css?v=2', BASE).href,
  new URL('./academy-evaluations.css?v=1', BASE).href,
  new URL('./academy-library.css?v=1', BASE).href,
  new URL('./academy-calendar.css?v=1', BASE).href,
  new URL('./academy-certificates.css?v=2', BASE).href,
  new URL('./academy-profile.css?v=1', BASE).href,
  new URL('./academy-support.css?v=1', BASE).href,
  new URL('./academy-explore.css?v=1', BASE).href,
  new URL('./academy-assessment-player.css?v=1&build=1', BASE).href,
  new URL('./academy-player-v35.css?v=38', BASE).href,
  new URL('./academy-i18n-v27.css?v=27', BASE).href,
  new URL('./cloudflare-stream-v28.css?v=62', BASE).href,
  new URL('./academy-stable-v54.css?v=56', BASE).href,
  new URL('./academy-pwa-v57.css?v=57', BASE).href,
  new URL('./academy-progress-v58.css?v=58', BASE).href,
  new URL('./academy-mobile-course-v59.css?v=59', BASE).href,
  new URL('./academy-mobile-home-v60.css?v=60', BASE).href,
  new URL('./academy-mobile-secondary-v61.css?v=61', BASE).href,
  new URL('./academy-module-navigation-v66.css?v=66', BASE).href,
  new URL('./academy-course-hub-v68.css?v=68', BASE).href,
  new URL('./academy-aula-clone-v69.css?v=69', BASE).href,
  new URL('./academy-aula-clone-v69-user.css?v=69', BASE).href,
  new URL('./academy-hash-router-v70.css?v=70', BASE).href,
  new URL('./academy-aula-pages-v71.css?v=71', BASE).href,
  new URL('./academy-mobile-home-v94.css?v=94', BASE).href,
  new URL('./academy-mobile-hero-v95.css?v=95', BASE).href,
  new URL('./academy-mobile-continue-v96.css?v=96', BASE).href,
  new URL('./academy-mobile-lower-home-v97.css?v=97', BASE).href,
  new URL('./academy-mobile-courses-v98.css?v=98', BASE).href,
  new URL('./academy-mobile-course-interior-v99.css?v=99', BASE).href,
  new URL('./academy-mobile-library-v100.css?v=100', BASE).href,
  new URL('./academy-mobile-certificates-v101.css?v=101', BASE).href,
  new URL('./academy-mobile-calendar-v102.css?v=102', BASE).href,
  new URL('./academy-mobile-profile-support-v103.css?v=103', BASE).href,
  new URL('./academy-mobile-evaluations-v104.css?v=104', BASE).href,
  new URL('./academy-mobile-admin-v105.css?v=105', BASE).href,
  new URL('./academy-mobile-admin-agenda-evaluations-v106.css?v=106', BASE).href,
  new URL('./academy-mobile-admin-certificates-support-v107.css?v=107', BASE).href,
  new URL('./academy-i18n-v27.js?v=27', BASE).href,
  new URL('./academy-i18n-preference-v27.js?v=27', BASE).href,
  new URL('./auth-email-p18.js?v=1', BASE).href,
  new URL('./app.js?v=66', BASE).href,
  new URL('./private-media-p15.js?v=1', BASE).href,
  new URL('./drive-media-v26.js?v=26', BASE).href,
  new URL('./cloudflare-stream-v37.js?v=37', BASE).href,
  new URL('./recovery-p17.js?v=1', BASE).href,
  new URL('./academy-shell-v21.js?v=34', BASE).href,
  new URL('./academy-navigation.js?v=68', BASE).href,
  new URL('./academy-visual-path-fix-v92.js?v=92', BASE).href,
  new URL('./academy-dashboard.js?v=108', BASE).href,
  new URL('./academy-courses.js?v=68', BASE).href,
  new URL('./academy-module-navigation-v66.js?v=66', BASE).href,
  new URL('./academy-evaluations.js?v=1', BASE).href,
  new URL('./academy-library.js?v=1', BASE).href,
  new URL('./academy-calendar.js?v=1', BASE).href,
  new URL('./academy-certificates.js?v=2', BASE).href,
  new URL('./academy-profile.js?v=1', BASE).href,
  new URL('./academy-support.js?v=1', BASE).href,
  new URL('./academy-profile-support-fix-v103.js?v=103', BASE).href,
  new URL('./academy-explore.js?v=68', BASE).href,
  new URL('./academy-assessment-player.js?v=1&build=1', BASE).href,
  new URL('./academy-assessment-mobile-v104.js?v=104', BASE).href,
  new URL('./academy-player-v37.js?v=38', BASE).href,
  new URL('./academy-progress-v58.js?v=58', BASE).href,
  new URL('./academy-pwa-v57.js?v=108', BASE).href,
  new URL('./academy-mobile-secondary-v61.js?v=61', BASE).href,
  new URL('./academy-mobile-home-v60.js?v=60', BASE).href,
  new URL('./academy-aula-clone-v69.js?v=69', BASE).href,
  new URL('./academy-hash-router-v70.js?v=108', BASE).href,
  new URL('./academy-aula-pages-v71.js?v=71', BASE).href,
  new URL('./academy-v72-refinement.css?v=72', BASE).href,
  new URL('./academy-courses-refinement-v73.css?v=73', BASE).href,
  new URL('./academy-library-refinement-v74.css?v=74', BASE).href,
  new URL('./academy-agenda-refinement-v75.css?v=75', BASE).href,
  new URL('./academy-certificates-refinement-v76.css?v=76', BASE).href
];

const isAdminAsset = url => /(?:admin|students-p16|content-admin-p15|academy-content-cms|academy-content-runtime)/i.test(url.pathname);

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
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))))
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

  const isAcademyAsset = url.pathname.includes('/academia/') || url.pathname.includes('/assets/') || url.pathname.includes('/imagenes-academia-yamilet-final/');
  const isStatic = ['style','script','image','font'].includes(request.destination) || url.pathname.endsWith('.webmanifest');
  if (!isAcademyAsset || !isStatic) return;

  if (isAdminAsset(url)) {
    event.respondWith(
      fetch(request)
        .then(async response => {
          if (response?.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then(response => {
          if (response?.ok) cache.put(request, response.clone());
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
