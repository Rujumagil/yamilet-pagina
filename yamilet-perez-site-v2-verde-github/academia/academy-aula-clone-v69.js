(() => {
  'use strict';
  const VERSION = '69.0.0';
  let scheduled = false;

  function text(selector, fallback = '') {
    return document.querySelector(selector)?.textContent?.trim() || fallback;
  }

  function initials(name = '') {
    return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'YP';
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
  }

  function enhanceTopbar() {
    const topbar = document.querySelector('.academy-topbar');
    if (!topbar) return;
    const small = topbar.querySelector('.academy-topbar-brand small');
    if (small) small.textContent = 'ACADEMIA YAMILET · MÉTODO MES®';
  }

  function run() {
    scheduled = false;
    document.documentElement.dataset.academyAulaClone = VERSION;
    enhanceBrand();
    enhanceTopbar();
    enhanceUserCard();
    enhanceCourseCards();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', () => setTimeout(schedule, 60), true);
    window.addEventListener('pageshow', schedule);
    schedule();
    window.ACADEMIA_YAMILET_AULA_CLONE_V69 = Object.freeze({ version: VERSION, refresh: schedule });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
