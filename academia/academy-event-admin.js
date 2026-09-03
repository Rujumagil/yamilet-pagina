(() => {
  'use strict';

  const VERSION = '122.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = {
    agenda: { loading: null, loaded: false },
    support: { loading: null, loaded: false }
  };
  let operationsGuarded = false;
  let agendaGuarded = false;

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

  function guardAgenda() {
    if (agendaGuarded || !window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85?.render) return;
    const original = window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85.render.bind(window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85);
    window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85.render = (...args) => {
      if (section() !== 'agenda') return Promise.resolve(false);
      if (agendaReady()) return Promise.resolve(true);
      return original(...args);
    };
    agendaGuarded = true;
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
      src: './academy-support-runtime-v122.js?v=122',
      attr: 'data-support-runtime-v122',
      oldSelector: 'script[data-support-runtime-v122]',
      ready: () => !!window.ACADEMIA_YAMILET_SUPPORT_RUNTIME_V122
    };
  }

  function ensureRuntime(kind) {
    const item = state[kind];
    const cfg = runtimeConfig(kind);
    if (cfg.ready()) {
      item.loaded = true;
      if (kind === 'agenda') guardAgenda();
      return Promise.resolve(true);
    }
    if (item.loading) return item.loading;

    item.loading = new Promise(resolve => {
      const existing = $(`script[${cfg.attr}]`) || $(cfg.oldSelector);
      if (existing) {
        if (cfg.ready()) {
          item.loaded = true;
          if (kind === 'agenda') guardAgenda();
          resolve(true);
          return;
        }
        let settled = false;
        const finish = ok => {
          if (settled) return;
          settled = true;
          item.loaded = !!ok;
          if (kind === 'agenda' && item.loaded) guardAgenda();
          resolve(!!ok);
        };
        existing.addEventListener('load', () => finish(cfg.ready()), { once: true });
        existing.addEventListener('error', () => finish(false), { once: true });
        setTimeout(() => finish(cfg.ready()), 1600);
        return;
      }

      const script = document.createElement('script');
      script.src = cfg.src;
      script.async = true;
      script.setAttribute(cfg.attr, 'true');
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        item.loaded = cfg.ready();
        if (kind === 'agenda' && item.loaded) guardAgenda();
        resolve(item.loaded);
      }, { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      document.body.appendChild(script);
    }).finally(() => {
      item.loading = null;
    });

    return item.loading;
  }

  async function openAgenda(force = false) {
    if (section() !== 'agenda') return false;
    const ready = await ensureRuntime('agenda');
    if (!ready || section() !== 'agenda') return false;
    guardAgenda();
    if (!force && agendaReady()) return true;
    const renderer = window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85?.render;
    if (!renderer) return false;
    return Promise.resolve(renderer()).then(value => value !== false);
  }

  async function openSupport(force = false) {
    if (section() !== 'support') return false;
    guardOperations();
    cleanupSupportLegacy();
    const ready = await ensureRuntime('support');
    if (!ready || section() !== 'support') return false;
    cleanupSupportLegacy();
    const api = window.ACADEMIA_YAMILET_SUPPORT_RUNTIME_V122;
    if (!api) return false;
    return force ? api.refresh() : api.load();
  }

  function openCurrent(force = false) {
    const kind = section();
    if (kind === 'agenda') return openAgenda(force);
    if (kind === 'support') return openSupport(force);
    return Promise.resolve(false);
  }

  // academy-admin.js conserva el control de navegación. Este archivo sólo
  // carga el runtime de Agenda o Soporte solicitado, sin observers globales
  // ni ciclos de reintentos de montaje.
  window.ACADEMIA_YAMILET_EVENT_ADMIN = Object.freeze({
    version: VERSION,
    load: () => openCurrent(false),
    render: () => openCurrent(true)
  });

  if (section()) queueMicrotask(() => openCurrent(false));
})();
