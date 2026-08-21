(() => {
  'use strict';

  const RELEASE = '20260821.38';
  const dashboard = document.querySelector('[data-dashboard]');
  const main = document.querySelector('.dashboard-main');
  const dashHead = document.querySelector('.dash-head');
  const stats = document.querySelector('.stats');
  const courseList = document.querySelector('[data-course-list]');
  const continuePanel = document.querySelector('#continuar');
  const continueHost = document.querySelector('[data-continue-card]');
  const overallProgress = document.querySelector('[data-overall-progress]');
  const courseView = document.querySelector('[data-course-view]');
  const lessonView = document.querySelector('[data-lesson-view]');

  function onHome() {
    if (!dashboard || dashboard.classList.contains('hidden')) return false;
    if (!main) return false;
    if (main.classList.contains('shell-route-mode') || main.classList.contains('shell-courses-mode')) return false;
    if (courseView && !courseView.classList.contains('hidden')) return false;
    if (lessonView && !lessonView.classList.contains('hidden')) return false;
    return true;
  }

  function syncHomeClass() {
    document.body.classList.toggle('yamilet-home-v38', onHome());
  }

  function ensureGreeting() {
    if (!dashHead) return;
    const copy = dashHead.firstElementChild;
    if (!copy) return;

    if (!copy.querySelector('.home-v38-intro')) {
      const intro = document.createElement('p');
      intro.className = 'home-v38-intro';
      intro.textContent = 'Continúa tu proceso, retoma Método MES® y encuentra tus prácticas en un solo lugar, a tu propio ritmo.';
      copy.appendChild(intro);
    }

    if (!copy.querySelector('.home-v38-quote')) {
      const quote = document.createElement('div');
      quote.className = 'home-v38-quote';
      quote.textContent = 'Tu proceso merece un espacio para detenerte, escucharte y avanzar con intención.';
      copy.appendChild(quote);
    }

    if (!dashHead.querySelector('.home-v38-activity')) {
      const card = document.createElement('aside');
      card.className = 'home-v38-activity';
      card.innerHTML = '<small>Tu avance actual</small><strong data-home-v38-activity>0 lecciones</strong><p>Tu progreso se guarda automáticamente para que puedas retomar cuando quieras.</p>';
      dashHead.appendChild(card);
    }
  }

  function ensureStats() {
    if (!stats) return;
    const existing = [...stats.querySelectorAll(':scope > article')];
    if (existing[0] && !existing[0].querySelector('small')) existing[0].insertAdjacentHTML('beforeend','<small>Programas disponibles para continuar</small>');
    if (existing[1] && !existing[1].querySelector('small')) existing[1].insertAdjacentHTML('beforeend','<small>Avance guardado en tu cuenta</small>');

    if (!stats.querySelector('[data-home-v38-weeks]')) {
      const weeks = document.createElement('article');
      weeks.dataset.homeV38Weeks = '1';
      weeks.innerHTML = '<span>Semanas del programa</span><strong>4</strong><small>Ruta completa de Método MES®</small>';
      stats.appendChild(weeks);
    }
    if (!stats.querySelector('[data-home-v38-days]')) {
      const days = document.createElement('article');
      days.dataset.homeV38Days = '1';
      days.innerHTML = '<span>Días de práctica</span><strong>24</strong><small>Recorrido completo del programa</small>';
      stats.appendChild(days);
    }
  }

  function ensureProgressCard() {
    if (!continuePanel || document.querySelector('.home-v38-progress')) return;
    const card = document.createElement('aside');
    card.className = 'home-v38-progress';
    card.innerHTML = `
      <div class="home-v38-kicker">Progreso del programa</div>
      <div class="home-v38-progress-label">Tu avance actual</div>
      <strong data-home-v38-progress>0%</strong>
      <p>Tu progreso está guardado y puedes retomarlo cuando quieras.</p>
      <div class="home-v38-track"><span data-home-v38-progress-bar></span></div>
      <div class="home-v38-program"><small>Programa</small><b>Método MES®</b></div>
      <button type="button" data-home-v38-continue>Continuar</button>`;
    continuePanel.insertAdjacentElement('afterend', card);
    card.querySelector('[data-home-v38-continue]')?.addEventListener('click', () => {
      const target = continueHost?.querySelector('[data-open-lesson],button.btn');
      if (target) target.click();
      else document.querySelector('[data-scroll-courses]')?.click();
    });
  }

  function parseProgress() {
    const text = overallProgress?.textContent?.trim() || '0%';
    return Math.max(0, Math.min(100, parseInt(text, 10) || 0));
  }

  function completedLessons() {
    const card = courseList?.querySelector('.learning-course-card');
    const meta = card?.querySelector('.course-meta span')?.textContent || '';
    const match = meta.match(/(\d+)\s+de\s+(\d+)\s+lecciones/i);
    return match ? Number(match[1]) : 0;
  }

  function courseCover() {
    return courseList?.querySelector('.learning-course-card .course-cover')?.src || '';
  }

  function hydrate() {
    ensureGreeting();
    ensureStats();
    ensureProgressCard();

    const progress = parseProgress();
    const completed = completedLessons();
    const activity = document.querySelector('[data-home-v38-activity]');
    const progressValue = document.querySelector('[data-home-v38-progress]');
    const progressBar = document.querySelector('[data-home-v38-progress-bar]');

    if (activity) activity.textContent = `${completed} ${completed === 1 ? 'lección' : 'lecciones'}`;
    if (progressValue) progressValue.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;

    const cover = courseCover();
    if (continuePanel && cover && continuePanel.dataset.homeV38Cover !== cover) {
      continuePanel.dataset.homeV38Cover = cover;
      continuePanel.style.backgroundImage = `url("${cover.replace(/"/g, '%22')}")`;
    }
  }

  function boot() {
    syncHomeClass();
    hydrate();

    if (main) {
      new MutationObserver(() => {
        syncHomeClass();
        if (onHome()) hydrate();
      }).observe(main, { attributes:true, attributeFilter:['class'] });
    }

    if (dashboard) {
      new MutationObserver(() => {
        syncHomeClass();
        if (onHome()) hydrate();
      }).observe(dashboard, { attributes:true, attributeFilter:['class'] });
    }

    if (courseList) {
      new MutationObserver(() => { if (onHome()) hydrate(); }).observe(courseList, { childList:true, subtree:true });
    }

    if (overallProgress) {
      new MutationObserver(() => { if (onHome()) hydrate(); }).observe(overallProgress, { childList:true, characterData:true, subtree:true });
    }

    window.addEventListener('pageshow', () => { syncHomeClass(); hydrate(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.ACADEMIA_YAMILET_HOME_V38 = { release: RELEASE, hydrate };
})();
