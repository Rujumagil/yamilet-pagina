(() => {
  'use strict';
  let tries = 0;

  function loadHomeV38(){
    if (!document.querySelector('link[data-yamilet-home-v38]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-home-v38.css?v=38';
      link.dataset.yamiletHomeV38 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-home-v38]')) {
      const script = document.createElement('script');
      script.src = './academy-home-v38.js?v=38';
      script.dataset.yamiletHomeV38 = '1';
      document.body.appendChild(script);
    }
  }

  function loadLanguageV39(){
    if (document.querySelector('script[data-yamilet-language-v39]')) return;
    const script = document.createElement('script');
    script.src = './academy-language-v39.js?v=39';
    script.dataset.yamiletLanguageV39 = '1';
    document.body.appendChild(script);
  }

  function loadTabsV41(){
    if (document.querySelector('script[data-yamilet-tabs-v41]')) return;
    const script = document.createElement('script');
    script.src = './academy-tabs-v41.js?v=41';
    script.dataset.yamiletTabsV41 = '1';
    document.body.appendChild(script);
  }

  function loadLayoutV42(){
    if (!document.querySelector('link[data-yamilet-layout-v42]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-layout-v42.css?v=42';
      link.dataset.yamiletLayoutV42 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-layout-v42]')) {
      const script = document.createElement('script');
      script.src = './academy-layout-v42.js?v=42';
      script.dataset.yamiletLayoutV42 = '1';
      document.body.appendChild(script);
    }
  }

  function loadLayoutV43(){
    if (!document.querySelector('link[data-yamilet-layout-v43]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-layout-v43.css?v=43';
      link.dataset.yamiletLayoutV43 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-layout-v43]')) {
      const script = document.createElement('script');
      script.src = './academy-layout-v43.js?v=43';
      script.dataset.yamiletLayoutV43 = '1';
      document.body.appendChild(script);
    }
  }

  function loadLayoutV44(){
    if (!document.querySelector('link[data-yamilet-layout-v44]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-layout-v44.css?v=44';
      link.dataset.yamiletLayoutV44 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-layout-v44]')) {
      const script = document.createElement('script');
      script.src = './academy-layout-v44.js?v=44';
      script.dataset.yamiletLayoutV44 = '1';
      document.body.appendChild(script);
    }
  }

  function loadHeaderV45(){
    if (document.querySelector('link[data-yamilet-header-v45]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './academy-header-v45.css?v=45';
    link.dataset.yamiletHeaderV45 = '1';
    document.head.appendChild(link);
  }

  function loadHeaderV46(){
    if (document.querySelector('link[data-yamilet-header-v46]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './academy-header-v46.css?v=46';
    link.dataset.yamiletHeaderV46 = '1';
    document.head.appendChild(link);
  }

  function loadProfessionalV47(){
    if (!document.querySelector('link[data-yamilet-professional-v47]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-professional-v47.css?v=47';
      link.dataset.yamiletProfessionalV47 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-professional-v47]')) {
      const script = document.createElement('script');
      script.src = './academy-professional-v47.js?v=47';
      script.dataset.yamiletProfessionalV47 = '1';
      document.body.appendChild(script);
    }
  }

  function loadUpcomingV48(){
    if (!document.querySelector('link[data-yamilet-upcoming-v48]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-upcoming-v48.css?v=48';
      link.dataset.yamiletUpcomingV48 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-upcoming-v48]')) {
      const script = document.createElement('script');
      script.src = './academy-upcoming-v48.js?v=48';
      script.dataset.yamiletUpcomingV48 = '1';
      document.body.appendChild(script);
    }
  }

  function loadCinematicV49(){
    if (!document.querySelector('link[data-yamilet-appletv-v49]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-appletv-v49.css?v=49';
      link.dataset.yamiletAppletvV49 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-yamilet-appletv-sections-v49]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-appletv-sections-v49.css?v=49';
      link.dataset.yamiletAppletvSectionsV49 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-appletv-v49]')) {
      const script = document.createElement('script');
      script.src = './academy-appletv-v49.js?v=49';
      script.dataset.yamiletAppletvV49 = '1';
      document.body.appendChild(script);
    }
  }

  function loadEnrollmentV50(){
    if (!document.querySelector('link[data-yamilet-enrollment-v50]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-enrollment-v50.css?v=50';
      link.dataset.yamiletEnrollmentV50 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-enrollment-v50]')) {
      const script = document.createElement('script');
      script.src = './academy-enrollment-v50.js?v=50.1';
      script.dataset.yamiletEnrollmentV50 = '1';
      document.body.appendChild(script);
    }
  }

  function loadIsolationV52(){
    if (!document.querySelector('link[data-yamilet-isolation-v52]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-tab-isolation-v52.css?v=52';
      link.dataset.yamiletIsolationV52 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-isolation-v52]')) {
      const script = document.createElement('script');
      script.src = './academy-tab-isolation-v52.js?v=52';
      script.dataset.yamiletIsolationV52 = '1';
      document.body.appendChild(script);
    }
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

  function boot(){
    loadHomeV38();
    loadLanguageV39();
    loadTabsV41();
    loadLayoutV42();
    loadLayoutV43();
    loadLayoutV44();
    loadHeaderV45();
    loadHeaderV46();
    loadProfessionalV47();
    loadUpcomingV48();
    loadCinematicV49();
    loadEnrollmentV50();
    loadIsolationV52();
    if (wireAdminLink()) return;
    const timer = setInterval(() => {
      tries += 1;
      if (wireAdminLink() || tries >= 24) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();