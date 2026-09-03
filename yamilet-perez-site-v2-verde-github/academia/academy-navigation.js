(() => {
  'use strict';

  const GROUPS = [
    { label: 'APRENDIZAJE', routes: ['home', 'courses', 'evaluations', 'calendar', 'certificates'] },
    { label: 'RECURSOS', routes: ['library', 'help'] },
    { label: 'CUENTA', routes: ['profile'] },
    { label: 'DESCUBRIR', routes: ['explore'] },
    { label: 'ADMINISTRACIÓN', routes: ['admin'], admin: true }
  ];

  const LABELS = {
    home: 'Inicio',
    courses: 'Mis cursos',
    evaluations: 'Evaluaciones',
    calendar: 'Calendario',
    certificates: 'Certificados',
    library: 'Mi biblioteca',
    help: 'Ayuda y soporte',
    profile: 'Mi perfil',
    explore: 'Catálogo de cursos',
    admin: 'Panel administrativo'
  };

  let attempts = 0;

  function relabel(button, route) {
    const spans = button.querySelectorAll('span');
    const text = spans[spans.length - 1];
    if (text && LABELS[route]) text.textContent = LABELS[route];
  }

  function organizeNavigation() {
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return retry();
    if (nav.dataset.professionalAcademyNav === 'true') return;

    const buttons = [...nav.querySelectorAll('.shell-nav-item[data-shell-route]')];
    if (!buttons.length || !buttons.some(button => button.dataset.shellRoute === 'home')) return retry();

    // Estos controles antiguos siguen siendo disparadores internos de los módulos.
    // Deben permanecer en el DOM aunque no se muestren en la navegación profesional.
    const legacyAdminControls = [...nav.querySelectorAll('[data-content-admin-nav],[data-students-admin-nav],[data-scroll-bookings]')];

    const byRoute = new Map(buttons.map(button => [button.dataset.shellRoute, button]));
    const fragment = document.createDocumentFragment();

    GROUPS.forEach(group => {
      const groupButtons = group.routes.map(route => byRoute.get(route)).filter(Boolean);
      if (!groupButtons.length) return;

      const section = document.createElement('section');
      section.className = `academy-nav-group${group.admin ? ' academy-nav-group-admin' : ''}`;
      const label = document.createElement('div');
      label.className = 'academy-nav-group-label';
      label.textContent = group.label;
      section.appendChild(label);

      const items = document.createElement('div');
      items.className = 'academy-nav-group-items';
      groupButtons.forEach(button => {
        const route = button.dataset.shellRoute;
        relabel(button, route);
        items.appendChild(button);
      });
      section.appendChild(items);
      fragment.appendChild(section);
    });

    nav.replaceChildren(fragment, ...legacyAdminControls);
    legacyAdminControls.forEach(button => {
      button.classList.add('hidden');
      button.setAttribute('aria-hidden', 'true');
      button.tabIndex = -1;
    });
    nav.dataset.professionalAcademyNav = 'true';
  }

  function retry() {
    attempts += 1;
    if (attempts <= 40) window.setTimeout(organizeNavigation, 250);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="explore"]')) {
      window.setTimeout(() => {
        const breadcrumb = document.querySelector('[data-shell-breadcrumb]');
        if (breadcrumb) breadcrumb.textContent = 'Catálogo de cursos';
      }, 0);
    }

    // El shell oculta #reservas con !important. Al abrir Clase gratuita dejamos
    // el panel visible después de que termine el enrutado principal.
    if (event.target.closest('[data-admin-target="bookings"]')) {
      window.setTimeout(() => {
        const panel = document.querySelector('#reservas');
        if (!panel) return;
        panel.classList.remove('hidden');
        panel.style.setProperty('display', 'block', 'important');
        panel.style.setProperty('grid-column', '1 / -1', 'important');
        panel.style.setProperty('grid-row', 'auto', 'important');
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', organizeNavigation, { once: true });
  else organizeNavigation();

  window.addEventListener('pageshow', () => {
    attempts = 0;
    organizeNavigation();
  });
})();

(() => {
  'use strict';

  const EXCLUDED_VIDEO_LESSON = 'evaluacion y cierre de la semana 1';
  let exclusionScheduled = false;

  const normalizeLessonTitle = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');

  const isExcludedVideoLesson = value => normalizeLessonTitle(value) === EXCLUDED_VIDEO_LESSON;

  function removeExcludedAdminRow() {
    let changed = false;
    document.querySelectorAll('[data-video-row]').forEach(row => {
      const title = row.querySelector('.academy-video-row-main strong')?.textContent || '';
      if (isExcludedVideoLesson(title)) {
        row.remove();
        changed = true;
      }
    });
    if (!changed) return;

    document.querySelectorAll('.academy-video-module').forEach(module => {
      const rows = [...module.querySelectorAll('[data-video-row]')];
      const ready = rows.filter(row => row.querySelector('[data-video-state]')?.classList.contains('ready')).length;
      const counter = module.querySelector('.academy-video-module-head span');
      if (counter) counter.textContent = `${ready}/${rows.length} listos`;
    });

    const manager = document.querySelector('[data-video-manager-v62]');
    if (!manager) return;
    const rows = [...manager.querySelectorAll('[data-video-row]')];
    const ready = rows.filter(row => row.querySelector('[data-video-state]')?.classList.contains('ready')).length;
    const summary = manager.querySelector('.academy-video-manager-summary strong');
    if (summary) summary.textContent = `${ready}/${rows.length}`;
    const intro = manager.querySelector('.academy-admin-section-head p');
    if (intro) intro.textContent = `${ready} de ${rows.length} lecciones requieren y tienen video. Las evaluaciones sin video no se incluyen en este control.`;
  }

  function removeExcludedEditorUploader() {
    const form = document.querySelector('[data-lesson-form]');
    if (!form) return;
    const title = form.elements?.title?.value || form.querySelector('input[name="title"]')?.value || '';
    if (isExcludedVideoLesson(title)) form.querySelector('.academy-video-uploader-v62')?.remove();
  }

  function removeExcludedStudentVideoArea() {
    const view = document.querySelector('[data-lesson-view]:not(.hidden)');
    if (!view) return;
    const title = view.querySelector('.lesson-title h2')?.textContent || '';
    if (!isExcludedVideoLesson(title)) return;
    view.querySelectorAll('.video-shell,.lesson-video,[data-mes-video-pending],[data-cloudflare-stream-player],[data-cloudflare-stream-error]').forEach(el => el.remove());
  }

  function applyVideoExclusion() {
    exclusionScheduled = false;
    removeExcludedAdminRow();
    removeExcludedEditorUploader();
    removeExcludedStudentVideoArea();
  }

  function scheduleVideoExclusion() {
    if (exclusionScheduled) return;
    exclusionScheduled = true;
    requestAnimationFrame(applyVideoExclusion);
  }

  function bootVideoExclusion() {
    const observer = new MutationObserver(scheduleVideoExclusion);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', () => window.setTimeout(scheduleVideoExclusion, 50), true);
    scheduleVideoExclusion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootVideoExclusion, { once: true });
  else bootVideoExclusion();
})();

(() => {
  'use strict';

  // Corrección de carrera de inicialización del centro administrativo.
  // El shell cambia la visibilidad por clase y el router actualiza el hash con
  // history.pushState; ninguno de esos cambios garantiza por sí solo un
  // hashchange. Por eso el panel podía quedar vacío hasta recargar el navegador.
  let pageObserver = null;
  let attachAttempts = 0;
  let pendingTimer = null;

  const adminPage = () => document.querySelector('[data-shell-page="admin"]');
  const isAdminHash = () => /^#admin(?:\/|$)/.test(String(location.hash || ''));
  const isAdminVisible = () => {
    const page = adminPage();
    return !!page && !page.classList.contains('hidden');
  };

  function requestAdminRender(force = false, delay = 0) {
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => {
      if (!isAdminVisible()) return;
      const api = window.ACADEMIA_YAMILET_ADMIN;
      if (!api?.render) return;

      // Si el shell ya mostró administración pero el router todavía no terminó
      // de sincronizar el hash, lo normalizamos antes de renderizar.
      if (!isAdminHash()) {
        const url = `${location.pathname}${location.search}#admin`;
        history.replaceState({ academyRoute: 'admin' }, '', url);
      }

      api.render(force);
    }, delay);
  }

  function bindAdminPageObserver() {
    const page = adminPage();
    if (!page) {
      attachAttempts += 1;
      if (attachAttempts <= 80) window.setTimeout(bindAdminPageObserver, 100);
      return;
    }

    if (pageObserver) pageObserver.disconnect();
    pageObserver = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'attributes' && mutation.attributeName === 'class')) {
        if (isAdminVisible()) {
          requestAdminRender(false, 0);
          requestAdminRender(false, 90);
        }
      }
    });
    pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });

    if (isAdminVisible() || isAdminHash()) {
      requestAdminRender(false, 40);
      requestAdminRender(false, 180);
    }
  }

  function boot() {
    bindAdminPageObserver();

    document.addEventListener('click', event => {
      const enteringAdmin = event.target.closest('[data-shell-route="admin"]');
      const adminControl = event.target.closest('[data-admin-v79-go],[data-admin-v79-go-card]');
      if (!enteringAdmin && !adminControl) return;

      // Reintentos cortos cubren render del shell, actualización del hash y carga
      // de sesión/Supabase sin exigir una recarga manual al usuario.
      [35, 110, 260, 600].forEach((delay, index) => {
        window.setTimeout(() => requestAdminRender(index === 3, 0), delay);
      });
    }, true);

    window.addEventListener('hashchange', () => {
      if (isAdminHash()) requestAdminRender(false, 40);
    });
    window.addEventListener('popstate', () => {
      if (isAdminHash()) requestAdminRender(false, 40);
    });
    window.addEventListener('pageshow', () => {
      if (isAdminVisible() || isAdminHash()) {
        requestAdminRender(false, 80);
        requestAdminRender(false, 260);
      }
    });

    // También cubre el caso de volver a la pestaña después de que el navegador
    // haya suspendido JavaScript o restaurado la página desde bfcache.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && (isAdminVisible() || isAdminHash())) requestAdminRender(false, 50);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
