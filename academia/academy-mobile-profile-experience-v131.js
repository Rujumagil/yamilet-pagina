(() => {
  'use strict';

  const isProfile = () => String(location.hash || '').replace(/^#/, '').split('/')[0] === 'profile';

  function markLegacyProfile() {
    const main = document.querySelector('.dashboard-main');
    if (!main) return;
    const legacy = main.querySelector(':scope > [data-shell-page="profile"]');
    if (legacy) {
      legacy.dataset.v131ProfileLegacy = 'true';
      legacy.setAttribute('aria-hidden', 'true');
      legacy.inert = true;
    }
  }

  function restoreLegacyProfile() {
    document.querySelectorAll('[data-v131-profile-legacy="true"]').forEach(node => {
      node.removeAttribute('data-v131-profile-legacy');
      node.removeAttribute('aria-hidden');
      node.inert = false;
    });
  }

  function sync() {
    if (isProfile()) {
      document.body.dataset.academyRoute = 'profile';
      markLegacyProfile();
      const host = document.querySelector('.dashboard-main > [data-aula-pages-v71]');
      if (host) host.hidden = false;
    } else {
      restoreLegacyProfile();
    }
  }

  const observer = new MutationObserver(() => {
    if (isProfile()) markLegacyProfile();
  });

  function start() {
    sync();
    observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('hashchange', () => setTimeout(sync, 30));
    window.addEventListener('pageshow', () => setTimeout(sync, 60));
    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="profile"],[data-avatar-button],a[href="#profile"]')) {
        setTimeout(sync, 80);
        setTimeout(sync, 280);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.ACADEMIA_YAMILET_PROFILE_EXPERIENCE_V131 = Object.freeze({ sync });
})();
