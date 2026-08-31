(() => {
  'use strict';

  const VERSION = '104.0.0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function fixLibraryLinks(root = document) {
    $$('a[href="#resources"]', root).forEach(link => {
      const text = String(link.textContent || '').toLowerCase();
      if (text.includes('biblioteca') || text.includes('recurso')) link.setAttribute('href', '#library');
    });
  }

  function isAnswered(question) {
    if (!question) return false;
    const textarea = $('textarea', question);
    if (textarea) return !!textarea.value.trim();
    return !!$('input:checked', question);
  }

  function ensureProgress(shell, questions) {
    let progress = $('.assessment-v104-progress', shell);
    if (progress) return progress;
    const head = $('.assessment-player-head', shell);
    if (!head) return null;
    progress = document.createElement('div');
    progress.className = 'assessment-v104-progress';
    progress.innerHTML = '<div class="assessment-v104-progress-head"><span data-v104-question-label>Pregunta 1</span><strong data-v104-progress-label>0% completado</strong></div><div class="assessment-v104-progress-track"><i data-v104-progress-bar></i></div><div class="assessment-v104-progress-sub"><span data-v104-answered>0 respondidas</span><span>Academia Yamilet</span></div>';
    head.insertAdjacentElement('afterend', progress);
    return progress;
  }

  function ensureFooterControls(shell) {
    const footer = $('.assessment-player-footer', shell);
    if (!footer) return null;
    let actions = $('.assessment-v104-actions', footer);
    if (actions) return actions;
    const submit = $('[data-submit-assessment]', footer);
    actions = document.createElement('div');
    actions.className = 'assessment-v104-actions';
    actions.innerHTML = '<button type="button" class="assessment-v104-prev" data-v104-prev>Anterior</button><button type="button" class="assessment-v104-next" data-v104-next>Siguiente</button>';
    if (submit) actions.appendChild(submit);
    footer.appendChild(actions);
    return actions;
  }

  function enhance(shell) {
    if (!shell || !shell.classList.contains('assessment-player-active')) return;
    const questions = $$('.assessment-question', shell);
    if (!questions.length) return;

    ensureProgress(shell, questions);
    ensureFooterControls(shell);

    const prev = $('[data-v104-prev]', shell);
    const next = $('[data-v104-next]', shell);
    const submit = $('[data-submit-assessment]', shell);
    if (!prev || !next || !submit) return;

    if (!shell.dataset.v104Bound) {
      shell.dataset.v104Bound = 'true';
      shell.dataset.v104Index = '0';
      prev.addEventListener('click', () => show(shell, Number(shell.dataset.v104Index || 0) - 1));
      next.addEventListener('click', () => show(shell, Number(shell.dataset.v104Index || 0) + 1));
      shell.addEventListener('change', () => refresh(shell));
      shell.addEventListener('input', () => refresh(shell));
    }
    show(shell, Number(shell.dataset.v104Index || 0), false);
  }

  function refresh(shell) {
    const questions = $$('.assessment-question', shell);
    const current = Math.max(0, Math.min(questions.length - 1, Number(shell.dataset.v104Index || 0)));
    const answered = questions.filter(isAnswered).length;
    const visibleStep = current + 1;
    const progress = questions.length ? Math.round((visibleStep / questions.length) * 100) : 0;
    const questionLabel = $('[data-v104-question-label]', shell);
    const progressLabel = $('[data-v104-progress-label]', shell);
    const progressBar = $('[data-v104-progress-bar]', shell);
    const answeredLabel = $('[data-v104-answered]', shell);
    if (questionLabel) questionLabel.textContent = `Pregunta ${visibleStep} de ${questions.length}`;
    if (progressLabel) progressLabel.textContent = `${progress}% recorrido`;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (answeredLabel) answeredLabel.textContent = `${answered} ${answered === 1 ? 'respondida' : 'respondidas'}`;
    questions.forEach(question => question.dataset.v104Answered = isAnswered(question) ? 'true' : 'false');
  }

  function show(shell, index, shouldScroll = true) {
    const questions = $$('.assessment-question', shell);
    if (!questions.length) return;
    const current = Math.max(0, Math.min(questions.length - 1, Number(index) || 0));
    shell.dataset.v104Index = String(current);
    questions.forEach((question, idx) => {
      question.hidden = idx !== current;
      question.setAttribute('aria-hidden', idx === current ? 'false' : 'true');
    });
    const prev = $('[data-v104-prev]', shell);
    const next = $('[data-v104-next]', shell);
    const submit = $('[data-submit-assessment]', shell);
    if (prev) prev.disabled = current === 0;
    if (next) next.hidden = current === questions.length - 1;
    if (submit) submit.hidden = current !== questions.length - 1;
    refresh(shell);
    if (shouldScroll) {
      const host = $('[data-assessment-player]');
      if (host) host.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function scan(root = document) {
    fixLibraryLinks(root);
    const shell = $('.assessment-player-shell.assessment-player-active', root) || (root.matches?.('.assessment-player-shell.assessment-player-active') ? root : null);
    if (shell) enhance(shell);
    $$('.assessment-player-shell.assessment-player-active', root).forEach(enhance);
  }

  function start() {
    scan(document);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        });
      }
      fixLibraryLinks(document);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="evaluations"],a[href="#evaluations"],[data-open-assessment],[data-v77-eval-open]')) {
        setTimeout(() => scan(document), 120);
        setTimeout(() => scan(document), 420);
      }
    }, true);
    window.addEventListener('pageshow', () => setTimeout(() => scan(document), 220));
    window.ACADEMIA_YAMILET_ASSESSMENT_V104 = Object.freeze({ version: VERSION, refresh: () => scan(document) });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
