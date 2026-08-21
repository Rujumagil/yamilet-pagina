(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const STREAM_ORIGIN = 'https://customer-l4ebvl2tw1zhwagv.cloudflarestream.com';
  const UID_RE = /^[A-Za-z0-9_-]{16,128}$/;
  let sb = null;
  let activeLessonId = null;
  let requestedLessonId = null;
  let loadingLessonId = null;

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

  async function client() {
    if (sb) return sb;
    const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('config_unavailable');
    const cfg = await response.json();
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    return sb;
  }

  function inferLessonIdFromVisibleTitle() {
    const view = document.querySelector('[data-lesson-view]:not(.hidden)');
    if (!view) return null;
    const title = view.querySelector('.lesson-title h2')?.textContent?.trim();
    if (!title) return null;
    const target = normalize(title);
    const row = [...document.querySelectorAll('[data-course-detail] [data-open-lesson][data-course-id]')]
      .find(item => normalize(item.querySelector('.lesson-copy strong')?.textContent) === target);
    return row?.dataset.openLesson || null;
  }

  function currentLessonId() {
    const view = document.querySelector('[data-lesson-view]:not(.hidden)');
    if (!view) return null;
    return view.querySelector('[data-toggle-complete]')?.dataset.toggleComplete || requestedLessonId || inferLessonIdFromVisibleTitle();
  }

  function clearPlayer() {
    document.querySelectorAll('[data-cloudflare-stream-player], [data-cloudflare-stream-error]').forEach(el => el.remove());
  }

  async function renderStreamForCurrentLesson() {
    const lessonId = currentLessonId();
    if (!lessonId || lessonId === loadingLessonId) return;
    if (lessonId === activeLessonId && document.querySelector('[data-cloudflare-stream-player]')) return;
    loadingLessonId = lessonId;
    try {
      const supabase = await client();
      const { data: lesson, error } = await supabase.from('lessons').select('id,stream_video_uid').eq('id', lessonId).maybeSingle();
      clearPlayer();
      if (error || !lesson?.stream_video_uid) { activeLessonId = lessonId; return; }
      const uid = String(lesson.stream_video_uid || '').trim();
      if (!UID_RE.test(uid)) throw new Error('invalid_stream_uid');
      const host = document.querySelector('[data-lesson-detail]');
      const content = host?.querySelector('.lesson-content');
      if (!host || !content) return;
      host.querySelector('.video-shell:not([data-mes-video-pending])')?.remove();
      host.querySelector('.lesson-video')?.remove();
      const shell = document.createElement('div');
      shell.className = 'video-shell cloudflare-stream-shell';
      shell.dataset.cloudflareStreamPlayer = lessonId;
      shell.innerHTML = `<iframe src="${escapeHtml(`${STREAM_ORIGIN}/${encodeURIComponent(uid)}/iframe`)}" title="Video de la lección" loading="eager" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      content.before(shell);
      activeLessonId = lessonId;
      document.dispatchEvent(new CustomEvent('yamilet:stream-ready', { detail: { lessonId } }));
    } catch (error) {
      console.warn('Academia Yamilet Cloudflare Stream v37', error);
      const host = document.querySelector('[data-lesson-detail]');
      if (host && !host.querySelector('[data-cloudflare-stream-error]')) {
        const note = document.createElement('p');
        note.className = 'muted';
        note.dataset.cloudflareStreamError = '1';
        note.textContent = 'El video no pudo cargarse desde Cloudflare Stream.';
        host.querySelector('.lesson-content')?.before(note);
      }
    } finally { loadingLessonId = null; }
  }

  document.addEventListener('click', event => {
    const row = event.target.closest('[data-open-lesson][data-course-id], [data-mes-open-lesson][data-course-id]');
    if (!row) return;
    requestedLessonId = row.dataset.openLesson || row.dataset.mesOpenLesson || null;
    activeLessonId = null;
    setTimeout(renderStreamForCurrentLesson, 100);
  }, true);
  window.addEventListener('pageshow', () => setTimeout(renderStreamForCurrentLesson, 250));
  setInterval(() => {
    const id = currentLessonId();
    if (id && (id !== activeLessonId || !document.querySelector('[data-cloudflare-stream-player]'))) renderStreamForCurrentLesson();
  }, 1000);
  window.ACADEMIA_YAMILET_STREAM_V37 = { render: renderStreamForCurrentLesson };
})();
