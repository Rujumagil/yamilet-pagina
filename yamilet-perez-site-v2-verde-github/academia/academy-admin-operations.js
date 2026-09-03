(() => {
  'use strict';

  const VERSION='123.0.0';
  const $=(s,r=document)=>r.querySelector(s);
  let loading=null;
  let loaded=false;
  let rendering=null;

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

  function loadStudentDeletionAssets(){
    if(!$('link[data-academy-student-delete-v112]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='./academy-student-delete-v112.css?v=112';
      link.dataset.academyStudentDeleteV112='true';
      document.head.appendChild(link);
    }
    if(!$('script[data-academy-student-delete-v112]')){
      const script=document.createElement('script');
      script.src='./academy-student-delete-v112.js?v=112';
      script.defer=true;
      script.dataset.academyStudentDeleteV112='true';
      document.body.appendChild(script);
    }
  }

  function isRoute(){
    const p=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);
    return p[0]==='admin'&&p[1]==='operations';
  }

  function adminModule(){
    const page=$('[data-shell-page="admin"]');
    if(!page||page.classList.contains('hidden'))return null;
    return $('[data-admin-v79-module]',page);
  }

  function operationsReady(){
    const module=adminModule();
    return !!module?.querySelector('[data-ops87-root], .ops87-loading');
  }

  function cleanLegacy(){
    if(!isRoute())return;
    $('[data-commerce-host]')?.remove();
    $('[data-academy-ops]')?.remove();
  }

  async function renderCurrent(force=false){
    if(!isRoute())return false;
    cleanLegacy();
    if(!force&&operationsReady())return true;
    if(rendering&&!force)return rendering;
    const renderer=window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87?.render;
    if(!renderer)return false;
    const promise=Promise.resolve(renderer(force)).then(value=>value!==false).finally(()=>{
      if(rendering===promise)rendering=null;
    });
    rendering=promise;
    return promise;
  }

  function loadAdmin(){
    if(!isRoute())return Promise.resolve(false);
    cleanLegacy();
    if(loaded&&window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87){
      return renderCurrent(false);
    }
    if(loading)return loading;

    loading=new Promise(resolve=>{
      const existing=$('script[data-operations-runtime-v123]')||$('script[data-operations-runtime-v87]');
      if(existing){
        if(window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87){
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
        existing.addEventListener('load',()=>{existing.dataset.loaded='true';finish(!!window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87);},{once:true});
        existing.addEventListener('error',()=>finish(false),{once:true});
        setTimeout(()=>finish(!!window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87),1600);
        return;
      }

      const script=document.createElement('script');
      script.src='./academy-operations-admin-v87.js?v=123';
      script.async=true;
      script.dataset.operationsRuntimeV123='true';
      script.addEventListener('load',async()=>{
        script.dataset.loaded='true';
        loaded=!!window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87;
        if(loaded&&isRoute())await renderCurrent(false);
        resolve(loaded);
      },{once:true});
      script.addEventListener('error',()=>resolve(false),{once:true});
      document.body.appendChild(script);
    }).finally(()=>{loading=null;});

    return loading;
  }

  function start(){
    loadPublicRegistrationAssets();
    loadPendingRegistrationAdminAssets();
    loadStudentDeletionAssets();
    if(isRoute())queueMicrotask(()=>loadAdmin());
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_ADMIN_OPERATIONS=Object.freeze({
    version:VERSION,
    load:loadAdmin,
    render:()=>renderCurrent(true)
  });
})();

(() => {
  'use strict';

  const VERSION='123.0.0';
  const $=(selector,root=document)=>root.querySelector(selector);
  let timer=null;
  let frame=null;
  let assessmentRuntimeLoading=null;

  function routeSection(){
    const parts=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);
    if(parts[0]!=='admin')return null;
    return parts[1]||'overview';
  }

  function adminPage(){return $('[data-shell-page="admin"]');}
  function adminModule(){const page=adminPage();return page?$('[data-admin-v79-module]',page):null;}
  function dashboardMain(){return $('.dashboard-main');}

  function parkNativePanels(activeSection=routeSection()){
    const main=dashboardMain();
    const root=$('[data-admin-v79-root]');
    if(!main||!root)return;
    [
      ['content','[data-content-admin]'],
      ['students','[data-students-admin]']
    ].forEach(([section,selector])=>{
      const panel=$(selector);
      if(!panel||section===activeSection)return;
      if(root.contains(panel)){
        panel.classList.add('hidden');
        panel.classList.remove('admin-v79-native-panel');
        main.appendChild(panel);
      }
    });
  }

  function mountNative(section,selector){
    if(routeSection()!==section)return false;
    const module=adminModule();
    const panel=$(selector);
    if(!module||!panel)return false;
    if(panel.parentElement!==module){
      module.innerHTML='';
      module.appendChild(panel);
    }
    panel.classList.remove('hidden');
    panel.classList.add('admin-v79-native-panel');
    module.style.removeProperty('display');
    return true;
  }

  function loadScript(src,attr){
    const existing=$(`script[${attr}]`);
    if(existing){
      if(existing.dataset.loaded==='true')return Promise.resolve(true);
      return new Promise(resolve=>{
        existing.addEventListener('load',()=>{existing.dataset.loaded='true';resolve(true);},{once:true});
        existing.addEventListener('error',()=>resolve(false),{once:true});
      });
    }
    return new Promise(resolve=>{
      const script=document.createElement('script');
      script.src=src;
      script.async=true;
      script.setAttribute(attr,'true');
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve(true);},{once:true});
      script.addEventListener('error',()=>resolve(false),{once:true});
      document.body.appendChild(script);
    });
  }

  async function ensureAssessmentRuntime(){
    if(window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME?.version==='120.0.0')return true;
    if(assessmentRuntimeLoading)return assessmentRuntimeLoading;
    assessmentRuntimeLoading=loadScript(
      './academy-assessment-runtime-v82.js?v=120',
      'data-assessment-runtime-bridge-v120'
    ).then(()=>window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME?.version==='120.0.0')
      .finally(()=>{assessmentRuntimeLoading=null;});
    return assessmentRuntimeLoading;
  }

  async function repairCurrent(){
    const section=routeSection();
    if(!section)return false;
    parkNativePanels(section);

    if(section==='content'){
      await window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.load?.();
      mountNative('content','[data-content-admin]');
      window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
      return true;
    }

    if(section==='students'){
      await window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.loadStudents?.();
      mountNative('students','[data-students-admin]');
      window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111?.render?.();
      return true;
    }

    if(section==='evaluations'){
      const ready=await ensureAssessmentRuntime();
      if(!ready||routeSection()!=='evaluations')return false;
      await window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME?.load?.();
      window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME?.mount?.();
      return true;
    }

    if(section==='agenda'){
      await window.ACADEMIA_YAMILET_EVENT_ADMIN?.load?.();
      return true;
    }

    if(section==='certificates'){
      await window.ACADEMIA_YAMILET_CERTIFICATE_RUNTIME_V84?.load?.();
      return true;
    }

    if(section==='support'){
      await window.ACADEMIA_YAMILET_EVENT_ADMIN?.load?.();
      return true;
    }

    if(section==='operations'){
      await window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.load?.();
      return true;
    }

    if(section==='settings'){
      await window.ACADEMIA_YAMILET_COMMERCIAL_ADMIN?.load?.();
      return true;
    }

    return true;
  }

  function scheduleRepair(delay=0){
    clearTimeout(timer);
    if(frame)cancelAnimationFrame(frame);
    timer=setTimeout(()=>{
      frame=requestAnimationFrame(()=>{
        frame=null;
        repairCurrent().catch(error=>console.warn('Academia Yamilet admin bridge v123',error));
      });
    },Math.max(0,delay));
  }

  function boot(){
    document.addEventListener('click',event=>{
      const nav=event.target.closest('[data-admin-v79-go],[data-admin-v79-go-card]');
      if(!nav)return;
      const next=nav.dataset.adminV79Go||nav.dataset.adminV79GoCard||null;
      parkNativePanels(next);
    },true);

    window.addEventListener('hashchange',()=>scheduleRepair(0));
    window.addEventListener('pageshow',()=>scheduleRepair(80));
    if(routeSection())scheduleRepair(0);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.ACADEMIA_YAMILET_ADMIN_MOUNT_FIX={version:VERSION,repair:repairCurrent};
})();