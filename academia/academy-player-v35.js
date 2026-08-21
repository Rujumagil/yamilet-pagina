(() => {
  'use strict';

  const RELEASE = '20260821.35';
  const lessonView = document.querySelector('[data-lesson-view]');
  const courseView = document.querySelector('[data-course-view]');
  const lessonHost = document.querySelector('[data-lesson-detail]');
  let timer = null;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function currentContext() {
    if (!lessonView || lessonView.classList.contains('hidden')) return null;
    const complete = lessonView.querySelector('[data-toggle-complete]');
    const anyLesson = lessonView.querySelector('[data-course-id][data-open-lesson]');
    const lessonId = complete?.dataset.toggleComplete || null;
    const courseId = complete?.dataset.courseId || anyLesson?.dataset.courseId || null;
    return lessonId && courseId ? { lessonId, courseId } : null;
  }

  function progressFromCourse(courseId) {
    const detail = document.querySelector('[data-course-detail]');
    const detailCourse = detail?.querySelector('[data-open-lesson][data-course-id="' + CSS.escape(courseId) + '"]');
    if (!detailCourse) return { percent:0, title:'Método MES®' };
    const percentText = detail.querySelector('.progress-orb strong')?.textContent || '0%';
    const percent = Math.max(0, Math.min(100, parseInt(percentText, 10) || 0));
    const title = detail.querySelector('.course-detail-head h2')?.textContent?.trim() || 'Método MES®';
    return { percent, title };
  }

  function outlineMarkup(courseId, lessonId) {
    const detail = document.querySelector('[data-course-detail]');
    const moduleBlocks = detail ? [...detail.querySelectorAll('.module-block')] : [];
    const course = progressFromCourse(courseId);

    const modules = moduleBlocks.map((block, index) => {
      const title = block.querySelector('.module-head h3')?.textContent?.trim() || `Módulo ${index + 1}`;
      const label = block.querySelector('.module-label')?.textContent?.trim() || `Módulo ${index + 1}`;
      const rows = [...block.querySelectorAll('[data-open-lesson][data-course-id="' + CSS.escape(courseId) + '"]')];
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
          <div class="mes-progress-track" aria-label="Avance del módulo ${percent}%"><span style="width:${percent}%"></span></div>
        </summary>
        <div class="mes-module-lessons">${lessons || '<div style="padding:12px;color:#8fa39b;font-size:11px">Sin lecciones.</div>'}</div>
      </details>`;
    }).join('');

    return `<div class="mes-outline-head"><h3>Contenido del curso</h3><p>${esc(course.title)} · 4 semanas · 24 días</p></div>
      <div class="mes-course-progress">
        <div class="mes-course-progress-top"><span>Tu avance general</span><strong>${course.percent}%</strong></div>
        <div class="mes-progress-track" aria-label="Progreso general ${course.percent}%"><span style="width:${course.percent}%"></span></div>
      </div>
      ${modules || '<div style="padding:16px;color:#9fb4ac;font-size:12px">El temario aparecerá aquí.</div>'}`;
  }

  function wireOutline(shell) {
    shell.querySelectorAll('[data-mes-open-lesson]').forEach(button => {
      button.onclick = () => {
        const id = button.dataset.mesOpenLesson;
        const courseId = button.dataset.courseId;
        const source = document.querySelector('[data-course-detail] [data-open-lesson="' + CSS.escape(id) + '"][data-course-id="' + CSS.escape(courseId) + '"]');
        if (source) source.click();
      };
    });
  }

  function ensurePendingVideo(main) {
    const media = main.querySelector('.video-shell:not([data-mes-video-pending]),.lesson-video,[data-cloudflare-stream-player]');
    let pending = main.querySelector('[data-mes-video-pending]');
    if (media) {
      pending?.remove();
      return;
    }
    if (!pending) {
      pending = document.createElement('div');
      pending.dataset.mesVideoPending = '1';
      pending.className = 'video-shell';
      pending.innerHTML = '<div style="height:100%;display:grid;place-items:center;text-align:center;padding:32px;color:#a9bbb4"><div><strong style="display:block;color:#f4f2e9;font-size:20px;margin-bottom:7px">Video pendiente de publicación</strong><span>Esta lección ya forma parte de Método MES® y el video aparecerá aquí cuando sea vinculado.</span></div></div>';
      const content = main.querySelector('.lesson-content');
      content?.before(pending);
    }
  }

  function enhanceLesson() {
    const context = currentContext();
    if (!context || !lessonHost) {
      document.body.classList.remove('yamilet-player-mode');
      return;
    }

    document.body.classList.add('yamilet-player-mode');
    const back = lessonView.querySelector('[data-back-course]');
    if (back) back.textContent = '← Volver al contenido';

    let shell = lessonHost.querySelector(':scope > .mes-player-shell');
    let main;
    let outline;

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
      const breadcrumb = lessonHost.querySelector('.lesson-breadcrumb');
      const title = lessonHost.querySelector('.lesson-title');
      if (breadcrumb) heading.appendChild(breadcrumb);
      if (title) heading.appendChild(title);
      main.appendChild(heading);

      [
        lessonHost.querySelector('.video-shell'),
        lessonHost.querySelector('.lesson-video'),
        lessonHost.querySelector('[data-cloudflare-stream-error]'),
        lessonHost.querySelector('.lesson-content'),
        lessonHost.querySelector('.transcript'),
        lessonHost.querySelector('.lesson-actions'),
        lessonHost.querySelector('.lesson-nav')
      ].filter(Boolean).forEach(node => main.appendChild(node));

      lessonHost.appendChild(shell);
    } else {
      main = shell.querySelector('.mes-player-main');
      outline = shell.querySelector('.mes-outline');
    }

    if (!main || !outline) return;
    outline.innerHTML = outlineMarkup(context.courseId, context.lessonId);
    wireOutline(shell);

    const strayMedia = [...lessonHost.children].filter(node => node.matches?.('.video-shell,.lesson-video,[data-cloudflare-stream-error]'));
    strayMedia.forEach(node => {
      const content = main.querySelector('.lesson-content');
      if (content) content.before(node); else main.appendChild(node);
    });

    setTimeout(() => ensurePendingVideo(main), 220);
  }

  function schedule(delay = 70) {
    clearTimeout(timer);
    timer = setTimeout(enhanceLesson, delay);
  }

  document.addEventListener('click', event => {
    const courseButton = event.target.closest('[data-open-course]');
    if (courseButton) {
      const courseId = courseButton.dataset.openCourse;
      setTimeout(() => {
        const rows = [...document.querySelectorAll('[data-course-detail] [data-open-lesson][data-course-id="' + CSS.escape(courseId) + '"]')];
        const next = rows.find(row => !row.classList.contains('is-complete')) || rows[0];
        next?.click();
      }, 90);
      return;
    }

    if (event.target.closest('[data-open-lesson]')) schedule(80);
    if (event.target.closest('[data-toggle-complete]')) schedule(450);
    if (event.target.closest('[data-back-course],[data-back-courses]')) {
      setTimeout(() => document.body.classList.remove('yamilet-player-mode'), 0);
    }
  }, true);

  if (lessonHost) {
    const observer = new MutationObserver(mutations => {
      const meaningful = mutations.some(mutation => [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
        node.nodeType === 1 && (node.matches?.('.video-shell,.lesson-video,[data-cloudflare-stream-player],[data-cloudflare-stream-error]') || node.querySelector?.('.video-shell,.lesson-video,[data-cloudflare-stream-player],[data-cloudflare-stream-error]'))
      ));
      if (meaningful) schedule(90);
    });
    observer.observe(lessonHost, { childList:true, subtree:true });
  }

  window.addEventListener('pageshow', () => schedule(120));
  window.ACADEMIA_YAMILET_PLAYER_V35 = { release: RELEASE, enhance: enhanceLesson };
})();
