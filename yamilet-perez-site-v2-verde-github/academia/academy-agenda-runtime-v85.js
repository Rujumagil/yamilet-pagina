(() => {
  'use strict';
  const VERSION='85.0.0';
  let loading=null,loaded=false,timer=null;
  const $=(s,r=document)=>r.querySelector(s);
  function isRoute(){const p=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[0]==='admin'&&p[1]==='agenda';}
  function dashboardReady(){const d=$('[data-dashboard]');return !!d&&!d.classList.contains('hidden')&&!!$('[data-shell-page="admin"]');}
  function remount(){if(!isRoute())return;[40,180,420,900].forEach(delay=>setTimeout(()=>{window.ACADEMIA_YAMILET_ADMIN?.render?.();setTimeout(()=>window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85?.render?.(),35);},delay));}
  function loadAdmin(){
    if(loaded){remount();return Promise.resolve(true);}if(loading)return loading;
    loading=new Promise(resolve=>{const existing=$('script[data-agenda-runtime-v85]');if(existing){if(existing.dataset.loaded==='true'){loaded=true;remount();resolve(true);return;}existing.addEventListener('load',()=>{loaded=true;existing.dataset.loaded='true';remount();resolve(true);},{once:true});existing.addEventListener('error',()=>resolve(false),{once:true});return;}
      const s=document.createElement('script');s.src='./academy-agenda-admin-v85.js?v=85';s.async=true;s.dataset.agendaRuntimeV85='true';s.addEventListener('load',()=>{loaded=true;s.dataset.loaded='true';remount();resolve(true);},{once:true});s.addEventListener('error',()=>resolve(false),{once:true});document.body.appendChild(s);
    }).finally(()=>{loading=null;});return loading;
  }
  function schedule(delay=100){clearTimeout(timer);timer=setTimeout(async()=>{if(!isRoute()||!dashboardReady())return;await loadAdmin();if(loaded&&!$('[data-agenda85-root]'))remount();},delay);}
  function start(){document.addEventListener('click',e=>{if(e.target.closest('[data-admin-v79-go="agenda"],a[href="#admin/agenda"]'))schedule(120);},true);window.addEventListener('hashchange',()=>schedule(90));window.addEventListener('popstate',()=>schedule(90));window.addEventListener('pageshow',()=>schedule(180));const o=new MutationObserver(()=>{if(isRoute()&&dashboardReady()&&(!loaded||!$('[data-agenda85-root]')))schedule(80);});o.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-admin-v79-section']});[300,800,1500].forEach(d=>setTimeout(()=>schedule(0),d));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_AGENDA_RUNTIME_V85={version:VERSION,load:loadAdmin};
})();