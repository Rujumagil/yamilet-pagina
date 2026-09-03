(() => {
  'use strict';

  const VERSION = '120.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = {
    agenda: { loading: null, loaded: false },
    support: { loading: null, loaded: false }
  };
  let operationsGuarded = false;

  function section() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    if (parts[0] !== 'admin') return null;
    if (parts[1] === 'agenda') return 'agenda';
    if (parts[1] === 'support') return 'support';
    return null;
  }

  function adminModule() {
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return null;
    return $('[data-admin-v79-module]', page);
  }

  function agendaReady() {
    const module = adminModule();
    return !!module?.querySelector('[data-agenda85-root], .agenda85-loading');
  }

  function supportReady() {
    const module = adminModule();
    return !!module?.querySelector('[data-support86-root]');
  }

  function cleanupSupportLegacy() {
    if (section() !== 'support') return;
    const page = $('[data-shell-page="admin"]');
    if (!page) return;
    page.querySelectorAll('[data-academy-ops]').forEach(node => node.remove());
  }

  function guardOperations() {
    if (operationsGuarded || !window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.render) return;
    const original = window.ACADEMIA_YAMILET_ADMIN_OPERATIONS.render.bind(window.ACADEMIA_YAMILET_ADMIN_OPERATIONS);
    window.ACADEMIA_YAMILET_ADMIN_OPERATIONS.render = (...args) => section() === 'support'
      ? Promise.resolve(false)
      : original(...args);
    operationsGuarded = true;
  }

  function runtimeConfig(kind) {
    if (kind === 'agenda') {
      return {
        src: './academy-agenda-admin-v85.js?v=120',
        attr: 'data-agenda-runtime-v120',
        oldSelector: 'script[data-agenda-runtime-v85]',
        ready: () => !!window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85
      };
    }
    return {
      src: './academy-support-admin-v86.js?v=86',
      attr: 'data-support-runtime-v120',
      oldSelector: 'script[data-support-runtime-v86]',
      ready: () => !!window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86
    };
  }

  function ensureRuntime(kind) {
    const item = state[kind];
    const cfg = runtimeConfig(kind);
    if (cfg.ready()) {
      item.loaded = true;
      return Promise.resolve({ ok: true, fresh: false });
    }
    if (item.loading) return item.loading;

    item.loading = new Promise(resolve => {
      const existing = $(`script[${cfg.attr}]`) || $(cfg.oldSelector);
      if (existing) {
        if (cfg.ready() || existing.dataset.loaded === 'true') {
          item.loaded = cfg.ready();
          resolve({ ok: item.loaded, fresh: false });
          return;
        }
        let settled = false;
        const finish = ok => {
          if (settled) return;
          settled = true;
          item.loaded = !!ok;
          resolve({ ok: !!ok, fresh: false });
        };
        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          finish(cfg.ready());
        }, { once: true });
        existing.addEventListener('error', () => finish(false), { once: true });
        setTimeout(() => finish(cfg.ready()), 1800);
        return;
      }

      const script = document.createElement('script');
      script.src = cfg.src;
      script.async = true;
      script.setAttribute(cfg.attr, 'true');
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        item.loaded = cfg.ready();
        resolve({ ok: item.loaded, fresh: true });
      }, { once: true });
      script.addEventListener('error', () => resolve({ ok: false, fresh: true }), { once: true });
      document.body.appendChild(script);
    }).finally(() => {
      item.loading = null;
    });

    return item.loading;
  }

  async function openAgenda(force = false) {
    if (section() !== 'agenda') return false;
    const result = await ensureRuntime('agenda');
    if (!result.ok || section() !== 'agenda') return false;

    // La versión v85 se auto-renderiza al cargarse por primera vez. Evitamos
    // disparar un segundo render mientras esa primera consulta está en curso.
    if (!force && agendaReady()) return true;

    const renderer = window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85?.render;
    if (!renderer) return false;
    return Promise.resolve(renderer()).then(value => value !== false);
  }

  async function openSupport(force = false) {
    if (section() !== 'support') return false;
    guardOperations();
    cleanupSupportLegacy();
    const result = await ensureRuntime('support');
    if (!result.ok || section() !== 'support') return false;
    cleanupSupportLegacy();
    if (!force && supportReady()) return true;
    const renderer = window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86?.render;
    if (!renderer) return false;
    return Promise.resolve(renderer()).then(value => value !== false);
  }

  function openCurrent(force = false) {
    const kind = section();
    if (kind === 'agenda') return openAgenda(force);
    if (kind === 'support') return openSupport(force);
    return Promise.resolve(false);
  }

  // academy-admin.js es el único router. Este puente sólo carga el runtime
  // solicitado; no observa el DOM, no reintenta por intervalos y no vuelve a
  // renderizar administración por su cuenta.
  window.ACADEMIA_YAMILET_EVENT_ADMIN = Object.freeze({
    version: VERSION,
    load: () => openCurrent(false),
    render: () => openCurrent(true)
  });

  if (section()) queueMicrotask(() => openCurrent(false));
})();
