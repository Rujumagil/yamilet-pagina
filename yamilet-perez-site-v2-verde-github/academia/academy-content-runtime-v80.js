(() => {
  'use strict';

  const VERSION = '80.0.0';
  let loading = null;
  let loaded = false;
  let timer = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function isContentRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'content';
  }

  function dashboardReady() {
    const dashboard = $('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden') && !!$('[data-content-admin-root]');
  }

  function loadLegacy() {
    if (loaded) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(resolve => {
      const existing = $('script[data-content-admin-runtime-v80]');
      if (existing) {
        if (existing.dataset.loaded === 'true') { loaded = true; resolve(true); return; }
        existing.addEventListener('load', () => { loaded = true; existing.dataset.loaded = 'true'; resolve(true); }, {once:true});
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
        resolve(true);
        [350,850,1500].forEach(delay => setTimeout(() => window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.(), delay));
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

  function schedule(delay = 100) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!isContentRoute() || !dashboardReady()) return;
      await loadLegacy();
      window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
    }, delay);
  }

  function start() {
    document.addEventListener('click', event => {
      if (event.target.closest('[data-admin-v79-go="content"],[data-admin-v79-go-card="content"],[data-content-admin-nav]')) schedule(120);
    }, true);
    window.addEventListener('hashchange', () => schedule(100));
    window.addEventListener('popstate', () => schedule(100));
    window.addEventListener('pageshow', () => schedule(180));
    const observer = new MutationObserver(() => {
      if (isContentRoute() && dashboardReady() && !loaded) schedule(80);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    [300,800,1600].forEach(delay => setTimeout(() => schedule(0), delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();

  window.ACADEMIA_YAMILET_CONTENT_RUNTIME = {version:VERSION,load:loadLegacy};
})();