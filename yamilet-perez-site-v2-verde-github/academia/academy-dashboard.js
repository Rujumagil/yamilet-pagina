(() => {
  'use strict';

  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const $ = (selector, root = document) => root.querySelector(selector);
  const imageUrl = file => new URL(`../../imagenes-academia-yamilet-final/${file}`, document.baseURI).href;
  const VISUALS = {
    master: imageUrl('01-yamilet-logo-master.png'),
    isotipo: imageUrl('02-yamilet-isotipo.png'),
    header: imageUrl('03-yamilet-logo-header.png'),
    favicon: imageUrl('04-favicon.png'),
    heroDesktop: imageUrl('05-academia-hero-desktop.webp'),
    heroTablet: imageUrl('06-academia-hero-tablet.webp'),
    heroMobile: imageUrl('07-academia-hero-mobile.webp'),
    portrait: imageUrl('08-yamilet-academia.webp'),
    mentor: imageUrl('09-yamilet-academia-horizontal.webp'),
    course: imageUrl('10-metodo-mes-cover.webp'),
    courseVertical: imageUrl('11-metodo-mes-cover-vertical.webp'),
    courseThumb: imageUrl('12-metodo-mes-thumb.webp'),
    continue: imageUrl('13-continuar-aprendiendo.webp'),
    community: imageUrl('14-comunidad-acompanamiento.webp'),
    resources: imageUrl('15-recursos-descargables.webp'),
    certificates: imageUrl('16-certificados.webp'),
    avatar: imageUrl('18-avatar-alumno-generico.webp')
  };

  let initialized = false;
  let visualFrame = 0;

  function loadVisualStyles() {
    if (document.querySelector('link[data-academy-visuals-v91]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './academy-visuals-v91.css?v=91';
    link.dataset.academyVisualsV91 = 'true';
    document.head.appendChild(link);
  }

  function applyGlobalBrand() {
    $$('link[rel~="icon"],link[rel="apple-touch-icon"]').forEach(link => { link.href = VISUALS.favicon; });

    $$('.login-logo').forEach(img => {
      img.src = VISUALS.master;
      img.alt = 'Academia Yamilet';
      img.classList.add('academy-login-master');
    });

    const brand = $('.topbar .brand');
    const brandImg = brand?.querySelector('img');
    if (brand && brandImg) {
      brand.classList.add('academy-brand-upgraded');
      brandImg.src = VISUALS.header;
      brandImg.alt = 'Academia Yamilet';
    }

    $$('.side-brand img').forEach(img => {
      img.src = VISUALS.isotipo;
      img.alt = 'Academia Yamilet';
      img.classList.add('academy-side-isotipo');
    });

    const welcome = $('.welcome-card');
    if (welcome && !welcome.querySelector('.academy-auth-portrait')) {
      welcome.classList.add('academy-auth-visual');
      welcome.insertAdjacentHTML('afterbegin', `<img class="academy-auth-portrait" src="${VISUALS.portrait}" alt="" aria-hidden="true" decoding="async" fetchpriority="high">`);
    }
  }

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

  function ensureHero(main) {
    const head = $('.dash-head', main);
    if (!head || head.querySelector('.academy-hero-media')) return;
    head.insertAdjacentHTML('afterbegin', `
      <picture class="academy-hero-media" aria-hidden="true">
        <source media="(max-width:760px)" srcset="${VISUALS.heroMobile}">
        <source media="(max-width:1180px)" srcset="${VISUALS.heroTablet}">
        <img src="${VISUALS.heroDesktop}" alt="" decoding="async" fetchpriority="high">
      </picture>
    `);
  }

  function addRoadmap(main) {
    if ($('.academy-home-roadmap', main)) return;
    const continuePanel = $('#continuar', main);
    if (!continuePanel) return;
    const card = document.createElement('aside');
    card.className = 'academy-home-roadmap';
    card.innerHTML = `
      <img class="academy-roadmap-mentor" src="${VISUALS.mentor}" alt="" aria-hidden="true" loading="lazy" decoding="async">
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
    card.querySelector('[data-dashboard-open-courses]')?.addEventListener('click', () => {
      $('[data-shell-route="courses"]')?.click();
    });
  }

  function addVisualLinks(main) {
    if ($('.academy-home-visual-links', main)) return;
    const roadmap = $('.academy-home-roadmap', main);
    if (!roadmap) return;
    const section = document.createElement('section');
    section.className = 'academy-home-visual-links';
    section.setAttribute('aria-label', 'Accesos de Academia Yamilet');
    section.innerHTML = `
      <button class="academy-visual-link" type="button" data-visual-route="help">
        <img src="${VISUALS.community}" alt="" loading="lazy" decoding="async">
        <span class="academy-visual-link-copy"><small>Acompañamiento</small><strong>Comunidad y soporte</strong><span>Encuentra orientación durante tu proceso.</span></span>
      </button>
      <button class="academy-visual-link" type="button" data-visual-route="library">
        <img src="${VISUALS.resources}" alt="" loading="lazy" decoding="async">
        <span class="academy-visual-link-copy"><small>Material de trabajo</small><strong>Recursos</strong><span>Accede a guías, ejercicios y materiales.</span></span>
      </button>
      <button class="academy-visual-link" type="button" data-visual-route="certificates">
        <img src="${VISUALS.certificates}" alt="" loading="lazy" decoding="async">
        <span class="academy-visual-link-copy"><small>Tu avance</small><strong>Certificados</strong><span>Consulta tus logros y certificaciones.</span></span>
      </button>
    `;
    roadmap.insertAdjacentElement('afterend', section);
    $$('[data-visual-route]', section).forEach(button => button.addEventListener('click', () => {
      $(`[data-shell-route="${button.dataset.visualRoute}"]`)?.click();
    }));
  }

  function decorateContinue() {
    const card = $('[data-continue-card] .continue-card');
    if (!card || card.querySelector('.academy-continue-visual')) return;
    card.insertAdjacentHTML('afterbegin', `<img class="academy-continue-visual" src="${VISUALS.continue}" alt="" aria-hidden="true" decoding="async">`);
  }

  function decorateCourses() {
    const mobile = window.matchMedia('(max-width:760px)').matches;
    $$('.learning-course-card').forEach(card => {
      const title = $('h3', card)?.textContent || '';
      if (!/m[eé]todo\s+mes/i.test(title)) return;
      let img = $('.course-cover', card);
      if (!img) {
        img = document.createElement('img');
        img.className = 'course-cover';
        card.prepend(img);
      }
      img.classList.add('academy-mes-cover');
      img.src = mobile ? VISUALS.courseVertical : VISUALS.courseThumb;
      img.alt = `Portada de ${title.trim() || 'Método MES'}`;
      img.loading = 'eager';
      img.decoding = 'async';
    });

    $$('.v71-course-card').forEach(card => {
      if (!/m[eé]todo\s+mes/i.test(card.textContent || '')) return;
      const img = $('.v71-course-cover img', card);
      if (img) {
        img.src = mobile ? VISUALS.courseVertical : VISUALS.courseThumb;
        img.classList.add('academy-v91-image');
      }
    });
  }

  function decorateCourseDetail() {
    const head = $('.course-detail-head');
    if (!head || !/m[eé]todo\s+mes/i.test(head.textContent || '')) return;
    head.classList.add('academy-course-art-host');
    if (!head.querySelector('.academy-course-detail-visual')) {
      head.insertAdjacentHTML('afterbegin', `<img class="academy-course-detail-visual" src="${VISUALS.course}" alt="" aria-hidden="true" loading="eager" decoding="async">`);
    }
  }

  function addRouteArt(target, src) {
    if (!target || target.querySelector('.academy-route-art')) return;
    target.classList.add('academy-route-art-host');
    target.insertAdjacentHTML('afterbegin', `<img class="academy-route-art" src="${src}" alt="" aria-hidden="true" loading="lazy" decoding="async">`);
  }

  function decorateModernPages() {
    addRouteArt($('.academy-library-hero'), VISUALS.resources);
    addRouteArt($('.academy-cert-hero'), VISUALS.certificates);
    addRouteArt($('.v78-support-hero'), VISUALS.community);

    $$('.v71-featured-course').forEach(node => {
      const img = node.querySelector(':scope > img');
      if (img) { img.src = VISUALS.course; img.classList.add('academy-v91-image'); }
    });
    $$('.v71-continue-panel').forEach(node => {
      const img = node.querySelector(':scope > img');
      if (img) { img.src = VISUALS.continue; img.classList.add('academy-v91-image'); }
    });
    $$('.v71-featured-resource').forEach(node => {
      const img = node.querySelector(':scope > img');
      if (img) { img.src = VISUALS.resources; img.classList.add('academy-v91-image'); }
    });

    const avatar = $('.academy-avatar');
    if (avatar && !avatar.querySelector('img')) avatar.classList.add('academy-avatar-fallback');

    $$('.v78-profile-avatar').forEach(node => {
      if (node.querySelector('img')) return;
      node.innerHTML = `<img class="academy-generic-profile-avatar" src="${VISUALS.avatar}" alt="Avatar genérico de estudiante">`;
    });
  }

  function decorateDynamic() {
    applyGlobalBrand();
    decorateContinue();
    decorateCourses();
    decorateCourseDetail();
    decorateModernPages();
  }

  function scheduleVisuals() {
    window.cancelAnimationFrame(visualFrame);
    visualFrame = window.requestAnimationFrame(decorateDynamic);
  }

  function syncResponsive(main) {
    const head = $('.dash-head', main);
    if (head) {
      const height = window.innerWidth <= 760 ? '440px' : window.innerWidth <= 1180 ? '340px' : '310px';
      head.style.setProperty('min-height', height, 'important');
    }
    decorateCourses();
  }

  function setSection(main, section) {
    main.dataset.academySection = section || 'home';
  }

  function bindNavigation(main) {
    $$('[data-shell-route]').forEach(button => {
      if (button.dataset.dashboardBound) return;
      button.dataset.dashboardBound = 'true';
      button.addEventListener('click', () => {
        setSection(main, button.dataset.shellRoute || 'home');
        window.setTimeout(scheduleVisuals, 80);
        window.setTimeout(scheduleVisuals, 320);
      });
    });
    $('[data-scroll-home]')?.addEventListener('click', () => setSection(main, 'home'));
    $('[data-scroll-courses]')?.addEventListener('click', () => setSection(main, 'courses'));
  }

  function enhanceHeading(main) {
    const head = $('.dash-head', main);
    if (!head || head.dataset.dashboardEnhanced) return;
    head.dataset.dashboardEnhanced = 'true';
    const paragraph = head.querySelector('p');
    if (paragraph && !paragraph.textContent.trim()) {
      paragraph.textContent = 'Continúa tu proceso, retoma Método MES® y encuentra tus recursos en un solo lugar, a tu propio ritmo.';
    }
  }

  function watchDynamicContent(main) {
    if (main.dataset.visualObserverV91) return;
    main.dataset.visualObserverV91 = 'true';
    new MutationObserver(scheduleVisuals).observe(main, { childList: true, subtree: true });
    window.addEventListener('resize', () => syncResponsive(main), { passive: true });
  }

  function init() {
    if (initialized) return true;
    const dashboard = $('[data-dashboard]');
    const main = $('.dashboard-main');
    const nav = $('[data-shell-route="home"]');
    if (!dashboard || dashboard.classList.contains('hidden') || !main || !nav) return false;
    initialized = true;
    addAcademicStats(main);
    ensureHero(main);
    addRoadmap(main);
    addVisualLinks(main);
    enhanceHeading(main);
    bindNavigation(main);
    setSection(main, 'home');
    syncResponsive(main);
    decorateDynamic();
    watchDynamicContent(main);
    return true;
  }

  loadVisualStyles();
  applyGlobalBrand();
  window.setTimeout(applyGlobalBrand, 500);
  window.setTimeout(applyGlobalBrand, 1400);

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (init() || attempts > 80) window.clearInterval(timer);
  }, 250);
})();
