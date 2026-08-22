(() => {
  'use strict';

  const RELEASE = '20260822.51';
  const dashboardMain = document.querySelector('.dashboard-main');
  const courseView = document.querySelector('[data-course-view]');
  const lessonView = document.querySelector('[data-lesson-view]');
  let timer = null;

  function modeFromDom() {
    if (lessonView && !lessonView.classList.contains('hidden')) return 'lesson';
    if (courseView && !courseView.classList.contains('hidden')) return 'course';
    return 'home';
  }

  function applyMode(mode, shouldScroll = false) {
    document.body.dataset.academyLearningView = mode;
    if (mode === 'lesson') document.body.dataset.ay49View = 'lesson';
    else if (mode === 'course') document.body.dataset.ay49View = 'course';
    else if (document.body.dataset.ay49View !== 'home') document.body.dataset.ay49View = 'home';

    if (shouldScroll && dashboardMain) {
      requestAnimationFrame(() => dashboardMain.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function sync(shouldScroll = false) {
    clearTimeout(timer);
    timer = setTimeout(() => applyMode(modeFromDom(), shouldScroll), 35);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-course]')) {
      setTimeout(() => sync(true), 90);
      return;
    }
    if (event.target.closest('[data-open-lesson][data-course-id]')) {
      setTimeout(() => sync(true), 90);
      return;
    }
    if (event.target.closest('[data-back-courses]')) {
      setTimeout(() => applyMode('home', true), 60);
      return;
    }
    if (event.target.closest('[data-back-course]')) {
      setTimeout(() => applyMode('course', true), 60);
      return;
    }
    if (event.target.closest('[data-shell-route]')) {
      setTimeout(() => applyMode('home', false), 40);
    }
  }, true);

  if (courseView) new MutationObserver(() => sync(false)).observe(courseView, { attributes: true, attributeFilter: ['class'] });
  if (lessonView) new MutationObserver(() => sync(false)).observe(lessonView, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('hashchange', () => setTimeout(() => sync(false), 30));
  window.addEventListener('pageshow', () => sync(false));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => sync(false), { once: true });
  else sync(false);

  window.ACADEMIA_YAMILET_DEDICATED_V51 = { release: RELEASE, sync, setMode: applyMode };
})();
