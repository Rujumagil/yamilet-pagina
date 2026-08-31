(() => {
  'use strict';

  const PUBLIC_TO_INTERNAL = {
    home: 'home',
    courses: 'courses',
    resources: 'library',
    library: 'library',
    agenda: 'calendar',
    calendar: 'calendar',
    certificates: 'certificates',
    evaluations: 'evaluations',
    help: 'help',
    profile: 'profile',
    catalog: 'explore',
    admin: 'admin'
  };

  const CANONICAL_PUBLIC = {
    library: 'library',
    calendar: 'calendar'
  };

  const INTERNAL_TO_PUBLIC = Object.fromEntries(
    Object.entries(PUBLIC_TO_INTERNAL).map(([publicRoute, internalRoute]) => [internalRoute, CANONICAL_PUBLIC[internalRoute] || publicRoute])
  );

  const ROUTE_TITLES = {
    home: 'Inicio',
    courses: 'Mis cursos',
    resources: 'Mi biblioteca',
    library: 'Mi biblioteca',
    agenda: 'Calendario',
    calendar: 'Calendario',
    certificates: 'Certificados',
    evaluations: 'Evaluaciones',
    help: 'Ayuda y soporte',
    profile: 'Mi perfil',
    catalog: 'Catálogo de cursos',
    admin: 'Administración',
    course: 'Curso',
    lesson: 'Lección'
  };

  let applyingRoute = false;
  let booted = false;
  let bootTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function routeParts() {
    const raw = String(location.hash || '').replace(/^#/, '').trim();
    if (!raw || /(^|&)access_token=|(^|&)refresh_token=|(^|&)type=recovery/.test(raw)) return ['home'];
    return raw.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  }

  function hashPath(parts = routeParts()) {
    return parts.map(part => encodeURIComponent(part)).join('/');
  }

  function dashboardReady() {
    const dashboard = $('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden') && !!$('[data-shell-route="home"]');
  }

  function publicRouteForInternal(internal) {
    return INTERNAL_TO_PUBLIC[internal] || internal || 'home';
  }

  function setDocumentRoute(route, detail = '') {
    document.body.dataset.academyRoute = route;
    const main = $('.dashboard-main');
    if (main) main.dataset.hashRoute = route;
    const title = detail || ROUTE_TITLES[route] || 'Academia';
    document.title = `${title} | Academia Yamilet`;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function setHash(path, { replace = false } = {}) {
    const clean = String(path || 'home').replace(/^#/, '');
    const next = `#${clean}`;
    if (location.hash === next) return;
    const url = `${location.pathname}${location.search}${next}`;
    history[replace ? 'replaceState' : 'pushState']({ academyRoute: clean }, '', url);
  }

  function clickShellRoute(internal) {
    const button = $(`[data-shell-route="${CSS.escape(internal)}"]`);
    if (!button) return false;
    applyingRoute = true;
    try { button.click(); } finally { applyingRoute = false; }
    return true;
  }

  function waitFor(selector, predicate = null, attempts = 80, interval = 50) {
    return new Promise(resolve => {
      let count = 0;
      const tick = () => {
        const node = $(selector);
        if (node && (!predicate || predicate(node))) return resolve(node);
        count += 1;
        if (count >= attempts) return resolve(null);
        window.setTimeout(tick, interval);
      };
      tick();
    });
  }

  function setBreadcrumb(text) {
    const breadcrumb = $('[data-shell-breadcrumb]');
    if (breadcrumb && text) breadcrumb.textContent = text;
  }

  async function applyCourseRoute(courseId) {
    setDocumentRoute('course');
    clickShellRoute('courses');

    const button = await waitFor(`[data-open-course="${CSS.escape(courseId)}"]`);
    if (!button) {
      setHash('courses', { replace: true });
      return applyTopLevelRoute('courses');
    }

    const card = button.closest('.learning-course-card');
    const title = card?.querySelector('h3')?.textContent?.trim() || 'Curso';
    applyingRoute = true;
    try { button.click(); } finally { applyingRoute = false; }
    setDocumentRoute('course', title);
    setBreadcrumb(title);
  }

  async function applyLessonRoute(courseId, lessonId) {
    setDocumentRoute('lesson');
    clickShellRoute('courses');

    const courseButton = await waitFor(`[data-open-course="${CSS.escape(courseId)}"]`);
    if (!courseButton) {
      setHash('courses', { replace: true });
      return applyTopLevelRoute('courses');
    }

    applyingRoute = true;
    try { courseButton.click(); } finally { applyingRoute = false; }

    const lessonButton = await waitFor(`[data-open-lesson="${CSS.escape(lessonId)}"][data-course-id="${CSS.escape(courseId)}"]`);
    if (!lessonButton) {
      setHash(`course/${encodeURIComponent(courseId)}`, { replace: true });
      return applyCourseRoute(courseId);
    }

    const lessonTitle = lessonButton.querySelector('strong')?.textContent?.trim() || 'Lección';
    applyingRoute = true;
    try { lessonButton.click(); } finally { applyingRoute = false; }
    setDocumentRoute('lesson', lessonTitle);
    setBreadcrumb(lessonTitle);
  }

  async function applyTopLevelRoute(publicRoute) {
    const internal = PUBLIC_TO_INTERNAL[publicRoute] || 'home';
    setDocumentRoute(publicRoute);
    if (!clickShellRoute(internal)) return false;
    setBreadcrumb(ROUTE_TITLES[publicRoute] || 'Academia Yamilet');
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0);
    return true;
  }

  async function applyRouteFromLocation() {
    if (!dashboardReady()) return false;

    const parts = routeParts();
    const page = parts[0] || 'home';

    if (page === 'course') {
      const courseId = parts[1];
      if (!courseId) {
        setHash('courses', { replace: true });
        await applyTopLevelRoute('courses');
      } else {
        await applyCourseRoute(courseId);
      }
      return true;
    }

    if (page === 'lesson') {
      const courseId = parts[1];
      const lessonId = parts[2];
      if (!courseId || !lessonId) {
        setHash('courses', { replace: true });
        await applyTopLevelRoute('courses');
      } else {
        await applyLessonRoute(courseId, lessonId);
      }
      return true;
    }

    const validPage = PUBLIC_TO_INTERNAL[page] ? page : 'home';
    if (validPage !== page) setHash(validPage, { replace: true });
    await applyTopLevelRoute(validPage);
    return true;
  }

  function scheduleBoot(delay = 40) {
    window.clearTimeout(bootTimer);
    bootTimer = window.setTimeout(async () => {
      if (!dashboardReady()) return;
      if (!location.hash || /access_token=|refresh_token=|type=recovery/.test(location.hash)) {
        setHash('home', { replace: true });
      }
      booted = true;
      await applyRouteFromLocation();
    }, delay);
  }

  function routeFromClick(event) {
    if (applyingRoute || !dashboardReady()) return;

    const shellButton = event.target.closest('[data-shell-route]');
    if (shellButton) {
      const publicRoute = publicRouteForInternal(shellButton.dataset.shellRoute);
      setHash(publicRoute);
      setDocumentRoute(publicRoute);
      return;
    }

    const courseButton = event.target.closest('[data-open-course]');
    if (courseButton) {
      const courseId = courseButton.dataset.openCourse;
      if (!courseId) return;
      const title = courseButton.closest('.learning-course-card')?.querySelector('h3')?.textContent?.trim() || 'Curso';
      setHash(`course/${encodeURIComponent(courseId)}`);
      setDocumentRoute('course', title);
      return;
    }

    const lessonButton = event.target.closest('[data-open-lesson]');
    if (lessonButton) {
      const courseId = lessonButton.dataset.courseId;
      const lessonId = lessonButton.dataset.openLesson;
      if (!courseId || !lessonId) return;
      const title = lessonButton.querySelector('strong')?.textContent?.trim() || 'Lección';
      setHash(`lesson/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`);
      setDocumentRoute('lesson', title);
      return;
    }

    if (event.target.closest('[data-back-courses]')) {
      setHash('courses');
      setDocumentRoute('courses');
      return;
    }

    if (event.target.closest('[data-back-course]')) {
      const [page, courseId] = routeParts();
      if (page === 'lesson' && courseId) {
        setHash(`course/${encodeURIComponent(courseId)}`);
        setDocumentRoute('course');
      }
      return;
    }

    if (event.target.closest('[data-quick-help]')) {
      setHash('help');
      setDocumentRoute('help');
      return;
    }

    if (event.target.closest('[data-avatar-button]')) {
      setHash('profile');
      setDocumentRoute('profile');
      return;
    }

    if (event.target.closest('[data-scroll-home]')) {
      setHash('home');
      setDocumentRoute('home');
      return;
    }

    if (event.target.closest('[data-scroll-courses],[data-dashboard-open-courses]')) {
      setHash('courses');
      setDocumentRoute('courses');
    }
  }

  document.addEventListener('click', routeFromClick, true);

  window.addEventListener('hashchange', () => {
    if (booted) applyRouteFromLocation();
  });
  window.addEventListener('popstate', () => {
    if (booted) applyRouteFromLocation();
  });
  window.addEventListener('pageshow', () => scheduleBoot(80));

  const observer = new MutationObserver(() => {
    if (!booted && dashboardReady()) scheduleBoot(30);
  });

  function start() {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    scheduleBoot(120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.AcademiaYamiletRouter = {
    go(path, options = {}) {
      setHash(hashPath(String(path || 'home').replace(/^#/, '').split('/')), options);
      return applyRouteFromLocation();
    },
    current: () => hashPath(),
    routes: { ...PUBLIC_TO_INTERNAL }
  };
})();
