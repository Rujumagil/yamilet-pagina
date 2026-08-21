(() => {
  'use strict';

  const RELEASE = '20260821.37';
  const lessonView = document.querySelector('[data-lesson-view]');
  const lessonHost = document.querySelector('[data-lesson-detail]');
  let timer = null;
  let lastContext = null;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

  function inferContextFromVisibleTitle() {
    const visibleTitle = lessonHost?.querySelector('.lesson-title h2')?.textContent?.trim();
    if (!visibleTitle) return null;
    const target = normalize(visibleTitle);
    const row = [...document.querySelectorAll('[data-course-detail] [data-open-lesson][data-course-id]')]
      .find(item => normalize(item.querySelector('.lesson-copy strong')?.textContent) === target);
    return row ? { lessonId: row.dataset.openLesson, courseId: row.dataset.courseId } : null;
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

  function progressFromCourse() {
    const detail = document.querySelector('[data-course-detail]');
    const percent = Math.max(0, Math.min(100, parseInt(detail?.querySelector('.progress-orb strong')?.textContent || '0', 10) || 0));
    const title = detail?.querySelector('.course-detail-head h2')?.textContent?.trim() || 'Método MES®';
    return { percent, title };
  }

  function outlineMarkup(courseId, lessonId) {
    const detail = document.querySelector('[data-course-detail]');
    const course = progressFromCourse();
    const modules = [...(detail?.querySelectorAll('.module-block') || [])].map((block, index) => {
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
        return `<button class="mes-outline-lesson ${done ? 'completed' : ''} ${current ? 'current' : ''}" type="button" data-mes-open-lesson="${esc(id)}" data-course-id="${esc(courseId)}"><span class="mes-lesson-icon">${done ? '✓' : current ? '▶' : '•'}</span><span class="mes-lesson-copy"><strong>${esc(name)}</strong><small>${esc(meta)}</small></span><span class="mes-lesson-state">${done ? '✓' : current ? 'Ahora' : ''}</span></button>`;
      }).join('');
      return `<details class="mes-outline-module" ${containsCurrent ? 'open' : ''}><summary><strong>${esc(label)} · ${esc(title)}</strong><div class="mes-module-progress-meta"><span>${completed}/${total} lecciones</span><b>${percent}%</b></div><div class="mes-progress-track"><span style="width:${percent}%"></span></div></summary><div class="mes-module-lessons">${lessons}</div></details>`;
    }).join('');
    return `<div class="mes-outline-head"><h3>Contenido del curso</h3><p>${esc(course.title)} · 4 semanas · 24 días</p></div><div class="mes-course-progress"><div class="mes-course-progress-top"><span>Tu avance general</span><strong>${course.percent}%</strong></div><div class="mes-progress-track"><span style="width:${course.percent}%"></span></div></div>${modules || '<div style="padding:16px;color:#9fb4ac;font-size:12px">El temario aparecerá aquí.</div>'}`;
  }

  function wireOutline(shell) {
    shell.querySelectorAll('[data-mes-open-lesson]').forEach(button => {
      button.onclick = () => {
        const id = button.dataset.mesOpenLesson;
        const courseId = button.dataset.courseId;
        lastContext = { lessonId:id, courseId };
        document.querySelector('[data-course-detail] [data-open-lesson="' + CSS.escape(id) + '"][data-course-id="' + CSS.escape(courseId) + '"]')?.click();
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
      pending.className = 'video-shell';
      pending.innerHTML = '<div style="height:100%;display:grid;place-items:center;text-align:center;padding:32px;color:#a9bbb4"><div><strong style="display:block;color:#f4f2e9;font-size:20px;margin-bottom:7px">Video pendiente de publicación</strong><span>Esta lección ya forma parte de Método MES® y el video aparecerá aquí cuando sea vinculado.</span></div></div>';
      main.querySelector('.lesson-content')?.before(pending);
    }
  }

  function enhanceLesson() {
    const context = currentContext();
    if (!context || !lessonHost) { document.body.classList.remove('yamilet-player-mode'); return; }
    document.body.classList.add('yamilet-player-mode');
    const back = lessonView.querySelector('[data-back-course]');
    if (back) back.textContent = '← Volver al contenido';
    let shell = lessonHost.querySelector(':scope > .mes-player-shell');
    let main = shell?.querySelector('.mes-player-main');
    let outline = shell?.querySelector('.mes-outline');
    if (!shell) {
      shell = document.createElement('div'); shell.className = 'mes-player-shell';
      main = document.createElement('div'); main.className = 'mes-player-main';
      outline = document.createElement('aside'); outline.className = 'mes-outline'; shell.append(main, outline);
      const heading = document.createElement('div'); heading.className = 'mes-player-heading';
      [lessonHost.querySelector('.lesson-breadcrumb'), lessonHost.querySelector('.lesson-title')].filter(Boolean).forEach(node => heading.appendChild(node));
      main.appendChild(heading);
      [lessonHost.querySelector('.video-shell'),lessonHost.querySelector('.lesson-video'),lessonHost.querySelector('[data-cloudflare-stream-player]'),lessonHost.querySelector('[data-cloudflare-stream-error]'),lessonHost.querySelector('.lesson-content'),lessonHost.querySelector('.transcript'),lessonHost.querySelector('.lesson-actions'),lessonHost.querySelector('.lesson-nav')].filter(Boolean).forEach(node => main.appendChild(node));
      lessonHost.appendChild(shell);
    }
    outline.innerHTML = outlineMarkup(context.courseId, context.lessonId);
    wireOutline(shell);
    [...lessonHost.children].filter(node => node.matches?.('.video-shell,.lesson-video,[data-cloudflare-stream-player],[data-cloudflare-stream-error]')).forEach(node => { const content = main.querySelector('.lesson-content'); if (content) content.before(node); else main.appendChild(node); });
    setTimeout(() => ensurePendingVideo(main), 300);
  }

  function schedule(delay = 80) { clearTimeout(timer); timer = setTimeout(enhanceLesson, delay); }
  document.addEventListener('click', event => {
    const row = event.target.closest('[data-open-lesson][data-course-id]');
    if (row) lastContext = { lessonId:row.dataset.openLesson, courseId:row.dataset.courseId };
    if (event.target.closest('[data-open-course]')) setTimeout(schedule, 180); else if (row || event.target.closest('[data-toggle-complete]')) schedule(120);
    if (event.target.closest('[data-back-course],[data-back-courses]')) setTimeout(() => document.body.classList.remove('yamilet-player-mode'), 0);
  }, true);
  document.addEventListener('yamilet:stream-ready', () => schedule(20));
  window.addEventListener('pageshow', () => schedule(180));
  setInterval(() => { if (lessonView && !lessonView.classList.contains('hidden') && !lessonHost?.querySelector('.mes-player-shell')) schedule(0); }, 900);
  window.ACADEMIA_YAMILET_PLAYER_V37 = { release: RELEASE, enhance: enhanceLesson };
})();
