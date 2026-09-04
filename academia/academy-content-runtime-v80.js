(() => {
  'use strict';

  const VERSION = '127.0.0';
  const CONTENT_READY_TIMEOUT = 12000;
  const $ = (selector, root = document) => root.querySelector(selector);

  let contentLoading = null;
  let contentLoaded = false;
  let contentReadyPromise = null;
  let videoStackLoading = null;
  let studentsRuntimeLoading = null;
  let studentsRuntimeLoaded = false;

  function routeParts() {
    return String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
  }

  function isContentRoute() {
    const parts = routeParts();
    return parts[0] === 'admin' && parts[1] === 'content';
  }

  function isStudentsRoute() {
    const parts = routeParts();
    return parts[0] === 'admin' && parts[1] === 'students';
  }

  function ensureStyle(href, attr) {
    if ($(`link[${attr}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(attr, 'true');
    document.head.appendChild(link);
  }

  function loadScript(src, attr, globalCheck = null) {
    if (globalCheck?.()) return Promise.resolve(true);
    const selector = `script[${attr}]`;
    const existing = $(selector);
    if (existing) {
      if (existing.dataset.loaded === 'true' || globalCheck?.()) return Promise.resolve(true);
      return new Promise(resolve => {
        const done = ok => resolve(ok);
        existing.addEventListener('load', () => {
          existing.dataset.loaded = 'true';
          done(true);
        }, {once:true});
        existing.addEventListener('error', () => done(false), {once:true});
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

  function contentRootReady() {
    const root = $('[data-content-admin-root]');
    return !!root && !!$('.admin-toolbar', root) && !!$('.course-admin-summary', root);
  }

  function waitForContentReady(timeout = CONTENT_READY_TIMEOUT) {
    if (contentRootReady()) return Promise.resolve(true);
    if (contentReadyPromise) return contentReadyPromise;

    contentReadyPromise = new Promise(resolve => {
      const root = $('[data-content-admin-root]');
      if (!root) {
        resolve(false);
        return;
      }

      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(value);
      };
      const observer = new MutationObserver(() => {
        if (contentRootReady()) finish(true);
      });
      observer.observe(root, {childList:true, subtree:true});
      const timeoutId = setTimeout(() => finish(contentRootReady()), timeout);
    }).finally(() => {
      contentReadyPromise = null;
    });

    return contentReadyPromise;
  }

  function showContentError(message = 'No fue posible abrir el editor de contenido.') {
    const root = $('[data-content-admin-root]');
    if (!root) return;
    root.innerHTML = `<div class="cms80-runtime-error"><strong>${message}</strong><span>La sesión sigue disponible. Puedes intentar cargar nuevamente esta sección.</span><button type="button" data-content-runtime-retry>Reintentar</button></div>`;
    $('[data-content-runtime-retry]', root)?.addEventListener('click', () => {
      contentLoaded = false;
      loadContentStack(true);
    }, {once:true});
  }

  function enhanceContent() {
    if (!isContentRoute()) return false;
    return !!window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
  }

  function loadVideoStack() {
    if (videoStackLoading) return videoStackLoading;
    videoStackLoading = (async () => {
      const tusReady = await loadScript(
        'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js',
        'data-content-tus-v118',
        () => !!window.tus
      );
      if (!tusReady) console.warn('Academia Yamilet v127: TUS no disponible; la vinculación manual de Stream sigue disponible.');

      await Promise.allSettled([
        loadScript('./academy-video-admin-v62.js?v=62', 'data-video-admin-runtime-v118'),
        loadScript('./academy-video-cloudflare-manual-v64.js?v=64', 'data-video-manual-runtime-v118')
      ]);
      return true;
    })().catch(error => {
      console.warn('Academia Yamilet video stack v127', error);
      return false;
    }).finally(() => {
      videoStackLoading = null;
    });
    return videoStackLoading;
  }

  async function loadContentStack(force = false) {
    if (!isContentRoute() && !force) return false;
    if (contentLoaded && !force) {
      enhanceContent();
      void loadVideoStack();
      return true;
    }
    if (contentLoading) return contentLoading;

    contentLoading = (async () => {
      ensureStyle('./content-admin-p15.css?v=89', 'data-content-admin-style-v118');
      ensureStyle('./academy-content-cms-v80.css?v=80', 'data-content-cms-style-v118');
      ensureStyle('./academy-content-refinement-v127.css?v=127', 'data-content-refinement-v127');

      const root = $('[data-content-admin-root]');
      if (root && !root.children.length) {
        root.innerHTML = '<div class="cms80-runtime-loading"><span></span><strong>Preparando editor de contenido…</strong><small>Cargando estructura, lecciones y recursos.</small></div>';
      }

      const [cmsReady, editorReady] = await Promise.all([
        loadScript(
          './academy-content-cms-v80.js?v=118',
          'data-content-cms-runtime-v118',
          () => !!window.ACADEMIA_YAMILET_CONTENT_CMS
        ),
        loadScript('./content-admin-p15.js?v=118', 'data-content-admin-runtime-v118')
      ]);

      if (!cmsReady || !editorReady) return false;

      const ready = await waitForContentReady();
      if (!ready) return false;

      contentLoaded = true;
      enhanceContent();
      void loadVideoStack();
      return true;
    })().catch(error => {
      console.error('Academia Yamilet content runtime v127', error);
      return false;
    }).finally(() => {
      contentLoading = null;
    });

    const ready = await contentLoading;
    if (!ready) showContentError();
    return ready;
  }

  function ensureStudentsStyle() {
    if ($('link[data-students81-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './students-p16.css?v=81';
    link.dataset.students81Style = 'true';
    document.head.appendChild(link);
  }

  async function loadStudentsRuntime() {
    if (!isStudentsRoute()) return false;
    ensureStudentsStyle();

    if (studentsRuntimeLoaded && window.ACADEMIA_YAMILET_STUDENTS_RUNTIME) {
      await window.ACADEMIA_YAMILET_STUDENTS_RUNTIME.load?.();
      return true;
    }
    if (studentsRuntimeLoading) return studentsRuntimeLoading;

    studentsRuntimeLoading = (async () => {
      const ready = await loadScript(
        './academy-students-runtime-v81.js?v=119',
        'data-students119-bridge',
        () => !!window.ACADEMIA_YAMILET_STUDENTS_RUNTIME
      );
      if (!ready) return false;
      studentsRuntimeLoaded = true;
      await window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
      return true;
    })().catch(error => {
      console.error('Academia Yamilet students bridge v119', error);
      return false;
    }).finally(() => {
      studentsRuntimeLoading = null;
    });

    return studentsRuntimeLoading;
  }

  window.ACADEMIA_YAMILET_CONTENT_RUNTIME = Object.freeze({
    version: VERSION,
    load: loadContentStack,
    loadStudents: loadStudentsRuntime,
    enhance: enhanceContent
  });
})();
