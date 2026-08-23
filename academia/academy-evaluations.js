(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readSummary(page) {
    const values = $$('.shell-summary article strong', page).map(node => Number(node.textContent.trim()) || 0);
    return { assigned: values[0] || 0, approved: values[1] || 0, attempts: values[2] || 0 };
  }

  function ensureProgress(page) {
    if ($('.academy-eval-progress', page)) return;
    const heading = $('.shell-page-heading', page);
    if (!heading) return;
    const { assigned, approved, attempts } = readSummary(page);
    const percent = assigned ? Math.round((approved / assigned) * 100) : 0;
    const block = document.createElement('section');
    block.className = 'academy-eval-progress';
    block.innerHTML = `
      <div class="academy-eval-progress-copy">
        <span class="academy-eval-kicker">SEGUIMIENTO ACADÉMICO</span>
        <h3>${assigned ? 'Tu progreso en evaluaciones' : 'Centro de Evaluaciones preparado'}</h3>
        <p>${assigned ? `${approved} de ${assigned} evaluaciones aprobadas. Tu historial se actualiza automáticamente.` : 'Cuando se publiquen evaluaciones de Método MES®, aparecerán aquí con su estado, resultado e historial de intentos.'}</p>
      </div>
      <div class="academy-eval-progress-ring" style="--eval-progress:${percent * 3.6}deg"><div><strong>${percent}%</strong><span>aprobado</span></div></div>
      <div class="academy-eval-progress-stats">
        <div><span>Asignadas</span><strong>${assigned}</strong></div>
        <div><span>Aprobadas</span><strong>${approved}</strong></div>
        <div><span>Intentos</span><strong>${attempts}</strong></div>
      </div>`;
    heading.insertAdjacentElement('afterend', block);
  }

  function enhanceEmpty(page) {
    const empty = $('.shell-empty', page);
    const grid = $('.shell-grid', page);
    if (!empty || grid || empty.dataset.evalEnhanced === 'true') return;
    empty.dataset.evalEnhanced = 'true';
    empty.classList.add('academy-eval-empty');
    empty.innerHTML = `
      <div class="academy-eval-empty-icon" aria-hidden="true">✓</div>
      <div class="academy-eval-empty-copy">
        <span class="academy-eval-kicker">MÉTODO MES®</span>
        <h3>Aún no hay evaluaciones asignadas</h3>
        <p>Tu recorrido académico está listo. Cuando se publique una evaluación, aparecerá automáticamente en esta sección sin que tengas que hacer ningún registro adicional.</p>
      </div>
      <div class="academy-eval-capabilities">
        <article><span>01</span><strong>Seguimiento por evaluación</strong><small>Estado pendiente, intentada o aprobada.</small></article>
        <article><span>02</span><strong>Resultados e intentos</strong><small>Historial basado en tu actividad real.</small></article>
        <article><span>03</span><strong>Progreso académico</strong><small>Avance consolidado dentro de tu academia.</small></article>
      </div>
      <button type="button" disabled>Sin evaluaciones disponibles</button>`;
  }

  function statusFor(card) {
    const label = $('.shell-pill', card)?.textContent.trim().toLowerCase() || '';
    if (label.includes('aprob')) return 'approved';
    if (label.includes('intent')) return 'attempted';
    return 'pending';
  }

  function decorateCards(page) {
    const cards = $$('.shell-grid .shell-card', page);
    if (!cards.length) return;
    cards.forEach((card, index) => {
      card.classList.add('academy-eval-card');
      card.dataset.evalStatus = statusFor(card);
      if (!$('.academy-eval-number', card)) {
        const badge = document.createElement('span');
        badge.className = 'academy-eval-number';
        badge.textContent = String(index + 1).padStart(2, '0');
        card.insertAdjacentElement('afterbegin', badge);
      }
      const footer = $('.shell-card-footer', card);
      if (footer && !$('.academy-eval-detail-note', card)) {
        const note = document.createElement('div');
        note.className = 'academy-eval-detail-note';
        note.textContent = card.dataset.evalStatus === 'approved' ? 'Resultado registrado' : card.dataset.evalStatus === 'attempted' ? 'Intento registrado' : 'Pendiente de realizar';
        footer.insertAdjacentElement('beforebegin', note);
      }
    });
    ensureFilters(page, cards);
  }

  function ensureFilters(page, cards) {
    if ($('.academy-eval-toolbar', page)) return;
    const grid = $('.shell-grid', page);
    if (!grid) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'academy-eval-toolbar';
    toolbar.innerHTML = `
      <div><span class="academy-eval-kicker">EVALUACIONES DEL PROGRAMA</span><h3>Tu historial académico</h3></div>
      <div class="academy-eval-filters" role="group" aria-label="Filtrar evaluaciones">
        <button type="button" class="active" data-eval-filter="all">Todas</button>
        <button type="button" data-eval-filter="pending">Pendientes</button>
        <button type="button" data-eval-filter="attempted">Intentadas</button>
        <button type="button" data-eval-filter="approved">Aprobadas</button>
      </div>`;
    grid.insertAdjacentElement('beforebegin', toolbar);
    $$('.academy-eval-filters button', toolbar).forEach(button => {
      button.addEventListener('click', () => {
        $$('.academy-eval-filters button', toolbar).forEach(item => item.classList.toggle('active', item === button));
        const filter = button.dataset.evalFilter;
        cards.forEach(card => { card.hidden = filter !== 'all' && card.dataset.evalStatus !== filter; });
      });
    });
  }

  function enhanceEvaluations() {
    const page = $('[data-shell-page="evaluations"]');
    if (!page || page.classList.contains('hidden')) return false;
    const heading = $('.shell-page-heading', page);
    if (!heading) return false;
    page.classList.add('academy-evaluations-page');
    ensureProgress(page);
    enhanceEmpty(page);
    decorateCards(page);
    return true;
  }

  function scheduleEnhance() {
    [80, 250, 600, 1200, 2000].forEach(delay => window.setTimeout(enhanceEvaluations, delay));
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="evaluations"]')) scheduleEnhance();
  });

  window.addEventListener('pageshow', scheduleEnhance);
})();