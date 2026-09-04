(() => {
  'use strict';

  const VERSION = '127.0.0';
  let scheduled = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function normalizeCard(card) {
    if (!card) return;
    const meta = $('.library-meta', card);
    const title = $('h3', card)?.textContent?.trim().toLowerCase() || '';
    const currentMeta = meta?.textContent?.trim().toLowerCase() || '';

    const workbook = /cuaderno|workbook|semana/.test(title);
    const isTemplate = /template|plantilla/.test(currentMeta);
    const isDocument = /pdf|document|manual|gu[ií]a/.test(currentMeta);
    const isExercise = /ejercicio|actividad/.test(currentMeta);
    const isAudio = /audio|mp3|m4a|wav/.test(currentMeta);
    const isLink = /link|enlace|url/.test(currentMeta);

    if (workbook || isTemplate || isDocument) {
      card.dataset.libraryType = 'document';
      if (meta) meta.textContent = 'DOCUMENTO';
    } else if (isExercise) {
      card.dataset.libraryType = 'exercise';
      if (meta) meta.textContent = 'EJERCICIO';
    } else if (isAudio) {
      card.dataset.libraryType = 'audio';
      if (meta) meta.textContent = 'AUDIO';
    } else if (isLink) {
      card.dataset.libraryType = 'link';
      if (meta) meta.textContent = 'ENLACE';
    }

    const action = $('.shell-action', card);
    if (action) {
      action.textContent = 'Abrir recurso';
      action.removeAttribute('target');
      action.setAttribute('aria-label', `Abrir ${$('h3', card)?.textContent?.trim() || 'recurso'}`);
    }
  }

  function improveSummary(page) {
    const cards = $$('.library-card', page);
    const heading = $('.shell-page-heading', page);
    const summary = $('.shell-summary', heading || page);
    if (!summary) return;

    const resourceCount = cards.length;
    const courseLabels = new Set();
    cards.forEach(card => {
      const text = card.textContent || '';
      if (/m[eé]todo mes/i.test(text)) courseLabels.add('Método MES');
    });
    const courseCount = Math.max(1, courseLabels.size || (resourceCount ? 1 : 0));

    const articles = $$('article', summary);
    if (articles[0]) {
      const strong = $('strong', articles[0]);
      const span = $('span', articles[0]);
      if (strong) strong.textContent = String(resourceCount);
      if (span) span.textContent = resourceCount === 1 ? 'RECURSO' : 'RECURSOS';
    }
    if (articles[1]) {
      const strong = $('strong', articles[1]);
      const span = $('span', articles[1]);
      if (strong) strong.textContent = String(courseCount);
      if (span) span.textContent = courseCount === 1 ? 'CURSO' : 'CURSOS';
    }
  }

  function improveLibrary() {
    scheduled = false;
    const page = $('[data-shell-page="library"]');
    if (!page || page.classList.contains('hidden')) return;

    page.classList.add('academy-library-page', 'academy-library-v127');
    $$('.library-card', page).forEach(normalizeCard);
    improveSummary(page);

    const search = $('[data-library-search]', page);
    if (search) {
      search.placeholder = 'Buscar recursos';
      search.setAttribute('autocomplete', 'off');
      search.setAttribute('enterkeyhint', 'search');
    }

    const filters = $$('[data-library-filter]', page);
    filters.forEach(button => {
      if (button.dataset.libraryFilter === 'document') button.textContent = 'Documentos';
      if (button.dataset.libraryFilter === 'exercise') button.textContent = 'Ejercicios';
      if (button.dataset.libraryFilter === 'link') button.textContent = 'Enlaces';
    });

    if (window.ACADEMIA_YAMILET_LIBRARY?.enhance && page.dataset.libraryEnhanced !== '1') {
      window.ACADEMIA_YAMILET_LIBRARY.enhance();
    }
  }

  function schedule(delay = 40) {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(improveLibrary, delay);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="library"],a[href="#resources"],a[href="#library"]')) {
      window.setTimeout(() => schedule(0), 160);
      window.setTimeout(() => schedule(0), 520);
    }
  }, true);

  window.addEventListener('hashchange', () => schedule(60));
  window.addEventListener('pageshow', () => schedule(180));

  const observer = new MutationObserver(() => schedule(50));
  observer.observe(document.body, { childList: true, subtree: true });

  schedule(350);
  window.ACADEMIA_YAMILET_LIBRARY_V127 = Object.freeze({ version: VERSION, refresh: () => schedule(0) });
})();
