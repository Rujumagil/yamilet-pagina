(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  let timer = null;

  function loadSecondaryV61() {
    if (!document.querySelector('link[data-mobile-secondary-v61]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './academy-mobile-secondary-v61.css?v=61';
      link.dataset.mobileSecondaryV61 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-mobile-secondary-v61]')) {
      const script = document.createElement('script');
      script.src = './academy-mobile-secondary-v61.js?v=61';
      script.defer = true;
      script.dataset.mobileSecondaryV61 = '1';
      document.body.appendChild(script);
    }
  }

  function staffRole() {
    const text = $('[data-user-role]')?.textContent?.toLowerCase() || '';
    return ['owner', 'admin', 'instructor'].some(role => text.includes(role));
  }

  function openCourses() {
    const route = $('[data-shell-route="courses"]') || $('[data-scroll-courses]');
    route?.click();
    window.setTimeout(() => {
      const firstCourse = $('[data-open-course]');
      firstCourse?.click();
    }, 180);
  }

  function enhanceContinueCard() {
    if (window.innerWidth > 760) return false;
    const dashboard = $('[data-dashboard]');
    const main = $('.dashboard-main');
    const host = $('[data-continue-card]');
    if (!dashboard || dashboard.classList.contains('hidden') || !main || !host) return false;

    const card = host.querySelector('.continue-card');
    if (!card) return false;

    if (staffRole() && (card.classList.contains('complete-state') || card.classList.contains('empty-state'))) {
      if (!host.querySelector('[data-v60-open-course]')) {
        host.innerHTML = `
          <article class="continue-card v60-staff-review">
            <div>
              <span class="v60-staff-kicker">Vista de staff</span>
              <h3>Revisar Método MES®</h3>
              <p>Abre el programa completo para revisar módulos, lecciones, videos, evaluaciones y progreso sin alterar el recorrido de las alumnas.</p>
              <div class="v60-staff-meta"><span>4 módulos</span><span>24 lecciones</span><span>Acceso completo</span></div>
            </div>
            <button class="btn primary" type="button" data-v60-open-course>Revisar curso</button>
          </article>`;
        host.querySelector('[data-v60-open-course]')?.addEventListener('click', openCourses);
      }
    } else if (card.classList.contains('complete-state')) {
      card.classList.add('v60-compact-complete');
    }

    return true;
  }

  function schedule(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(enhanceContinueCard, delay);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="home"],[data-scroll-home],[data-pwa-route="home"]')) schedule(120);
  }, true);

  window.addEventListener('resize', () => schedule(100));
  window.addEventListener('pageshow', () => schedule(160));

  loadSecondaryV61();
  let attempts = 0;
  const interval = window.setInterval(() => {
    attempts += 1;
    if (enhanceContinueCard() || attempts > 60) window.clearInterval(interval);
  }, 250);
})();
