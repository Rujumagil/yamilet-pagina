(() => {
  'use strict';

  const VERSION = '119.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);

  let scriptPromise = null;
  let loaded = false;
  let bootPromise = null;
  let booted = false;

  function isStudentsRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'students';
  }

  function section() {
    return $('[data-students-admin]');
  }

  function root() {
    return $('[data-students-admin-root]');
  }

  function ensureStyle() {
    if ($('link[data-students81-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './students-p16.css?v=81';
    link.dataset.students81Style = 'true';
    document.head.appendChild(link);
  }

  function showPanel() {
    if (!isStudentsRoute()) return false;
    section()?.classList.remove('hidden');
    return true;
  }

  function showLoading() {
    const host = root();
    if (!host || host.children.length) return;
    host.innerHTML = '<div class="students81-runtime-loading"><span></span><strong>Preparando Estudiantes…</strong><small>Cargando accesos, solicitudes y seguimiento académico.</small></div>';
  }

  function showError() {
    const host = root();
    if (!host) return;
    host.innerHTML = '<div class="students81-error"><strong>No fue posible abrir Estudiantes</strong><span>La sesión sigue activa. Pulsa Reintentar para cargar nuevamente.</span><button type="button" data-students119-retry>Reintentar</button></div>';
    $('[data-students119-retry]', host)?.addEventListener('click', () => {
      loaded = false;
      booted = false;
      loadStudents(true);
    }, { once: true });
  }

  function loadScript() {
    if (window.ACADEMIA_YAMILET_STUDENTS) {
      loaded = true;
      return Promise.resolve(true);
    }
    if (scriptPromise) return scriptPromise;

    ensureStyle();
    showLoading();

    scriptPromise = new Promise(resolve => {
      const existing = $('script[data-students-runtime-v81]');
      if (existing) {
        if (window.ACADEMIA_YAMILET_STUDENTS || existing.dataset.loaded === 'true') {
          loaded = true;
          resolve(true);
          return;
        }
        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          loaded = !!window.ACADEMIA_YAMILET_STUDENTS;
          resolve(loaded);
        }, { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = './students-p16.js?v=81';
      script.async = true;
      script.dataset.studentsRuntimeV81 = 'true';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        loaded = !!window.ACADEMIA_YAMILET_STUDENTS;
        resolve(loaded);
      }, { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      document.body.appendChild(script);
    }).finally(() => {
      scriptPromise = null;
    });

    return scriptPromise;
  }

  async function bootstrapOnce(force = false) {
    if (!isStudentsRoute()) return false;
    if (booted && !force) return true;
    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
      const api = window.ACADEMIA_YAMILET_STUDENTS;
      if (!api) return false;
      const result = await api.bootstrap?.();
      booted = result !== false;
      return booted;
    })().catch(error => {
      console.warn('Academia Yamilet students runtime v119 bootstrap', error);
      return false;
    }).finally(() => {
      bootPromise = null;
    });

    return bootPromise;
  }

  async function mountPending() {
    const pending = window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111;
    if (!pending) return false;
    if (typeof pending.mount === 'function') return pending.mount();
    if (typeof pending.render === 'function') return pending.render();
    return false;
  }

  async function loadStudents(force = false) {
    if (!isStudentsRoute()) return false;
    showPanel();
    ensureStyle();

    if (!loaded || !window.ACADEMIA_YAMILET_STUDENTS) {
      const ready = await loadScript();
      if (!ready) {
        showError();
        return false;
      }
    }

    const ready = await bootstrapOnce(force);
    if (!ready) {
      showError();
      return false;
    }

    showPanel();
    await mountPending();
    return true;
  }

  async function refresh() {
    if (!isStudentsRoute()) return false;
    const api = window.ACADEMIA_YAMILET_STUDENTS;
    if (!api) return loadStudents(true);
    try {
      await api.refresh?.();
      booted = true;
      await window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111?.refresh?.();
      return true;
    } catch (error) {
      console.warn('Academia Yamilet students runtime v119 refresh', error);
      return false;
    }
  }

  window.ACADEMIA_YAMILET_STUDENTS_RUNTIME = Object.freeze({
    version: VERSION,
    load: loadStudents,
    refresh
  });
})();
