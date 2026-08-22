(() => {
  'use strict';

  const RELEASE = '20260822.50.1';
  const panel = document.querySelector('#mis-cursos');
  const list = panel?.querySelector('[data-course-list]');
  const continuePanel = document.querySelector('#continuar');
  let timer = null;

  const norm = value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

  function loadDedicatedV51() {
    if (!document.querySelector('link[data-yamilet-dedicated-v51]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-dedicated-view-v51.css?v=51';
      link.dataset.yamiletDedicatedV51 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-yamilet-dedicated-v51]')) {
      const script = document.createElement('script');
      script.src = './academy-dedicated-view-v51.js?v=51';
      script.dataset.yamiletDedicatedV51 = '1';
      document.body.appendChild(script);
    }
  }

  function isEnrolledCard(card, totalCards) {
    if (totalCards === 1) return true;
    const status = norm(card.querySelector('.tag')?.textContent);
    if (!status) return true;
    if (status.includes('vista de staff')) return false;
    if (status.includes('en preparación')) return false;
    return status.includes('disponible') || status.includes('completado') || status.includes('activo');
  }

  function ensureCurrentHeading() {
    if (!panel || !list) return;
    let head = panel.querySelector('[data-ay50-current-head]');
    if (!head) {
      head = document.createElement('div');
      head.className = 'ay50-current-head';
      head.dataset.ay50CurrentHead = '1';
      head.innerHTML = '<div><span>Tu aprendizaje</span><h3>Tu curso actual</h3></div><p>Aquí aparecen únicamente los programas en los que tienes acceso activo.</p>';
      list.before(head);
    }
  }

  function filterEnrolledCourses() {
    if (!list) return;
    const cards = [...list.querySelectorAll('.learning-course-card')];
    let visible = 0;
    cards.forEach(card => {
      const keep = isEnrolledCard(card, cards.length);
      card.hidden = !keep;
      card.classList.toggle('ay50-enrolled-course', keep);
      if (keep) visible += 1;
    });

    const count = document.querySelector('[data-course-count]');
    if (count) count.textContent = String(visible);

    let empty = list.querySelector('[data-ay50-empty]');
    if (!visible && cards.length) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'ay50-empty';
        empty.dataset.ay50Empty = '1';
        empty.innerHTML = '<strong>Aún no tienes un curso activo.</strong><span>Cuando tu inscripción sea habilitada aparecerá aquí automáticamente.</span>';
        list.appendChild(empty);
      }
    } else {
      empty?.remove();
    }
  }

  function separateUpcoming() {
    if (!panel) return;
    const upcoming = panel.querySelector('.academy-upcoming-v48');
    if (!upcoming) return;
    upcoming.classList.add('ay50-upcoming-zone');
    const eyebrow = upcoming.querySelector('.academy-upcoming-v48-head > div > span');
    const title = upcoming.querySelector('.academy-upcoming-v48-head h3');
    const copy = upcoming.querySelector('.academy-upcoming-v48-head > p');
    if (eyebrow) eyebrow.textContent = 'Catálogo futuro';
    if (title) title.textContent = 'Próximamente';
    if (copy) copy.textContent = 'Estos programas todavía no forman parte de tu inscripción. Se habilitarán conforme sean publicados.';
  }

  function simplifyPanelHeading() {
    if (!panel) return;
    const panelHead = panel.querySelector(':scope > .panel-head');
    if (!panelHead) return;
    const kicker = panelHead.querySelector('.kicker');
    const title = panelHead.querySelector('h2');
    if (kicker) kicker.textContent = 'Mi aprendizaje';
    if (title) title.textContent = 'Mis cursos';
  }

  function labelCurrentLearning() {
    if (!continuePanel) return;
    const kicker = continuePanel.querySelector('.panel-head .kicker');
    const title = continuePanel.querySelector('.panel-head h2');
    if (kicker) kicker.textContent = 'En curso';
    if (title) title.textContent = 'Continúa donde lo dejaste';
  }

  function hideNonCourseExtras() {
    panel?.querySelectorAll('.home-v47-program').forEach(node => node.classList.add('ay50-hide-program-summary'));
  }

  function hydrate() {
    ensureCurrentHeading();
    filterEnrolledCourses();
    separateUpcoming();
    simplifyPanelHeading();
    labelCurrentLearning();
    hideNonCourseExtras();
    document.body.dataset.academyEnrollmentLayout = 'v50';
  }

  function schedule(delay = 30) {
    clearTimeout(timer);
    timer = setTimeout(hydrate, delay);
  }

  if (list) new MutationObserver(() => schedule(20)).observe(list, { childList: true, subtree: true });
  if (panel) new MutationObserver(() => schedule(25)).observe(panel, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => schedule(40));
  window.addEventListener('pageshow', () => schedule(80));

  loadDedicatedV51();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule(0), { once: true });
  else schedule(0);

  window.ACADEMIA_YAMILET_ENROLLMENT_V50 = { release: RELEASE, refresh: hydrate };
})();
