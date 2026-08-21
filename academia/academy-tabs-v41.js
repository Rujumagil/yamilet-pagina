(() => {
  'use strict';

  const RELEASE = '20260821.41';
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

  function currentHashRoute() {
    const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
    return ROUTE_BY_HASH[hash] || 'home';
  }

  function setHash(route) {
    const hash = HASH_BY_ROUTE[route];
    if (!hash) return;
    const next = `#${hash}`;
    if (window.location.hash === next) return;
    history.pushState({ academyTab: route }, '', `${academyRoot()}${next}`);
  }

  function activate(route) {
    const button = document.querySelector(`[data-shell-route="${route}"]`);
    if (!button) return false;
    button.dataset.v41Internal = '1';
    button.click();
    document.body.dataset.academyTab = route;
    return true;
  }

  function activateWhenReady(route = currentHashRoute()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (activate(route) || attempts >= 100) clearInterval(timer);
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

  window.addEventListener('popstate', () => activateWhenReady(currentHashRoute()));
  window.addEventListener('hashchange', () => activateWhenReady(currentHashRoute()));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => activateWhenReady(), { once: true });
  } else {
    activateWhenReady();
  }

  window.ACADEMIA_YAMILET_TABS_V41 = {
    release: RELEASE,
    currentRoute: currentHashRoute,
    setHash
  };
})();
