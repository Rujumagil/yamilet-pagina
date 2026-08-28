(() => {
  'use strict';

  const VERSION = '81.0.0';
  let loading = null;
  let loaded = false;
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

  function remount() {
    if (!isContentRoute()) return;
    [40,180,520,980].forEach(delay => setTimeout(() => {
      window.ACADEMIA_YAMILET_ADMIN?.render?.();
      window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
    }, delay));
  }

  function loadLegacy() {
    if (loaded) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(resolve => {
      const existing = $('script[data-content-admin-runtime-v80]');
      if (existing) {
        if (existing.dataset.loaded === 'true') { loaded = true; remount(); resolve(true); return; }
        existing.addEventListener('load', () => { loaded = true; existing.dataset.loaded = 'true'; remount(); resolve(true); }, {once:true});
        existing.addEventListener('error', () => resolve(false), {once:true});
        return;
      }
      const root = $('[data-content-admin-root]');
      if (root && !root.children.length) root.innerHTML = '<div class="cms80-runtime-loading"><span></span><strong>Preparando editor de contenido…</strong><small>Conectando cursos, módulos y lecciones.</small></div>';
      const script = document.createElement('script');
      script.src = './content-admin-p15.js?v=80';
      script.async = true;
      script.dataset.contentAdminRuntimeV80 = 'true';
      script.addEventListener('load', () => {
        loaded = true;
        script.dataset.loaded = 'true';
        remount();
        resolve(true);
      }, {once:true});
      script.addEventListener('error', () => {
        const rootNode = $('[data-content-admin-root]');
        if (rootNode) rootNode.innerHTML = '<div class="cms80-runtime-error"><strong>No fue posible abrir el editor</strong><span>Recarga la Academia e intenta nuevamente.</span></div>';
        resolve(false);
      }, {once:true});
      document.body.appendChild(script);
    }).finally(() => { loading = null; });
    return loading;
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
      await loadLegacy();
      window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
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
      if (isContentRoute() && dashboardReady() && !loaded) schedule(80);
      if (isStudentsRoute() && studentsDashboardReady() && !studentsRuntimeLoaded) scheduleStudents(80);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    [300,800,1600].forEach(delay => setTimeout(() => scheduleCurrent(0), delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();

  window.ACADEMIA_YAMILET_CONTENT_RUNTIME = {version:VERSION,load:loadLegacy,loadStudents:loadStudentsRuntime};
})();