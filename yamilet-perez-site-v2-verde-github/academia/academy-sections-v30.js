(() => {
  'use strict';

  const RELEASE = '20260821.30';
  const ROUTE_LABELS = {
    evaluations: 'Evaluaciones',
    library: 'Mi biblioteca',
    calendar: 'Calendario',
    certificates: 'Certificados',
    help: 'Ayuda y soporte',
    profile: 'Mi perfil',
    explore: 'Explorar cursos',
    admin: 'Administrar'
  };

  let activeRoute = null;
  let lastRouteAt = 0;

  const pageFor = name => document.querySelector(`[data-shell-page="${CSS.escape(name)}"]`);

  function renderRouteError(name, error) {
    const page = pageFor(name);
    if (!page || page.classList.contains('hidden')) return;
    if (page.dataset.sectionErrorV30 === '1') return;

    page.dataset.sectionErrorV30 = '1';
    const label = ROUTE_LABELS[name] || 'esta sección';
    page.innerHTML = `
      <div class="shell-empty academy-section-error-v30">
        <div>
          <strong>No fue posible abrir ${label}</strong>
          <span>La sesión sigue activa. Puedes volver a intentarlo sin cerrar la Academia.</span>
          <button class="shell-action primary" type="button" data-section-retry-v30="${name}">Reintentar</button>
        </div>
      </div>`;

    page.querySelector('[data-section-retry-v30]')?.addEventListener('click', async () => {
      delete page.dataset.sectionErrorV30;
      page.innerHTML = '<div class="shell-empty"><div><strong>Volviendo a cargar…</strong><span>Un momento.</span></div></div>';
      try {
        await window.ACADEMIA_YAMILET_SHELL?.route?.(name);
      } catch (retryError) {
        renderRouteError(name, retryError);
      }
    });

    if (error) console.error(`Academia Yamilet v30 · ${name}`, error);
  }

  function verifyRoute(name) {
    if (!ROUTE_LABELS[name]) return;
    const page = pageFor(name);
    if (!page || page.classList.contains('hidden')) return;

    const text = (page.textContent || '').replace(/\s+/g, ' ').trim();
    const stillPreparing = /^Preparando\b/i.test(text) || text === '';
    if (stillPreparing) renderRouteError(name, new Error('section_render_timeout'));
  }

  document.addEventListener('click', event => {
    const routeButton = event.target.closest('[data-shell-route]');
    if (!routeButton) return;
    activeRoute = routeButton.dataset.shellRoute || null;
    lastRouteAt = Date.now();
    setTimeout(() => verifyRoute(activeRoute), 1800);
  }, true);

  window.addEventListener('unhandledrejection', event => {
    if (!activeRoute || Date.now() - lastRouteAt > 5000) return;
    const page = pageFor(activeRoute);
    if (!page || page.classList.contains('hidden')) return;
    renderRouteError(activeRoute, event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'route_error')));
  });

  window.addEventListener('error', event => {
    if (!activeRoute || Date.now() - lastRouteAt > 5000) return;
    const page = pageFor(activeRoute);
    if (!page || page.classList.contains('hidden')) return;
    renderRouteError(activeRoute, event.error instanceof Error ? event.error : new Error(event.message || 'route_error'));
  });

  window.ACADEMIA_YAMILET_SECTIONS_V30 = { release: RELEASE, verifyRoute };
})();
