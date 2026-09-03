(() => {
  'use strict';

  const VERSION='123.0.0';
  const $=(selector,root=document)=>root.querySelector(selector);
  let loading=null;
  let loaded=false;
  let rendering=null;

  function isRoute(){
    const parts=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);
    return parts[0]==='admin'&&parts[1]==='settings';
  }

  function adminModule(){
    const page=$('[data-shell-page="admin"]');
    if(!page||page.classList.contains('hidden'))return null;
    return $('[data-admin-v79-module]',page);
  }

  function settingsReady(){
    const module=adminModule();
    return !!module?.querySelector('[data-settings88-root], .settings88-loading');
  }

  function cleanLegacy(){
    if(!isRoute())return;
    $('[data-commerce-host]')?.remove();
  }

  async function renderCurrent(force=false){
    if(!isRoute())return false;
    cleanLegacy();
    if(!force&&settingsReady())return true;
    if(rendering&&!force)return rendering;
    const renderer=window.ACADEMIA_YAMILET_SETTINGS_ADMIN_V88?.render;
    if(!renderer)return false;
    const promise=Promise.resolve(renderer(force)).then(value=>value!==false).finally(()=>{
      if(rendering===promise)rendering=null;
    });
    rendering=promise;
    return promise;
  }

  function load(){
    if(!isRoute())return Promise.resolve(false);
    cleanLegacy();
    if(loaded&&window.ACADEMIA_YAMILET_SETTINGS_ADMIN_V88){
      return renderCurrent(false);
    }
    if(loading)return loading;

    loading=new Promise(resolve=>{
      const existing=$('script[data-settings-runtime-v123]')||$('script[data-settings-runtime-v88]');
      if(existing){
        if(window.ACADEMIA_YAMILET_SETTINGS_ADMIN_V88){
          loaded=true;
          resolve(true);
          return;
        }
        let settled=false;
        const finish=async ok=>{
          if(settled)return;
          settled=true;
          loaded=!!ok;
          if(ok&&isRoute())await renderCurrent(false);
          resolve(!!ok);
        };
        existing.addEventListener('load',()=>{existing.dataset.loaded='true';finish(!!window.ACADEMIA_YAMILET_SETTINGS_ADMIN_V88);},{once:true});
        existing.addEventListener('error',()=>finish(false),{once:true});
        setTimeout(()=>finish(!!window.ACADEMIA_YAMILET_SETTINGS_ADMIN_V88),1600);
        return;
      }

      const script=document.createElement('script');
      script.src='./academy-settings-admin-v88.js?v=123';
      script.async=true;
      script.dataset.settingsRuntimeV123='true';
      script.addEventListener('load',async()=>{
        script.dataset.loaded='true';
        loaded=!!window.ACADEMIA_YAMILET_SETTINGS_ADMIN_V88;
        if(loaded&&isRoute())await renderCurrent(false);
        resolve(loaded);
      },{once:true});
      script.addEventListener('error',()=>resolve(false),{once:true});
      document.body.appendChild(script);
    }).finally(()=>{loading=null;});

    return loading;
  }

  window.ACADEMIA_YAMILET_COMMERCIAL_ADMIN=Object.freeze({
    version:VERSION,
    load,
    render:()=>renderCurrent(true)
  });

  if(isRoute())queueMicrotask(()=>load());
})();