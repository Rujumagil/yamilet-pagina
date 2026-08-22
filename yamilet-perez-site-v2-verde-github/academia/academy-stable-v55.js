(() => {
  'use strict';

  const RELEASE = '20260822.55';
  const dashboard = document.querySelector('[data-dashboard]');
  const main = document.querySelector('.dashboard-main');
  const dashHead = document.querySelector('.dash-head');
  const stats = document.querySelector('.stats');
  const continuePanel = document.querySelector('#continuar');
  const coursesPanel = document.querySelector('#mis-cursos');
  const courseView = document.querySelector('[data-course-view]');
  const lessonView = document.querySelector('[data-lesson-view]');
  const reservations = document.querySelector('#reservas');
  let initialized = false;
  let refreshQueued = false;

  const labels = {
    home:'Inicio', courses:'Mis cursos', evaluations:'Evaluaciones', library:'Mi biblioteca',
    calendar:'Calendario', certificates:'Certificados', help:'Ayuda y soporte', profile:'Mi perfil',
    explore:'Explorar cursos', course:'Método MES®', lesson:'Método MES®'
  };
  const hashByView = {
    home:'inicio', courses:'cursos', evaluations:'evaluaciones', library:'biblioteca',
    calendar:'calendario', certificates:'certificados', help:'ayuda', profile:'perfil', explore:'explorar'
  };
  const viewByHash = Object.fromEntries(Object.entries(hashByView).map(([k,v]) => [v,k]));

  const shellPages = () => [...document.querySelectorAll('[data-shell-page]')];
  const managedNodes = () => [dashHead,stats,continuePanel,coursesPanel,courseView,lessonView,reservations,...shellPages()].filter(Boolean);
  const dashboardOpen = () => !!dashboard && !dashboard.classList.contains('hidden');

  function setHidden(node, hidden) {
    if (node) node.classList.toggle('v54-hidden', !!hidden);
  }

  function activeNav(view) {
    const route = (view === 'course' || view === 'lesson') ? 'courses' : view;
    document.querySelectorAll('[data-shell-route]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.shellRoute === route);
    });
    const crumb = document.querySelector('[data-shell-breadcrumb]');
    if (crumb) {
      crumb.textContent = view === 'lesson'
        ? (document.querySelector('[data-lesson-detail] .lesson-title h2')?.textContent?.trim() || 'Método MES®')
        : (labels[view] || 'Academia Yamilet');
    }
  }

  function updateHash(view) {
    const hash = hashByView[view];
    if (!hash || location.hash === `#${hash}`) return;
    history.pushState({ academyView:view }, '', `#${hash}`);
  }

  function applyView(view, {updateUrl=false, scroll=true} = {}) {
    if (!dashboardOpen()) return;
    managedNodes().forEach(node => setHidden(node, true));

    if (view === 'home') [dashHead,stats,continuePanel].forEach(node => setHidden(node,false));
    else if (view === 'courses') setHidden(coursesPanel,false);
    else if (view === 'course') setHidden(courseView,false);
    else if (view === 'lesson') setHidden(lessonView,false);
    else {
      const page = document.querySelector(`[data-shell-page="${view}"]`);
      if (page) setHidden(page,false);
    }

    document.body.dataset.v54View = view;
    activeNav(view);
    if (updateUrl) updateHash(view);
    if (scroll && main) requestAnimationFrame(() => main.scrollIntoView({block:'start',behavior:'smooth'}));
  }

  function currentHashView() {
    return viewByHash[location.hash.replace(/^#/,'').toLowerCase()] || 'home';
  }

  function fixImages() {
    document.querySelectorAll('img.course-cover').forEach(img => {
      if (img.dataset.v55ImageGuard === '1') return;
      img.dataset.v55ImageGuard = '1';
      img.addEventListener('error', () => {
        if (img.dataset.v55Fallback === '1') return;
        img.dataset.v55Fallback = '1';
        img.src = '../assets/curso-metodo-mes.png?v=55';
      }, {once:true});
    });
    document.querySelectorAll('.side-brand img,.topbar .brand img,.login-logo').forEach(img => {
      if (img.dataset.v55LogoGuard === '1') return;
      img.dataset.v55LogoGuard = '1';
      img.addEventListener('error', () => { img.src = '../assets/logo-yamilet.png?v=55'; }, {once:true});
    });
  }

  function upcomingMarkup() {
    const items = [
      ['Nuevo curso','Contenido en preparación','./assets/cursos/proximamente-nuevo-curso.svg'],
      ['Próximo taller','Nueva experiencia formativa','./assets/cursos/proximamente-taller.svg'],
      ['Curso en desarrollo','Próxima incorporación a la academia','./assets/cursos/proximamente-desarrollo.svg']
    ];
    return `<section class="v54-upcoming" data-v54-upcoming>
      <div class="v54-section-head"><div><span>Catálogo futuro</span><h3>Próximamente</h3></div><p>Nuevos espacios de aprendizaje que se habilitarán conforme estén listos.</p></div>
      <div class="v54-upcoming-grid">${items.map(([title,copy,img]) => `<article class="v54-upcoming-card"><img src="${img}" alt="${title}" loading="lazy"><div><span>PRÓXIMAMENTE</span><h4>${title}</h4><p>${copy}</p><button type="button" disabled>Disponible próximamente</button></div></article>`).join('')}</div>
    </section>`;
  }

  function ensureUpcoming() {
    if (!coursesPanel || coursesPanel.querySelector('[data-v54-upcoming]')) return;
    const list = coursesPanel.querySelector('[data-course-list]');
    if (!list || !list.querySelector('.learning-course-card')) return;
    list.insertAdjacentHTML('afterend', upcomingMarkup());
  }

  function cleanStaffPreview() {
    document.querySelectorAll('.learning-course-card .tag').forEach(tag => {
      if ((tag.textContent || '').toLowerCase().includes('vista de staff')) tag.textContent = 'Disponible';
    });
  }

  function refreshUi() {
    refreshQueued = false;
    if (!dashboardOpen()) return;
    fixImages();
    ensureUpcoming();
    cleanStaffPreview();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refreshUi);
  }

  function init() {
    if (initialized || !dashboardOpen()) return;
    initialized = true;
    document.body.dataset.v54Stable = '1';
    document.body.dataset.v55Stable = '1';
    queueRefresh();
    applyView(currentHashView(), {scroll:false});

    // Only watch rendered child content. Do NOT watch course/lesson class changes:
    // v54 did that and could recursively trigger applyView until the page froze.
    if (main) new MutationObserver(queueRefresh).observe(main,{childList:true,subtree:true});
  }

  document.addEventListener('click', event => {
    const shell = event.target.closest('[data-shell-route]');
    if (shell) {
      const route = shell.dataset.shellRoute;
      if (route === 'admin') {
        event.preventDefault();
        event.stopImmediatePropagation();
        location.href = './admin/';
        return;
      }
      if (hashByView[route]) setTimeout(() => applyView(route,{updateUrl:true}),80);
      return;
    }

    if (event.target.closest('[data-open-course]')) {
      setTimeout(() => applyView('course',{scroll:true}),60);
      return;
    }
    if (event.target.closest('[data-open-lesson][data-course-id]')) {
      setTimeout(() => applyView('lesson',{scroll:true}),60);
      return;
    }
    if (event.target.closest('[data-back-courses]')) {
      setTimeout(() => applyView('courses',{updateUrl:true}),60);
      return;
    }
    if (event.target.closest('[data-back-course]')) {
      setTimeout(() => applyView('course'),60);
    }
  }, true);

  window.addEventListener('hashchange', () => {
    if (!dashboardOpen()) return;
    const courseOpen = courseView && !courseView.classList.contains('hidden');
    const lessonOpen = lessonView && !lessonView.classList.contains('hidden');
    if (courseOpen || lessonOpen) return;
    applyView(currentHashView(),{scroll:false});
  });

  if (dashboard) {
    new MutationObserver(() => {
      if (dashboardOpen()) init();
    }).observe(dashboard,{attributes:true,attributeFilter:['class']});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();

  window.ACADEMIA_YAMILET_STABLE_V55 = {release:RELEASE,applyView,refresh:queueRefresh};
})();
