(() => {
  'use strict';
  const VERSION = '73.0.0';
  const TOP_LEVEL = new Set(['home','courses','resources','agenda','certificates']);
  let scheduled = false;

  function text(selector, fallback = '') {
    return document.querySelector(selector)?.textContent?.trim() || fallback;
  }

  function initials(name = '') {
    return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'YP';
  }

  function currentRoute() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function ensureStylesheet(selector, href, datasetKey) {
    if (document.querySelector(selector)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset[datasetKey] = 'true';
    document.head.appendChild(link);
  }

  function ensureRefinementStyles() {
    ensureStylesheet('link[data-academy-v72]', './academy-v72-refinement.css?v=72', 'academyV72');
    ensureStylesheet('link[data-academy-courses-v73]', './academy-courses-refinement-v73.css?v=73', 'academyCoursesV73');
  }

  function enhanceBrand() {
    const brand = document.querySelector('.side-brand');
    if (!brand) return;
    const strong = brand.querySelector('strong');
    const small = brand.querySelector('small');
    if (strong) strong.textContent = 'Academia Yamilet';
    if (small) small.textContent = 'Método MES®';
  }

  function enhanceUserCard() {
    const sidebar = document.querySelector('.sidebar');
    const signout = sidebar?.querySelector('[data-signout]');
    if (!sidebar || !signout) return;

    let card = sidebar.querySelector('[data-aula-clone-user]');
    if (!card) {
      card = document.createElement('div');
      card.className = 'academy-aula-user-card';
      card.dataset.aulaCloneUser = 'true';
      signout.insertAdjacentElement('beforebegin', card);
    }

    const name = text('[data-user-name]', 'Academia Yamilet');
    const role = text('[data-user-role]', 'Alumna');
    card.innerHTML = `<span class="academy-aula-user-avatar">${initials(name)}</span><span class="academy-aula-user-copy"><strong>${name}</strong><small>${role}</small></span><span class="academy-aula-user-arrow">›</span>`;
  }

  function makeCardClickable(card, action, marker) {
    if (!card || !action || card.dataset[marker] === 'true') return;
    card.dataset[marker] = 'true';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.addEventListener('click', event => {
      if (event.target.closest('a,button,input,select,textarea')) return;
      action.click();
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter') action.click();
    });
  }

  function enhanceCourseCards() {
    document.querySelectorAll('[data-course-list] .learning-course-card').forEach(card => {
      const button = card.querySelector('[data-open-course]');
      makeCardClickable(card, button, 'aulaCloneClick');
    });

    document.querySelectorAll('.v71-course-card').forEach(card => {
      const action = card.querySelector('.v71-course-actions .primary, .v71-course-cover, h3 a');
      makeCardClickable(card, action, 'v72CardClick');
    });
  }

  function enhanceCoursesPage() {
    const page = document.querySelector('.v71-courses-page');
    if (!page) return;
    const grid = page.querySelector(':scope > .v71-course-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll(':scope > .v71-course-card'));
    const count = cards.length;
    const signature = `${count}:${cards.map(card => card.querySelector('h3')?.textContent?.trim() || '').join('|')}`;
    if (page.dataset.v73Enhanced === signature) return;

    page.dataset.v73Enhanced = signature;
    page.dataset.v73CourseCount = String(count);

    const header = page.querySelector(':scope > .v71-page-heading');
    const eyebrow = header?.querySelector('.v71-eyebrow');
    const description = header?.querySelector('p');
    const catalog = header?.querySelector('a[href="#catalog"]');
    if (eyebrow) eyebrow.textContent = 'Tu aprendizaje';
    if (description) description.textContent = 'Aquí encuentras únicamente los programas activos de tu cuenta y los próximos lanzamientos de Academia Yamilet.';
    if (catalog) catalog.textContent = 'Catálogo de cursos';

    let activeHeading = page.querySelector(':scope > .v73-active-heading');
    if (!activeHeading) {
      activeHeading = document.createElement('div');
      activeHeading.className = 'v73-active-heading';
      grid.insertAdjacentElement('beforebegin', activeHeading);
    }
    activeHeading.innerHTML = `<div><span>Formación activa</span><h2>${count === 1 ? 'Tu curso activo' : 'Tus cursos activos'}</h2></div><small>${count} ${count === 1 ? 'programa disponible' : 'programas disponibles'}</small>`;

    page.querySelectorAll('.v71-course-actions .ghost').forEach(action => {
      action.setAttribute('aria-hidden', 'true');
      action.tabIndex = -1;
    });

    cards.forEach(card => {
      const primary = card.querySelector('.v71-course-actions .primary');
      if (primary) {
        const isContinue = /continuar/i.test(primary.textContent || '');
        primary.textContent = isContinue ? 'Continuar curso →' : 'Entrar al curso →';
      }
    });

    const continuePanel = page.querySelector(':scope > .v71-continue-panel');
    const continuePrimary = continuePanel?.querySelector('.v71-course-actions .primary');
    if (continuePrimary) continuePrimary.textContent = /continuar/i.test(continuePrimary.textContent || '') ? 'Continuar curso →' : 'Entrar al curso →';
  }

  function enhanceTopbar() {
    const topbar = document.querySelector('.academy-topbar');
    if (!topbar) return;
    const small = topbar.querySelector('.academy-topbar-brand small');
    if (small) small.textContent = 'ACADEMIA YAMILET · MÉTODO MES®';
  }

  function cleanRouteLayers() {
    const main = document.querySelector('.dashboard-main');
    if (!main) return;
    const route = currentRoute();
    const host = main.querySelector('[data-aula-pages-v71]');
    const clean = TOP_LEVEL.has(route) && host && !host.hidden;

    Array.from(main.children).forEach(child => {
      const keep = child === host || child.classList.contains('academy-topbar');
      if (clean && !keep) child.dataset.v72Suppressed = 'true';
      else delete child.dataset.v72Suppressed;
    });
    main.dataset.v72Route = clean ? route : '';
  }

  function run() {
    scheduled = false;
    document.documentElement.dataset.academyAulaClone = VERSION;
    ensureRefinementStyles();
    enhanceBrand();
    enhanceTopbar();
    enhanceUserCard();
    enhanceCourseCards();
    enhanceCoursesPage();
    cleanRouteLayers();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    ensureRefinementStyles();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class','hidden'] });
    document.addEventListener('click', () => setTimeout(schedule, 60), true);
    window.addEventListener('hashchange', () => setTimeout(schedule, 80));
    window.addEventListener('popstate', () => setTimeout(schedule, 80));
    window.addEventListener('pageshow', schedule);
    schedule();
    window.ACADEMIA_YAMILET_AULA_CLONE_V69 = Object.freeze({ version: VERSION, refresh: schedule });
    window.ACADEMIA_YAMILET_REFINEMENT_V72 = Object.freeze({ version: VERSION, refresh: schedule });
    window.ACADEMIA_YAMILET_COURSES_V73 = Object.freeze({ version: VERSION, refresh: schedule });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
