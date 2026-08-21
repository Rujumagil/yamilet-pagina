(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  let sb = null;

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

  async function enhanceEditor() {
    const form = document.querySelector('[data-lesson-form]');
    if (!form || form.dataset.streamEnhanced === '1') return;
    form.dataset.streamEnhanced = '1';

    const lessonId = String(form.elements.lesson_id?.value || '').trim();
    const actions = form.querySelector('.admin-actions.end');
    if (!actions) return;

    const block = document.createElement('div');
    block.className = 'admin-span-2 cloudflare-stream-admin';

    if (!lessonId) {
      block.innerHTML = '<div class="upload-note"><strong>Cloudflare Stream:</strong> crea primero la lección. Después podrás vincular su video privado.</div>';
      actions.before(block);
      return;
    }

    block.innerHTML = `
      <div class="kicker">Video privado · Cloudflare Stream</div>
      <label>Stream Video UID
        <input type="text" data-stream-video-uid maxlength="80" autocomplete="off" placeholder="UID generado por Cloudflare Stream">
        <span class="upload-note">Sube el video a Cloudflare Stream, activa Require Signed URLs y pega aquí el UID. La Academia generará un token privado por sesión.</span>
      </label>
      <div class="admin-actions end"><button class="mini-btn primary-mini" type="button" data-save-stream-video>Guardar video Stream</button></div>
      <p class="admin-status" data-stream-admin-status aria-live="polite"></p>`;
    actions.before(block);

    const status = block.querySelector('[data-stream-admin-status]');
    const input = block.querySelector('[data-stream-video-uid]');
    const save = block.querySelector('[data-save-stream-video]');

    try {
      const supabase = await client();
      const { data, error } = await supabase.from('lessons')
        .select('stream_video_uid,stream_require_signed_urls')
        .eq('id', lessonId).maybeSingle();
      if (!error && data?.stream_video_uid) input.value = data.stream_video_uid;
    } catch (error) {
      console.warn('Stream admin load', error);
    }

    save.addEventListener('click', async () => {
      const uid = String(input.value || '').trim();
      if (!uid) {
        status.textContent = 'Pega primero el UID del video de Cloudflare Stream.';
        return;
      }
      save.disabled = true;
      status.textContent = 'Guardando vínculo con Cloudflare Stream…';
      try {
        const supabase = await client();
        const { error } = await supabase.from('lessons').update({
          stream_video_uid: uid,
          stream_require_signed_urls: true,
          updated_at: new Date().toISOString()
        }).eq('id', lessonId);
        if (error) throw error;
        status.textContent = 'Video Stream vinculado correctamente.';
        status.classList.add('ok');
      } catch (error) {
        console.warn('Stream admin save', error);
        status.textContent = 'No fue posible vincular el video. Revisa el UID y tus permisos.';
      } finally {
        save.disabled = false;
      }
    });
  }

  const observer = new MutationObserver(() => enhanceEditor());
  function boot() {
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceEditor();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
