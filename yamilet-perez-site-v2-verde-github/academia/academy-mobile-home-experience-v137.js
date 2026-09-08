(() => {
  'use strict';

  const VERSION = '137';
  const mq = window.matchMedia('(max-width:760px)');
  let raf = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function loadPolishV138() {
    if (!document.querySelector('link[data-academy-mobile-home-polish-v138]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-mobile-home-polish-v138.css?v=138';
      link.dataset.academyMobileHomePolishV138 = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-academy-mobile-home-polish-v138]')) {
      const script = document.createElement('script');
      script.src = './academy-mobile-home-polish-v138.js?v=138';
      script.defer = true;
      script.dataset.academyMobileHomePolishV138 = 'true';
      document.body.appendChild(script);
    }
    if (!document.querySelector('link[data-academy-mobile-lesson-v139]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-mobile-lesson-experience-v139.css?v=139';
      link.dataset.academyMobileLessonV139 = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-academy-mobile-lesson-v139]')) {
      const script = document.createElement('script');
      script.src = './academy-mobile-lesson-experience-v139.js?v=139';
      script.defer = true;
      script.dataset.academyMobileLessonV139 = 'true';
      document.body.appendChild(script);
    }
  }

  function route() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function profileInitials(name = '') {
    return String(name)
      .replace(/^Hola,\s*/i, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'YP';
  }

  function numericProgress(card) {
    const raw = card?.querySelector('.v71-progress-label strong')?.textContent || '0';
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  }

  function ensureHomebar(page) {
    if ($('.v137-homebar', page)) return;
    const hero = $('.v71-welcome', page);
    if (!hero) return;
    const name = hero.querySelector('h1')?.textContent || 'Yamilet';
    const bar = document.createElement('div');
    bar.className = 'v137-homebar';
    bar.innerHTML = `
      <div class="v137-homebar-copy">
        <small>Academia Yamilet</small>
        <strong>Método MES®</strong>
      </div>
      <a class="v137-profile-shortcut" href="#profile" aria-label="Abrir mi perfil">${profileInitials(name)}</a>
    `;
    hero.insertAdjacentElement('beforebegin', bar);
  }

  function enhanceHero(page) {
    const hero = $('.v71-welcome', page);
    if (!hero) return;
    const copy = hero.querySelector('p');
    if (copy) copy.textContent = 'Continúa donde lo dejaste y avanza a tu propio ritmo dentro del Método MES®.';
  }

  function enhanceFeatured(page) {
    const card = $('.v71-featured-course', page);
    if (!card) return;

    const badge = $('.v71-badge', card);
    if (badge) badge.textContent = 'Tu siguiente paso';

    const progress = numericProgress(card);
    const progressLabel = $('.v71-progress-label span', card);
    if (progressLabel) progressLabel.textContent = 'Progreso del curso';

    const primary = $('.v71-featured-actions .v71-btn.primary', card);
    if (primary) {
      if (progress >= 100) primary.textContent = '✓ Repasar Método MES®';
      else if (progress > 0) primary.textContent = '▶ Reanudar aprendizaje';
      else primary.textContent = '▶ Comenzar Método MES®';
    }

    const ghost = $('.v71-featured-actions .v71-btn.ghost', card);
    if (ghost) ghost.textContent = 'Ver temario';

    let note = $('.v137-progress-note', card);
    if (!note) {
      note = document.createElement('div');
      note.className = 'v137-progress-note';
      $('.v71-progress.large', card)?.insertAdjacentElement('afterend', note);
    }
    if (note) {
      note.textContent = progress >= 100
        ? 'Curso completado. Puedes volver a cualquier lección cuando quieras.'
        : progress > 0
          ? `${progress}% completado · tu avance se guarda automáticamente.`
          : 'Tu avance se guardará automáticamente desde la primera lección.';
    }
  }

  function enhanceStats(page) {
    const cards = $$('.v71-summary-card', page);
    const labels = ['Cursos', 'Lecciones', 'Biblioteca', 'Próxima sesión'];
    cards.forEach((card, index) => {
      const small = $('small', card);
      if (small && labels[index]) small.textContent = labels[index];
    });

    const next = cards[3];
    const value = next?.querySelector('strong');
    if (value && /sin fecha/i.test(value.textContent || '')) value.textContent = 'Pendiente';
  }

  function enhanceEvent(page) {
    const card = $('.v71-event-card', page);
    if (!card) return;
    const title = $('h2', card);
    const empty = /aparecerá aquí|no tienes sesiones|sin eventos/i.test(title?.textContent || '');
    card.dataset.v137Empty = empty ? 'true' : 'false';

    if (empty) {
      const eyebrow = $('.v71-eyebrow', card);
      const copy = $('p', card);
      const action = $('.v71-btn', card);
      if (eyebrow) eyebrow.textContent = 'Próxima sesión';
      if (title) title.textContent = 'No tienes sesiones programadas';
      if (copy) copy.textContent = 'Cuando Yamilet publique una sesión o encuentro, aparecerá aquí.';
      if (action) action.textContent = 'Ver calendario →';
    }
  }

  function reorderHome(page) {
    const welcome = $('.v71-welcome', page);
    const summary = $('.v71-summary-grid', page);
    const homeGrid = $('.v71-home-grid', page);
    const featured = $('.v71-featured-course', page);
    const event = $('.v71-event-card', page);
    if (!welcome || !summary || !featured || !event) return;

    if (featured.parentElement !== page) welcome.insertAdjacentElement('afterend', featured);
    if (event.parentElement !== page) summary.insertAdjacentElement('afterend', event);
    if (homeGrid && !homeGrid.children.length) homeGrid.remove();
  }

  function ensureQuickAccess(page) {
    if ($('.v137-quick', page)) return;
    const event = $('.v71-event-card', page);
    if (!event) return;

    const section = document.createElement('section');
    section.className = 'v137-quick';
    section.setAttribute('aria-label', 'Accesos rápidos de Academia Yamilet');
    section.innerHTML = `
      <div class="v137-quick-head">
        <strong>Accesos rápidos</strong>
        <small>Tu espacio de aprendizaje</small>
      </div>
      <div class="v137-quick-grid">
        <a href="#courses"><span class="v137-quick-icon">▤</span><span><strong>Mis cursos</strong><small>Continúa aprendiendo</small></span></a>
        <a href="#resources"><span class="v137-quick-icon">▥</span><span><strong>Biblioteca</strong><small>Recursos y ejercicios</small></span></a>
        <a href="#agenda"><span class="v137-quick-icon">◷</span><span><strong>Calendario</strong><small>Sesiones y encuentros</small></span></a>
        <a href="#profile"><span class="v137-quick-icon">●</span><span><strong>Mi perfil</strong><small>Cuenta y preferencias</small></span></a>
      </div>
    `;
    event.insertAdjacentElement('afterend', section);
  }

  function enhanceLower(page) {
    const newsTitle = $('.v71-news .v71-section-heading h2', page);
    if (newsTitle) newsTitle.textContent = 'Novedades y recursos';

    const support = $('.v71-support', page);
    if (support) {
      const title = $('h2', support);
      const copy = $('p', support);
      const action = $('.v71-btn', support);
      if (title) title.textContent = '¿Necesitas ayuda?';
      if (copy) copy.textContent = 'Encuentra respuestas sobre acceso, cursos, recursos, progreso y certificados.';
      if (action) action.textContent = 'Abrir centro de ayuda';
    }
  }

  function enhance() {
    raf = 0;
    if (!mq.matches || route() !== 'home') return;
    const page = $('.v71-home-page');
    if (!page) return;

    page.classList.add('v137-home');
    page.dataset.v137Home = VERSION;
    ensureHomebar(page);
    enhanceHero(page);
    enhanceFeatured(page);
    enhanceStats(page);
    reorderHome(page);
    enhanceEvent(page);
    ensureQuickAccess(page);
    enhanceLower(page);
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(enhance);
  }

  loadPolishV138();
  const target = $('[data-dashboard]') || document.body;
  new MutationObserver(schedule).observe(target, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(schedule, 40));
  window.addEventListener('pageshow', schedule);
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', schedule);
  else if (typeof mq.addListener === 'function') mq.addListener(schedule);

  [60, 220, 650, 1400].forEach(delay => setTimeout(schedule, delay));
  window.ACADEMIA_YAMILET_MOBILE_HOME_V137 = Object.freeze({ version: VERSION, refresh: schedule });
})();
