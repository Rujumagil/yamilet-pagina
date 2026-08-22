(() => {
  'use strict';
  let tries = 0;
  let enhancementsLoaded = false;

  const addStyle = (key, href) => {
    if (document.querySelector(`link[data-${key}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset[key.replace(/-/g,'')] = '1';
    document.head.appendChild(link);
  };
  const addScript = (key, src) => {
    if (document.querySelector(`script[data-${key}]`)) return;
    const script = document.createElement('script');
    script.src = src; script.dataset[key.replace(/-/g,'')] = '1';
    document.body.appendChild(script);
  };

  function loadEnhancements(){
    if (enhancementsLoaded) return;
    enhancementsLoaded = true;

    addStyle('yamilet-home-v38','./academy-home-v38.css?v=38'); addScript('yamilet-home-v38','./academy-home-v38.js?v=38');
    addScript('yamilet-language-v39','./academy-language-v39.js?v=39');
    addScript('yamilet-tabs-v41','./academy-tabs-v41.js?v=41');
    addStyle('yamilet-layout-v42','./academy-layout-v42.css?v=42'); addScript('yamilet-layout-v42','./academy-layout-v42.js?v=42');
    addStyle('yamilet-layout-v43','./academy-layout-v43.css?v=43'); addScript('yamilet-layout-v43','./academy-layout-v43.js?v=43');
    addStyle('yamilet-layout-v44','./academy-layout-v44.css?v=44'); addScript('yamilet-layout-v44','./academy-layout-v44.js?v=44');
    addStyle('yamilet-header-v45','./academy-header-v45.css?v=45');
    addStyle('yamilet-header-v46','./academy-header-v46.css?v=46');
    addStyle('yamilet-professional-v47','./academy-professional-v47.css?v=47'); addScript('yamilet-professional-v47','./academy-professional-v47.js?v=47');
    addStyle('yamilet-upcoming-v48','./academy-upcoming-v48.css?v=48'); addScript('yamilet-upcoming-v48','./academy-upcoming-v48.js?v=48');
    addStyle('yamilet-appletv-v49','./academy-appletv-v49.css?v=49'); addStyle('yamilet-appletv-sections-v49','./academy-appletv-sections-v49.css?v=49'); addScript('yamilet-appletv-v49','./academy-appletv-v49.js?v=49');
    addStyle('yamilet-enrollment-v50','./academy-enrollment-v50.css?v=50'); addScript('yamilet-enrollment-v50','./academy-enrollment-v50.js?v=50.1');
    addStyle('yamilet-isolation-v53','./academy-tab-isolation-v53.css?v=53'); addScript('yamilet-isolation-v53','./academy-tab-isolation-v53.js?v=53');
    wireAdminLink();
  }

  function wireAdminLink(){
    const btn = document.querySelector('[data-shell-route="admin"]');
    if (!btn) return false;
    if (btn.dataset.adminSeparated === '1') return true;
    btn.dataset.adminSeparated = '1';
    const label = btn.querySelector('span:last-child');
    if (label) label.textContent = 'Panel administrativo';
    return true;
  }

  function dashboardIsOpen(){
    const dashboard = document.querySelector('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden');
  }

  function bootWhenAuthenticated(){
    if (dashboardIsOpen()) { loadEnhancements(); return; }
    const dashboard = document.querySelector('[data-dashboard]');
    if (!dashboard) return;
    const observer = new MutationObserver(() => {
      if (!dashboardIsOpen()) return;
      observer.disconnect();
      loadEnhancements();
    });
    observer.observe(dashboard,{attributes:true,attributeFilter:['class']});
  }

  function boot(){
    bootWhenAuthenticated();
    const timer = setInterval(() => {
      tries += 1;
      if (enhancementsLoaded || dashboardIsOpen()) { loadEnhancements(); clearInterval(timer); }
      else if (tries >= 80) clearInterval(timer);
    },250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.ACADEMIA_YAMILET_SAFE_LOADER_V53 = { loadEnhancements };
})();