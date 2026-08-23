(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const UPCOMING = [
    { title: 'Nuevo curso', copy: 'Un nuevo espacio de aprendizaje se incorporará a la academia.', image: './assets/cursos/proximamente-nuevo-curso.svg' },
    { title: 'Próximo taller', copy: 'Una nueva experiencia formativa se encuentra en preparación.', image: './assets/cursos/proximamente-taller.svg' },
    { title: 'Curso en desarrollo', copy: 'Próxima incorporación al catálogo de Academia Yamilet.', image: './assets/cursos/proximamente-desarrollo.svg' }
  ];

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
        meta.innerHTML = '<span>4 semanas</span><span>24 días</span><span>Programa guiado</span>';
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

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="courses"], [data-scroll-courses], [data-dashboard-open-courses]')) scheduleEnhance();
  });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (enhanceCourses() || attempts > 60) window.clearInterval(timer);
  }, 250);
})();
