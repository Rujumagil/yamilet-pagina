(() => {
  'use strict';
  const VERSION='112.0.0';
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
    loadStudentDeletionAssets();
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

(() => {
  'use strict';

  const VERSION = '113.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  let repairTimer = null;
  let observer = null;

  function routeSection() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    if (parts[0] !== 'admin') return null;
    return parts[1] || 'overview';
  }

  function adminPage() {
    return $('[data-shell-page="admin"]');
  }

  function adminModule() {
    const page = adminPage();
    return page ? $('[data-admin-v79-module]', page) : null;
  }

  function dashboardMain() {
    return $('.dashboard-main');
  }

  function parkNativePanels(activeSection = routeSection()) {
    const main = dashboardMain();
    const root = $('[data-admin-v79-root]');
    if (!main || !root) return;

    [
      ['content', '[data-content-admin]'],
      ['students', '[data-students-admin]']
    ].forEach(([section, selector]) => {
      const panel = $(selector);
      if (!panel) return;
      if (section === activeSection) return;
      if (root.contains(panel)) {
        panel.classList.add('hidden');
        panel.classList.remove('admin-v79-native-panel');
        main.appendChild(panel);
      }
    });
  }

  function mountNative(section, selector) {
    if (routeSection() !== section) return false;
    const module = adminModule();
    const panel = $(selector);
    if (!module || !panel) return false;

    if (panel.parentElement !== module) {
      module.innerHTML = '';
      module.appendChild(panel);
    }
    panel.classList.remove('hidden');
    panel.classList.add('admin-v79-native-panel');
    module.style.removeProperty('display');
    return true;
  }

  function moveAssessmentHost() {
    if (routeSection() !== 'evaluations') return false;
    const page = adminPage();
    const module = adminModule();
    if (!page || !module) return false;
    const host = $('[data-assessment-admin-host]', page);
    if (!host) return false;

    if (host.parentElement !== module) {
      module.innerHTML = '';
      module.appendChild(host);
    }
    host.style.setProperty('display', 'block', 'important');
    return true;
  }

  function ensureScript(src, attr, globalCheck) {
    if (globalCheck?.()) return Promise.resolve(true);
    const existing = $(`script[${attr}]`);
    if (existing) {
      if (globalCheck?.()) return Promise.resolve(true);
      return new Promise(resolve => {
        const done = () => resolve(!!globalCheck?.());
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        setTimeout(done, 1200);
      });
    }
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute(attr, 'true');
      script.addEventListener('load', () => resolve(!!globalCheck?.()), { once: true });
      script.addEventListener('error', () => resolve(false), { once: true });
      document.body.appendChild(script);
    });
  }

  async function repairEvaluations() {
    if (routeSection() !== 'evaluations') return;

    await ensureScript(
      './academy-assessment-admin.js?v=113',
      'data-assessment-admin-hotfix-v113',
      () => !!window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN
    );

    if (routeSection() !== 'evaluations') return;
    const renderPromise = window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN?.render?.();
    moveAssessmentHost();
    Promise.resolve(renderPromise).finally(() => moveAssessmentHost());
    [50, 140, 320, 700, 1400].forEach(delay => setTimeout(moveAssessmentHost, delay));
  }

  async function repairCurrent() {
    const section = routeSection();
    if (!section) return;

    parkNativePanels(section);

    if (section === 'content') {
      window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.load?.();
      mountNative('content', '[data-content-admin]');
      [80, 220, 520, 1000].forEach(delay => setTimeout(() => {
        mountNative('content', '[data-content-admin]');
        window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
      }, delay));
      return;
    }

    if (section === 'students') {
      window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.loadStudents?.();
      mountNative('students', '[data-students-admin]');
      [80, 220, 520, 1000].forEach(delay => setTimeout(() => {
        mountNative('students', '[data-students-admin]');
        window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
      }, delay));
      return;
    }

    if (section === 'evaluations') {
      repairEvaluations();
      return;
    }

    if (section === 'agenda') {
      window.ACADEMIA_YAMILET_EVENT_ADMIN?.load?.();
      [120, 360, 800].forEach(delay => setTimeout(() => window.ACADEMIA_YAMILET_AGENDA_ADMIN_V85?.render?.(), delay));
      return;
    }

    if (section === 'certificates') {
      window.ACADEMIA_YAMILET_CERTIFICATE_RUNTIME_V84?.load?.();
      [120, 360, 800].forEach(delay => setTimeout(() => window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84?.render?.(), delay));
      return;
    }

    if (section === 'support') {
      window.ACADEMIA_YAMILET_EVENT_ADMIN?.load?.();
      [120, 360, 800].forEach(delay => setTimeout(() => window.ACADEMIA_YAMILET_SUPPORT_ADMIN_V86?.render?.(), delay));
      return;
    }

    if (section === 'operations') {
      window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.load?.();
      [120, 360, 800].forEach(delay => setTimeout(() => window.ACADEMIA_YAMILET_OPERATIONS_ADMIN_V87?.render?.(), delay));
      return;
    }

    if (section === 'settings') {
      window.ACADEMIA_YAMILET_COMMERCIAL_ADMIN?.load?.();
      [120, 360, 800].forEach(delay => setTimeout(() => window.ACADEMIA_YAMILET_SETTINGS_ADMIN_V88?.render?.(), delay));
    }
  }

  function scheduleRepair(delay = 60) {
    clearTimeout(repairTimer);
    repairTimer = setTimeout(repairCurrent, delay);
  }

  function boot() {
    document.addEventListener('click', event => {
      const nav = event.target.closest('[data-admin-v79-go],[data-admin-v79-go-card]');
      if (!nav) return;
      const next = nav.dataset.adminV79Go || nav.dataset.adminV79GoCard || null;
      parkNativePanels(next);
      [40, 140, 340, 760].forEach(delay => setTimeout(() => scheduleRepair(0), delay));
    }, true);

    window.addEventListener('hashchange', () => {
      parkNativePanels(routeSection());
      [30, 120, 320, 700].forEach(delay => setTimeout(() => scheduleRepair(0), delay));
    });
    window.addEventListener('popstate', () => scheduleRepair(50));
    window.addEventListener('pageshow', () => scheduleRepair(100));

    observer = new MutationObserver(() => {
      const section = routeSection();
      if (!section) return;
      if (section === 'evaluations') moveAssessmentHost();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    [250, 700, 1500].forEach(delay => setTimeout(() => scheduleRepair(0), delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.ACADEMIA_YAMILET_ADMIN_MOUNT_FIX = { version: VERSION, repair: repairCurrent };
})();
