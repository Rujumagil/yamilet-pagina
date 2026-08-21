(() => {
  'use strict';

  const RELEASE = '20260821.44';

  function applyDesktopDensity(){
    const stats = document.querySelector('.stats');
    const head = document.querySelector('.dash-head');
    const activity = document.querySelector('.home-v38-activity');
    const focus = document.querySelector('.home-v42-focus');
    const hero = focus?.querySelector('#continuar');
    const progress = focus?.querySelector('.home-v38-progress');

    if (activity) activity.style.setProperty('display','none','important');

    const desktop = window.innerWidth > 740;
    if (stats) {
      stats.style.setProperty('grid-template-columns', desktop ? 'repeat(4,minmax(0,1fr))' : (window.innerWidth > 480 ? 'repeat(2,minmax(0,1fr))' : '1fr'), 'important');
    }

    if (head) {
      head.style.setProperty('grid-template-columns','1fr','important');
      head.style.setProperty('min-height', desktop ? '132px' : 'auto', 'important');
    }

    if (desktop && focus) {
      focus.style.setProperty('grid-template-columns','minmax(0,1fr) 240px','important');
      focus.style.setProperty('grid-auto-flow','column','important');
      if (hero) {
        hero.style.setProperty('grid-column','1','important');
        hero.style.setProperty('grid-row','1','important');
        hero.style.setProperty('height','258px','important');
        hero.style.setProperty('min-height','258px','important');
      }
      if (progress) {
        progress.style.setProperty('grid-column','2','important');
        progress.style.setProperty('grid-row','1','important');
        progress.style.setProperty('width','240px','important');
        progress.style.setProperty('min-width','240px','important');
        progress.style.setProperty('height','258px','important');
        progress.style.setProperty('min-height','258px','important');
      }
    }

    document.body.dataset.academyLayout = 'v44';
  }

  function boot(){
    let attempts = 0;
    const run = () => {
      attempts += 1;
      applyDesktopDensity();
      if (document.querySelector('.home-v42-focus') && document.querySelector('.stats')) return true;
      return attempts >= 80;
    };
    if (run()) return;
    const timer = setInterval(() => { if (run()) clearInterval(timer); }, 100);
  }

  window.addEventListener('resize', () => requestAnimationFrame(applyDesktopDensity));
  window.addEventListener('pageshow', () => setTimeout(applyDesktopDensity, 40));
  window.addEventListener('hashchange', () => setTimeout(applyDesktopDensity, 40));
  document.addEventListener('yamilet:language-change', () => setTimeout(applyDesktopDensity, 0));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  window.ACADEMIA_YAMILET_LAYOUT_V44 = { release: RELEASE, apply: applyDesktopDensity };
})();
