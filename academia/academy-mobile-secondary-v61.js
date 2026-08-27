(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const ICONS = {
    evaluations: '✓',
    certificates: '★',
    help: '?',
    profile: '●',
    explore: '↗',
    admin: '⚙'
  };

  function userData() {
    const name = $('[data-user-name]')?.textContent?.trim() || 'Academia Yamilet';
    const rawRole = $('[data-user-role]')?.textContent?.trim() || '';
    const role = rawRole.split('·').pop()?.trim() || rawRole || 'Usuario';
    const initial = name.charAt(0).toUpperCase() || 'Y';
    return { name, role, initial };
  }

  function decorateMore() {
    const more = $('[data-pwa-more]');
    if (!more) return false;
    more.classList.add('v61');

    const head = $('.academy-mobile-more-head', more);
    let user = $('.academy-mobile-user-card', more);
    const data = userData();
    if (!user && head) {
      user = document.createElement('div');
      user.className = 'academy-mobile-user-card';
      head.insertAdjacentElement('afterend', user);
    }
    if (user) {
      user.innerHTML = `<div class="academy-mobile-user-avatar">${data.initial}</div><div class="academy-mobile-user-copy"><strong>${data.name}</strong><small>Tu espacio privado de aprendizaje</small></div><span class="academy-mobile-user-role">${data.role}</span>`;
    }

    $$('[data-pwa-extra-route]', more).forEach(button => {
      if ($('.academy-mobile-more-icon', button)) return;
      const icon = document.createElement('span');
      icon.className = 'academy-mobile-more-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = ICONS[button.dataset.pwaExtraRoute] || '•';
      button.insertAdjacentElement('afterbegin', icon);
    });
    return true;
  }

  function markRoute() {
    const main = $('.dashboard-main');
    if (!main) return;
    const visible = $$('.shell-page:not(.hidden), .academy-admin-page:not([hidden])', main).find(node => node.offsetParent !== null);
    const route = visible?.dataset?.shellPage || visible?.id || main.dataset.academySection || 'home';
    document.body.dataset.academyMobileSection = route;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-pwa-route],[data-pwa-extra-route],.sidebar [data-shell-route]')) {
      window.setTimeout(() => { decorateMore(); markRoute(); }, 60);
    }
  }, true);

  [80, 350, 900, 1800, 3600].forEach(delay => window.setTimeout(() => { decorateMore(); markRoute(); }, delay));
  window.ACADEMIA_YAMILET_MOBILE_SECONDARY_V61 = { decorateMore, markRoute };
})();
