(() => {
  'use strict';

  const RELEASE = '20260823.38';
  const lessonView = document.querySelector('[data-lesson-view]');
  const lessonHost = document.querySelector('[data-lesson-detail]');
  let timer = null;
  let lastContext = null;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

  function inferContextFromVisibleTitle() {
    const visibleTitle = lessonHost?.querySelector('.lesson-title h2')?.textContent?.trim();
    if (!visibleTitle) return null;
    const target = normalize(visibleTitle);
    const rows = [...document.querySelectorAll('[data-course-detail] [data-open-lesson][data-course-id]')];
    const row = rows.find(item => normalize(item.querySelector('.lesson-copy strong')?.textContent) === target);
    if (!row) return null;
    return { lessonId: row.dataset.openLesson, courseId: row.dataset.courseId };
  }

  function currentContext() {
    if (!lessonView || lessonView.classList.contains('hidden')) return null;
    const complete = lessonView.querySelector('[data-toggle-complete]');
    if (complete?.dataset.toggleComplete && complete?.dataset.courseId) {
      lastContext = { lessonId: complete.dataset.toggleComplete, courseId: complete.dataset.courseId };
      return lastContext;
    }
    const inferred = inferContextFromVisibleTitle();
    if (inferred) lastContext = inferred;
    return inferred || lastContext;
  }

  function courseStructure(courseId) {
    const detail = document.querySelector('[data-course-detail]');
    const moduleBlocks = detail ? [...detail.querySelectorAll('.module-block')] : [];
    const flat = [];
    moduleBlocks.forEach((block, moduleIndex) => {
      const rows = [...block.querySelectorAll(`[data-open-lesson][data-course-id="${CSS.escape(courseId)}"]`)];
      rows.forEach((row, lessonIndex) => flat.push({ row, block, moduleIndex, lessonIndex }));
    });
    const percentText = detail?.querySelector('.progress-orb strong')?.textContent || '0%';
    const percent = Math.max(0, Math.min(100, parseInt(percentText, 10) || 0));
    const title = detail?.querySelector('.course-detail-head h2')?.textContent?.trim() || 'Método MES®';
    return { detail, moduleBlocks, flat, percent, title };
  }

  function lessonPosition(courseId, lessonId) {
    const structure = courseStructure(courseId);
    const index = structure.flat.findIndex(item => item.row.dataset.openLesson === lessonId);
    const item = index >= 0 ? structure.flat[index] : null;
    return {
      ...structure,
      currentIndex: index,
      currentNumber: index >= 0 ? index + 1 : 1,
      totalLessons: structure.flat.length,
      moduleNumber: item ? item.moduleIndex + 1 : 1,
      moduleTitle: item?.block.querySelector('.module-head h3')?.textContent?.trim() || 'Semana',
      completed: structure.flat.filter(item => item.row.classList.contains('is-complete')).length
    };
  }

  function outlineMarkup(courseId, lessonId) {
    const structure = courseStructure(courseId);
    const modules = structure.moduleBlocks.map((block, index) => {
      const title = block.querySelector('.module-head h3')?.textContent?.trim() || `Semana ${index + 1}`;
      const label = block.querySelector('.module-label')?.textContent?.trim() || `Semana ${index + 1}`;
      const rows = [...block.querySelectorAll(`[data-open-lesson][data-course-id="${CSS.escape(courseId)}"]`)];
      const completed = rows.filter(row => row.classList.contains('is-complete')).length;
      const total = rows.length;
      const percent = total ? Math.round((completed / total) * 100) : 0;
      const containsCurrent = rows.some(row => row.dataset.openLesson === lessonId);
      const lessons = rows.map(row => {
        const id = row.dataset.openLesson;
        const name = row.querySelector('.lesson-copy strong')?.textContent?.trim() || 'Lección';
        const meta = row.querySelector('.lesson-copy small')?.textContent?.trim() || 'Lección';
        const done = row.classList.contains('is-complete');
        const current = id === lessonId;
        return `<button class="mes-outline-lesson ${done ? 'completed' : ''} ${current ? 'current' : ''}" type="button" data-mes-open-lesson="${esc(id)}" data-course-id="${esc(courseId)}">
          <span class="mes-lesson-icon">${done ? '✓' : current ? '▶' : '•'}</span>
          <span class="mes-lesson-copy"><strong>${esc(name)}</strong><small>${esc(meta)}</small></span>
          <span class="mes-lesson-state">${done ? '✓' : current ? 'Ahora' : ''}</span>
        </button>`;
      }).join('');
      return `<details class="mes-outline-module" ${containsCurrent ? 'open' : ''}>
        <summary>
          <strong>${esc(label)} · ${esc(title)}</strong>
          <div class="mes-module-progress-meta"><span>${completed}/${total} lecciones</span><b>${percent}%</b></div>
          <div class="mes-progress-track"><span style="width:${percent}%"></span></div>
        </summary>
        <div class="mes-module-lessons">${lessons}</div>
      </details>`;
    }).join('');

    const totalLessons = structure.flat.length;
    return `<div class="mes-outline-head"><span>PROGRAMA</span><h3>Contenido del curso</h3><p>${esc(structure.title)} · ${structure.moduleBlocks.length} semanas · ${totalLessons} lecciones</p></div>
      <div class="mes-course-progress"><div class="mes-course-progress-top"><span>Tu avance general</span><strong>${structure.percent}%</strong></div><div class="mes-progress-track"><span style="width:${structure.percent}%"></span></div></div>
      ${modules || '<div class="mes-outline-empty">El temario aparecerá aquí.</div>'}`;
  }

  function wireOutline(shell) {
    shell.querySelectorAll('[data-mes-open-lesson]').forEach(button => {
      button.onclick = () => {
        const id = button.dataset.mesOpenLesson;
        const courseId = button.dataset.courseId;
        lastContext = { lessonId:id, courseId };
        document.querySelector(`[data-course-detail] [data-open-lesson="${CSS.escape(id)}"][data-course-id="${CSS.escape(courseId)}"]`)?.click();
      };
    });
  }

  function ensurePendingVideo(main) {
    const media = main.querySelector('.video-shell:not([data-mes-video-pending]),.lesson-video,[data-cloudflare-stream-player]');
    let pending = main.querySelector('[data-mes-video-pending]');
    if (media) { pending?.remove(); return; }
    if (!pending) {
      pending = document.createElement('div');
      pending.dataset.mesVideoPending = '1';
      pending.className = 'video-shell mes-video-pending';
      pending.innerHTML = '<div><span>VIDEO DE LA LECCIÓN</span><strong>Contenido multimedia pendiente</strong><p>El video aparecerá aquí cuando esté vinculado a esta lección.</p></div>';
      main.querySelector('.lesson-content')?.before(pending);
    }
  }

  function ensureStudyMeta(main, context) {
    const position = lessonPosition(context.courseId, context.lessonId);
    let meta = main.querySelector('.mes-study-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'mes-study-meta';
      main.querySelector('.mes-player-heading')?.insertAdjacentElement('afterend', meta);
    }
    meta.innerHTML = `
      <div><span>Lección</span><strong>${position.currentNumber} de ${position.totalLessons || 1}</strong></div>
      <div><span>Semana</span><strong>${position.moduleNumber} de ${position.moduleBlocks.length || 1}</strong></div>
      <div><span>Progreso</span><strong>${position.percent}%</strong></div>
      <div class="mes-study-current"><span>Etapa actual</span><strong>${esc(position.moduleTitle)}</strong></div>`;
  }

  function fileLabel(anchor) {
    const text = anchor.textContent?.trim();
    if (text) return text;
    try {
      const url = new URL(anchor.href);
      return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'Material');
    } catch { return 'Material'; }
  }

  function findMaterials(main) {
    const links = [...main.querySelectorAll('.lesson-content a[href]')];
    const seen = new Set();
    return links.filter(anchor => {
      const href = anchor.href || '';
      const isFile = anchor.hasAttribute('download') || /\.(pdf|docx?|xlsx?|pptx?|zip|rar|mp3|m4a|wav|jpg|jpeg|png)(\?|#|$)/i.test(href);
      if (!isFile || seen.has(href)) return false;
      seen.add(href);
      return true;
    });
  }

  function ensureResources(main) {
    let section = main.querySelector('.mes-lesson-resources');
    if (!section) {
      section = document.createElement('section');
      section.className = 'mes-lesson-resources';
      const transcript = main.querySelector('.transcript');
      const actions = main.querySelector('.lesson-actions');
      (transcript || actions || main.querySelector('.lesson-nav'))?.insertAdjacentElement('beforebegin', section);
    }
    if (!section) return;
    const materials = findMaterials(main);
    const transcriptAvailable = !!main.querySelector('.transcript');
    const cards = materials.map(anchor => `<a class="mes-resource-card" href="${esc(anchor.href)}" target="_blank" rel="noopener noreferrer"><span>↗</span><div><strong>${esc(fileLabel(anchor))}</strong><small>Material de la lección</small></div></a>`).join('');
    section.innerHTML = `<div class="mes-resources-head"><div><span>RECURSOS</span><h3>Materiales de esta lección</h3></div><p>${materials.length ? 'Consulta o descarga los recursos vinculados a esta clase.' : 'No hay archivos adicionales cargados para esta lección.'}</p></div>
      <div class="mes-resources-grid">${cards}${transcriptAvailable ? '<div class="mes-resource-card mes-resource-info"><span>≡</span><div><strong>Transcripción disponible</strong><small>Consulta el texto completo debajo</small></div></div>' : ''}</div>`;
  }

  function enhanceCompletion(main) {
    const actions = main.querySelector('.lesson-actions');
    if (!actions || actions.dataset.mesEnhanced === 'true') return;
    actions.dataset.mesEnhanced = 'true';
    const copy = document.createElement('div');
    copy.className = 'mes-completion-copy';
    copy.innerHTML = '<span>PROGRESO</span><strong>¿Terminaste esta lección?</strong><small>Marca tu avance para continuar con tu recorrido.</small>';
    actions.insertAdjacentElement('afterbegin', copy);
  }

  function enhanceNavigation(main) {
    const nav = main.querySelector('.lesson-nav');
    if (!nav || nav.dataset.mesEnhanced === 'true') return;
    nav.dataset.mesEnhanced = 'true';
    nav.classList.add('mes-lesson-navigation');
    nav.querySelectorAll('.btn').forEach((button, index) => {
      button.insertAdjacentHTML('afterbegin', `<span class="mes-nav-label">${index === 0 ? 'LECCIÓN ANTERIOR' : 'SIGUIENTE LECCIÓN'}</span>`);
    });
  }

  function enhanceLesson() {
    const context = currentContext();
    if (!context || !lessonHost) {
      document.body.classList.remove('yamilet-player-mode');
      return;
    }

    document.body.classList.add('yamilet-player-mode');
    const back = lessonView.querySelector('[data-back-course]');
    if (back) back.textContent = '← Volver al contenido del curso';

    let shell = lessonHost.querySelector(':scope > .mes-player-shell');
    let main = shell?.querySelector('.mes-player-main');
    let outline = shell?.querySelector('.mes-outline');

    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'mes-player-shell';
      main = document.createElement('div');
      main.className = 'mes-player-main';
      outline = document.createElement('aside');
      outline.className = 'mes-outline';
      shell.append(main, outline);

      const heading = document.createElement('div');
      heading.className = 'mes-player-heading';
      [lessonHost.querySelector('.lesson-breadcrumb'), lessonHost.querySelector('.lesson-title')].filter(Boolean).forEach(node => heading.appendChild(node));
      main.appendChild(heading);

      [
        lessonHost.querySelector('.video-shell'),
        lessonHost.querySelector('.lesson-video'),
        lessonHost.querySelector('[data-cloudflare-stream-player]'),
        lessonHost.querySelector('[data-cloudflare-stream-error]'),
        lessonHost.querySelector('.lesson-content'),
        lessonHost.querySelector('.transcript'),
        lessonHost.querySelector('.lesson-actions'),
        lessonHost.querySelector('.lesson-nav')
      ].filter(Boolean).forEach(node => main.appendChild(node));

      lessonHost.appendChild(shell);
    }

    outline.innerHTML = outlineMarkup(context.courseId, context.lessonId);
    wireOutline(shell);

    [...lessonHost.children].filter(node => node.matches?.('.video-shell,.lesson-video,[data-cloudflare-stream-player],[data-cloudflare-stream-error]')).forEach(node => {
      const content = main.querySelector('.lesson-content');
      if (content) content.before(node); else main.appendChild(node);
    });

    ensureStudyMeta(main, context);
    enhanceCompletion(main);
    enhanceNavigation(main);
    ensureResources(main);
    window.setTimeout(() => ensurePendingVideo(main), 260);
  }

  function schedule(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(enhanceLesson, delay);
  }

  document.addEventListener('click', event => {
    const row = event.target.closest('[data-open-lesson][data-course-id], [data-mes-open-lesson][data-course-id]');
    if (row) {
      lastContext = {
        lessonId: row.dataset.openLesson || row.dataset.mesOpenLesson,
        courseId: row.dataset.courseId
      };
      schedule(100);
      return;
    }
    if (event.target.closest('[data-toggle-complete]')) {
      schedule(180);
      return;
    }
    if (event.target.closest('[data-back-course],[data-back-courses]')) {
      window.setTimeout(() => document.body.classList.remove('yamilet-player-mode'), 0);
    }
  }, true);

  document.addEventListener('yamilet:stream-ready', () => schedule(20));
  window.addEventListener('pageshow', () => schedule(180));

  window.ACADEMIA_YAMILET_PLAYER_V37 = { release: RELEASE, enhance: enhanceLesson };
})();
