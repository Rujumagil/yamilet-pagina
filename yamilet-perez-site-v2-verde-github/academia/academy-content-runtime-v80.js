(() => {
  'use strict';

  const VERSION = '89.0.0';
  let contentLoading = null;
  let contentLoaded = false;
  let timer = null;
  let studentsRuntimeLoading = null;
  let studentsRuntimeLoaded = false;
  let studentsTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function routeParts(){
    return String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
  }

  function isContentRoute() {
    const parts = routeParts();
    return parts[0] === 'admin' && parts[1] === 'content';
  }

  function isStudentsRoute(){
    const parts = routeParts();
    return parts[0] === 'admin' && parts[1] === 'students';
  }

  function dashboardReady() {
    const dashboard = $('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden') && !!$('[data-content-admin-root]');
  }

  function studentsDashboardReady(){
    const dashboard = $('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden') && !!$('[data-students-admin-root]');
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
      if (existing.dataset.loaded === 'true') return Promise.resolve(true);
      return new Promise(resolve => {
        existing.addEventListener('load', () => { existing.dataset.loaded = 'true'; resolve(true); }, {once:true});
        existing.addEventListener('error', () => resolve(false), {once:true});
      });
    }
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute(attr, 'true');
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(true); }, {once:true});
      script.addEventListener('error', () => resolve(false), {once:true});
      document.body.appendChild(script);
    });
  }

  function remountContent() {
    if (!isContentRoute()) return;
    [40,180,520,980,1600].forEach(delay => setTimeout(() => {
      window.ACADEMIA_YAMILET_ADMIN?.render?.();
      window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
    }, delay));
  }

  async function loadContentStack() {
    if (contentLoaded) {
      remountContent();
      return true;
    }
    if (contentLoading) return contentLoading;

    contentLoading = (async () => {
      ensureStyle('./content-admin-p15.css?v=89', 'data-content-admin-style-v89');
      ensureStyle('./academy-content-cms-v80.css?v=80', 'data-content-cms-style-v80');

      const root = $('[data-content-admin-root]');
      if (root && !root.children.length) {
        root.innerHTML = '<div class="cms80-runtime-loading"><span></span><strong>Preparando editor de contenido…</strong><small>Cargando únicamente las herramientas administrativas necesarias.</small></div>';
      }

      const tusReady = await loadScript(
        'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js',
        'data-content-tus-v89',
        () => !!window.tus
      );
      if (!tusReady) console.warn('Academia Yamilet v89: TUS no disponible; la vinculación manual de Stream sigue disponible.');

      const cmsReady = await loadScript(
        './academy-content-cms-v80.js?v=80',
        'data-content-cms-runtime-v80',
        () => !!window.ACADEMIA_YAMILET_CONTENT_CMS
      );
      if (!cmsReady) return false;

      const editorReady = await loadScript(
        './content-admin-p15.js?v=89',
        'data-content-admin-runtime-v89'
      );
      if (!editorReady) return false;

      await Promise.all([
        loadScript('./academy-video-admin-v62.js?v=62', 'data-video-admin-runtime-v89'),
        loadScript('./academy-video-cloudflare-manual-v64.js?v=64', 'data-video-manual-runtime-v89')
      ]);

      contentLoaded = true;
      remountContent();
      return true;
    })().catch(error => {
      console.error('Academia Yamilet content runtime v89', error);
      return false;
    }).finally(() => { contentLoading = null; });

    const ready = await contentLoading;
    if (!ready) {
      const rootNode = $('[data-content-admin-root]');
      if (rootNode) rootNode.innerHTML = '<div class="cms80-runtime-error"><strong>No fue posible abrir el editor</strong><span>Recarga la Academia e intenta nuevamente.</span></div>';
    }
    return ready;
  }

  function ensureStudentsStyle(){
    if ($('link[data-students81-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './students-p16.css?v=81';
    link.dataset.students81Style = 'true';
    document.head.appendChild(link);
  }

  function loadStudentsRuntime(){
    ensureStudentsStyle();
    if (studentsRuntimeLoaded) {
      window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
      return Promise.resolve(true);
    }
    if (studentsRuntimeLoading) return studentsRuntimeLoading;
    studentsRuntimeLoading = new Promise(resolve => {
      const existing = $('script[data-students81-bridge]');
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          studentsRuntimeLoaded = true;
          window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
          resolve(true);
          return;
        }
        existing.addEventListener('load',() => {
          studentsRuntimeLoaded = true;
          existing.dataset.loaded = 'true';
          window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
          resolve(true);
        },{once:true});
        existing.addEventListener('error',() => resolve(false),{once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = './academy-students-runtime-v81.js?v=81';
      script.async = true;
      script.dataset.students81Bridge = 'true';
      script.addEventListener('load',() => {
        studentsRuntimeLoaded = true;
        script.dataset.loaded = 'true';
        window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
        resolve(true);
      },{once:true});
      script.addEventListener('error',() => resolve(false),{once:true});
      document.body.appendChild(script);
    }).finally(() => { studentsRuntimeLoading = null; });
    return studentsRuntimeLoading;
  }

  function schedule(delay = 100) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!isContentRoute() || !dashboardReady()) return;
      const ready = await loadContentStack();
      if (ready) window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
    }, delay);
  }

  function scheduleStudents(delay = 100){
    clearTimeout(studentsTimer);
    studentsTimer = setTimeout(async () => {
      if (!isStudentsRoute() || !studentsDashboardReady()) return;
      await loadStudentsRuntime();
      window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
    },delay);
  }

  function scheduleCurrent(delay = 100){
    if (isContentRoute()) schedule(delay);
    if (isStudentsRoute()) scheduleStudents(delay);
  }

  function start() {
    document.addEventListener('click', event => {
      if (event.target.closest('[data-admin-v79-go="content"],[data-admin-v79-go-card="content"],[data-content-admin-nav]')) schedule(120);
      if (event.target.closest('[data-admin-v79-go="students"],[data-admin-v79-go-card="students"],[data-students-admin-nav]')) scheduleStudents(120);
    }, true);
    window.addEventListener('hashchange', () => scheduleCurrent(100));
    window.addEventListener('popstate', () => scheduleCurrent(100));
    window.addEventListener('pageshow', () => scheduleCurrent(180));
    const observer = new MutationObserver(() => {
      if (isContentRoute() && dashboardReady() && !contentLoaded) schedule(80);
      if (isStudentsRoute() && studentsDashboardReady() && !studentsRuntimeLoaded) scheduleStudents(80);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    [300,800,1600].forEach(delay => setTimeout(() => scheduleCurrent(0), delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();

  window.ACADEMIA_YAMILET_CONTENT_RUNTIME = {version:VERSION,load:loadContentStack,loadStudents:loadStudentsRuntime};
})();
