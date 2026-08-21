(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const MAX_BASIC_UPLOAD_BYTES = 200 * 1024 * 1024;
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

  async function sessionToken() {
    const supabase = await client();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  function uploadFile(uploadUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.responseType = 'text';
      xhr.upload.addEventListener('progress', event => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
        else reject(new Error(`upload_http_${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('upload_network_error')));
      xhr.addEventListener('abort', () => reject(new Error('upload_aborted')));
      const form = new FormData();
      form.append('file', file, file.name);
      xhr.send(form);
    });
  }

  async function saveVideoUid(lessonId, uid) {
    const supabase = await client();
    const { error } = await supabase.from('lessons').update({
      stream_video_uid: uid,
      stream_require_signed_urls: true,
      updated_at: new Date().toISOString()
    }).eq('id', lessonId);
    if (error) throw error;
  }

  async function provisionUpload(lessonId, file) {
    const token = await sessionToken();
    if (!token) throw new Error('session_required');

    const response = await fetch('/api/stream-upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      body: JSON.stringify({
        lesson_id: lessonId,
        filename: file.name,
        max_duration_seconds: 7200
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `provision_http_${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (!payload.upload_url || !payload.video_uid) throw new Error('invalid_upload_response');
    return payload;
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
      block.innerHTML = '<div class="upload-note"><strong>Cloudflare Stream:</strong> crea primero la lección. Después podrás subir y vincular su video privado.</div>';
      actions.before(block);
      return;
    }

    block.innerHTML = `
      <div class="kicker">Video privado · Cloudflare Stream</div>
      <div class="admin-form">
        <label>Subir video a Stream
          <input type="file" data-stream-upload-file accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*">
          <span class="upload-note">Carga directa segura desde Academia Yamilet. Para esta primera versión usa archivos de hasta 200 MB. Los videos quedan con URLs firmadas y metadatos de Yamilet.</span>
        </label>
        <div class="admin-actions end">
          <button class="mini-btn primary-mini" type="button" data-upload-stream-video>Subir a Cloudflare Stream</button>
        </div>
        <div class="stream-upload-progress hidden" data-stream-progress-wrap>
          <progress data-stream-progress max="100" value="0"></progress>
          <span data-stream-progress-label>0%</span>
        </div>
      </div>
      <div class="admin-divider"></div>
      <label>Stream Video UID
        <input type="text" data-stream-video-uid maxlength="128" autocomplete="off" placeholder="UID generado por Cloudflare Stream">
        <span class="upload-note">También puedes pegar manualmente un UID existente. La Academia genera un token privado cada vez que una alumna autorizada reproduce el video.</span>
      </label>
      <div class="admin-actions end"><button class="mini-btn" type="button" data-save-stream-video>Guardar UID manualmente</button></div>
      <p class="admin-status" data-stream-admin-status aria-live="polite"></p>`;
    actions.before(block);

    const status = block.querySelector('[data-stream-admin-status]');
    const input = block.querySelector('[data-stream-video-uid]');
    const save = block.querySelector('[data-save-stream-video]');
    const uploadButton = block.querySelector('[data-upload-stream-video]');
    const fileInput = block.querySelector('[data-stream-upload-file]');
    const progressWrap = block.querySelector('[data-stream-progress-wrap]');
    const progress = block.querySelector('[data-stream-progress]');
    const progressLabel = block.querySelector('[data-stream-progress-label]');

    try {
      const supabase = await client();
      const { data, error } = await supabase.from('lessons')
        .select('stream_video_uid,stream_require_signed_urls')
        .eq('id', lessonId).maybeSingle();
      if (!error && data?.stream_video_uid) input.value = data.stream_video_uid;
    } catch (error) {
      console.warn('Stream admin load', error);
    }

    uploadButton.addEventListener('click', async () => {
      const file = fileInput.files?.[0] || null;
      status.classList.remove('ok');
      if (!file) {
        status.textContent = 'Selecciona primero el video que quieres subir.';
        return;
      }
      if (file.size > MAX_BASIC_UPLOAD_BYTES) {
        status.textContent = 'Este archivo supera 200 MB. Por ahora súbelo desde el panel de Cloudflare Stream y pega aquí su UID; después agregaremos carga reanudable TUS.';
        return;
      }

      uploadButton.disabled = true;
      save.disabled = true;
      fileInput.disabled = true;
      progressWrap.classList.remove('hidden');
      progress.value = 0;
      progressLabel.textContent = '0%';
      status.textContent = 'Preparando carga privada en Cloudflare Stream…';

      try {
        const provision = await provisionUpload(lessonId, file);
        input.value = provision.video_uid;
        status.textContent = 'Subiendo video a Cloudflare Stream…';

        await uploadFile(provision.upload_url, file, percent => {
          progress.value = percent;
          progressLabel.textContent = `${percent}%`;
          status.textContent = percent < 100
            ? `Subiendo video a Cloudflare Stream… ${percent}%`
            : 'Carga recibida. Vinculando video con la lección…';
        });

        await saveVideoUid(lessonId, provision.video_uid);
        progress.value = 100;
        progressLabel.textContent = '100%';
        status.textContent = 'Video cargado y vinculado. Cloudflare lo está procesando; quedará disponible automáticamente al terminar.';
        status.classList.add('ok');
        window.dispatchEvent(new CustomEvent('yamilet:stream-video-linked', {
          detail: { lessonId, videoUid: provision.video_uid }
        }));
      } catch (error) {
        console.warn('Stream direct upload', error);
        if (error.status === 404) {
          status.textContent = 'La subida directa estará disponible en el despliegue de Cloudflare Workers. La vista de GitHub Pages sigue funcionando como respaldo.';
        } else if (error.status === 403) {
          status.textContent = 'Tu cuenta no tiene permisos de administración para subir videos a esta lección.';
        } else {
          status.textContent = 'No fue posible completar la carga a Cloudflare Stream. El video no se vinculó; puedes intentar nuevamente.';
        }
      } finally {
        uploadButton.disabled = false;
        save.disabled = false;
        fileInput.disabled = false;
      }
    });

    save.addEventListener('click', async () => {
      const uid = String(input.value || '').trim();
      status.classList.remove('ok');
      if (!uid) {
        status.textContent = 'Pega primero el UID del video de Cloudflare Stream.';
        return;
      }
      save.disabled = true;
      status.textContent = 'Guardando vínculo con Cloudflare Stream…';
      try {
        await saveVideoUid(lessonId, uid);
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
