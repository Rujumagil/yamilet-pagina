(() => {
  'use strict';

  const VERSION = '120.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);

  let builderLoading = null;
  let reviewLoading = null;
  let builderLoaded = false;
  let reviewLoaded = false;
  let externalRenderWrapped = false;
  let originalExternalRender = null;

  function isRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'evaluations';
  }

  function adminPage() {
    return $('[data-shell-page="admin"]');
  }

  function adminModule() {
    const page = adminPage();
    return page ? $('[data-admin-v79-module]', page) : null;
  }

  function assessmentHost() {
    const page = adminPage();
    return page ? $('[data-assessment-admin-host]', page) : null;
  }

  function ensureHost() {
    if (!isRoute()) return null;
    const module = adminModule();
    if (!module) return null;

    let host = assessmentHost();
    if (!host) {
      host = document.createElement('div');
      host.dataset.assessmentAdminHost = 'true';
      host.innerHTML = '<section class="assess82 assess82-loading"><span></span><strong>Preparando constructor de evaluaciones…</strong><small>Cargando cursos, preguntas e intentos.</small></section>';
    }

    if (host.parentElement !== module) {
      module.innerHTML = '';
      module.appendChild(host);
    }
    host.style.setProperty('display', 'block', 'important');
    return host;
  }

  function builderBusyOrReady() {
    const host = assessmentHost();
    if (!host) return false;
    return !!host.querySelector('.assess82-loading,[data-assessment-admin],.assess82-error');
  }

  function builderReady() {
    const host = assessmentHost();
    return !!host?.querySelector('[data-assessment-admin]');
  }

  function moveHost() {
    if (!isRoute()) return false;
    const module = adminModule();
    const host = assessmentHost();
    if (!module || !host) return false;
    if (host.parentElement !== module) {
      module.innerHTML = '';
      module.appendChild(host);
    }
    host.style.setProperty('display', 'block', 'important');
    return true;
  }

  function loadScript(src, attr, globalCheck = null) {
    if (globalCheck?.()) return Promise.resolve(true);
    const existing = $(`script[${attr}]`);
    if (existing) {
      if (existing.dataset.loaded === 'true' || globalCheck?.()) return Promise.resolve(true);
      return new Promise(resolve => {
        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          resolve(true);
        }, {once:true});
        existing.addEventListener('error', () => resolve(false), {once:true});
      });
    }

    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute(attr, 'true');
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve(true);
      }, {once:true});
      script.addEventListener('error', () => resolve(false), {once:true});
      document.body.appendChild(script);
    });
  }

  function waitForBuilder(timeout = 450) {
    if (builderReady()) return Promise.resolve(true);
    const host = ensureHost();
    if (!host) return Promise.resolve(false);

    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      };
      const observer = new MutationObserver(() => {
        if (builderReady()) finish(true);
      });
      observer.observe(host, {childList:true, subtree:true});
      const timer = setTimeout(() => finish(builderReady()), timeout);
    });
  }

  function guardExternalRender() {
    const api = window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN;
    if (!api?.render) return false;
    if (externalRenderWrapped) return true;

    originalExternalRender = api.render.bind(api);
    api.render = (...args) => {
      if (!isRoute()) return Promise.resolve(false);
      moveHost();
      if (builderBusyOrReady()) return Promise.resolve(true);
      return Promise.resolve(originalExternalRender(...args)).finally(moveHost);
    };
    externalRenderWrapped = true;
    return true;
  }

  async function renderBuilderIfNeeded() {
    if (!isRoute()) return false;
    ensureHost();
    guardExternalRender();

    if (builderReady()) {
      moveHost();
      return true;
    }

    const autoRendered = await waitForBuilder(450);
    if (autoRendered) {
      moveHost();
      return true;
    }

    const renderer = originalExternalRender || window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN?.render?.bind(window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN);
    if (!renderer) return false;
    await renderer();
    moveHost();
    return builderReady() || !!assessmentHost()?.querySelector('.assess82-error');
  }

  async function loadBuilder() {
    if (!isRoute()) return false;
    ensureHost();

    if (builderLoaded && window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN) {
      guardExternalRender();
      return renderBuilderIfNeeded();
    }
    if (builderLoading) return builderLoading;

    builderLoading = (async () => {
      const ready = await loadScript(
        './academy-assessment-admin.js?v=120',
        'data-assessment-runtime-v120',
        () => !!window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN
      );
      if (!ready) return false;
      builderLoaded = true;
      guardExternalRender();
      return renderBuilderIfNeeded();
    })().catch(error => {
      console.error('Academia Yamilet assessment runtime v120', error);
      const host = ensureHost();
      if (host) {
        host.innerHTML = '<section class="assess82 assess82-error"><strong>No fue posible abrir Evaluaciones</strong><span>La sesión sigue activa. Intenta cargar nuevamente esta herramienta.</span><button type="button" data-assess120-retry>Reintentar</button></section>';
        $('[data-assess120-retry]', host)?.addEventListener('click', () => {
          builderLoaded = false;
          loadBuilder();
        }, {once:true});
      }
      return false;
    }).finally(() => {
      builderLoading = null;
    });

    return builderLoading;
  }

  async function loadReviewIntegration() {
    if (!isRoute()) return false;
    if (reviewLoaded && window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83) {
      window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83.refresh?.();
      return true;
    }
    if (reviewLoading) return reviewLoading;

    reviewLoading = (async () => {
      const ready = await loadScript(
        './academy-assessment-review-v83.js?v=120',
        'data-assessment-review-runtime-v120',
        () => !!window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83
      );
      if (!ready) return false;
      reviewLoaded = true;
      window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83?.refresh?.();
      return true;
    })().catch(error => {
      console.warn('Academia Yamilet assessment review v120', error);
      return false;
    }).finally(() => {
      reviewLoading = null;
    });

    return reviewLoading;
  }

  async function load() {
    if (!isRoute()) return false;
    const ready = await loadBuilder();
    if (!ready) return false;
    void loadReviewIntegration();
    return true;
  }

  function restoreSearchFocus(position) {
    requestAnimationFrame(() => {
      if (!isRoute()) return;
      const input = $('[data-assess82-search]');
      if (!input) return;
      input.focus({preventScroll:true});
      if (Number.isInteger(position) && input.setSelectionRange) {
        try { input.setSelectionRange(position, position); } catch {}
      }
    });
  }

  document.addEventListener('input', event => {
    if (!event.target.matches?.('[data-assess82-search]')) return;
    restoreSearchFocus(event.target.selectionStart);
  }, true);

  window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME = Object.freeze({
    version: VERSION,
    load,
    mount: moveHost
  });
})();
