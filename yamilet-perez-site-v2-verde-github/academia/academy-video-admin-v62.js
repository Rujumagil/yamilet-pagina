(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const MAX_STREAM_BASIC_BYTES = 200 * 1024 * 1024;
  const MAX_STORAGE_BYTES = 250 * 1024 * 1024;
  const FALLBACK_BUCKET = 'lesson-media';
  const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
  let sb = null;
  let cfg = null;
  let scheduled = false;
  let adminRendering = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const safeName = (value = 'video') => String(value || 'video')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'video';

  async function client() {
    if (sb && cfg) return { sb, cfg };
    const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('config_unavailable');
    cfg = await response.json();
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return { sb, cfg };
  }

  async function sessionToken() {
    const { sb: supabase } = await client();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function workspaceContext() {
    const { sb: supabase, cfg: config } = await client();
    const { data: workspace, error } = await supabase.from('workspaces')
      .select('id,slug,name').eq('slug', config.workspaceSlug || 'yamilet-mes').maybeSingle();
    if (error || !workspace?.id) throw error || new Error('workspace_not_found');
    return { supabase, config, workspace };
  }

  async function readLessonContext(lessonId) {
    const { supabase, workspace } = await workspaceContext();
    const { data: lesson, error: lessonError } = await supabase.from('lessons')
      .select('id,module_id,title,stream_video_uid,stream_require_signed_urls,media_path,media_bucket,media_mime_type,media_filename')
      .eq('id', lessonId).maybeSingle();
    if (lessonError || !lesson?.module_id) throw lessonError || new Error('lesson_not_found');

    const { data: module, error: moduleError } = await supabase.from('modules')
      .select('id,course_id,title').eq('id', lesson.module_id).maybeSingle();
    if (moduleError || !module?.course_id) throw moduleError || new Error('module_not_found');

    const { data: course, error: courseError } = await supabase.from('courses')
      .select('id,workspace_id,title').eq('id', module.course_id).maybeSingle();
    if (courseError || !course?.workspace_id || course.workspace_id !== workspace.id) {
      throw courseError || new Error('wrong_workspace');
    }
    return { lesson, module, course, workspace };
  }

  function hasVideo(lesson) {
    return !!String(lesson?.stream_video_uid || lesson?.media_path || '').trim();
  }

  function currentVideoLabel(context) {
    if (context.lesson.stream_video_uid) return 'Video actual listo para reproducirse.';
    if (context.lesson.media_path) return `Video actual: ${context.lesson.media_filename || 'archivo cargado'}.`;
    return 'Esta lección todavía no tiene un video vinculado.';
  }

  function uploadToStream(uploadUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`stream_upload_http_${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('stream_upload_network_error')));
      xhr.addEventListener('abort', () => reject(new Error('stream_upload_aborted')));
      const form = new FormData();
      form.append('file', file, file.name);
      xhr.send(form);
    });
  }

  async function provisionStreamUpload(lessonId, file) {
    if (/\.github\.io$/i.test(location.hostname) || file.size > MAX_STREAM_BASIC_BYTES) return null;
    const token = await sessionToken();
    if (!token) throw new Error('session_required');

    let response;
    try {
      response = await fetch('/api/stream-upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        cache: 'no-store',
        body: JSON.stringify({ lesson_id: lessonId, filename: file.name, max_duration_seconds: 21600 })
      });
    } catch {
      return null;
    }

    const payload = await response.json().catch(() => ({}));
    if ([404, 405, 502, 503].includes(response.status)) return null;
    if (!response.ok) {
      const error = new Error(payload.error || `stream_provision_http_${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (!payload.upload_url || !payload.video_uid) return null;
    return payload;
  }

  async function removeOldStorageFile(context) {
    const path = String(context.lesson.media_path || '').trim();
    const bucket = String(context.lesson.media_bucket || FALLBACK_BUCKET).trim();
    if (!path || bucket !== FALLBACK_BUCKET) return;
    const { sb: supabase } = await client();
    try { await supabase.storage.from(bucket).remove([path]); } catch { /* best effort cleanup */ }
  }

  async function saveStreamVideo(context, uid) {
    const { sb: supabase } = await client();
    const { error } = await supabase.from('lessons').update({
      stream_video_uid: uid,
      stream_require_signed_urls: false,
      video_url: null,
      media_path: null,
      media_bucket: FALLBACK_BUCKET,
      media_mime_type: null,
      media_filename: null,
      updated_at: new Date().toISOString()
    }).eq('id', context.lesson.id);
    if (error) throw error;
    await removeOldStorageFile(context);
  }

  function projectIdFromConfig(config) {
    try { return new URL(config.url).hostname.split('.')[0] || ''; }
    catch { return ''; }
  }

  async function tusUpload(path, file, onProgress) {
    const { cfg: config } = await client();
    const token = await sessionToken();
    const projectId = projectIdFromConfig(config);
    if (!token || !projectId || !window.tus?.Upload) throw new Error('tus_unavailable');

    return new Promise((resolve, reject) => {
      const upload = new window.tus.Upload(file, {
        endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}` },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: TUS_CHUNK_SIZE,
        metadata: {
          bucketName: FALLBACK_BUCKET,
          objectName: path,
          contentType: file.type || 'video/mp4',
          cacheControl: '3600'
        },
        onError: reject,
        onProgress: (uploaded, total) => onProgress?.(total ? Math.round((uploaded / total) * 100) : 0),
        onSuccess: () => resolve({ url: upload.url })
      });
      upload.findPreviousUploads().then(previous => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      }).catch(reject);
    });
  }

  async function uploadToPrivateStorage(context, file, onProgress) {
    if (file.size > MAX_STORAGE_BYTES) throw new Error('file_too_large');
    const { sb: supabase } = await client();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `courses/${context.course.id}/lessons/${context.lesson.id}/${timestamp}-${safeName(file.name)}`;

    if (window.tus?.Upload) {
      await tusUpload(path, file, onProgress);
    } else {
      const { error: uploadError } = await supabase.storage.from(FALLBACK_BUCKET).upload(path, file, {
        contentType: file.type || 'video/mp4', cacheControl: '3600', upsert: false
      });
      if (uploadError) throw uploadError;
      onProgress?.(100);
    }

    const { error: updateError } = await supabase.from('lessons').update({
      stream_video_uid: null,
      stream_require_signed_urls: false,
      video_url: null,
      media_path: path,
      media_bucket: FALLBACK_BUCKET,
      media_mime_type: file.type || 'video/mp4',
      media_filename: file.name,
      updated_at: new Date().toISOString()
    }).eq('id', context.lesson.id);

    if (updateError) {
      try { await supabase.storage.from(FALLBACK_BUCKET).remove([path]); } catch { /* no-op */ }
      throw updateError;
    }
    await removeOldStorageFile(context);
    return { path };
  }

  function setProgress(block, percent, indeterminate = false) {
    const wrap = $('[data-video-upload-progress-wrap]', block);
    const bar = $('[data-video-upload-progress]', block);
    const label = $('[data-video-upload-progress-label]', block);
    wrap?.classList.remove('hidden');
    if (bar) {
      if (indeterminate) bar.removeAttribute('value');
      else bar.value = Math.max(0, Math.min(100, Number(percent || 0)));
    }
    if (label) label.textContent = indeterminate ? 'Subiendo…' : `${Math.round(percent || 0)}%`;
  }

  function setStatus(block, text, ok = false) {
    const status = $('[data-video-admin-status]', block);
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('ok', !!ok);
  }

  function setVideoReady(block, filename = '') {
    const state = $('[data-video-state]', block);
    if (state) {
      state.textContent = 'Video listo';
      state.classList.add('ready');
    }
    const current = $('[data-video-current]', block);
    if (current) current.textContent = filename ? `Video actualizado: ${filename}.` : 'Video actualizado y listo para la lección.';
  }

  async function performUpload(lessonId, block) {
    const fileInput = $('[data-video-upload-file]', block);
    const button = $('[data-upload-lesson-video]', block);
    const file = fileInput?.files?.[0] || null;

    if (!file) return setStatus(block, 'Selecciona primero el video que quieres subir.');
    if (!lessonId) return setStatus(block, 'No pude identificar esta lección.');
    if (!String(file.type || '').startsWith('video/')) return setStatus(block, 'Selecciona un archivo de video válido.');
    if (file.size > MAX_STORAGE_BYTES) return setStatus(block, 'El archivo supera 250 MB. Comprímelo antes de subirlo desde la Academia.');

    button.disabled = true;
    fileInput.disabled = true;
    setStatus(block, 'Preparando el video…');
    setProgress(block, 0);

    try {
      const context = await readLessonContext(lessonId);
      const provision = await provisionStreamUpload(lessonId, file);

      if (provision) {
        setStatus(block, 'Subiendo video…');
        await uploadToStream(provision.upload_url, file, percent => {
          setProgress(block, percent);
          setStatus(block, percent < 100 ? `Subiendo video… ${percent}%` : 'Vinculando video con la lección…');
        });
        await saveStreamVideo(context, provision.video_uid);
        setProgress(block, 100);
        setStatus(block, 'Video actualizado. La Academia lo vinculó automáticamente a esta lección.', true);
      } else {
        setStatus(block, 'Subiendo video de forma segura…');
        await uploadToPrivateStorage(context, file, percent => {
          setProgress(block, percent);
          setStatus(block, percent < 100 ? `Subiendo video… ${percent}%` : 'Vinculando video con la lección…');
        });
        setProgress(block, 100);
        setStatus(block, 'Video actualizado. Ya quedó vinculado automáticamente a esta lección.', true);
      }

      setVideoReady(block, file.name);
      fileInput.value = '';
      window.dispatchEvent(new CustomEvent('yamilet:lesson-video-updated', { detail: { lessonId } }));
    } catch (error) {
      console.warn('Academia Yamilet video upload v62', error);
      if (error?.status === 401 || error?.message === 'session_required') setStatus(block, 'Tu sesión expiró. Vuelve a iniciar sesión e inténtalo nuevamente.');
      else if (error?.status === 403) setStatus(block, 'Tu cuenta no tiene permisos para modificar esta lección.');
      else if (error?.message === 'file_too_large') setStatus(block, 'El video supera el límite actual de carga directa.');
      else setStatus(block, 'No fue posible subir el video. El contenido anterior se conservó sin cambios.');
    } finally {
      button.disabled = false;
      fileInput.disabled = false;
    }
  }

  async function loadMethodMes() {
    const { supabase, workspace } = await workspaceContext();
    const { data: courses, error: courseError } = await supabase.from('courses')
      .select('id,title,status').eq('workspace_id', workspace.id).ilike('title', '%Método MES%').limit(1);
    if (courseError) throw courseError;
    const course = courses?.[0];
    if (!course?.id) throw new Error('method_mes_not_found');

    const { data: modules, error: moduleError } = await supabase.from('modules')
      .select('id,title,position').eq('course_id', course.id).order('position', { ascending: true });
    if (moduleError) throw moduleError;
    const moduleIds = (modules || []).map(module => module.id);
    let lessons = [];
    if (moduleIds.length) {
      const { data, error } = await supabase.from('lessons')
        .select('id,module_id,title,position,stream_video_uid,media_path,media_filename')
        .in('module_id', moduleIds).order('position', { ascending: true });
      if (error) throw error;
      lessons = data || [];
    }
    return { course, modules: modules || [], lessons };
  }

  function videoRow(lesson) {
    const ready = hasVideo(lesson);
    return `<div class="academy-video-row" data-video-row data-video-lesson-id="${esc(lesson.id)}">
      <div class="academy-video-row-main"><div><strong>${esc(lesson.title)}</strong><small>${ready && lesson.media_filename ? esc(lesson.media_filename) : 'Selecciona un archivo para actualizar esta clase.'}</small></div><span class="academy-video-state${ready ? ' ready' : ''}" data-video-state>${ready ? 'Video listo' : 'Sin video'}</span></div>
      <div class="academy-video-row-actions"><input type="file" data-video-upload-file accept="video/mp4,video/webm,video/quicktime,video/*"><button type="button" data-upload-lesson-video>${ready ? 'Reemplazar video' : 'Subir video'}</button></div>
      <div class="stream-upload-progress hidden" data-video-upload-progress-wrap><progress data-video-upload-progress max="100" value="0"></progress><span data-video-upload-progress-label>0%</span></div>
      <p class="admin-status" data-video-admin-status aria-live="polite"></p>
    </div>`;
  }

  function videoManagerMarkup(data) {
    const total = data.lessons.length;
    const ready = data.lessons.filter(hasVideo).length;
    return `<div class="academy-admin-section-head"><div><span>VIDEOS · MÉTODO MES®</span><h3>Actualiza las clases desde la Academia</h3></div><p>${ready} de ${total} lecciones tienen video. Ya no necesitas abrir GitHub ni copiar enlaces.</p></div>
      <div class="academy-video-manager-summary"><strong>${ready}/${total}</strong><span>videos vinculados</span><small>Formatos MP4, MOV o WebM · hasta 250 MB por archivo</small></div>
      <div class="academy-video-module-list">${data.modules.map(module => {
        const rows = data.lessons.filter(lesson => lesson.module_id === module.id).sort((a,b) => Number(a.position || 0) - Number(b.position || 0));
        return `<article class="academy-video-module"><div class="academy-video-module-head"><strong>${esc(module.title)}</strong><span>${rows.filter(hasVideo).length}/${rows.length} listos</span></div><div class="academy-video-lessons">${rows.map(videoRow).join('')}</div></article>`;
      }).join('')}</div>`;
  }

  function bindVideoRows(root) {
    root.querySelectorAll('[data-video-row]').forEach(row => {
      $('[data-upload-lesson-video]', row)?.addEventListener('click', () => performUpload(row.dataset.videoLessonId, row));
    });
  }

  async function enhanceAdminPage() {
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden') || adminRendering) return;
    if ($('[data-video-manager-v62]', page)) return;
    const anchor = $('.academy-admin-section', page);
    if (!anchor) return;

    adminRendering = true;
    const section = document.createElement('section');
    section.className = 'academy-admin-section academy-video-manager-v62';
    section.dataset.videoManagerV62 = '1';
    section.innerHTML = '<div class="academy-video-manager-loading"><strong>Cargando videos de Método MES®…</strong><span>Consultando módulos y lecciones.</span></div>';
    anchor.after(section);

    try {
      const data = await loadMethodMes();
      section.innerHTML = videoManagerMarkup(data);
      bindVideoRows(section);
    } catch (error) {
      console.warn('Academia Yamilet video manager v62', error);
      section.innerHTML = '<div class="academy-video-manager-loading error"><strong>No fue posible cargar los videos</strong><span>Recarga el panel administrativo y vuelve a intentarlo.</span></div>';
    } finally {
      adminRendering = false;
    }
  }

  async function enhanceEditor() {
    const form = $('[data-lesson-form]');
    if (!form || form.dataset.videoUploaderV62 === '1') return;
    form.dataset.videoUploaderV62 = '1';
    const actions = $('.admin-actions.end', form);
    if (!actions) return;
    const lessonId = String(form.elements.lesson_id?.value || '').trim();
    const block = document.createElement('div');
    block.className = 'admin-span-2 cloudflare-stream-admin academy-video-uploader-v62';
    block.innerHTML = `<div class="kicker">Video de la lección</div><div class="academy-video-current" data-video-current>Consultando video actual…</div><label>Subir o reemplazar video<input type="file" data-video-upload-file accept="video/mp4,video/webm,video/quicktime,video/*" ${lessonId ? '' : 'disabled'}><span class="upload-note">Selecciona el archivo y la Academia lo vinculará automáticamente.</span></label><div class="admin-actions end"><button class="mini-btn primary-mini" type="button" data-upload-lesson-video ${lessonId ? '' : 'disabled'}>${lessonId ? 'Subir / reemplazar video' : 'Guarda primero la lección'}</button></div><div class="stream-upload-progress hidden" data-video-upload-progress-wrap><progress data-video-upload-progress max="100" value="0"></progress><span data-video-upload-progress-label>0%</span></div><p class="admin-status" data-video-admin-status aria-live="polite"></p>`;
    actions.before(block);
    if (!lessonId) return;
    try {
      const context = await readLessonContext(lessonId);
      $('[data-video-current]', block).textContent = currentVideoLabel(context);
    } catch {
      $('[data-video-current]', block).textContent = 'No fue posible consultar el estado del video.';
    }
    $('[data-upload-lesson-video]', block)?.addEventListener('click', () => performUpload(lessonId, block));
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceAdminPage().catch(error => console.warn('Academia Yamilet manager enhance', error));
      enhanceEditor().catch(error => console.warn('Academia Yamilet uploader enhance', error));
    });
  }

  function boot() {
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="admin"]')) window.setTimeout(scheduleEnhance, 80);
    });
    scheduleEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();