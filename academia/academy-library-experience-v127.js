(() => {
  'use strict';

  const VERSION = '127.0.1';
  let scheduled = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };

  function normalizeCard(card) {
    if (!card) return;
    const meta = $('.library-meta', card);
    const titleNode = $('h3', card);
    const title = titleNode?.textContent?.trim().toLowerCase() || '';
    const currentMeta = meta?.textContent?.trim().toLowerCase() || '';

    const workbook = /cuaderno|workbook|semana/.test(title);
    const isTemplate = /template|plantilla/.test(currentMeta);
    const isDocument = /pdf|document|manual|gu[ií]a/.test(currentMeta);
    const isExercise = /ejercicio|actividad/.test(currentMeta);
    const isAudio = /audio|mp3|m4a|wav/.test(currentMeta);
    const isLink = /link|enlace|url/.test(currentMeta);

    if (workbook || isTemplate || isDocument) {
      card.dataset.libraryType = 'document';
      setText(meta, 'DOCUMENTO');
    } else if (isExercise) {
      card.dataset.libraryType = 'exercise';
      setText(meta, 'EJERCICIO');
    } else if (isAudio) {
      card.dataset.libraryType = 'audio';
      setText(meta, 'AUDIO');
    } else if (isLink) {
      card.dataset.libraryType = 'link';
      setText(meta, 'ENLACE');
    }

    const action = $('.shell-action', card);
    if (action) {
      setText(action, 'Abrir recurso');
      if (action.hasAttribute('target')) action.removeAttribute('target');
      const aria = `Abrir ${titleNode?.textContent?.trim() || 'recurso'}`;
      if (action.getAttribute('aria-label') !== aria) action.setAttribute('aria-label', aria);
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
    const courseCount = Math.max(resourceCount ? 1 : 0, courseLabels.size);

    const articles = $$('article', summary);
    if (articles[0]) {
      setText($('strong', articles[0]), String(resourceCount));
      setText($('span', articles[0]), resourceCount === 1 ? 'RECURSO' : 'RECURSOS');
    }
    if (articles[1]) {
      setText($('strong', articles[1]), String(courseCount));
      setText($('span', articles[1]), courseCount === 1 ? 'CURSO' : 'CURSOS');
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
      if (search.placeholder !== 'Buscar recursos') search.placeholder = 'Buscar recursos';
      if (search.getAttribute('autocomplete') !== 'off') search.setAttribute('autocomplete', 'off');
      if (search.getAttribute('enterkeyhint') !== 'search') search.setAttribute('enterkeyhint', 'search');
    }

    $$('[data-library-filter]', page).forEach(button => {
      if (button.dataset.libraryFilter === 'document') setText(button, 'Documentos');
      if (button.dataset.libraryFilter === 'exercise') setText(button, 'Ejercicios');
      if (button.dataset.libraryFilter === 'link') setText(button, 'Enlaces');
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

  const observer = new MutationObserver(records => {
    if (records.some(record => record.addedNodes?.length)) schedule(50);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  schedule(350);
  window.ACADEMIA_YAMILET_LIBRARY_V127 = Object.freeze({ version: VERSION, refresh: () => schedule(0) });
})();
