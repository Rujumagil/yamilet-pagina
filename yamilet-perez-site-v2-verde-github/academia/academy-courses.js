(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const UPCOMING = [
    { title: 'Nuevo curso', copy: 'Un nuevo espacio de aprendizaje se incorporará a la academia.', image: './assets/cursos/proximamente-nuevo-curso.svg' },
    { title: 'Próximo taller', copy: 'Una nueva experiencia formativa se encuentra en preparación.', image: './assets/cursos/proximamente-taller.svg' },
    { title: 'Curso en desarrollo', copy: 'Próxima incorporación al catálogo de Academia Yamilet.', image: './assets/cursos/proximamente-desarrollo.svg' }
  ];

  let activeCourseCover = '';

  function addHeading(panel) {
    const head = $('.panel-head', panel);
    if (!head || head.dataset.coursesEnhanced) return;
    head.dataset.coursesEnhanced = 'true';
    head.innerHTML = `<div><div class="kicker">Tu aprendizaje</div><h2>Mis cursos</h2><p>Aquí encuentras únicamente tu formación activa y los programas que forman parte de tu recorrido dentro de Academia Yamilet.</p></div>`;
  }

  function addSubhead(list) {
    if ($('.academy-courses-subhead', list.parentElement)) return;
    const sub = document.createElement('div');
    sub.className = 'academy-courses-subhead';
    sub.innerHTML = '<div><h3>Tu curso actual</h3><span>Retoma exactamente donde lo dejaste.</span></div><span>Progreso guardado automáticamente</span>';
    list.insertAdjacentElement('beforebegin', sub);
  }

  function decorateCards(list) {
    const cards = $$('.learning-course-card', list);
    if (!cards.length) return false;
    cards.forEach((card, index) => {
      card.dataset.academyCourseCard = index === 0 ? 'current' : 'enrolled';
      if (index === 0 && !$('.academy-current-meta', card)) {
        const meta = document.createElement('div');
        meta.className = 'academy-current-meta';
        meta.innerHTML = '<span>4 semanas</span><span>24 lecciones</span><span>Programa guiado</span>';
        const action = $('.course-action', card);
        if (action) action.insertAdjacentElement('beforebegin', meta);
        else $('.course-card-body', card)?.appendChild(meta);
      }
    });
    return true;
  }

  function addUpcoming(panel) {
    if ($('.academy-upcoming-section', panel)) return;
    const section = document.createElement('section');
    section.className = 'academy-upcoming-section';
    section.innerHTML = `
      <div class="academy-upcoming-head">
        <div><div class="academy-upcoming-kicker">Nuevas experiencias</div><h3>Próximamente</h3></div>
        <p>Estos espacios están en preparación y no forman parte todavía de tus cursos activos.</p>
      </div>
      <div class="academy-upcoming-grid">
        ${UPCOMING.map(item => `<article class="academy-upcoming-card"><img src="${item.image}" alt="${item.title}" loading="lazy"><div class="academy-upcoming-body"><span class="academy-upcoming-status">PRÓXIMAMENTE</span><h4>${item.title}</h4><p>${item.copy}</p><button type="button" disabled>Disponible próximamente</button></div></article>`).join('')}
      </div>`;
    panel.appendChild(section);
  }

  function enhanceCourses() {
    const dashboard = $('[data-dashboard]');
    const panel = $('#mis-cursos');
    const list = $('[data-course-list]', panel || document);
    if (!dashboard || dashboard.classList.contains('hidden') || !panel || !list) return false;
    panel.classList.add('academy-courses-page');
    addHeading(panel);
    addSubhead(list);
    addUpcoming(panel);
    return decorateCards(list);
  }

  function scheduleEnhance() {
    window.setTimeout(enhanceCourses, 80);
    window.setTimeout(enhanceCourses, 350);
    window.setTimeout(enhanceCourses, 900);
  }

  function findCoverByTitle(title) {
    const card = $$('.learning-course-card').find(item => $('h3', item)?.textContent.trim() === title);
    return $('.course-cover', card || document)?.src || '';
  }

  function progressParts(module) {
    const count = $('.module-head > span', module)?.textContent.trim() || '0/0';
    const match = count.match(/(\d+)\s*\/\s*(\d+)/);
    const done = Number(match?.[1] || 0);
    const total = Number(match?.[2] || 0);
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function decorateModules(host) {
    const modules = $$('.module-block', host);
    modules.forEach((module, index) => {
      module.classList.add('academy-week-card');
      module.dataset.week = String(index + 1);
      const label = $('.module-label', module);
      if (label) label.textContent = `Semana ${String(index + 1).padStart(2, '0')}`;

      const head = $('.module-head', module);
      const originalCount = $('.module-head > span', module);
      if (originalCount) originalCount.classList.add('academy-module-count');
      const { done, total, percent } = progressParts(module);

      if (head && !$('.academy-week-number', head)) {
        const number = document.createElement('div');
        number.className = 'academy-week-number';
        number.textContent = String(index + 1).padStart(2, '0');
        head.insertAdjacentElement('afterbegin', number);
      }
      if (!$('.academy-week-progress', module)) {
        const progress = document.createElement('div');
        progress.className = 'academy-week-progress';
        progress.innerHTML = `<div><span>${done} de ${total} lecciones completadas</span><strong>${percent}%</strong></div><div class="academy-week-progress-track"><span style="width:${percent}%"></span></div>`;
        head?.insertAdjacentElement('afterend', progress);
      }
    });
    return modules;
  }

  function addProgramHeading(host, moduleCount, lessonCount, completedCount) {
    let heading = $('.academy-program-heading', host);
    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'academy-program-heading';
      $('.syllabus', host)?.insertAdjacentElement('beforebegin', heading);
    }
    heading.innerHTML = `<div><div class="academy-course-kicker">Contenido del programa</div><h3>Tu recorrido en Método MES®</h3><p>Avanza semana por semana. Tu progreso se registra automáticamente en cada lección.</p></div><div class="academy-program-summary"><span><b>${moduleCount}</b> semanas</span><span><b>${lessonCount}</b> lecciones</span><span><b>${completedCount}</b> completadas</span></div>`;
  }

  function buildCourseHero(host, title, description, status, percent, moduleCount, lessonCount) {
    let hero = $('.academy-course-hero', host);
    if (!hero) {
      hero = document.createElement('section');
      hero.className = 'academy-course-hero';
      host.insertAdjacentElement('afterbegin', hero);
    }
    const cover = activeCourseCover || findCoverByTitle(title);
    hero.innerHTML = `
      <div class="academy-course-hero-media">${cover ? `<img src="${cover}" alt="Portada de ${title}">` : '<div class="academy-course-cover-fallback"><span>YP</span><strong>Método MES®</strong></div>'}</div>
      <div class="academy-course-hero-copy">
        <span class="academy-course-status">${status || 'Curso activo'}</span>
        <div class="academy-course-kicker">Academia Yamilet · Programa formativo</div>
        <h1>${title}</h1>
        <p>${description || 'Programa de Academia Yamilet.'}</p>
        <div class="academy-course-facts"><span><b>${moduleCount}</b> semanas</span><span><b>${lessonCount}</b> lecciones</span><span><b>${percent}</b> de avance</span></div>
        <div class="academy-course-progress"><div><span>Progreso del programa</span><strong>${percent}</strong></div><div class="academy-course-progress-track"><span style="width:${percent}"></span></div></div>
        <button class="academy-course-primary" type="button" data-course-primary-action>Continuar aprendizaje</button>
      </div>`;

    $('[data-course-primary-action]', hero)?.addEventListener('click', () => {
      const next = $('.lesson-row:not(.is-complete)', host) || $('.lesson-row', host);
      next?.click();
    });
  }

  function enhanceCourseView() {
    const view = $('[data-course-view]');
    const host = $('[data-course-detail]');
    if (!view || view.classList.contains('hidden') || !host) return false;
    const detailHead = $('.course-detail-head', host);
    const syllabus = $('.syllabus', host);
    if (!detailHead || !syllabus) return false;

    const title = $('h2', detailHead)?.textContent.trim() || 'Método MES®';
    const description = $('p', detailHead)?.textContent.trim() || '';
    const status = $('.eyebrow', detailHead)?.textContent.trim() || 'Disponible';
    const percent = $('.progress-orb strong', detailHead)?.textContent.trim() || '0%';
    const modules = decorateModules(host);
    const lessons = $$('.lesson-row', syllabus);
    const completed = $$('.lesson-row.is-complete', syllabus).length;

    detailHead.classList.add('academy-course-original-head');
    const originalProgress = $('.progress-track.large', host);
    originalProgress?.classList.add('academy-course-original-progress');
    buildCourseHero(host, title, description, status, percent, modules.length, lessons.length);
    addProgramHeading(host, modules.length, lessons.length, completed);

    view.classList.add('academy-course-page');
    document.body.dataset.academyLearningView = 'course';
    const main = $('.dashboard-main');
    if (main) main.dataset.academySection = 'course';
    return true;
  }

  function activateCatalog() {
    delete document.body.dataset.academyLearningView;
    const main = $('.dashboard-main');
    if (main) main.dataset.academySection = 'courses';
    scheduleEnhance();
  }

  function activateLesson() {
    document.body.dataset.academyLearningView = 'lesson';
    const main = $('.dashboard-main');
    if (main) main.dataset.academySection = 'lesson';
  }

  document.addEventListener('click', event => {
    const openCourse = event.target.closest('[data-open-course]');
    if (openCourse) {
      activeCourseCover = $('.course-cover', openCourse.closest('.learning-course-card') || document)?.src || activeCourseCover;
      window.setTimeout(enhanceCourseView, 0);
      window.setTimeout(enhanceCourseView, 100);
      return;
    }

    if (event.target.closest('[data-open-lesson]')) {
      window.setTimeout(activateLesson, 0);
      return;
    }

    if (event.target.closest('[data-back-course]')) {
      window.setTimeout(enhanceCourseView, 0);
      window.setTimeout(enhanceCourseView, 100);
      return;
    }

    if (event.target.closest('[data-back-courses], [data-shell-route="courses"], [data-scroll-courses], [data-dashboard-open-courses]')) {
      window.setTimeout(activateCatalog, 0);
      return;
    }

    const shellRoute = event.target.closest('[data-shell-route]');
    if (shellRoute) delete document.body.dataset.academyLearningView;
  });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (enhanceCourses() || attempts > 60) window.clearInterval(timer);
  }, 250);
})();
