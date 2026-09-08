(() => {
  'use strict';

  if (window.__ACADEMIA_YAMILET_COURSES_STABILITY_V136_INIT__) return;
  window.__ACADEMIA_YAMILET_COURSES_STABILITY_V136_INIT__ = true;

  const VERSION = '136.3.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let timer = 0;

  function routeName() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function isCoursesRoute() {
    return routeName() === 'courses';
  }

  function ensureStyle() {
    if ($('style[data-academy-courses-stability-v136]')) return;
    const style = document.createElement('style');
    style.dataset.academyCoursesStabilityV136 = 'true';
    style.textContent = `
      html body.academy-courses-stable-v136 .dashboard-main > [data-aula-pages-v71] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      html body.academy-courses-stable-v136 .dashboard-main > #mis-cursos,
      html body.academy-courses-stable-v136 .dashboard-main > #mis-cursos.hidden,
      html body.academy-courses-stable-v136 .dashboard-main > #mis-cursos[data-v125-suppressed="true"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      html body.academy-courses-stable-v136 #mis-cursos .learning-course-card,
      html body.academy-courses-stable-v136 #mis-cursos .learning-course-card * {
        animation: none !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeOnce() {
    if (!isCoursesRoute()) return;
    const panel = $('#mis-cursos');
    const list = $('[data-course-list]', panel || document);
    if (!panel || !list) return;

    // v136 owns only layer stability. Visual content belongs to v140.
    // Keeping these responsibilities separate prevents the two runtimes from
    // alternating labels, buttons and course covers after navigation.
    panel.classList.add('academy-v68-course-hub');
    list.classList.add('academy-v68-active-grid');

    $$('.learning-course-card', list).forEach(card => {
      const tag = $('.tag', card);
      const draft = /preparaci[oó]n/i.test(tag?.textContent || '');
      if (card.hidden !== draft) card.hidden = draft;
    });
  }

  function apply() {
    ensureStyle();
    const active = isCoursesRoute();
    document.body.classList.toggle('academy-courses-stable-v136', active);
    if (!active) return;

    normalizeOnce();
    window.clearTimeout(timer);
    timer = window.setTimeout(normalizeOnce, 240);
  }

  function start() {
    ensureStyle();
    apply();
    window.addEventListener('hashchange', apply);
    window.addEventListener('popstate', apply);
    window.addEventListener('pageshow', apply);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-pwa-route="courses"],[data-shell-route="courses"],[data-scroll-courses],a[href="#courses"]')) {
        window.setTimeout(apply, 0);
      }
    }, true);

    window.ACADEMIA_YAMILET_COURSES_STABILITY_V136 = Object.freeze({
      version: VERSION,
      refresh: apply
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
