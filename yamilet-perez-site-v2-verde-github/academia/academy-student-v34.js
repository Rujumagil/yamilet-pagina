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

  function loadPagesV40(){
    if (document.querySelector('script[data-yamilet-pages-v40]')) return;
    const script = document.createElement('script');
    script.src = './academy-pages-v40.js?v=40';
    script.dataset.yamiletPagesV40 = '1';
    document.body.appendChild(script);
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
    loadPagesV40();
    if (wireAdminLink()) return;
    const timer = setInterval(() => {
      tries += 1;
      if (wireAdminLink() || tries >= 24) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
