(() => {
  'use strict';
  let tries = 0;
  function wireAdminLink(){
    const btn = document.querySelector('[data-shell-route="admin"]');
    if (!btn) return false;
    if (btn.dataset.adminSeparated === '1') return true;
    btn.dataset.adminSeparated = '1';
    const label = btn.querySelector('span:last-child');
    if (label) label.textContent = 'Panel administrativo';
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = './admin/';
    }, true);
    return true;
  }
  function boot(){
    if (wireAdminLink()) return;
    const timer = setInterval(() => {
      tries += 1;
      if (wireAdminLink() || tries >= 24) clearInterval(timer);
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
