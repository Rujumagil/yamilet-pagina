(() => {
  'use strict';
  const VERSION = '84.0.0';
  let loading = null;
  let loaded = false;
  let timer = null;
  const $ = (s,r=document) => r.querySelector(s);

  function isRoute(){
    const parts=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);
    return parts[0]==='admin'&&parts[1]==='certificates';
  }

  function dashboardReady(){
    const dashboard=$('[data-dashboard]');
    return !!dashboard&&!dashboard.classList.contains('hidden')&&!!$('[data-shell-page="admin"]');
  }

  function remount(){
    if(!isRoute()) return;
    [40,180,420,900].forEach(delay=>setTimeout(()=>{
      window.ACADEMIA_YAMILET_ADMIN?.render?.();
      window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84?.render?.();
    },delay));
  }

  function loadAdmin(){
    if(loaded){remount();return Promise.resolve(true);}
    if(loading) return loading;
    loading=new Promise(resolve=>{
      const existing=$('script[data-certificate-runtime-v84]');
      if(existing){
        if(existing.dataset.loaded==='true'){loaded=true;remount();resolve(true);return;}
        existing.addEventListener('load',()=>{loaded=true;existing.dataset.loaded='true';remount();resolve(true);},{once:true});
        existing.addEventListener('error',()=>resolve(false),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src='./academy-certificate-admin-v84.js?v=84';
      script.async=true;
      script.dataset.certificateRuntimeV84='true';
      script.addEventListener('load',()=>{loaded=true;script.dataset.loaded='true';remount();resolve(true);},{once:true});
      script.addEventListener('error',()=>resolve(false),{once:true});
      document.body.appendChild(script);
    }).finally(()=>{loading=null;});
    return loading;
  }

  function schedule(delay=100){
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      if(!isRoute()||!dashboardReady()) return;
      await loadAdmin();
    },delay);
  }

  function start(){
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-admin-v79-go="certificates"],a[href="#admin/certificates"]')) schedule(120);
    },true);
    window.addEventListener('hashchange',()=>schedule(100));
    window.addEventListener('popstate',()=>schedule(100));
    window.addEventListener('pageshow',()=>schedule(180));
    const observer=new MutationObserver(()=>{if(isRoute()&&dashboardReady()&&!loaded) schedule(80);});
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-admin-v79-section']});
    [300,800,1500].forEach(delay=>setTimeout(()=>schedule(0),delay));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  window.ACADEMIA_YAMILET_CERTIFICATE_RUNTIME_V84={version:VERSION,load:loadAdmin};
})();