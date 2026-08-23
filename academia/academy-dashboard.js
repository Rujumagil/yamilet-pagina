(() => {
  'use strict';
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const $ = (selector, root = document) => root.querySelector(selector);
  let initialized = false;

  function addAcademicStats(main) {
    const stats = $('.stats', main);
    if (!stats) return;
    if (!stats.querySelector('[data-dashboard-stat="weeks"]')) {
      stats.insertAdjacentHTML('beforeend', `
        <article data-dashboard-stat="weeks"><span>Semanas del programa</span><strong>4</strong><small>Ruta completa de Método MES®</small></article>
        <article data-dashboard-stat="days"><span>Días de práctica</span><strong>24</strong><small>Recorrido completo del programa</small></article>
      `);
    }
    const courseCount = stats.querySelector('[data-course-count]')?.closest('article');
    if (courseCount && !courseCount.querySelector('small')) courseCount.insertAdjacentHTML('beforeend','<small>Programas disponibles para continuar</small>');
    const progress = stats.querySelector('[data-overall-progress]')?.closest('article');
    if (progress && !progress.querySelector('small')) progress.insertAdjacentHTML('beforeend','<small>Tu avance se guarda automáticamente</small>');
  }

  function addRoadmap(main) {
    if ($('.academy-home-roadmap', main)) return;
    const continuePanel = $('#continuar', main);
    if (!continuePanel) return;
    const card = document.createElement('aside');
    card.className = 'academy-home-roadmap';
    card.innerHTML = `
      <div class="academy-roadmap-kicker">Tu ruta de aprendizaje</div>
      <h3>Método MES®</h3>
      <p>Una ruta de cuatro semanas para avanzar con claridad, práctica y seguimiento.</p>
      <ol class="academy-roadmap-list">
        <li><b>01</b><span>Preparar el sistema nervioso</span></li>
        <li><b>02</b><span>La biología de la calma</span></li>
        <li><b>03</b><span>Tu sistema personal</span></li>
        <li><b>04</b><span>Autonomía emocional</span></li>
      </ol>
      <button type="button" data-dashboard-open-courses>Ver mis cursos</button>
    `;
    continuePanel.insertAdjacentElement('afterend', card);
    card.querySelector('[data-dashboard-open-courses]')?.addEventListener('click', () => $('[data-shell-route="courses"]')?.click());
  }

  function setSection(main, section) { main.dataset.academySection = section || 'home'; }

  function bindNavigation(main) {
    $$('[data-shell-route]').forEach(button => {
      if (button.dataset.dashboardBound) return;
      button.dataset.dashboardBound = 'true';
      button.addEventListener('click', () => setSection(main, button.dataset.shellRoute || 'home'));
    });
    $('[data-scroll-home]')?.addEventListener('click', () => setSection(main, 'home'));
    $('[data-scroll-courses]')?.addEventListener('click', () => setSection(main, 'courses'));
  }

  function enhanceHeading(main) {
    const head = $('.dash-head', main);
    if (!head || head.dataset.dashboardEnhanced) return;
    head.dataset.dashboardEnhanced = 'true';
    const paragraph = head.querySelector('p');
    if (paragraph && !paragraph.textContent.trim()) paragraph.textContent = 'Continúa tu proceso, retoma Método MES® y encuentra tus recursos en un solo lugar, a tu propio ritmo.';
  }

  function init() {
    if (initialized) return true;
    const dashboard = $('[data-dashboard]');
    const main = $('.dashboard-main');
    const nav = $('[data-shell-route="home"]');
    if (!dashboard || dashboard.classList.contains('hidden') || !main || !nav) return false;
    initialized = true;
    addAcademicStats(main);
    addRoadmap(main);
    enhanceHeading(main);
    bindNavigation(main);
    setSection(main, 'home');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (init() || attempts > 80) window.clearInterval(timer);
  }, 250);
})();
