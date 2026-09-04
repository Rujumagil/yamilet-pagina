(() => {
  'use strict';

  const CATALOG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-catalog';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let catalogPromise = null;
  let scheduled = false;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const safeImage = value => {
    try {
      const url = new URL(String(value || ''), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(CATALOG_ENDPOINT, { headers: { Accept: 'application/json' } })
        .then(response => {
          if (!response.ok) throw new Error('catalog_unavailable');
          return response.json();
        })
        .catch(error => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }

  function activeCourseCards(list) {
    return $$('.learning-course-card', list).filter(card => {
      const status = $('.tag', card)?.textContent.trim().toLocaleLowerCase('es') || '';
      const draft = status.includes('preparación') || status.includes('preparacion');
      card.classList.toggle('academy-v68-draft-card', draft);
      card.hidden = draft;
      return !draft;
    });
  }

  function decorateActiveCard(card) {
    if (card.dataset.courseHubV68 === 'true') return;
    card.dataset.courseHubV68 = 'true';
    card.classList.add('academy-v68-active-course');

    const action = $('[data-open-course]', card);
    if (action) {
      action.textContent = 'Abrir curso';
      action.setAttribute('aria-label', `Abrir ${$('h3', card)?.textContent.trim() || 'curso'}`);
    }

    const tag = $('.tag', card);
    if (tag && !tag.textContent.toLocaleLowerCase('es').includes('staff')) tag.textContent = 'ACTIVO';

    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.addEventListener('click', event => {
      if (event.target.closest('button,a,input,select,textarea')) return;
      action?.click();
    });
    card.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button,a,input,select,textarea')) {
        event.preventDefault();
        action?.click();
      }
    });
  }

  function ensureHubHeading(panel, list, activeCount) {
    const head = $('.panel-head', panel);
    if (head) {
      head.innerHTML = `<div><div class="kicker">Tu aprendizaje</div><h2>Mis cursos</h2><p>Accede a los programas que ya forman parte de tu cuenta y consulta lo que Academia Yamilet está preparando para ti.</p></div>
        <button class="academy-v68-catalog-link" type="button" data-open-course-catalog>Catálogo de cursos →</button>`;
    }

    let subhead = $('.academy-v68-active-head', panel);
    if (!subhead) {
      subhead = document.createElement('div');
      subhead.className = 'academy-v68-active-head';
      list.insertAdjacentElement('beforebegin', subhead);
    }
    subhead.innerHTML = `<div><span>FORMACIÓN ACTIVA</span><h3>${activeCount === 1 ? 'Tu curso' : 'Tus cursos'}</h3></div><p>${activeCount ? `${activeCount} ${activeCount === 1 ? 'programa disponible' : 'programas disponibles'} en tu cuenta.` : 'Todavía no tienes un curso activo.'}</p>`;
  }

  function upcomingCard(course) {
    const cover = safeImage(course.cover_url);
    return `<article class="academy-v68-upcoming-card">
      <div class="academy-v68-upcoming-media">${cover ? `<img src="${esc(cover)}" alt="Portada de ${esc(course.title)}" loading="lazy">` : '<div class="academy-v68-cover-fallback">YP</div>'}<span>PRÓXIMAMENTE</span></div>
      <div class="academy-v68-upcoming-copy">
        <small>${esc(course.category || 'Academia Yamilet')}</small>
        <h4>${esc(course.title)}</h4>
        <p>${esc(course.subtitle || course.description || 'Nueva formación en preparación.')}</p>
        <div>${course.duration_label ? `<span>${esc(course.duration_label)}</span>` : '<span>Más información próximamente</span>'}</div>
      </div>
    </article>`;
  }

  async function renderUpcoming(panel, activeIds) {
    let section = $('.academy-v68-upcoming', panel);
    if (!section) {
      section = document.createElement('section');
      section.className = 'academy-v68-upcoming';
      panel.appendChild(section);
    }

    section.innerHTML = '<div class="academy-v68-upcoming-loading">Consultando próximos cursos…</div>';
    try {
      const data = await loadCatalog();
      if (!panel.isConnected) return;
      const upcoming = (data.courses || []).filter(course => course.catalog_status === 'upcoming' && !activeIds.has(String(course.id)));
      section.innerHTML = `<div class="academy-v68-upcoming-head"><div><span>PRÓXIMAMENTE</span><h3>Lo que viene en Academia Yamilet</h3></div><p>Estos programas todavía no forman parte de tu inscripción. Cuando estén listos, podrás encontrarlos también en el Catálogo de cursos.</p></div>
        ${upcoming.length ? `<div class="academy-v68-upcoming-grid">${upcoming.map(upcomingCard).join('')}</div>` : '<div class="academy-v68-upcoming-empty"><strong>Nuevas formaciones en preparación</strong><span>Cuando Yamilet publique un nuevo curso como “Próximamente”, aparecerá aquí automáticamente.</span></div>'}`;
    } catch (error) {
      console.error('Academia Yamilet próximos cursos', error);
      section.innerHTML = '<div class="academy-v68-upcoming-empty"><strong>No fue posible consultar los próximos cursos</strong><span>Tu formación activa sigue disponible. Vuelve a intentarlo más tarde.</span></div>';
    }
  }

  function bindCatalogButton(panel) {
    $('[data-open-course-catalog]', panel)?.addEventListener('click', () => {
      $('[data-shell-route="explore"]')?.click();
    });
  }

  function enhanceHub() {
    scheduled = false;
    const dashboard = $('[data-dashboard]');
    const panel = $('#mis-cursos');
    const list = $('[data-course-list]', panel || document);
    if (!dashboard || dashboard.classList.contains('hidden') || !panel || !list) return false;

    panel.classList.add('academy-v68-course-hub');
    panel.querySelectorAll('.academy-courses-subhead,.academy-upcoming-section').forEach(node => node.remove());

    const cards = activeCourseCards(list);
    cards.forEach(decorateActiveCard);
    list.classList.add('academy-v68-active-grid');
    ensureHubHeading(panel, list, cards.length);
    bindCatalogButton(panel);

    const activeIds = new Set(cards.map(card => String($('[data-open-course]', card)?.dataset.openCourse || '')).filter(Boolean));
    renderUpcoming(panel, activeIds);
    return true;
  }

  function cleanCourseLearningView() {
    const view = $('[data-course-view]');
    const host = $('[data-course-detail]');
    if (!view || view.classList.contains('hidden') || !host) return false;

    view.classList.add('academy-course-page', 'academy-v68-learning-course');
    host.querySelectorAll('.academy-course-hero,.academy-program-heading').forEach(node => node.remove());
    $('.course-detail-head', host)?.classList.remove('academy-course-original-head');
    $('.progress-track.large', host)?.classList.remove('academy-course-original-progress');
    document.body.dataset.academyLearningView = document.body.dataset.academyLearningView || 'course';
    const main = $('.dashboard-main');
    if (main) main.dataset.academySection = 'course';
    return true;
  }

  function activateHub() {
    delete document.body.dataset.academyLearningView;
    const main = $('.dashboard-main');
    if (main) main.dataset.academySection = 'courses';
    scheduleEnhance(20);
  }

  function scheduleEnhance(delay = 60) {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      enhanceHub();
    }, delay);
  }

  function loadUnifiedCoursesFix() {
    if (document.querySelector('script[data-academy-courses-fix-v125]')) return;
    const script = document.createElement('script');
    script.src = './academy-mobile-courses-fix-v125.js?v=125';
    script.defer = true;
    script.dataset.academyCoursesFixV125 = 'true';
    document.head.appendChild(script);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-course]')) {
      window.setTimeout(cleanCourseLearningView, 0);
      window.setTimeout(cleanCourseLearningView, 120);
      return;
    }
    if (event.target.closest('[data-back-course]')) {
      window.setTimeout(cleanCourseLearningView, 40);
      return;
    }
    if (event.target.closest('[data-back-courses],[data-shell-route="courses"],[data-scroll-courses],[data-dashboard-open-courses]')) {
      window.setTimeout(activateHub, 0);
    }
  });

  const list = $('[data-course-list]');
  if (list) new MutationObserver(() => scheduleEnhance(50)).observe(list, { childList: true, subtree: true });

  window.addEventListener('pageshow', () => scheduleEnhance(120));
  window.setTimeout(() => scheduleEnhance(0), 300);
  loadUnifiedCoursesFix();
})();