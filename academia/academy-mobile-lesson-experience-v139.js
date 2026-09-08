(() => {
  'use strict';

  const VERSION = '139.1';
  const mq = window.matchMedia('(max-width:760px)');
  let timer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function lessonVisible() {
    const view = $('[data-lesson-view]');
    return !!view && !view.classList.contains('hidden') && document.body.classList.contains('yamilet-player-mode');
  }

  function studyValues(main) {
    const boxes = $$('.mes-study-meta > div', main);
    const values = boxes.map(box => ({
      label: $('span', box)?.textContent?.trim() || '',
      value: $('strong', box)?.textContent?.trim() || ''
    }));
    return {
      lesson: values[0] || { label:'Lección', value:'—' },
      week: values[1] || { label:'Semana', value:'—' },
      progress: values[2] || { label:'Progreso', value:'0%' },
      stage: values[3] || { label:'Etapa actual', value:'Método MES®' }
    };
  }

  function ensureStudyStrip(main) {
    const original = $('.mes-study-meta', main);
    if (!original) return;
    const values = studyValues(main);
    let strip = $('.v139-study-strip', main);
    if (!strip) {
      strip = document.createElement('section');
      strip.className = 'v139-study-strip';
      strip.setAttribute('aria-label', 'Resumen de la lección');
      original.insertAdjacentElement('afterend', strip);
    }
    strip.innerHTML = `
      <div class="v139-study-kpis">
        <div class="v139-study-kpi"><span>${esc(values.lesson.label)}</span><strong>${esc(values.lesson.value)}</strong></div>
        <div class="v139-study-kpi"><span>${esc(values.week.label)}</span><strong>${esc(values.week.value)}</strong></div>
        <div class="v139-study-kpi"><span>${esc(values.progress.label)}</span><strong>${esc(values.progress.value)}</strong></div>
      </div>
      <div class="v139-stage"><span>${esc(values.stage.label)}</span><strong>${esc(values.stage.value)}</strong></div>`;
  }

  function polishBackButton() {
    const back = $('[data-back-course]');
    if (back) back.textContent = '← Método MES®';
  }

  function dedupeMedia(main) {
    const stream = $('[data-cloudflare-stream-player]', main);
    if (!stream) return;
    $$('.video-shell:not([data-cloudflare-stream-player]), .lesson-video, [data-mes-video-pending]', main)
      .forEach(node => node.remove());
  }

  function hideEmptyResources(main) {
    const section = $('.mes-lesson-resources', main);
    if (!section) return;
    const realMaterials = $$('a.mes-resource-card[href]', section);
    section.hidden = realMaterials.length === 0;
    section.dataset.v139Resources = realMaterials.length ? 'available' : 'empty';
  }

  function polishCompletion(main) {
    const actions = $('.lesson-actions', main);
    if (!actions) return;
    const copy = $('.mes-completion-copy', actions);
    const button = $('[data-toggle-complete]', actions);
    const staff = $('.staff-preview', actions);

    if (copy) {
      const title = $('strong', copy);
      const sub = $('small', copy);
      if (button) {
        if (title) title.textContent = 'Guarda tu avance';
        if (sub) sub.textContent = 'Marca la lección como completada cuando termines.';
      } else if (staff) {
        if (title) title.textContent = 'Modo de vista previa';
        if (sub) sub.textContent = 'El avance no se modifica desde esta vista.';
      }
    }

    if (staff) {
      const role = $('[data-user-role]')?.textContent?.toLowerCase() || '';
      const isStaff = /owner|admin|instructor|staff/.test(role);
      staff.textContent = isStaff
        ? 'Vista previa de instructor · el progreso no se registra en modo staff.'
        : 'El registro de progreso estará disponible cuando tu inscripción esté activa.';
    }
  }

  function outlineSummary(outline) {
    const meta = $('.mes-outline-head p', outline)?.textContent?.trim() || 'Contenido del curso';
    return meta.replace(/^Método MES®\s*·\s*/i, '');
  }

  function ensureOutlineToggle(shell) {
    const outline = $('.mes-outline', shell);
    if (!outline) return;
    let toggle = $('.v139-outline-toggle', shell);
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'v139-outline-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span><strong>Ver temario del curso</strong><small></small></span><span class="v139-outline-chevron" aria-hidden="true">⌄</span>';
      outline.insertAdjacentElement('beforebegin', toggle);
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        outline.classList.toggle('v139-open', !open);
        const title = $('strong', toggle);
        if (title) title.textContent = open ? 'Ver temario del curso' : 'Ocultar temario del curso';
      });
    }
    const small = $('small', toggle);
    if (small) small.textContent = outlineSummary(outline);
    if (!outline.classList.contains('v139-open')) toggle.setAttribute('aria-expanded', 'false');
  }

  function polishNavigation(main) {
    const nav = $('.lesson-nav', main);
    if (!nav) return;
    const buttons = $$('.btn', nav);
    nav.dataset.v139Buttons = String(buttons.length);
    buttons.forEach(button => {
      const textNodes = Array.from(button.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
      textNodes.forEach(node => {
        node.textContent = node.textContent.replace(/^\s*←\s*/, '').replace(/\s*→\s*$/, '');
      });
    });
  }

  function enhance() {
    window.clearTimeout(timer);
    timer = 0;
    if (!mq.matches || !lessonVisible()) {
      document.body.classList.remove('v139-lesson-enhanced');
      return;
    }

    const host = $('[data-lesson-detail]');
    const shell = host?.querySelector(':scope > .mes-player-shell');
    const main = shell?.querySelector('.mes-player-main');
    if (!host || !shell || !main) return;

    document.body.classList.add('v139-lesson-enhanced');
    document.body.dataset.academyLessonExperience = VERSION;
    polishBackButton();
    ensureStudyStrip(main);
    dedupeMedia(main);
    hideEmptyResources(main);
    polishCompletion(main);
    polishNavigation(main);
    ensureOutlineToggle(shell);
  }

  function schedule(delay = 70) {
    window.clearTimeout(timer);
    timer = window.setTimeout(enhance, delay);
  }

  const target = $('[data-dashboard]') || document.body;
  new MutationObserver(() => schedule(90)).observe(target, { childList:true, subtree:true });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-lesson],[data-mes-open-lesson],[data-toggle-complete],[data-back-course]')) schedule(130);
  }, true);
  window.addEventListener('hashchange', () => schedule(90));
  window.addEventListener('pageshow', () => schedule(160));
  document.addEventListener('yamilet:stream-ready', () => schedule(40));
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', () => schedule(20));
  else if (typeof mq.addListener === 'function') mq.addListener(() => schedule(20));

  [100, 350, 900, 1800, 2600].forEach(delay => window.setTimeout(() => schedule(20), delay));
  window.ACADEMIA_YAMILET_MOBILE_LESSON_V139 = Object.freeze({ version:VERSION, refresh:enhance });
})();
