(() => {
  'use strict';
  const VERSION = '72.0.0';
  const TOP_LEVEL = new Set(['home','courses','resources','agenda','certificates']);
  let scheduled = false;

  function text(selector, fallback = '') {
    return document.querySelector(selector)?.textContent?.trim() || fallback;
  }

  function initials(name = '') {
    return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'YP';
  }

  function currentRoute() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function ensureRefinementStyles() {
    if (document.querySelector('link[data-academy-v72]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './academy-v72-refinement.css?v=72';
    link.dataset.academyV72 = 'true';
    document.head.appendChild(link);
  }

  function enhanceBrand() {
    const brand = document.querySelector('.side-brand');
    if (!brand) return;
    const strong = brand.querySelector('strong');
    const small = brand.querySelector('small');
    if (strong) strong.textContent = 'Academia Yamilet';
    if (small) small.textContent = 'Método MES®';
  }

  function enhanceUserCard() {
    const sidebar = document.querySelector('.sidebar');
    const signout = sidebar?.querySelector('[data-signout]');
    if (!sidebar || !signout) return;

    let card = sidebar.querySelector('[data-aula-clone-user]');
    if (!card) {
      card = document.createElement('div');
      card.className = 'academy-aula-user-card';
      card.dataset.aulaCloneUser = 'true';
      signout.insertAdjacentElement('beforebegin', card);
    }

    const name = text('[data-user-name]', 'Academia Yamilet');
    const role = text('[data-user-role]', 'Alumna');
    card.innerHTML = `<span class="academy-aula-user-avatar">${initials(name)}</span><span class="academy-aula-user-copy"><strong>${name}</strong><small>${role}</small></span><span class="academy-aula-user-arrow">›</span>`;
  }

  function enhanceCourseCards() {
    document.querySelectorAll('[data-course-list] .learning-course-card').forEach(card => {
      if (card.dataset.aulaCloneClick === 'true') return;
      const button = card.querySelector('[data-open-course]');
      if (!button) return;
      card.dataset.aulaCloneClick = 'true';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('click', event => {
        if (event.target.closest('button,a,input,select,textarea')) return;
        button.click();
      });
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          button.click();
        }
      });
    });

    document.querySelectorAll('.v71-course-card').forEach(card => {
      if (card.dataset.v72CardClick === 'true') return;
      const action = card.querySelector('.v71-course-actions .primary, .v71-course-cover, h3 a');
      if (!action) return;
      card.dataset.v72CardClick = 'true';
      card.tabIndex = 0;
      card.setAttribute('role', 'link');
      card.addEventListener('click', event => {
        if (event.target.closest('a,button,input,select,textarea')) return;
        action.click();
      });
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter') action.click();
      });
    });
  }

  function enhanceTopbar() {
    const topbar = document.querySelector('.academy-topbar');
    if (!topbar) return;
    const small = topbar.querySelector('.academy-topbar-brand small');
    if (small) small.textContent = 'ACADEMIA YAMILET · MÉTODO MES®';
  }

  function cleanRouteLayers() {
    const main = document.querySelector('.dashboard-main');
    if (!main) return;
    const route = currentRoute();
    const host = main.querySelector('[data-aula-pages-v71]');
    const clean = TOP_LEVEL.has(route) && host && !host.hidden;

    Array.from(main.children).forEach(child => {
      const keep = child === host || child.classList.contains('academy-topbar');
      if (clean && !keep) child.dataset.v72Suppressed = 'true';
      else delete child.dataset.v72Suppressed;
    });
    main.dataset.v72Route = clean ? route : '';
  }

  function run() {
    scheduled = false;
    document.documentElement.dataset.academyAulaClone = VERSION;
    ensureRefinementStyles();
    enhanceBrand();
    enhanceTopbar();
    enhanceUserCard();
    enhanceCourseCards();
    cleanRouteLayers();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    ensureRefinementStyles();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class','hidden'] });
    document.addEventListener('click', () => setTimeout(schedule, 60), true);
    window.addEventListener('hashchange', () => setTimeout(schedule, 80));
    window.addEventListener('popstate', () => setTimeout(schedule, 80));
    window.addEventListener('pageshow', schedule);
    schedule();
    window.ACADEMIA_YAMILET_AULA_CLONE_V69 = Object.freeze({ version: VERSION, refresh: schedule });
    window.ACADEMIA_YAMILET_REFINEMENT_V72 = Object.freeze({ version: VERSION, refresh: schedule });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
