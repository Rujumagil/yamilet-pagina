(() => {
  'use strict';

  const RELEASE = '20260821.47';
  const courseList = document.querySelector('[data-course-list]');
  const continueHost = document.querySelector('[data-continue-card]');
  const coursePanel = document.querySelector('#mis-cursos');

  function staffPreviewCard() {
    return courseList?.querySelector('.learning-course-card .tag')?.textContent?.trim() === 'Vista de staff';
  }

  function firstCourseButton() {
    return courseList?.querySelector('[data-open-course]');
  }

  function openFirstLesson() {
    const courseBtn = firstCourseButton();
    if (!courseBtn) return;
    courseBtn.click();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const lessonBtn = document.querySelector('[data-course-view]:not(.hidden) [data-open-lesson]');
      if (lessonBtn) {
        clearInterval(timer);
        lessonBtn.click();
      } else if (attempts >= 30) {
        clearInterval(timer);
      }
    }, 100);
  }

  function polishStaffPreview() {
    if (!staffPreviewCard()) return;

    const tag = courseList?.querySelector('.learning-course-card .tag');
    if (tag) tag.textContent = 'Disponible';

    if (continueHost && !continueHost.querySelector('[data-home-v47-start]')) {
      continueHost.innerHTML = `
        <article class="continue-card home-v47-continue">
          <div class="continue-copy">
            <span class="eyebrow">Método MES®</span>
            <h3>Comienza tu recorrido</h3>
            <p><strong>Semana 1 · Día 1</strong> · Bienvenida y autodiagnóstico del ruido mental</p>
            <div class="home-v47-meta"><span>4 semanas</span><span>24 días</span><span>24 lecciones</span></div>
          </div>
          <button class="btn primary" type="button" data-home-v47-start>Comenzar</button>
        </article>`;
      continueHost.querySelector('[data-home-v47-start]')?.addEventListener('click', openFirstLesson);
    }
  }

  function ensureProgramSummary() {
    if (!coursePanel || coursePanel.querySelector('.home-v47-program')) return;
    const program = document.createElement('aside');
    program.className = 'home-v47-program';
    program.innerHTML = `
      <div class="home-v47-program-head">
        <span>Ruta del programa</span>
        <strong>Método MES®</strong>
        <p>Un recorrido de 4 semanas y 24 días de práctica.</p>
      </div>
      <ol>
        <li><b>01</b><div><strong>Preparar el sistema nervioso</strong><span>Semana 1</span></div></li>
        <li><b>02</b><div><strong>La biología de la calma</strong><span>Semana 2</span></div></li>
        <li><b>03</b><div><strong>Tu sistema personal</strong><span>Semana 3</span></div></li>
        <li><b>04</b><div><strong>Autonomía emocional</strong><span>Semana 4</span></div></li>
      </ol>`;
    coursePanel.appendChild(program);
  }

  function hydrate() {
    polishStaffPreview();
    ensureProgramSummary();
    document.body.dataset.academyProfessional = 'v47';
  }

  function boot() {
    hydrate();
    if (courseList) new MutationObserver(() => setTimeout(hydrate, 0)).observe(courseList, { childList: true, subtree: true });
    if (continueHost) new MutationObserver(() => setTimeout(hydrate, 0)).observe(continueHost, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setTimeout(hydrate, 60));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.ACADEMIA_YAMILET_PROFESSIONAL_V47 = { release: RELEASE, hydrate };
})();
