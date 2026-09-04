(() => {
  'use strict';

  const VERSION = '136.2.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const MES_COVER = new URL('../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp', document.baseURI).href;

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

      html body.academy-courses-stable-v136 #mis-cursos .learning-course-card .course-cover {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        aspect-ratio: 16 / 9 !important;
        object-fit: cover !important;
        object-position: center !important;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeOnce() {
    if (!isCoursesRoute()) return;
    const panel = $('#mis-cursos');
    const list = $('[data-course-list]', panel || document);
    if (!panel || !list) return;

    panel.classList.add('academy-v68-course-hub');
    list.classList.add('academy-v68-active-grid');

    $$('.learning-course-card', list).forEach(card => {
      const tag = $('.tag', card);
      const draft = /preparaci[oó]n/i.test(tag?.textContent || '');
      card.hidden = draft;
      if (draft) return;

      card.classList.add('academy-v68-active-course');
      if (tag && !/staff/i.test(tag.textContent || '')) tag.textContent = 'ACTIVO';

      const action = $('[data-open-course]', card);
      const title = $('h3', card)?.textContent?.trim() || 'curso';
      if (action) {
        action.textContent = 'Abrir curso';
        action.setAttribute('aria-label', `Abrir ${title}`);
      }

      const img = $('.course-cover', card);
      if (img) {
        img.src = MES_COVER;
        img.loading = 'eager';
        img.decoding = 'async';
      }
    });
  }

  function apply() {
    ensureStyle();
    const active = isCoursesRoute();
    document.body.classList.toggle('academy-courses-stable-v136', active);
    if (!active) return;

    // Run only a few bounded passes after navigation. No MutationObserver is used
    // here: previous continuous observers could react to each other and freeze
    // the UI on sign-in when the last route was #courses.
    normalizeOnce();
    window.clearTimeout(timer);
    timer = window.setTimeout(normalizeOnce, 220);
    window.setTimeout(normalizeOnce, 700);
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
