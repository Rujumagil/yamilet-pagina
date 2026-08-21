(() => {
  'use strict';

  const RELEASE = '20260821.41.1';
  const HASH_BY_ROUTE = {
    home: 'inicio',
    courses: 'cursos',
    evaluations: 'evaluaciones',
    library: 'biblioteca',
    calendar: 'calendario',
    certificates: 'certificados',
    help: 'ayuda',
    profile: 'perfil',
    explore: 'explorar'
  };
  const ROUTE_BY_HASH = Object.fromEntries(Object.entries(HASH_BY_ROUTE).map(([route, hash]) => [hash, route]));

  function academyRoot() {
    const path = window.location.pathname;
    const marker = '/academia/';
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(0, index + marker.length) : './';
  }

  function legacyPathRoute() {
    const root = academyRoot();
    const relative = window.location.pathname.slice(root.length).replace(/^\/+|\/+$/g, '');
    const segment = relative.split('/')[0] || '';
    return ROUTE_BY_HASH[segment] || null;
  }

  function currentHashRoute() {
    const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
    return ROUTE_BY_HASH[hash] || null;
  }

  function normalizeInitialLocation() {
    const hashRoute = currentHashRoute();
    if (hashRoute) return hashRoute;

    const legacyRoute = legacyPathRoute();
    if (legacyRoute && legacyRoute !== 'home') {
      const hash = HASH_BY_ROUTE[legacyRoute];
      history.replaceState({ academyTab: legacyRoute }, '', `${academyRoot()}#${hash}`);
      return legacyRoute;
    }

    return 'home';
  }

  function setHash(route) {
    const hash = HASH_BY_ROUTE[route];
    if (!hash) return;
    const target = `${academyRoot()}#${hash}`;
    if (`${window.location.pathname}${window.location.hash}` === target) return;
    history.pushState({ academyTab: route }, '', target);
  }

  function activate(route) {
    const button = document.querySelector(`[data-shell-route="${route}"]`);
    if (!button) return false;
    button.dataset.v41Internal = '1';
    button.click();
    document.body.dataset.academyTab = route;
    return true;
  }

  function activateWhenReady(route = currentHashRoute() || 'home') {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (activate(route) || attempts >= 120) clearInterval(timer);
    }, 100);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-shell-route]');
    if (!button) return;

    const route = button.dataset.shellRoute;

    if (button.dataset.v41Internal === '1') {
      delete button.dataset.v41Internal;
      return;
    }

    if (route === 'admin') {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = `${academyRoot()}admin/`;
      return;
    }

    if (!(route in HASH_BY_ROUTE)) return;
    setHash(route);
  }, true);

  window.addEventListener('popstate', () => activateWhenReady(currentHashRoute() || 'home'));
  window.addEventListener('hashchange', () => activateWhenReady(currentHashRoute() || 'home'));

  const initialRoute = normalizeInitialLocation();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => activateWhenReady(initialRoute), { once: true });
  } else {
    activateWhenReady(initialRoute);
  }

  window.ACADEMIA_YAMILET_TABS_V41 = {
    release: RELEASE,
    currentRoute: () => currentHashRoute() || 'home',
    setHash
  };
})();
