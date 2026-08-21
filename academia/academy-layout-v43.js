(() => {
  'use strict';

  const RELEASE = '20260821.43';

  function forceStructure(){
    const main = document.querySelector('.dashboard-main');
    const hero = document.querySelector('#continuar');
    const progress = document.querySelector('.home-v38-progress');
    if (!main || !hero || !progress) return false;

    let wrapper = main.querySelector(':scope > .home-v42-focus');
    if (!wrapper) {
      wrapper = document.createElement('section');
      wrapper.className = 'home-v42-focus';
      hero.before(wrapper);
    }

    if (hero.parentElement !== wrapper || progress.parentElement !== wrapper || wrapper.firstElementChild !== hero) {
      wrapper.replaceChildren(hero, progress);
    }

    hero.style.order = '1';
    progress.style.order = '2';
    document.body.dataset.academyLayout = 'v43';
    return true;
  }

  function boot(){
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (forceStructure() || attempts >= 100) return;
      setTimeout(tick, 100);
    };
    tick();

    const main = document.querySelector('.dashboard-main');
    if (main) new MutationObserver(() => forceStructure()).observe(main, { childList:true, subtree:false });
  }

  window.addEventListener('pageshow', () => setTimeout(forceStructure, 0));
  window.addEventListener('hashchange', () => setTimeout(forceStructure, 0));
  document.addEventListener('yamilet:language-change', () => setTimeout(forceStructure, 0));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  window.ACADEMIA_YAMILET_LAYOUT_V43 = { release: RELEASE, mount: forceStructure };
})();
