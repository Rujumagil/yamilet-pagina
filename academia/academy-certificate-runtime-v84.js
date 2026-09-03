(() => {
  'use strict';

  const VERSION = '121.1.0';
  const ADMIN_SRC = './academy-certificate-admin-v84.js?v=121';
  const $ = (selector, root = document) => root.querySelector(selector);

  let loading = null;
  let loaded = !!window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84;
  let renderGuardInstalled = false;
  let guardedRenderPromise = null;

  function isRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'certificates';
  }

  function certificateReady() {
    return !!$('[data-cert84-root]');
  }

  function installRenderGuard() {
    if (renderGuardInstalled) return;
    const admin = window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84;
    if (!admin?.render) return;

    const original = admin.render.bind(admin);
    admin.render = (force = false) => {
      if (!isRoute()) return Promise.resolve(false);
      if (!force && certificateReady()) return Promise.resolve(true);
      if (guardedRenderPromise) return guardedRenderPromise;
      guardedRenderPromise = Promise.resolve(original(force)).finally(() => {
        guardedRenderPromise = null;
      });
      return guardedRenderPromise;
    };
    renderGuardInstalled = true;
  }

  function waitForReady(timeout = 450) {
    if (certificateReady()) return Promise.resolve(true);
    const module = $('[data-admin-v79-module]');
    if (!module) return Promise.resolve(false);

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
        if (certificateReady()) finish(true);
      });
      observer.observe(module, {childList:true, subtree:true});
      const timer = setTimeout(() => finish(certificateReady()), timeout);
    });
  }

  async function renderCurrent(force = false) {
    if (!isRoute()) return false;
    installRenderGuard();
    const admin = window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84;
    if (!admin?.render) return false;
    if (!force && certificateReady()) return true;
    try {
      return (await admin.render(force)) !== false;
    } catch (error) {
      console.warn('Academia Yamilet certificates runtime v121', error);
      return false;
    }
  }

  function loadAdmin(force = false) {
    if (!isRoute() && !force) return Promise.resolve(false);

    if (loaded && window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84) {
      installRenderGuard();
      return renderCurrent(force);
    }
    if (loading) return loading;

    loading = new Promise(resolve => {
      const finish = async ok => {
        if (!ok) {
          resolve(false);
          return;
        }
        loaded = true;
        installRenderGuard();

        if (!force && await waitForReady()) {
          resolve(true);
          return;
        }
        resolve(await renderCurrent(force));
      };

      const existing = $('script[data-certificate-runtime-v121]');
      if (existing) {
        if (window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84 || existing.dataset.loaded === 'true') {
          finish(true);
          return;
        }
        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          finish(true);
        }, {once:true});
        existing.addEventListener('error', () => finish(false), {once:true});
        return;
      }

      const script = document.createElement('script');
      script.src = ADMIN_SRC;
      script.async = true;
      script.dataset.certificateRuntimeV121 = 'true';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        finish(true);
      }, {once:true});
      script.addEventListener('error', () => {
        const module = $('[data-admin-v79-module]');
        if (isRoute() && module) {
          module.innerHTML = '<div class="admin-v79-denied"><strong>No fue posible abrir Certificados</strong><span>La sesión sigue activa. Intenta cargar nuevamente este módulo.</span><button type="button" data-admin-v79-refresh>Reintentar</button></div>';
        }
        finish(false);
      }, {once:true});
      document.body.appendChild(script);
    }).finally(() => {
      loading = null;
    });

    return loading;
  }

  function start() {
    if (isRoute()) loadAdmin(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();

  window.ACADEMIA_YAMILET_CERTIFICATE_RUNTIME_V84 = Object.freeze({
    version: VERSION,
    load: loadAdmin,
    refresh: () => loadAdmin(true)
  });
})();