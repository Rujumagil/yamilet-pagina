(() => {
  'use strict';

  const RELEASE = '20260821.42';
  let mounted = false;

  function mountFocus(){
    if (mounted) return true;
    const main = document.querySelector('.dashboard-main');
    const continuePanel = document.querySelector('#continuar');
    const progress = document.querySelector('.home-v38-progress');
    if (!main || !continuePanel || !progress) return false;

    let wrapper = main.querySelector(':scope > .home-v42-focus');
    if (!wrapper) {
      wrapper = document.createElement('section');
      wrapper.className = 'home-v42-focus';
      continuePanel.before(wrapper);
    }

    wrapper.append(continuePanel, progress);
    mounted = true;
    document.body.dataset.academyLayout = 'v42';
    return true;
  }

  function boot(){
    let attempts = 0;
    if (mountFocus()) return;
    const timer = setInterval(() => {
      attempts += 1;
      if (mountFocus() || attempts >= 80) clearInterval(timer);
    }, 100);
  }

  document.addEventListener('yamilet:language-change', () => setTimeout(mountFocus, 0));
  window.addEventListener('pageshow', () => setTimeout(mountFocus, 50));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  window.ACADEMIA_YAMILET_LAYOUT_V42 = { release: RELEASE, mount: mountFocus };
})();
