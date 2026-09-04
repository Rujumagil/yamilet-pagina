(() => {
  'use strict';

  const VERSION = '136.1.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const MES_COVER = new URL('../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp', document.baseURI).href;

  let observer = null;
  let lastUpcomingHtml = '';
  let normalizing = false;
  let frame = 0;

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
        content: url("../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp") !important;
      }

      html body.academy-courses-stable-v136 #mis-cursos .academy-v68-upcoming-loading {
        min-height: 82px !important;
        visibility: hidden !important;
      }

      html body.academy-courses-stable-v136 #mis-cursos [data-v136-course-hidden="true"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function stabilizeUpcoming(panel) {
    const section = $('.academy-v68-upcoming', panel);
    if (!section) return;
    const loading = !!$('.academy-v68-upcoming-loading', section);
    if (loading && lastUpcomingHtml) {
      section.innerHTML = lastUpcomingHtml;
      return;
    }
    if (!loading && section.innerHTML.trim()) lastUpcomingHtml = section.innerHTML;
  }

  function makeCardStable(card) {
    const title = $('h3', card)?.textContent?.trim() || '';
    if (/preparaci[oó]n/i.test($('.tag', card)?.textContent || '')) {
      card.dataset.v136CourseHidden = 'true';
      return;
    }

    card.dataset.v136CourseHidden = 'false';
    if (!card.classList.contains('academy-v68-active-course')) card.classList.add('academy-v68-active-course');
    if (card.dataset.courseHubV68 !== 'true') card.dataset.courseHubV68 = 'true';

    const tag = $('.tag', card);
    if (tag && !/staff/i.test(tag.textContent || '') && tag.textContent !== 'ACTIVO') tag.textContent = 'ACTIVO';

    const action = $('[data-open-course]', card);
    if (action) {
      if (action.textContent !== 'Abrir curso') action.textContent = 'Abrir curso';
      const aria = `Abrir ${title || 'curso'}`;
      if (action.getAttribute('aria-label') !== aria) action.setAttribute('aria-label', aria);
    }

    const img = $('.course-cover', card);
    if (img) {
      if (img.src !== MES_COVER) img.src = MES_COVER;
      if (img.getAttribute('loading') !== 'eager') img.setAttribute('loading', 'eager');
      if (img.getAttribute('decoding') !== 'async') img.setAttribute('decoding', 'async');
    }

    if (card.dataset.v136Bound !== 'true') {
      card.dataset.v136Bound = 'true';
      card.tabIndex = 0;
      card.setAttribute('role', 'link');
      card.addEventListener('click', event => {
        if (event.target.closest('button,a,input,select,textarea')) return;
        action?.click();
      });
      card.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button,a,input,select,textarea')) {
          event.preventDefault();
          action?.click();
        }
      });
    }
  }

  function normalizeNativeCourses() {
    if (normalizing || !isCoursesRoute()) return;
    const panel = $('#mis-cursos');
    const list = $('[data-course-list]', panel || document);
    if (!panel || !list) return;

    normalizing = true;
    try {
      panel.classList.add('academy-v68-course-hub');
      list.classList.add('academy-v68-active-grid');
      $$('.learning-course-card', list).forEach(makeCardStable);
      stabilizeUpcoming(panel);
    } finally {
      normalizing = false;
    }
  }

  function apply() {
    frame = 0;
    ensureStyle();
    const active = isCoursesRoute();
    document.body.classList.toggle('academy-courses-stable-v136', active);
    if (!active) return;
    normalizeNativeCourses();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(normalizeNativeCourses);
    });
  }

  function observe() {
    observer?.disconnect();
    const dashboard = $('[data-dashboard]') || document.body;
    observer = new MutationObserver(records => {
      if (!isCoursesRoute() || normalizing) return;

      const relevant = records.some(record => {
        const target = record.target instanceof Element ? record.target : record.target?.parentElement;
        return !!target?.closest?.('#mis-cursos');
      });
      if (!relevant) return;

      // MutationObserver runs before the next paint. Normalize immediately so the
      // base card written by app.js never becomes visible for a frame.
      normalizeNativeCourses();
      schedule();
    });
    observer.observe(dashboard, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'src', 'hidden', 'data-course-hub-v68']
    });
  }

  function start() {
    ensureStyle();
    apply();
    observe();

    window.addEventListener('hashchange', schedule);
    window.addEventListener('popstate', schedule);
    window.addEventListener('pageshow', schedule);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-pwa-route="courses"],[data-shell-route="courses"],[data-scroll-courses],a[href="#courses"]')) {
        queueMicrotask(normalizeNativeCourses);
        schedule();
      }
    }, true);

    window.ACADEMIA_YAMILET_COURSES_STABILITY_V136 = Object.freeze({
      version: VERSION,
      refresh: () => {
        normalizeNativeCourses();
        schedule();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
