(() => {
  'use strict';

  const VERSION = '129.0.0';
  let routeRefreshRequested = false;
  let fallbackTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function currentRoute() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function fallbackGuideMarkup() {
    return `<section class="v129-eval-guide" aria-label="Cómo funcionan las evaluaciones">
      <div class="v129-eval-guide-head"><span>TU PROCESO</span><h3>Cómo funcionarán tus evaluaciones</h3></div>
      <div class="v129-eval-guide-grid">
        <article><b>01</b><strong>Recibe la evaluación</strong><p>Solo aparecerán actividades realmente asignadas a tu curso.</p></article>
        <article><b>02</b><strong>Completa tu intento</strong><p>Responde desde la Academia y continúa si necesitas retomarlo.</p></article>
        <article><b>03</b><strong>Consulta tu resultado</strong><p>Los intentos y aprobaciones quedarán asociados a tu progreso.</p></article>
      </div>
    </section>`;
  }

  function enhanceShellFallback() {
    if (currentRoute() !== 'evaluations') return;
    if ($('.v77-evaluations-page')) return;

    const page = $('[data-shell-page="evaluations"]');
    if (!page || page.classList.contains('hidden')) return;

    page.classList.add('v129-evaluations-fallback');

    const kicker = $('.shell-page-heading .kicker', page);
    const copy = $('.shell-page-heading p', page);
    if (kicker) kicker.textContent = 'Seguimiento académico';
    if (copy) copy.textContent = 'Consulta tus evaluaciones, resultados e intentos dentro de Método MES®.';

    const cards = page.querySelectorAll('.shell-card');
    const empty = $('.shell-empty', page);
    if (!empty || cards.length) return;

    if (!empty.classList.contains('v129-eval-empty-shell')) {
      empty.classList.add('v129-eval-empty-shell');
      empty.innerHTML = `<div class="v129-eval-empty-icon" aria-hidden="true">✓</div>
        <div class="v129-eval-empty-copy">
          <span>MÉTODO MES®</span>
          <strong>Aún no hay evaluaciones asignadas</strong>
          <p>Cuando Yamilet publique una evaluación para tu curso aparecerá aquí automáticamente con su estado, resultado e historial de intentos.</p>
          <div class="v129-eval-empty-actions">
            <a href="#courses">Volver a mis cursos</a>
            <a href="#library">Abrir biblioteca</a>
          </div>
        </div>`;
    }

    if (!page.querySelector('.v129-eval-guide')) {
      empty.insertAdjacentHTML('afterend', fallbackGuideMarkup());
    }
  }

  function requestModernView() {
    if (currentRoute() !== 'evaluations') {
      routeRefreshRequested = false;
      return;
    }

    if (!routeRefreshRequested && window.ACADEMIA_YAMILET_EVALUATIONS_V77?.refresh) {
      routeRefreshRequested = true;
      try { window.ACADEMIA_YAMILET_EVALUATIONS_V77.refresh(); } catch (_) {}
    }

    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(enhanceShellFallback, 420);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="evaluations"],[data-pwa-extra-route="evaluations"],a[href="#evaluations"]')) {
      routeRefreshRequested = false;
      window.setTimeout(requestModernView, 120);
      window.setTimeout(requestModernView, 420);
    }
  }, true);

  window.addEventListener('hashchange', () => {
    routeRefreshRequested = false;
    requestModernView();
  });

  window.addEventListener('pageshow', () => {
    routeRefreshRequested = false;
    window.setTimeout(requestModernView, 260);
  });

  window.setTimeout(requestModernView, 650);
  window.ACADEMIA_YAMILET_EVALUATIONS_V129 = Object.freeze({
    version: VERSION,
    refresh: () => {
      routeRefreshRequested = false;
      requestModernView();
    }
  });
})();
