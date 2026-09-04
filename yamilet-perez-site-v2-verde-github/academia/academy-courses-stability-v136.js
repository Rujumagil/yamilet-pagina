(() => {
  'use strict';

  const VERSION = '136.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let observer = null;
  let lastUpcomingHtml = '';
  let lastAllowedCourseIds = new Set();
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

  function captureAllowedCourses() {
    const source = $('[data-aula-pages-v71]');
    if (!source) return;
    const ids = $$('.v125-course-card[data-v125-course]', source)
      .map(card => String(card.dataset.v125Course || '').trim())
      .filter(Boolean);
    if (ids.length) lastAllowedCourseIds = new Set(ids);
  }

  function filterNativeCourses() {
    if (!lastAllowedCourseIds.size) return;
    const panel = $('#mis-cursos');
    if (!panel) return;
    const cards = $$('[data-course-list] .learning-course-card', panel);
    cards.forEach(card => {
      const id = card.querySelector('[data-open-course]')?.dataset.openCourse;
      if (!id) return;
      card.dataset.v136CourseHidden = lastAllowedCourseIds.has(String(id)) ? 'false' : 'true';
    });
  }

  function stabilizeUpcoming() {
    const panel = $('#mis-cursos');
    if (!panel) return;
    const section = $('.academy-v68-upcoming', panel);
    if (!section) return;

    const loading = !!$('.academy-v68-upcoming-loading', section);
    if (loading && lastUpcomingHtml) {
      section.innerHTML = lastUpcomingHtml;
      return;
    }
    if (!loading && section.innerHTML.trim()) lastUpcomingHtml = section.innerHTML;
  }

  function apply() {
    frame = 0;
    ensureStyle();
    const active = isCoursesRoute();
    document.body.classList.toggle('academy-courses-stable-v136', active);
    if (!active) return;

    captureAllowedCourses();
    stabilizeUpcoming();
    filterNativeCourses();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(apply);
  }

  function observe() {
    observer?.disconnect();
    const dashboard = $('[data-dashboard]') || document.body;
    observer = new MutationObserver(records => {
      if (!isCoursesRoute()) return;

      let relevant = false;
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : record.target?.parentElement;
        if (!target) continue;
        if (target.closest?.('#mis-cursos,[data-aula-pages-v71]') || target.matches?.('#mis-cursos,[data-aula-pages-v71]')) {
          relevant = true;
          break;
        }
      }
      if (!relevant) return;

      captureAllowedCourses();
      stabilizeUpcoming();
      filterNativeCourses();
      schedule();
    });
    observer.observe(dashboard, { childList: true, subtree: true });
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
        requestAnimationFrame(schedule);
      }
    }, true);

    window.ACADEMIA_YAMILET_COURSES_STABILITY_V136 = Object.freeze({
      version: VERSION,
      refresh: () => {
        captureAllowedCourses();
        apply();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
