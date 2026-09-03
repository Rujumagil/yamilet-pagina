(() => {
  'use strict';
  const VERSION='114.0.0';
  const state={agenda:{loading:null,loaded:false},support:{loading:null,loaded:false}};
  let timer=null,opsWrapped=false,agendaWrapped=false;
  const $=(s,r=document)=>r.querySelector(s);
  function section(){const p=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);if(p[0]!=='admin')return null;return p[1]==='agenda'?'agenda':p[1]==='support'?'support':null;}
  function dashboardReady(){const d=$('[data-dashboard]');return !!d&&!d.classList.contains('hidden')&&!!$('[data-shell-page="admin"]');}
  function cleanupSupportLegacy(){if(section()!=='support')return;const page=$('[data-shell-page="admin"]');if(!page)return;page.querySelectorAll('[data-academy-ops]').forEach(node=>node.remove());}
  function guardOperations(){if(opsWrapped||!window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.render)return;const original=window.ACADEMIA_YAMILET_ADMIN_OPERATIONS.render.bind(window.ACADEMIA_YAMILET_ADMIN_OPERATIONS);window.ACADEMIA_YAMILET_ADMIN_OPERATIONS.render=(...args)=>section()==='support'?Promise.resolve(false):original(...args);opsWrapped=true;}
  function agendaIsBusyOrReady(){const module=$('[data-admin-v79-module]');return !!module?.querySelector('[data-agenda85-root],.agenda85-loading');}
  function guardAgenda(){
    if(agendaWrapped||!window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85?.render)return;
    const original=window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85.render.bind(window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85);
    window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85.render=(...args)=>{
      if(section()!=='agenda')return Promise.resolve(false);
      if(agendaIsBusyOrReady())return Promise.resolve(true);
      return original(...args);
    };
    agendaWrapped=true;
  }
  function remount(kind){
    if(section()!==kind)return;
    if(kind==='agenda')guardAgenda();
    [40,180,420,900].forEach(delay=>setTimeout(()=>{
      if(section()!==kind)return;
      if(kind==='agenda'&&agendaIsBusyOrReady())return;
      if(kind==='support'){guardOperations();cleanupSupportLegacy();}
      const module=$('[data-admin-v79-module]');
      if(!module)window.ACADEMIA_YAMILET_ADMIN?.render?.();
      setTimeout(()=>{
        if(section()!==kind)return;
        if(kind==='support'){cleanupSupportLegacy();window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86?.render?.();}
        else{guardAgenda();if(!agendaIsBusyOrReady())window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85?.render?.();}
      },35);
    },delay));
  }
  function load(kind){
    const item=state[kind];if(item.loaded){remount(kind);return Promise.resolve(true);}if(item.loading)return item.loading;
    if(kind==='support'){guardOperations();cleanupSupportLegacy();}
    const cfg=kind==='agenda'?{src:'./academy-agenda-admin-v85.js?v=85',attr:'agendaRuntimeV85'}:{src:'./academy-support-admin-v86.js?v=86',attr:'supportRuntimeV86'};
    item.loading=new Promise(resolve=>{const selector=kind==='agenda'?'script[data-agenda-runtime-v85]':'script[data-support-runtime-v86]';const existing=$(selector);if(existing){if(existing.dataset.loaded==='true'){item.loaded=true;if(kind==='agenda')guardAgenda();remount(kind);resolve(true);return;}existing.addEventListener('load',()=>{item.loaded=true;existing.dataset.loaded='true';if(kind==='agenda')guardAgenda();remount(kind);resolve(true);},{once:true});existing.addEventListener('error',()=>resolve(false),{once:true});return;}
      const s=document.createElement('script');s.src=cfg.src;s.async=true;s.dataset[cfg.attr]='true';s.addEventListener('load',()=>{item.loaded=true;s.dataset.loaded='true';if(kind==='agenda')guardAgenda();remount(kind);resolve(true);},{once:true});s.addEventListener('error',()=>resolve(false),{once:true});document.body.appendChild(s);
    }).finally(()=>{item.loading=null;});return item.loading;
  }
  function schedule(delay=100){clearTimeout(timer);timer=setTimeout(async()=>{const kind=section();if(!kind||!dashboardReady())return;if(kind==='support'){guardOperations();cleanupSupportLegacy();[60,160,320,700,1300,2400].forEach(d=>setTimeout(cleanupSupportLegacy,d));}await load(kind);if(kind==='agenda'){guardAgenda();if(state.agenda.loaded&&!agendaIsBusyOrReady())remount('agenda');return;}const root='[data-support86-root]';if(state.support.loaded&&!$(root))remount('support');},delay);}
  function start(){document.addEventListener('click',e=>{if(e.target.closest('[data-admin-v79-go="agenda"],[data-admin-v79-go="support"],a[href="#admin/agenda"],a[href="#admin/support"]'))schedule(120);},true);window.addEventListener('hashchange',()=>schedule(90));window.addEventListener('popstate',()=>schedule(90));window.addEventListener('pageshow',()=>schedule(180));const o=new MutationObserver(()=>{const kind=section();if(!kind||!dashboardReady())return;if(kind==='support'){guardOperations();cleanupSupportLegacy();if(!state.support.loaded||!$('[data-support86-root]'))schedule(80);return;}guardAgenda();if(!state.agenda.loaded||!agendaIsBusyOrReady())schedule(80);});o.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-admin-v79-section']});[300,800,1500].forEach(d=>setTimeout(()=>schedule(0),d));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_EVENT_ADMIN={version:VERSION,render:()=>schedule(0),load:()=>{const kind=section()||'agenda';return load(kind);}};
})();
