(() => {
  'use strict';

  const VERSION = '133.2.0';
  const INTERIOR_ROUTES = new Set(['course', 'lesson']);
  let scheduled = false;
  let observer = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function routeName() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function ensureStyle() {
    if ($('style[data-academy-course-interior-guard-v133]')) return;
    const style = document.createElement('style');
    style.dataset.academyCourseInteriorGuardV133 = 'true';
    style.textContent = `
      body.academy-course-interior-v133 [data-aula-pages-v71],
      body.academy-course-interior-v133 .v125-courses-page {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureAssessmentGateV135() {
    if (window.ACADEMIA_YAMILET_ASSESSMENT_GATE_V135 || $('script[data-academy-assessment-gate-v135]')) return;
    const script = document.createElement('script');
    script.src = './academy-assessment-course-gate-v135.js?v=135';
    script.async = true;
    script.dataset.academyAssessmentGateV135 = 'true';
    document.body.appendChild(script);
  }

  function ensureCoursesStabilityV136() {
    if (window.ACADEMIA_YAMILET_COURSES_STABILITY_V136 || $('script[data-academy-courses-stability-v136]')) return;
    const script = document.createElement('script');
    script.src = './academy-courses-stability-v136.js?v=136';
    script.async = true;
    script.dataset.academyCoursesStabilityV136 = 'true';
    document.body.appendChild(script);
  }

  function clearStaleCourseListSuppression(main) {
    if (!main) return;
    main.querySelectorAll('[data-v125-suppressed="true"]').forEach(node => {
      delete node.dataset.v125Suppressed;
    });
  }

  function apply() {
    scheduled = false;
    ensureStyle();

    const route = routeName();
    const interior = INTERIOR_ROUTES.has(route);
    const main = $('.dashboard-main');
    const v71Host = $('[data-aula-pages-v71]', main || document);

    document.body.classList.toggle('academy-course-interior-v133', interior);

    if (interior) {
      clearStaleCourseListSuppression(main);
      if (main?.dataset.v71Route === 'courses') delete main.dataset.v71Route;
      if (v71Host && !v71Host.hidden) v71Host.hidden = true;
      return;
    }

    if (route === 'courses' && v71Host?.hidden) v71Host.hidden = false;
  }

  function schedule(delay = 0) {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(apply, delay);
  }

  function startObserver() {
    observer?.disconnect();
    const target = $('[data-dashboard]') || document.body;
    observer = new MutationObserver(() => {
      if (INTERIOR_ROUTES.has(routeName())) schedule(0);
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'data-v125-suppressed', 'data-v71-route']
    });
  }

  function start() {
    ensureStyle();
    ensureAssessmentGateV135();
    ensureCoursesStabilityV136();
    apply();
    startObserver();
    window.addEventListener('hashchange', () => schedule(0));
    window.addEventListener('pageshow', () => schedule(20));
    document.addEventListener('click', () => schedule(50), true);
    window.ACADEMIA_YAMILET_COURSE_INTERIOR_GUARD_V133 = Object.freeze({
      version: VERSION,
      refresh: () => schedule(0)
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
