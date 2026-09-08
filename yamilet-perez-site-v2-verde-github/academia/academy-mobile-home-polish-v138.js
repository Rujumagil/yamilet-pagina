(() => {
  'use strict';

  const VERSION = '138';
  const mq = window.matchMedia('(max-width:760px)');
  let raf = 0;
  const $ = (selector, root = document) => root.querySelector(selector);

  function route() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function polish() {
    raf = 0;
    if (!mq.matches || route() !== 'home') return;
    const page = $('.v71-home-page.v137-home');
    if (!page) return;
    page.dataset.v138Home = VERSION;

    const summaryCards = page.querySelectorAll('.v71-summary-card');
    const nextValue = summaryCards[3]?.querySelector('strong');
    if (nextValue && /pendiente|sin fecha/i.test(nextValue.textContent || '')) {
      nextValue.textContent = 'Sin fecha';
    }

    const support = $('.v71-support', page);
    if (support) {
      const eyebrow = $('.v71-eyebrow', support);
      const title = $('h2', support);
      const copy = $('p', support);
      if (eyebrow) eyebrow.textContent = 'Centro de ayuda';
      if (title) title.textContent = 'Estamos para acompañarte.';
      if (copy) copy.textContent = 'Resuelve dudas sobre acceso, cursos, recursos, progreso y certificados.';
    }
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(polish);
  }

  const target = document.querySelector('[data-dashboard]') || document.body;
  new MutationObserver(schedule).observe(target, { childList:true, subtree:true });
  window.addEventListener('hashchange', () => setTimeout(schedule, 30));
  window.addEventListener('pageshow', schedule);
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', schedule);
  else if (typeof mq.addListener === 'function') mq.addListener(schedule);
  [80, 260, 800].forEach(delay => setTimeout(schedule, delay));

  window.ACADEMIA_YAMILET_MOBILE_HOME_V138 = Object.freeze({ version:VERSION, refresh:schedule });
})();
