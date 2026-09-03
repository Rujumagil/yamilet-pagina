(() => {
  'use strict';

  let deferredInstallPrompt = null;
  let toastTimer = null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const icons = {
    home:'<svg viewBox="0 0 24 24"><path d="M3 10.8 12 3l9 7.8"/><path d="M5 9.8V21h14V9.8"/><path d="M9 21v-6h6v6"/></svg>',
    courses:'<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></svg>',
    library:'<svg viewBox="0 0 24 24"><path d="M4 4h5v16H4zM10 4h5v16h-5z"/><path d="m16.5 5 3-1 3.5 14-3 1z"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2"/></svg>',
    more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'
  };

  function shellButton(route) {
    return $(`.sidebar [data-shell-route="${route}"]`);
  }

  function runRoute(route) {
    const button = shellButton(route);
    if (!button) return false;
    button.click();
    setActive(route);
    closeMore();
    return true;
  }

  function setActive(route) {
    const direct = ['home','courses','library','calendar'];
    $$('[data-pwa-route]').forEach(button => {
      const target = button.dataset.pwaRoute;
      button.classList.toggle('active', target === route || (target === 'more' && !direct.includes(route)));
    });
  }

  function closeMore() {
    document.body.classList.remove('pwa-more-open');
  }

  function showMore() {
    syncMoreOptions();
    document.body.classList.add('pwa-more-open');
    setActive('more');
  }

  function syncMoreOptions() {
    $$('[data-pwa-extra-route]').forEach(button => {
      button.hidden = !shellButton(button.dataset.pwaExtraRoute);
    });
    const install = $('[data-pwa-install]');
    if (install) install.hidden = isStandalone() || (!deferredInstallPrompt && !isIOS());
  }

  function buildMobileNavigation() {
    if ($('[data-pwa-mobile-nav]')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <nav class="academy-mobile-nav" data-pwa-mobile-nav aria-label="Navegación móvil de Academia Yamilet">
        <button type="button" data-pwa-route="home" class="active">${icons.home}<span>Inicio</span></button>
        <button type="button" data-pwa-route="courses">${icons.courses}<span>Cursos</span></button>
        <button type="button" data-pwa-route="library">${icons.library}<span>Biblioteca</span></button>
        <button type="button" data-pwa-route="calendar">${icons.calendar}<span>Calendario</span></button>
        <button type="button" data-pwa-route="more">${icons.more}<span>Más</span></button>
      </nav>
      <button class="academy-mobile-backdrop" type="button" data-pwa-backdrop aria-label="Cerrar menú"></button>
      <aside class="academy-mobile-more" data-pwa-more aria-label="Más opciones">
        <div class="academy-mobile-more-head"><div><strong>Academia Yamilet</strong><span>Más herramientas de tu espacio</span></div><button class="academy-mobile-close" type="button" data-pwa-close aria-label="Cerrar">×</button></div>
        <div class="academy-mobile-more-grid">
          <button type="button" data-pwa-extra-route="evaluations">Evaluaciones<small>Revisa tus actividades</small></button>
          <button type="button" data-pwa-extra-route="certificates">Certificados<small>Tus logros y constancias</small></button>
          <button type="button" data-pwa-extra-route="help">Ayuda<small>Soporte de la Academia</small></button>
          <button type="button" data-pwa-extra-route="profile">Mi perfil<small>Cuenta y preferencias</small></button>
          <button type="button" data-pwa-extra-route="explore">Explorar<small>Conoce otros programas</small></button>
          <button type="button" data-pwa-extra-route="admin">Administrar<small>Gestión de la Academia</small></button>
          <button type="button" data-pwa-install hidden>Instalar Academia<small>Añadir a tu pantalla de inicio</small></button>
        </div>
        <div class="academy-mobile-install-help" data-pwa-install-help></div>
      </aside>
      <div class="academy-connectivity-toast" data-pwa-connectivity role="status" aria-live="polite"></div>
    `);

    $$('[data-pwa-route]').forEach(button => button.addEventListener('click', () => {
      const route = button.dataset.pwaRoute;
      if (route === 'more') showMore();
      else runRoute(route);
    }));
    $$('[data-pwa-extra-route]').forEach(button => button.addEventListener('click', () => runRoute(button.dataset.pwaExtraRoute)));
    $('[data-pwa-backdrop]')?.addEventListener('click', closeMore);
    $('[data-pwa-close]')?.addEventListener('click', closeMore);
    $('[data-pwa-install]')?.addEventListener('click', installApp);
  }

  async function installApp() {
    const helper = $('[data-pwa-install-help]');
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      if (helper) {
        helper.textContent = choice?.outcome === 'accepted' ? 'La instalación comenzó. Cuando termine, abre Academia Yamilet desde tu pantalla de inicio.' : 'Puedes instalarla más adelante desde este mismo menú.';
        helper.classList.add('visible');
      }
      syncMoreOptions();
      return;
    }
    if (isIOS() && helper) {
      helper.textContent = 'En iPhone o iPad: abre esta Academia en Safari, toca Compartir y elige “Agregar a pantalla de inicio”.';
      helper.classList.add('visible');
    }
  }

  function syncDashboardState() {
    const active = !!$('.dashboard:not(.hidden)');
    document.body.classList.toggle('pwa-dashboard-active', active);
    document.documentElement.classList.toggle('pwa-standalone', isStandalone());
    if (!active) closeMore();
    syncMoreOptions();
  }

  function showConnectivity(message, offline = false) {
    const toast = $('[data-pwa-connectivity]');
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('offline', offline);
    toast.classList.add('visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), offline ? 5000 : 2800);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol)) return;
    navigator.serviceWorker.register('./sw.js', { scope:'./', updateViaCache:'none' })
      .then(registration => registration.update().catch(() => null))
      .catch(error => console.warn('Academia Yamilet PWA', error));
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    syncMoreOptions();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.documentElement.classList.add('pwa-standalone');
    syncMoreOptions();
    showConnectivity('Academia Yamilet quedó instalada en tu dispositivo.');
  });
  window.addEventListener('online', () => showConnectivity('Conexión restablecida.'));
  window.addEventListener('offline', () => showConnectivity('Sin conexión. Los datos privados requieren internet.', true));
  window.addEventListener('pageshow', syncDashboardState);
  document.addEventListener('click', event => {
    const button = event.target.closest('.sidebar [data-shell-route]');
    if (button) setActive(button.dataset.shellRoute);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMore();
  });

  buildMobileNavigation();
  registerServiceWorker();
  syncDashboardState();
  [600, 1400, 2600, 5000].forEach(delay => window.setTimeout(syncDashboardState, delay));
  window.setInterval(syncDashboardState, 5000);
})();