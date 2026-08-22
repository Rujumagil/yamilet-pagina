(() => {
  'use strict';

  const RELEASE = '20260822.49';
  const courseView = document.querySelector('[data-course-view]');
  const lessonView = document.querySelector('[data-lesson-view]');
  const courseDetail = document.querySelector('[data-course-detail]');
  let currentCourseId = null;
  let timer = null;

  function bodyMode() {
    document.body.classList.add('ay49-cinematic');
  }

  function courseCover(courseId) {
    if (!courseId) return '';
    const button = document.querySelector(`[data-course-list] [data-open-course="${CSS.escape(courseId)}"]`);
    return button?.closest('.learning-course-card')?.querySelector('.course-cover')?.src || '';
  }

  function detectCourseId() {
    const row = courseDetail?.querySelector('[data-open-lesson][data-course-id]');
    return row?.dataset.courseId || currentCourseId || '';
  }

  function applyCourseBackdrop() {
    if (!courseView || courseView.classList.contains('hidden')) return;
    const id = detectCourseId();
    const cover = courseCover(id);
    if (cover) {
      courseView.style.setProperty('--ay49-course-cover', `url("${cover.replace(/"/g, '%22')}")`);
      document.body.style.setProperty('--ay49-course-cover', `url("${cover.replace(/"/g, '%22')}")`);
    }
    document.body.dataset.ay49View = 'course';
  }

  function applyViewState() {
    if (lessonView && !lessonView.classList.contains('hidden')) {
      document.body.dataset.ay49View = 'lesson';
      return;
    }
    if (courseView && !courseView.classList.contains('hidden')) {
      applyCourseBackdrop();
      return;
    }
    document.body.dataset.ay49View = 'home';
  }

  function enhanceCourseModules() {
    if (!courseDetail || courseView?.classList.contains('hidden')) return;
    const modules = [...courseDetail.querySelectorAll('.module-block')];
    modules.forEach((module, index) => {
      module.dataset.ay49Module = String(index + 1);
      const label = module.querySelector('.module-label');
      if (label && !label.dataset.ay49Enhanced) {
        label.dataset.ay49Enhanced = '1';
        label.textContent = `SEMANA ${index + 1}`;
      }
    });
  }

  function schedule(delay = 60) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      bodyMode();
      applyViewState();
      enhanceCourseModules();
    }, delay);
  }

  document.addEventListener('click', event => {
    const course = event.target.closest('[data-open-course]');
    if (course) {
      currentCourseId = course.dataset.openCourse || null;
      schedule(120);
      return;
    }
    const lesson = event.target.closest('[data-open-lesson][data-course-id]');
    if (lesson) {
      currentCourseId = lesson.dataset.courseId || currentCourseId;
      schedule(120);
      return;
    }
    if (event.target.closest('[data-back-course],[data-back-courses],[data-shell-route]')) schedule(80);
  }, true);

  if (courseDetail) new MutationObserver(() => schedule(30)).observe(courseDetail, { childList: true, subtree: true });
  if (courseView) new MutationObserver(() => schedule(30)).observe(courseView, { attributes: true, attributeFilter: ['class'] });
  if (lessonView) new MutationObserver(() => schedule(30)).observe(lessonView, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('hashchange', () => schedule(40));
  window.addEventListener('pageshow', () => schedule(80));

  bodyMode();
  schedule(0);

  window.ACADEMIA_YAMILET_APPLETV_V49 = { release: RELEASE, refresh: schedule };
})();
