(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const UID_RE = /^[A-Za-z0-9_-]{16,128}$/;
  const EXCLUDED_TITLES = new Set([
    'evaluacion y cierre de la semana 1'
  ]);
  let sb = null;
  let scheduled = false;

  const $ = (selector, root = document) => root.querySelector(selector);

  const normalize = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');

  function isExcludedTitle(value) {
    return EXCLUDED_TITLES.has(normalize(value));
  }

  function extractUid(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (UID_RE.test(raw)) return raw;

    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if (!host.endsWith('cloudflarestream.com') && !host.endsWith('videodelivery.net')) return '';
      const parts = url.pathname.split('/').filter(Boolean);
      const iframeIndex = parts.indexOf('iframe');
      const candidate = iframeIndex > 0 ? parts[iframeIndex - 1] : (parts[0] || '');
      return UID_RE.test(candidate) ? candidate : '';
    } catch {
      return '';
    }
  }

  async function client() {
    if (sb) return sb;
    const response = await fetch(CONFIG_ENDPOINT, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('config_unavailable');
    const cfg = await response.json();
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return sb;
  }

  function setStatus(root, text, ok = false) {
    const status = $('[data-cloudflare-manual-status]', root);
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('ok', !!ok);
  }

  async function saveUid(lessonId, rawValue, root) {
    const uid = extractUid(rawValue);
    if (!uid) {
      setStatus(root, 'Pega un UID o enlace válido de Cloudflare Stream.');
      return;
    }

    const button = $('[data-cloudflare-manual-save]', root);
    const input = $('[data-cloudflare-manual-input]', root);
    if (button) button.disabled = true;
    if (input) input.disabled = true;
    setStatus(root, 'Vinculando video con la lección…');

    try {
      const supabase = await client();
      const { error } = await supabase.from('lessons').update({
        stream_video_uid: uid,
        stream_require_signed_urls: false,
        video_url: null,
        media_path: null,
        media_bucket: 'lesson-media',
        media_mime_type: null,
        media_filename: null,
        updated_at: new Date().toISOString()
      }).eq('id', lessonId);

      if (error) throw error;

      const state = $('[data-video-state]', root);
      if (state) {
        state.textContent = 'Video listo';
        state.classList.add('ready');
      }
      const subtitle = $('.academy-video-row-main small', root);
      if (subtitle) subtitle.textContent = 'Video de Cloudflare vinculado correctamente.';
      setStatus(root, 'Listo. El video quedó vinculado a esta clase.', true);
      if (input) input.value = '';
      window.dispatchEvent(new CustomEvent('yamilet:lesson-video-updated', { detail: { lessonId, uid } }));
    } catch (error) {
      console.warn('Academia Yamilet Cloudflare manual v64', error);
      setStatus(root, 'No fue posible guardar el enlace. Verifica tu sesión y permisos.');
    } finally {
      if (button) button.disabled = false;
      if (input) input.disabled = false;
    }
  }

  function manualControls(lessonId, ready) {
    const wrap = document.createElement('div');
    wrap.className = 'academy-video-row-actions academy-cloudflare-manual-v64';
    wrap.dataset.cloudflareManual = '1';
    wrap.innerHTML = `
      <input type="text" data-cloudflare-manual-input autocomplete="off" spellcheck="false" placeholder="Pega UID o enlace de Cloudflare Stream">
      <button type="button" data-cloudflare-manual-save>${ready ? 'Reemplazar enlace' : 'Vincular video'}</button>
      <p class="admin-status" data-cloudflare-manual-status aria-live="polite"></p>`;
    $('[data-cloudflare-manual-save]', wrap)?.addEventListener('click', () => {
      saveUid(lessonId, $('[data-cloudflare-manual-input]', wrap)?.value || '', wrap);
    });
    $('[data-cloudflare-manual-input]', wrap)?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        $('[data-cloudflare-manual-save]', wrap)?.click();
      }
    });
    return wrap;
  }

  function transformManagerRow(row) {
    if (row.dataset.cloudflareManualV64 === '1') return;
    const title = $('.academy-video-row-main strong', row)?.textContent || '';
    if (isExcludedTitle(title)) {
      row.remove();
      return;
    }

    const lessonId = String(row.dataset.videoLessonId || '').trim();
    if (!lessonId) return;
    row.dataset.cloudflareManualV64 = '1';

    const ready = $('[data-video-state]', row)?.classList.contains('ready') || false;
    const subtitle = $('.academy-video-row-main small', row);
    if (subtitle) subtitle.textContent = ready
      ? 'Video vinculado. Para reemplazarlo, pega el nuevo UID o enlace de Cloudflare.'
      : 'Sube el video a Cloudflare Stream y pega aquí su UID o enlace.';

    $('.academy-video-row-actions', row)?.replaceWith(manualControls(lessonId, ready));
    $('[data-video-upload-progress-wrap]', row)?.remove();
    $('[data-video-admin-status]', row)?.remove();
  }

  function refreshCounts() {
    document.querySelectorAll('.academy-video-module').forEach(module => {
      const rows = [...module.querySelectorAll('[data-video-row]')];
      const ready = rows.filter(row => $('[data-video-state]', row)?.classList.contains('ready')).length;
      const counter = $('.academy-video-module-head span', module);
      if (counter) counter.textContent = `${ready}/${rows.length} listos`;
    });

    const manager = document.querySelector('[data-video-manager-v62]');
    if (!manager) return;
    const rows = [...manager.querySelectorAll('[data-video-row]')];
    const ready = rows.filter(row => $('[data-video-state]', row)?.classList.contains('ready')).length;
    const summary = $('.academy-video-manager-summary strong', manager);
    if (summary) summary.textContent = `${ready}/${rows.length}`;
    const note = $('.academy-video-manager-summary small', manager);
    if (note) note.textContent = 'Sube el video directamente a Cloudflare Stream y pega aquí el UID o enlace.';
    const intro = $('.academy-admin-section-head p', manager);
    if (intro) intro.textContent = `${ready} de ${rows.length} clases con video están vinculadas. Las evaluaciones sin video no se incluyen.`;
  }

  function transformNativeEditor() {
    const form = document.querySelector('[data-lesson-form]');
    if (!form) return;
    const title = form.elements?.title?.value || form.querySelector('input[name="title"]')?.value || '';
    const currentUploader = form.querySelector('.academy-video-uploader-v62');

    if (isExcludedTitle(title)) {
      currentUploader?.remove();
      form.querySelector('[data-cloudflare-manual-editor-v64]')?.remove();
      return;
    }

    const lessonId = String(form.elements?.lesson_id?.value || '').trim();
    if (!lessonId || form.querySelector('[data-cloudflare-manual-editor-v64]')) return;

    const actions = form.querySelector('.admin-actions.end');
    if (!actions) return;
    currentUploader?.remove();

    const block = document.createElement('div');
    block.className = 'admin-span-2 cloudflare-stream-admin academy-cloudflare-manual-editor-v64';
    block.dataset.cloudflareManualEditorV64 = '1';
    block.innerHTML = `
      <div class="kicker">Video de la lección · Cloudflare Stream</div>
      <p class="upload-note">Sube el video directamente en Cloudflare Stream. Después pega aquí el UID o enlace del video.</p>
      <label>UID o enlace de Cloudflare Stream
        <input type="text" data-cloudflare-manual-input autocomplete="off" spellcheck="false" placeholder="Ej. 6ab… o https://customer-…cloudflarestream.com/…/iframe">
      </label>
      <div class="admin-actions end"><button class="mini-btn primary-mini" type="button" data-cloudflare-manual-save>Vincular video</button></div>
      <p class="admin-status" data-cloudflare-manual-status aria-live="polite"></p>`;
    actions.before(block);
    $('[data-cloudflare-manual-save]', block)?.addEventListener('click', () => {
      saveUid(lessonId, $('[data-cloudflare-manual-input]', block)?.value || '', block);
    });
  }

  function updateManager() {
    document.querySelectorAll('[data-video-row]').forEach(transformManagerRow);
    refreshCounts();
  }

  function apply() {
    scheduled = false;
    updateManager();
    transformNativeEditor();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function boot() {
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', () => setTimeout(schedule, 60), true);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
