(() => {
  'use strict';
  const VERSION = '89.0.0';
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
    ensureStylesheet('link[data-academy-library-v74]', './academy-library-refinement-v74.css?v=74', 'academyLibraryV74');
    ensureStylesheet('link[data-academy-agenda-v75]', './academy-agenda-refinement-v75.css?v=75', 'academyAgendaV75');
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
    const role = text('[data-user-role]', 'Estudiante');
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

  function enhanceResourcesPage() {
    const page = document.querySelector('.v71-library-page');
    if (!page) return;

    const cards = Array.from(page.querySelectorAll('[data-v71-resource-card]'));
    const books = cards.filter(card => card.dataset.resourceGroup === 'book');
    const materials = cards.filter(card => card.dataset.resourceGroup !== 'book');
    const titles = cards.map(card => card.querySelector('h3')?.textContent?.trim() || '').join('|');
    const signature = `${cards.length}:${books.length}:${materials.length}:${titles}`;
    if (page.dataset.v74Enhanced === signature) return;

    page.dataset.v74Enhanced = signature;
    page.dataset.v74ResourceCount = String(cards.length);
    page.dataset.v74BookCount = String(books.length);
    page.dataset.v74MaterialCount = String(materials.length);

    const header = page.querySelector(':scope > .v71-page-heading');
    const eyebrow = header?.querySelector('.v71-eyebrow');
    const description = header?.querySelector('p');
    if (eyebrow) eyebrow.textContent = 'Tu colección';
    if (description) description.textContent = 'Libros, ejercicios y materiales asignados a tus programas, reunidos en un solo lugar.';

    const toolbar = page.querySelector(':scope > .v71-toolbar');
    if (toolbar) toolbar.dataset.v74Hidden = cards.length < 4 ? 'true' : 'false';

    cards.forEach(card => {
      delete card.dataset.v74FeaturedDuplicate;
      const action = card.querySelector('[data-v71-resource]');
      makeCardClickable(card, action, 'v74ResourceClick');
    });

    const featured = page.querySelector(':scope > .v71-featured-resource');
    const featuredTitle = featured?.querySelector('h2')?.textContent?.trim().toLowerCase() || '';
    const bookGrid = page.querySelector('.v71-resource-grid.books');
    const bookSection = bookGrid?.closest('.v71-library-section');

    let visibleBooks = books;
    if (featuredTitle) {
      let duplicateMarked = false;
      books.forEach(card => {
        const title = card.querySelector('h3')?.textContent?.trim().toLowerCase() || '';
        if (!duplicateMarked && title && title === featuredTitle) {
          card.dataset.v74FeaturedDuplicate = 'true';
          duplicateMarked = true;
        }
      });
      visibleBooks = books.filter(card => card.dataset.v74FeaturedDuplicate !== 'true');
    }

    if (bookSection) {
      bookSection.dataset.v74EmptySection = visibleBooks.length ? 'false' : 'true';
      const count = bookSection.querySelector(':scope > .v71-section-heading > span');
      if (count && visibleBooks.length) count.textContent = `${visibleBooks.length} ${visibleBooks.length === 1 ? 'título' : 'títulos'}`;
    }

    const materialGrid = Array.from(page.querySelectorAll('.v71-resource-grid')).find(grid => !grid.classList.contains('books'));
    const materialSection = materialGrid?.closest('.v71-library-section');
    if (materialSection) materialSection.dataset.v74MaterialSection = 'true';

    const empty = page.querySelector('.v71-library-content .v71-empty');
    if (empty && !empty.querySelector('.v74-empty-actions')) {
      empty.insertAdjacentHTML('beforeend', '<div class="v74-empty-actions"><a href="#courses">Volver a mis cursos</a><a href="#catalog">Explorar catálogo</a></div>');
    }

    const security = page.querySelector('.v71-security-note');
    const securityTitle = security?.querySelector('strong');
    const securityText = security?.querySelector('p');
    if (securityTitle) securityTitle.textContent = 'Biblioteca privada';
    if (securityText) securityText.textContent = 'Tus archivos se abren únicamente con los permisos de tu cuenta de Academia Yamilet.';
  }

  function enhanceAgendaPage() {
    const page = document.querySelector('.v71-agenda-page');
    if (!page) return;

    const rows = Array.from(page.querySelectorAll('.v71-event-row'));
    const nextCard = page.querySelector('.v71-next-event');
    const nextTitle = nextCard?.querySelector('h2')?.textContent?.trim().toLowerCase() || '';
    const signature = `${rows.length}:${nextTitle}:${rows.map(row => row.querySelector('h3')?.textContent?.trim() || '').join('|')}`;
    if (page.dataset.v75Enhanced === signature) return;
    page.dataset.v75Enhanced = signature;
    page.dataset.v75EventCount = String(rows.length);

    const header = page.querySelector(':scope > .v71-page-heading');
    const eyebrow = header?.querySelector('.v71-eyebrow');
    const description = header?.querySelector('p');
    if (eyebrow) eyebrow.textContent = 'Tu agenda';
    if (description) description.textContent = 'Consulta tus próximas sesiones, encuentros y actividades de Academia Yamilet desde un solo lugar.';

    const monthHead = page.querySelector('.v71-month-head strong');
    const monthText = monthHead?.textContent?.trim().toLowerCase() || '';
    const now = new Date();
    const currentMonth = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(now).toLowerCase();
    const currentYear = String(now.getFullYear());
    if (monthText.includes(currentMonth) && monthText.includes(currentYear)) {
      Array.from(page.querySelectorAll('.v71-month-grid > span')).forEach(cell => {
        delete cell.dataset.v75Today;
        if (cell.textContent?.trim() === String(now.getDate())) cell.dataset.v75Today = 'true';
      });
    }

    rows.forEach(row => delete row.dataset.v75NextDuplicate);
    if (nextTitle) {
      const duplicate = rows.find(row => (row.querySelector('h3')?.textContent?.trim().toLowerCase() || '') === nextTitle);
      if (duplicate) duplicate.dataset.v75NextDuplicate = 'true';
    }

    const visibleRows = rows.filter(row => row.dataset.v75NextDuplicate !== 'true');
    const originalHeading = page.querySelector(':scope > .v71-section-heading');
    if (originalHeading) originalHeading.dataset.v75OriginalEventsHeading = 'true';

    let heading = page.querySelector(':scope > .v75-events-heading');
    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'v75-events-heading';
      const list = page.querySelector(':scope > .v71-event-list');
      list?.insertAdjacentElement('beforebegin', heading);
    }
    if (heading) {
      const countLabel = visibleRows.length === 1 ? '1 encuentro adicional' : `${visibleRows.length} encuentros adicionales`;
      heading.innerHTML = `<div><span>Próximas actividades</span><h2>${nextTitle ? 'Siguientes encuentros' : 'Eventos programados'}</h2></div><small>${nextTitle ? countLabel : `${rows.length} ${rows.length === 1 ? 'evento próximo' : 'eventos próximos'}`}</small>`;
    }

    const empty = page.querySelector('.v71-event-list .v71-empty');
    if (empty && !empty.querySelector('.v75-empty-agenda-action')) {
      empty.insertAdjacentHTML('beforeend', '<a class="v75-empty-agenda-action" href="#courses">Volver a mis cursos</a>');
    }

    page.querySelectorAll('.v71-event-row-actions button').forEach(button => {
      if (/agregar/i.test(button.textContent || '')) button.textContent = 'Agregar al calendario';
    });
    page.querySelectorAll('.v71-event-row-actions a').forEach(link => {
      if (/entrar/i.test(link.textContent || '')) link.textContent = 'Entrar a sesión';
    });
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
    enhanceResourcesPage();
    enhanceAgendaPage();
    cleanRouteLayers();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    ensureRefinementStyles();
    const target = document.querySelector('[data-dashboard]') || document.body;
    const observer = new MutationObserver(schedule);
    observer.observe(target, { childList: true, subtree: true });
    document.addEventListener('click', () => setTimeout(schedule, 60), true);
    window.addEventListener('hashchange', () => setTimeout(schedule, 80));
    window.addEventListener('popstate', () => setTimeout(schedule, 80));
    window.addEventListener('pageshow', schedule);
    schedule();
    window.ACADEMIA_YAMILET_AULA_CLONE_V69 = Object.freeze({ version: VERSION, refresh: schedule });
    window.ACADEMIA_YAMILET_REFINEMENT_V72 = Object.freeze({ version: VERSION, refresh: schedule });
    window.ACADEMIA_YAMILET_COURSES_V73 = Object.freeze({ version: VERSION, refresh: schedule });
    window.ACADEMIA_YAMILET_LIBRARY_V74 = Object.freeze({ version: VERSION, refresh: schedule });
    window.ACADEMIA_YAMILET_AGENDA_V75 = Object.freeze({ version: VERSION, refresh: schedule });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
