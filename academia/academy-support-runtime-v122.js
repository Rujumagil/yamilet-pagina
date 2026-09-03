(() => {
  'use strict';

  const VERSION = '122.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  let loading = null;
  let guarded = false;
  let adminRefreshGuarded = false;
  let renderPromise = null;

  function isRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'support';
  }

  function supportReady() {
    const page = $('[data-shell-page="admin"]');
    const module = page ? $('[data-admin-v79-module]', page) : null;
    return !!module?.querySelector('[data-support86-root], .support86-loading, .support86-error');
  }

  function guardAdminRefresh() {
    if (adminRefreshGuarded || !window.ACADEMIA_YAMILET_ADMIN?.refresh) return;
    const api = window.ACADEMIA_YAMILET_ADMIN;
    const original = api.refresh.bind(api);
    api.refresh = (...args) => {
      // El módulo de soporte ya actualiza su propia información después de
      // responder o cambiar un estado. Evitamos que esa operación vuelva a
      // reconstruir todo Administración inmediatamente después.
      if (isRoute() && supportReady()) return Promise.resolve(true);
      return original(...args);
    };
    adminRefreshGuarded = true;
  }

  function guardRenderer() {
    const api = window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86;
    if (guarded || !api?.render) return;
    const originalRender = api.render.bind(api);
    const originalRefresh = typeof api.refresh === 'function' ? api.refresh.bind(api) : null;

    api.render = (...args) => {
      if (!isRoute()) return Promise.resolve(false);
      if (supportReady()) return Promise.resolve(true);
      if (renderPromise) return renderPromise;
      renderPromise = Promise.resolve(originalRender(...args)).finally(() => {
        renderPromise = null;
      });
      return renderPromise;
    };

    // El botón interno "Actualizar" conserva la actualización real del
    // módulo; sólo las llamadas redundantes de montaje quedan deduplicadas.
    if (originalRefresh) api.refresh = (...args) => originalRefresh(...args);
    guarded = true;
    guardAdminRefresh();
  }

  function ensureSupportAdmin() {
    if (window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86) {
      guardRenderer();
      return Promise.resolve(true);
    }
    if (loading) return loading;

    loading = new Promise(resolve => {
      const existing = $('script[data-support-admin-v122], script[data-support-runtime-v86]');
      if (existing) {
        if (window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86) {
          guardRenderer();
          resolve(true);
          return;
        }
        let settled = false;
        const finish = ok => {
          if (settled) return;
          settled = true;
          if (ok) guardRenderer();
          resolve(!!ok);
        };
        existing.addEventListener('load', () => finish(!!window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86), { once: true });
        existing.addEventListener('error', () => finish(false), { once: true });
        setTimeout(() => finish(!!window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86), 1600);
        return;
      }

      const script = document.createElement('script');
      script.src = './academy-support-admin-v86.js?v=122';
      script.async = true;
      script.dataset.supportAdminV122 = 'true';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        const ok = !!window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86;
        if (ok) guardRenderer();
        resolve(ok);
      }, { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      document.body.appendChild(script);
    }).finally(() => {
      loading = null;
    });

    return loading;
  }

  async function load(force = false) {
    if (!isRoute()) return false;
    const ready = await ensureSupportAdmin();
    if (!ready || !isRoute()) return false;
    guardRenderer();

    if (!force && supportReady()) return true;
    const api = window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86;
    if (!api) return false;
    if (force && typeof api.refresh === 'function') return Promise.resolve(api.refresh()).then(value => value !== false);
    return Promise.resolve(api.render()).then(value => value !== false);
  }

  window.ACADEMIA_YAMILET_SUPPORT_RUNTIME_V122 = Object.freeze({
    version: VERSION,
    load: () => load(false),
    refresh: () => load(true)
  });
})();