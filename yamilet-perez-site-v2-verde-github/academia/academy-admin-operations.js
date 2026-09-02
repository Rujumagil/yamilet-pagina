(() => {
  'use strict';
  const VERSION='111.0.0';
  let loading=null,loaded=false,timer=null;
  const $=(s,r=document)=>r.querySelector(s);

  function loadPublicRegistrationAssets(){
    if(!$('link[data-academy-registration-v111]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='./academy-registration-v109.css?v=111';
      link.dataset.academyRegistrationV111='true';
      document.head.appendChild(link);
    }
    if(!$('script[data-academy-registration-v111]')){
      const script=document.createElement('script');
      script.src='./academy-registration-v111.js?v=111';
      script.defer=true;
      script.dataset.academyRegistrationV111='true';
      document.body.appendChild(script);
    }
  }

  function loadPendingRegistrationAdminAssets(){
    if(!$('link[data-academy-pending-v111]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='./academy-pending-registrations-v110.css?v=111';
      link.dataset.academyPendingV111='true';
      document.head.appendChild(link);
    }
    if(!$('script[data-academy-pending-v111]')){
      const script=document.createElement('script');
      script.src='./academy-pending-registrations-v111.js?v=111';
      script.defer=true;
      script.dataset.academyPendingV111='true';
      document.body.appendChild(script);
    }
  }

  function isRoute(){const p=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[0]==='admin'&&p[1]==='operations';}
  function dashboardReady(){const d=$('[data-dashboard]');return !!d&&!d.classList.contains('hidden')&&!!$('[data-shell-page="admin"]');}
  function cleanLegacy(){if(!isRoute())return;$('[data-commerce-host]')?.remove();$('[data-academy-ops]')?.remove();}
  function remount(){if(!isRoute())return;cleanLegacy();[40,180,420,900].forEach(delay=>setTimeout(()=>{window.ACADEMIA_YAMILET_ADMIN?.render?.();cleanLegacy();setTimeout(()=>window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87?.render?.(),35);},delay));}
  function loadAdmin(){
    if(loaded){remount();return Promise.resolve(true);}if(loading)return loading;
    loading=new Promise(resolve=>{const existing=$('script[data-operations-runtime-v87]');if(existing){if(existing.dataset.loaded==='true'){loaded=true;remount();resolve(true);return;}existing.addEventListener('load',()=>{loaded=true;existing.dataset.loaded='true';remount();resolve(true);},{once:true});existing.addEventListener('error',()=>resolve(false),{once:true});return;}
      const s=document.createElement('script');s.src='./academy-operations-admin-v87.js?v=87';s.async=true;s.dataset.operationsRuntimeV87='true';s.addEventListener('load',()=>{loaded=true;s.dataset.loaded='true';remount();resolve(true);},{once:true});s.addEventListener('error',()=>resolve(false),{once:true});document.body.appendChild(s);
    }).finally(()=>loading=null);return loading;
  }
  function schedule(delay=100){clearTimeout(timer);timer=setTimeout(async()=>{if(!isRoute()||!dashboardReady())return;cleanLegacy();await loadAdmin();if(loaded&&!$('[data-ops87-root]'))remount();},delay);}
  function start(){
    loadPublicRegistrationAssets();
    loadPendingRegistrationAdminAssets();
    document.addEventListener('click',e=>{if(e.target.closest('[data-admin-v79-go="operations"],a[href="#admin/operations"]'))schedule(120);},true);
    window.addEventListener('hashchange',()=>schedule(90));
    window.addEventListener('popstate',()=>schedule(90));
    window.addEventListener('pageshow',()=>schedule(180));
    const o=new MutationObserver(()=>{if(!isRoute()||!dashboardReady())return;cleanLegacy();if(!loaded||!$('[data-ops87-root]'))schedule(80);});
    o.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-admin-v79-section']});
    [300,800,1500].forEach(d=>setTimeout(()=>schedule(0),d));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_ADMIN_OPERATIONS={version:VERSION,render:()=>schedule(0),load:loadAdmin};
})();
