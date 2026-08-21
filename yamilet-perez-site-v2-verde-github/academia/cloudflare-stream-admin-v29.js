(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const STREAM_ORIGIN = 'https://customer-l4ebvl2tw1zhwagv.cloudflarestream.com';
  const UID_RE = /^[A-Za-z0-9_-]{16,128}$/;
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

  function extractUid(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (UID_RE.test(raw)) return raw;

    try {
      const url = new URL(raw);
      if (!/(cloudflarestream\.com|videodelivery\.net)$/i.test(url.hostname)) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      const candidate = parts[0] || '';
      return UID_RE.test(candidate) ? candidate : '';
    } catch {
      return '';
    }
  }

  function embedUrl(uid) {
    return `${STREAM_ORIGIN}/${encodeURIComponent(uid)}/iframe`;
  }

  async function enhanceEditor() {
    const form = document.querySelector('[data-lesson-form]');
    if (!form || form.dataset.streamMediaOnlyEnhanced === '1') return;
    form.dataset.streamMediaOnlyEnhanced = '1';

    const lessonId = String(form.elements.lesson_id?.value || '').trim();
    const actions = form.querySelector('.admin-actions.end');
    if (!actions) return;

    const block = document.createElement('div');
    block.className = 'admin-span-2 cloudflare-stream-admin';

    if (!lessonId) {
      block.innerHTML = '<div class="upload-note"><strong>Cloudflare Stream:</strong> crea primero la lección. Después podrás vincular el video por UID.</div>';
      actions.before(block);
      return;
    }

    block.innerHTML = `
      <div class="kicker">Video · Cloudflare Stream</div>
      <label>UID o enlace del video
        <input type="text" data-stream-video-uid maxlength="500" autocomplete="off" placeholder="Pega el UID o la URL de Cloudflare Stream">
        <span class="upload-note">Sube el MP4 desde Media → Stream → Videos. Deja desactivado “Require Signed URLs” y pega aquí el UID, la URL del video o la URL del iframe.</span>
      </label>
      <div class="admin-actions end">
        <a class="mini-btn" href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">Abrir Cloudflare</a>
        <button class="mini-btn" type="button" data-preview-stream-video>Previsualizar</button>
        <button class="mini-btn primary-mini" type="button" data-save-stream-video>Guardar video Stream</button>
      </div>
      <p class="admin-status" data-stream-admin-status aria-live="polite"></p>`;
    actions.before(block);

    const status = block.querySelector('[data-stream-admin-status]');
    const input = block.querySelector('[data-stream-video-uid]');
    const save = block.querySelector('[data-save-stream-video]');
    const preview = block.querySelector('[data-preview-stream-video]');

    try {
      const supabase = await client();
      const { data, error } = await supabase.from('lessons')
        .select('stream_video_uid,stream_require_signed_urls')
        .eq('id', lessonId).maybeSingle();
      if (!error && data?.stream_video_uid) input.value = data.stream_video_uid;
      if (!error && data?.stream_video_uid && data?.stream_require_signed_urls) {
        status.textContent = 'Este vínculo estaba marcado como privado con token. Al guardar se convertirá al modo simple de reproducción por UID.';
      }
    } catch (error) {
      console.warn('Stream admin v29 load', error);
    }

    preview.addEventListener('click', () => {
      const uid = extractUid(input.value);
      if (!uid) {
        status.textContent = 'Pega un UID o enlace válido de Cloudflare Stream.';
        return;
      }
      window.open(embedUrl(uid), '_blank', 'noopener,noreferrer');
    });

    save.addEventListener('click', async () => {
      const uid = extractUid(input.value);
      if (!uid) {
        status.textContent = 'No pude reconocer el UID. Pega el UID o el enlace que Cloudflare muestra para el video.';
        return;
      }

      save.disabled = true;
      status.textContent = 'Guardando video de Cloudflare Stream…';
      status.classList.remove('ok');
      try {
        const supabase = await client();
        const { error } = await supabase.from('lessons').update({
          stream_video_uid: uid,
          stream_require_signed_urls: false,
          updated_at: new Date().toISOString()
        }).eq('id', lessonId);
        if (error) throw error;
        input.value = uid;
        status.textContent = 'Video Stream vinculado. La lección ya puede reproducirlo directamente.';
        status.classList.add('ok');
        window.dispatchEvent(new CustomEvent('yamilet:stream-video-updated', { detail: { lessonId, uid } }));
      } catch (error) {
        console.warn('Stream admin v29 save', error);
        status.textContent = 'No fue posible guardar el video. Revisa tus permisos e inténtalo nuevamente.';
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
