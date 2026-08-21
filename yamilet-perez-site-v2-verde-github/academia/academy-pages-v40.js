(() => {
  'use strict';

  const RELEASE = '20260821.40.1';
  const ROUTE_TO_SEGMENT = {
    home: '',
    courses: 'cursos/',
    evaluations: 'evaluaciones/',
    library: 'biblioteca/',
    calendar: 'calendario/',
    certificates: 'certificados/',
    help: 'ayuda/',
    profile: 'perfil/',
    explore: 'explorar/',
    admin: 'admin/'
  };
  const SEGMENT_TO_ROUTE = {
    cursos: 'courses',
    evaluaciones: 'evaluations',
    biblioteca: 'library',
    calendario: 'calendar',
    certificados: 'certificates',
    ayuda: 'help',
    perfil: 'profile',
    explorar: 'explore',
    admin: 'admin'
  };

  function academyRoot() {
    const path = window.location.pathname;
    const marker = '/academia/';
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(0, index + marker.length) : './';
  }

  function currentRoute() {
    const root = academyRoot();
    const relative = window.location.pathname.slice(root.length).replace(/^\/+|\/+$/g, '');
    const segment = relative.split('/')[0] || '';
    return SEGMENT_TO_ROUTE[segment] || 'home';
  }

  function routeUrl(route) {
    const segment = ROUTE_TO_SEGMENT[route];
    if (segment == null) return academyRoot();
    return `${academyRoot()}${segment}`;
  }

  function redirectToRoute(route) {
    const target = routeUrl(route);
    if (window.location.pathname === target || window.location.pathname === target.replace(/\/$/, '')) return;
    window.location.href = target;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-shell-route]');
    if (!button) return;

    if (button.dataset.v40Internal === '1') {
      delete button.dataset.v40Internal;
      return;
    }

    const route = button.dataset.shellRoute;
    if (!(route in ROUTE_TO_SEGMENT)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    redirectToRoute(route);
  }, true);

  function activatePageRoute() {
    const route = currentRoute();
    let activated = false;
    let observer = null;

    const tryActivate = () => {
      if (activated) return true;
      const button = document.querySelector(`[data-shell-route="${route}"]`);
      if (!button) return false;
      activated = true;
      button.dataset.v40Internal = '1';
      button.click();
      document.body.dataset.academyPage = route;
      observer?.disconnect();
      return true;
    };

    if (tryActivate()) return;
    observer = new MutationObserver(() => tryActivate());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activatePageRoute, { once: true });
  } else {
    activatePageRoute();
  }

  window.ACADEMIA_YAMILET_PAGES_V40 = {
    release: RELEASE,
    currentRoute,
    routeUrl
  };
})();
