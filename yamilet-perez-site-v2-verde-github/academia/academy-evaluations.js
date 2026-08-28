(() => {
  'use strict';

  const VERSION = '77.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let timer = null;
  let observer = null;
  let lastSignature = '';

  function currentRoute() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function main() {
    return $('.dashboard-main');
  }

  function host() {
    const root = main();
    if (!root) return null;
    let page = $('[data-aula-pages-v71]', root);
    if (!page) {
      page = document.createElement('section');
      page.className = 'aula-v71-page-host';
      page.dataset.aulaPagesV71 = 'true';
      root.appendChild(page);
    }
    return page;
  }

  function sourcePage() {
    return $('[data-shell-page="evaluations"]');
  }

  function suppressLegacy(enabled) {
    const root = main();
    const page = host();
    if (!root || !page) return;
    if (!enabled) {
      delete root.dataset.v77Route;
      Array.from(root.children).forEach(child => delete child.dataset.v77Suppressed);
      return;
    }
    root.dataset.v77Route = 'evaluations';
    page.hidden = false;
    Array.from(root.children).forEach(child => {
      const keep = child === page || child.classList.contains('academy-topbar');
      if (keep) delete child.dataset.v77Suppressed;
      else child.dataset.v77Suppressed = 'true';
    });
  }

  function statusFor(card) {
    const label = $('.shell-pill', card)?.textContent?.trim().toLowerCase() || '';
    if (/aprob|complet|finaliz/.test(label)) return 'approved';
    if (/intent|progreso|inici/.test(label)) return 'attempted';
    return 'pending';
  }

  function statusLabel(status) {
    if (status === 'approved') return 'Aprobada';
    if (status === 'attempted') return 'En progreso';
    return 'Pendiente';
  }

  function actionLabel(status) {
    if (status === 'approved') return 'Ver resultado';
    if (status === 'attempted') return 'Continuar evaluación';
    return 'Realizar evaluación';
  }

  function sourceCards(page) {
    return $$('.shell-grid .shell-card', page).map((card, index) => {
      const title = $('h3', card)?.textContent?.trim() || $('h2', card)?.textContent?.trim() || `Evaluación ${index + 1}`;
      const eyebrow = $('.eyebrow', card)?.textContent?.trim() || $('.shell-card-kicker', card)?.textContent?.trim() || 'Método MES®';
      const description = $('p', card)?.textContent?.trim() || 'Evaluación asignada dentro de tu programa.';
      const footer = $('.shell-card-footer', card);
      const footerText = footer?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const action = footer?.querySelector('button:not([disabled]),a[href]') || card.querySelector('button:not([disabled]),a[href]');
      const status = statusFor(card);
      return { index, title, eyebrow, description, footerText, status, hasAction: !!action };
    });
  }

  function readSummary(page, cards) {
    const values = $$('.shell-summary article strong', page).map(node => Number(String(node.textContent || '').replace(/[^0-9.-]/g, '')) || 0);
    const assigned = values[0] || cards.length;
    const approved = values[1] || cards.filter(card => card.status === 'approved').length;
    const attempts = values[2] || cards.filter(card => card.status !== 'pending').length;
    return { assigned, approved, attempts };
  }

  function cardHtml(item) {
    return `<article class="v77-eval-card" data-v77-eval-status="${item.status}" data-v77-eval-index="${item.index}">
      <div class="v77-eval-card-top"><span class="v77-eval-number">${String(item.index + 1).padStart(2, '0')}</span><span class="v77-eval-status ${item.status}">${statusLabel(item.status)}</span></div>
      <small>${esc(item.eyebrow)}</small>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.description)}</p>
      ${item.footerText ? `<div class="v77-eval-meta">${esc(item.footerText)}</div>` : ''}
      ${item.hasAction ? `<button type="button" class="v77-eval-action" data-v77-eval-open="${item.index}">${actionLabel(item.status)} →</button>` : ''}
    </article>`;
  }

  function renderEmpty(source, summary) {
    const target = host();
    target.innerHTML = `<div class="v77-evaluations-page">
      <section class="v77-eval-heading"><div><span>Seguimiento académico</span><h1>Evaluaciones</h1><p>Consulta tus evaluaciones, resultados e intentos desde una pantalla independiente.</p></div><div class="v77-eval-summary"><article><strong>${summary.assigned}</strong><span>Asignadas</span></article><article><strong>${summary.approved}</strong><span>Aprobadas</span></article><article><strong>${summary.attempts}</strong><span>Intentos</span></article></div></section>
      <section class="v77-eval-empty"><div class="v77-eval-empty-icon">✓</div><div><span>MÉTODO MES®</span><h2>Aún no hay evaluaciones asignadas</h2><p>Cuando Yamilet publique una evaluación para tu curso aparecerá aquí automáticamente con su estado, resultado e historial de intentos.</p><div class="v77-eval-empty-actions"><a href="#courses">Volver a mis cursos</a><a href="#resources">Abrir biblioteca</a></div></div></section>
      <section class="v77-eval-info-grid"><article><b>01</b><strong>Evaluaciones disponibles</strong><p>Visualiza únicamente las actividades que realmente están asignadas a tu cuenta.</p></article><article><b>02</b><strong>Resultados e intentos</strong><p>Consulta tu avance conforme completes cada evaluación del programa.</p></article><article><b>03</b><strong>Progreso académico</strong><p>Tu historial se mantiene conectado con Método MES® y tus certificados.</p></article></section>
    </div>`;
    bindActions(source);
  }

  function renderEvaluations() {
    if (currentRoute() !== 'evaluations') {
      lastSignature = '';
      suppressLegacy(false);
      return false;
    }

    const root = main();
    const source = sourcePage();
    const target = host();
    if (!root || !target) return false;

    suppressLegacy(true);
    if (!source) {
      target.innerHTML = '<section class="v77-eval-loading"><span></span><p>Preparando tus evaluaciones…</p></section>';
      return false;
    }

    const cards = sourceCards(source);
    const summary = readSummary(source, cards);
    const signature = `${summary.assigned}:${summary.approved}:${summary.attempts}:${cards.map(card => `${card.status}:${card.title}:${card.footerText}`).join('|')}`;
    if (signature === lastSignature && target.querySelector('.v77-evaluations-page')) {
      suppressLegacy(true);
      return true;
    }
    lastSignature = signature;

    if (!cards.length) {
      renderEmpty(source, summary);
      return true;
    }

    const percent = summary.assigned ? Math.min(100, Math.round((summary.approved / summary.assigned) * 100)) : 0;
    const spotlight = cards.find(card => card.status === 'attempted') || cards.find(card => card.status === 'pending') || null;
    const remaining = spotlight ? cards.filter(card => card.index !== spotlight.index) : cards;
    const pending = cards.filter(card => card.status === 'pending').length;
    const inProgress = cards.filter(card => card.status === 'attempted').length;

    target.innerHTML = `<div class="v77-evaluations-page">
      <section class="v77-eval-heading"><div><span>Seguimiento académico</span><h1>Evaluaciones</h1><p>Revisa lo pendiente, continúa tus intentos y consulta los resultados registrados en tu programa.</p></div><div class="v77-eval-summary"><article><strong>${summary.assigned}</strong><span>Asignadas</span></article><article><strong>${summary.approved}</strong><span>Aprobadas</span></article><article><strong>${summary.attempts}</strong><span>Intentos</span></article></div></section>

      <section class="v77-eval-progress"><div><span>PROGRESO DE EVALUACIONES</span><h2>${summary.approved === summary.assigned && summary.assigned ? 'Evaluaciones al día' : 'Tu progreso académico'}</h2><p>${summary.approved} de ${summary.assigned} evaluaciones aprobadas. ${pending ? `${pending} pendientes.` : ''} ${inProgress ? `${inProgress} en progreso.` : ''}</p></div><div class="v77-eval-progress-value"><strong>${percent}%</strong><span>aprobado</span></div><div class="v77-eval-progress-bar"><i style="width:${percent}%"></i></div></section>

      ${spotlight ? `<section class="v77-eval-feature"><div><span>${spotlight.status === 'attempted' ? 'RETOMA DONDE TE QUEDASTE' : 'SIGUIENTE EVALUACIÓN'}</span><h2>${esc(spotlight.title)}</h2><p>${esc(spotlight.description)}</p><div class="v77-eval-feature-meta"><b>${statusLabel(spotlight.status)}</b>${spotlight.footerText ? `<small>${esc(spotlight.footerText)}</small>` : ''}</div>${spotlight.hasAction ? `<button type="button" data-v77-eval-open="${spotlight.index}">${actionLabel(spotlight.status)} →</button>` : ''}</div><aside><span>${String(spotlight.index + 1).padStart(2, '0')}</span><small>MÉTODO MES®</small></aside></section>` : ''}

      <section class="v77-eval-list-section">
        <div class="v77-eval-list-heading"><div><span>HISTORIAL ACADÉMICO</span><h2>${spotlight ? 'Otras evaluaciones' : 'Tus evaluaciones'}</h2></div>${remaining.length >= 4 ? `<div class="v77-eval-filters" role="group" aria-label="Filtrar evaluaciones"><button type="button" class="active" data-v77-filter="all">Todas</button><button type="button" data-v77-filter="pending">Pendientes</button><button type="button" data-v77-filter="attempted">En progreso</button><button type="button" data-v77-filter="approved">Aprobadas</button></div>` : `<small>${remaining.length} ${remaining.length === 1 ? 'evaluación' : 'evaluaciones'}</small>`}</div>
        ${remaining.length ? `<div class="v77-eval-grid">${remaining.map(cardHtml).join('')}</div>` : `<div class="v77-eval-all-done"><strong>No hay más evaluaciones por mostrar.</strong><p>Tu siguiente actividad aparecerá aquí cuando sea publicada.</p></div>`}
      </section>

      <section class="v77-eval-note"><span>i</span><div><strong>Resultados conectados con tu progreso</strong><p>Los intentos y aprobaciones se conservan en tu cuenta y pueden formar parte de los requisitos para completar el programa y habilitar certificados.</p></div><a href="#certificates">Ver certificados →</a></section>
    </div>`;

    bindActions(source);
    return true;
  }

  function bindActions(source) {
    const target = host();
    if (!target) return;

    $$('[data-v77-eval-open]', target).forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.v77EvalOpen);
        const nativeCard = $$('.shell-grid .shell-card', source)[index];
        const nativeAction = nativeCard?.querySelector('.shell-card-footer button:not([disabled]),.shell-card-footer a[href],button:not([disabled]),a[href]');
        if (nativeAction) nativeAction.click();
      });
    });

    $$('[data-v77-filter]', target).forEach(button => {
      button.addEventListener('click', () => {
        $$('[data-v77-filter]', target).forEach(item => item.classList.toggle('active', item === button));
        const filter = button.dataset.v77Filter;
        $$('.v77-eval-card', target).forEach(card => {
          card.hidden = filter !== 'all' && card.dataset.v77EvalStatus !== filter;
        });
      });
    });
  }

  function schedule(delay = 120) {
    clearTimeout(timer);
    timer = window.setTimeout(renderEvaluations, delay);
  }

  function start() {
    observer = new MutationObserver(() => {
      if (currentRoute() === 'evaluations') schedule(80);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="evaluations"],a[href="#evaluations"]')) schedule(180);
    }, true);
    window.addEventListener('hashchange', () => schedule(160));
    window.addEventListener('popstate', () => schedule(160));
    window.addEventListener('pageshow', () => schedule(240));
    schedule(300);
    window.ACADEMIA_YAMILET_EVALUATIONS_V77 = Object.freeze({ version: VERSION, refresh: () => renderEvaluations() });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
