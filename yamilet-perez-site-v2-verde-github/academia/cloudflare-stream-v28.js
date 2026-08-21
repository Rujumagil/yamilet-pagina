(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  let sb = null;
  let activeLessonId = null;
  let loadingLessonId = null;

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  async function client() {
    if (sb) return sb;
    const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('config_unavailable');
    const cfg = await response.json();
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return sb;
  }

  function currentLessonId() {
    const view = document.querySelector('[data-lesson-view]:not(.hidden)');
    if (!view) return null;
    return view.querySelector('[data-toggle-complete]')?.dataset.toggleComplete || null;
  }

  function clearPlayer() {
    document.querySelectorAll('[data-cloudflare-stream-player]').forEach(el => el.remove());
  }

  async function renderStreamForCurrentLesson() {
    const lessonId = currentLessonId();
    if (!lessonId || lessonId === loadingLessonId) return;
    if (lessonId === activeLessonId && document.querySelector('[data-cloudflare-stream-player]')) return;
    loadingLessonId = lessonId;

    try {
      const supabase = await client();
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) return;

      const { data: lesson, error } = await supabase
        .from('lessons')
        .select('id,stream_video_uid,stream_require_signed_urls')
        .eq('id', lessonId)
        .maybeSingle();
      if (error || !lesson?.stream_video_uid) {
        activeLessonId = lessonId;
        return;
      }

      const response = await fetch(`/api/stream-token?lesson_id=${encodeURIComponent(lessonId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.iframe_url) throw new Error(payload.error || 'stream_token_failed');

      const host = document.querySelector('[data-lesson-detail]');
      const content = host?.querySelector('.lesson-content');
      if (!host || !content) return;

      clearPlayer();
      host.querySelector('.video-shell')?.remove();
      host.querySelector('.lesson-video')?.remove();

      const shell = document.createElement('div');
      shell.className = 'video-shell cloudflare-stream-shell';
      shell.dataset.cloudflareStreamPlayer = lessonId;
      shell.innerHTML = `<iframe src="${escapeHtml(payload.iframe_url)}" title="Video de la lección" loading="eager" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      content.before(shell);
      activeLessonId = lessonId;
    } catch (error) {
      console.warn('Academia Yamilet Cloudflare Stream', error);
      const host = document.querySelector('[data-lesson-detail]');
      if (host && !host.querySelector('[data-cloudflare-stream-error]')) {
        const note = document.createElement('p');
        note.className = 'muted';
        note.dataset.cloudflareStreamError = '1';
        note.textContent = 'El video privado no pudo cargarse. Actualiza la sesión e inténtalo nuevamente.';
        host.querySelector('.lesson-content')?.before(note);
      }
    } finally {
      loadingLessonId = null;
    }
  }

  const observer = new MutationObserver(() => {
    const next = currentLessonId();
    if (next && next !== activeLessonId) setTimeout(renderStreamForCurrentLesson, 0);
  });

  function boot() {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    renderStreamForCurrentLesson();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
