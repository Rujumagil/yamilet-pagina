(() => {
  'use strict';

  const VERSION = '81.0.0';
  let loading = null;
  let loaded = false;
  let timer = null;
  let dashboardObserver = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function isStudentsRoute(){
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'students';
  }

  function dashboardReady(){
    const dashboard = $('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden') && !!$('[data-students-admin-root]');
  }

  function remount(){
    if (!isStudentsRoute()) return;
    window.ACADEMIA_YAMILET_STUDENTS?.bootstrap?.();
    window.ACADEMIA_YAMILET_ADMIN?.render?.();
    [160,420,900].forEach(delay => setTimeout(() => {
      if (!isStudentsRoute()) return;
      window.ACADEMIA_YAMILET_ADMIN?.render?.();
    },delay));
  }

  function loadStudents(){
    if (loaded) { remount(); return Promise.resolve(true); }
    if (loading) return loading;
    loading = new Promise(resolve => {
      const existing = $('script[data-students-runtime-v81]');
      if (existing) {
        if (existing.dataset.loaded === 'true') { loaded = true; remount(); resolve(true); return; }
        existing.addEventListener('load',() => { loaded = true; existing.dataset.loaded = 'true'; remount(); resolve(true); },{once:true});
        existing.addEventListener('error',() => resolve(false),{once:true});
        return;
      }
      const root = $('[data-students-admin-root]');
      if (root && !root.children.length) root.innerHTML = '<div class="students81-runtime-loading"><span></span><strong>Preparando Estudiantes…</strong><small>Conectando accesos y seguimiento académico.</small></div>';
      const script = document.createElement('script');
      script.src = './students-p16.js?v=81';
      script.async = true;
      script.dataset.studentsRuntimeV81 = 'true';
      script.addEventListener('load',() => {
        loaded = true;
        script.dataset.loaded = 'true';
        remount();
        resolve(true);
      },{once:true});
      script.addEventListener('error',() => {
        const rootNode = $('[data-students-admin-root]');
        if (rootNode) rootNode.innerHTML = '<div class="students81-error"><strong>No fue posible abrir Estudiantes</strong><span>Recarga la Academia e inténtalo nuevamente.</span></div>';
        resolve(false);
      },{once:true});
      document.body.appendChild(script);
    }).finally(() => { loading = null; });
    return loading;
  }

  function schedule(delay = 100){
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!isStudentsRoute() || !dashboardReady()) return;
      await loadStudents();
      remount();
    },delay);
  }

  function watchDashboard(){
    const dashboard = $('[data-dashboard]');
    if (!dashboard) { setTimeout(watchDashboard,250); return; }
    dashboardObserver?.disconnect();
    dashboardObserver = new MutationObserver(() => {
      if (isStudentsRoute() && !dashboard.classList.contains('hidden')) schedule(80);
    });
    dashboardObserver.observe(dashboard,{attributes:true,attributeFilter:['class']});
  }

  function start(){
    document.addEventListener('click',event => {
      if (event.target.closest('[data-admin-v79-go="students"],[data-admin-v79-go-card="students"],[data-students-admin-nav]')) schedule(120);
    },true);
    window.addEventListener('hashchange',() => schedule(100));
    window.addEventListener('popstate',() => schedule(100));
    window.addEventListener('pageshow',() => schedule(180));
    watchDashboard();
    [280,760,1500].forEach(delay => setTimeout(() => schedule(0),delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_STUDENTS_RUNTIME = {version:VERSION,load:loadStudents};
})();
