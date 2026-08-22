(() => {
  'use strict';

  const RELEASE = '20260822.53';
  const dashboard = document.querySelector('[data-dashboard]');
  const dashHead = document.querySelector('.dash-head');
  const stats = document.querySelector('.stats');
  const continuePanel = document.querySelector('#continuar');
  const coursesPanel = document.querySelector('#mis-cursos');
  const courseView = document.querySelector('[data-course-view]');
  const lessonView = document.querySelector('[data-lesson-view]');
  const reservations = document.querySelector('#reservas');

  const routeLabels = {
    home: 'Inicio', courses: 'Mis cursos', evaluations: 'Evaluaciones', library: 'Mi biblioteca',
    calendar: 'Calendario', certificates: 'Certificados', help: 'Ayuda y soporte', profile: 'Mi perfil', explore: 'Explorar cursos'
  };

  const shellPages = () => [...document.querySelectorAll('[data-shell-page]')];
  const nativeSections = () => [dashHead, stats, continuePanel, coursesPanel, courseView, lessonView, reservations].filter(Boolean);
  const suppress = (node, value) => node && node.classList.toggle('ay53-suppressed', !!value);
  const dashboardReady = () => !!dashboard && !dashboard.classList.contains('hidden');

  function resetWhileLoggedOut() {
    document.body.removeAttribute('data-academy-section');
    [...nativeSections(), ...shellPages()].forEach(node => node.classList.remove('ay52-suppressed', 'ay53-suppressed'));
  }

  function setNav(section) {
    if (!dashboardReady()) return;
    const activeRoute = (section === 'course' || section === 'lesson') ? 'courses' : section;
    document.querySelectorAll('[data-shell-route]').forEach(btn => btn.classList.toggle('active', btn.dataset.shellRoute === activeRoute));
    const crumb = document.querySelector('[data-shell-breadcrumb]');
    if (!crumb) return;
    if (section === 'course') crumb.textContent = 'Método MES®';
    else if (section === 'lesson') crumb.textContent = document.querySelector('[data-lesson-detail] .lesson-title h2')?.textContent?.trim() || 'Método MES®';
    else crumb.textContent = routeLabels[section] || 'Academia Yamilet';
  }

  function clearSuppression() {
    [...nativeSections(), ...shellPages()].forEach(node => {
      node.classList.remove('ay52-suppressed');
      suppress(node, false);
    });
  }

  function apply(section) {
    if (!dashboardReady()) { resetWhileLoggedOut(); return; }
    clearSuppression();
    document.body.dataset.academySection = section;
    const pages = shellPages();

    if (section === 'home') {
      suppress(coursesPanel, true); suppress(courseView, true); suppress(lessonView, true); suppress(reservations, true);
      pages.forEach(p => suppress(p, true));
    } else if (section === 'courses') {
      suppress(dashHead, true); suppress(stats, true); suppress(continuePanel, true); suppress(courseView, true); suppress(lessonView, true); suppress(reservations, true);
      pages.forEach(p => suppress(p, true));
    } else if (section === 'course') {
      suppress(dashHead, true); suppress(stats, true); suppress(continuePanel, true); suppress(coursesPanel, true); suppress(lessonView, true); suppress(reservations, true);
      pages.forEach(p => suppress(p, true));
    } else if (section === 'lesson') {
      suppress(dashHead, true); suppress(stats, true); suppress(continuePanel, true); suppress(coursesPanel, true); suppress(courseView, true); suppress(reservations, true);
      pages.forEach(p => suppress(p, true));
    } else {
      nativeSections().forEach(node => suppress(node, true));
      pages.forEach(page => suppress(page, page.dataset.shellPage !== section));
    }
    setNav(section);
  }

  function routeFromHash() {
    const hash = location.hash.replace(/^#/, '').toLowerCase();
    const map = {inicio:'home',cursos:'courses',evaluaciones:'evaluations',biblioteca:'library',calendario:'calendar',certificados:'certificates',ayuda:'help',perfil:'profile',explorar:'explore'};
    return map[hash] || document.body.dataset.academyTab || 'home';
  }

  function sync() {
    if (!dashboardReady()) { resetWhileLoggedOut(); return; }
    if (lessonView && !lessonView.classList.contains('hidden')) return apply('lesson');
    if (courseView && !courseView.classList.contains('hidden')) return apply('course');
    apply(routeFromHash());
  }

  document.addEventListener('click', event => {
    if (!dashboardReady()) return;
    const shell = event.target.closest('[data-shell-route]');
    if (shell && shell.dataset.shellRoute !== 'admin') { setTimeout(() => apply(shell.dataset.shellRoute), 50); return; }
    if (event.target.closest('[data-open-course]')) { setTimeout(() => apply('course'), 120); return; }
    if (event.target.closest('[data-open-lesson][data-course-id]')) { setTimeout(() => apply('lesson'), 120); return; }
    if (event.target.closest('[data-back-courses]')) { setTimeout(() => apply('courses'), 70); return; }
    if (event.target.closest('[data-back-course]')) setTimeout(() => apply('course'), 70);
  }, true);

  if (courseView) new MutationObserver(sync).observe(courseView, {attributes:true,attributeFilter:['class']});
  if (lessonView) new MutationObserver(sync).observe(lessonView, {attributes:true,attributeFilter:['class']});
  if (dashboard) new MutationObserver(() => setTimeout(sync, 30)).observe(dashboard, {attributes:true,attributeFilter:['class']});
  window.addEventListener('hashchange', () => setTimeout(sync, 30));
  window.addEventListener('pageshow', () => setTimeout(sync, 80));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(sync, 80), {once:true});
  else setTimeout(sync, 80);

  window.ACADEMIA_YAMILET_TAB_ISOLATION_V53 = {release:RELEASE,apply,sync};
})();