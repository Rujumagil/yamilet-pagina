(() => {
  'use strict';
  const VERSION = '83.0.0';
  let loading = null;
  let loaded = false;
  let reviewLoading = null;
  let reviewLoaded = false;
  let timer = null;
  const $ = (selector, root = document) => root.querySelector(selector);

  function isRoute(){
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'evaluations';
  }

  function dashboardReady(){
    const dashboard = $('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden') && !!$('[data-shell-page="admin"]');
  }

  function remount(){
    if(!isRoute()) return;
    [40,180,420,900].forEach(delay => setTimeout(() => {
      window.ACADEMIA_YAMILET_ADMIN?.render?.();
      window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN?.render?.();
      window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83?.refresh?.();
    },delay));
  }

  function loadReviewIntegration(){
    if(reviewLoaded){ window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83?.refresh?.(); return Promise.resolve(true); }
    if(reviewLoading) return reviewLoading;
    reviewLoading = new Promise(resolve => {
      const existing = $('script[data-assessment-review-runtime-v83]');
      if(existing){
        if(existing.dataset.loaded === 'true'){ reviewLoaded = true; resolve(true); return; }
        existing.addEventListener('load',() => { reviewLoaded = true; existing.dataset.loaded = 'true'; resolve(true); },{once:true});
        existing.addEventListener('error',() => resolve(false),{once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = './academy-assessment-review-v83.js?v=83';
      script.async = true;
      script.dataset.assessmentReviewRuntimeV83 = 'true';
      script.addEventListener('load',() => {
        reviewLoaded = true;
        script.dataset.loaded = 'true';
        window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83?.refresh?.();
        resolve(true);
      },{once:true});
      script.addEventListener('error',() => resolve(false),{once:true});
      document.body.appendChild(script);
    }).finally(() => { reviewLoading = null; });
    return reviewLoading;
  }

  function loadBuilder(){
    if(loaded){ remount(); return Promise.resolve(true); }
    if(loading) return loading;
    loading = new Promise(resolve => {
      const existing = $('script[data-assessment-runtime-v82]');
      if(existing){
        if(existing.dataset.loaded === 'true'){ loaded = true; remount(); resolve(true); return; }
        existing.addEventListener('load',() => { loaded = true; existing.dataset.loaded = 'true'; remount(); resolve(true); },{once:true});
        existing.addEventListener('error',() => resolve(false),{once:true});
        return;
      }
      const page = $('[data-shell-page="admin"]');
      if(page && !$('[data-assessment-admin-host]',page)){
        const host = document.createElement('div');
        host.dataset.assessmentAdminHost = 'true';
        host.innerHTML = '<section class="assess82 assess82-loading"><span></span><strong>Preparando constructor de evaluaciones…</strong><small>Cargando herramienta académica.</small></section>';
        page.appendChild(host);
      }
      const script = document.createElement('script');
      script.src = './academy-assessment-admin.js?v=82';
      script.async = true;
      script.dataset.assessmentRuntimeV82 = 'true';
      script.addEventListener('load',() => { loaded = true; script.dataset.loaded = 'true'; remount(); resolve(true); },{once:true});
      script.addEventListener('error',() => {
        const host = $('[data-assessment-admin-host]');
        if(host) host.innerHTML = '<section class="assess82 assess82-error"><strong>No fue posible abrir Evaluaciones</strong><span>Recarga la Academia e intenta nuevamente.</span></section>';
        resolve(false);
      },{once:true});
      document.body.appendChild(script);
    }).finally(() => { loading = null; });
    return loading;
  }

  function schedule(delay = 100){
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if(!isRoute() || !dashboardReady()) return;
      const ready = await loadBuilder();
      if(ready) await loadReviewIntegration();
    },delay);
  }

  function restoreSearchFocus(position){
    setTimeout(() => {
      const input = $('[data-assess82-search]');
      if(!input || !isRoute()) return;
      input.focus({preventScroll:true});
      if(Number.isInteger(position) && input.setSelectionRange) input.setSelectionRange(position,position);
    },0);
  }

  function start(){
    document.addEventListener('click',event => {
      if(event.target.closest('[data-admin-v79-go="evaluations"],a[href="#admin/evaluations"]')) schedule(120);
    },true);
    document.addEventListener('input',event => {
      if(!event.target.matches?.('[data-assess82-search]')) return;
      restoreSearchFocus(event.target.selectionStart);
    },true);
    window.addEventListener('hashchange',() => schedule(100));
    window.addEventListener('popstate',() => schedule(100));
    window.addEventListener('pageshow',() => schedule(180));
    const observer = new MutationObserver(() => {
      if(isRoute() && dashboardReady() && (!loaded || !reviewLoaded)) schedule(80);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    [300,800,1500].forEach(delay => setTimeout(() => schedule(0),delay));
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME = {version:VERSION,load:async () => { const ready = await loadBuilder(); if(ready) await loadReviewIntegration(); return ready; }};
})();