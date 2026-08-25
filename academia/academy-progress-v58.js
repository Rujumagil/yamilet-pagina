(() => {
  'use strict';

  const RELEASE = '20260825.58';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const STREAM_SDK = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
  const SAVE_INTERVAL_MS = 10000;
  const MIN_RESUME_SECONDS = 5;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let sb = null;
  let user = null;
  let workspace = null;
  let membership = null;
  let profile = null;
  let identityPromise = null;
  let streamSdkPromise = null;
  let navigationToken = 0;
  const courseCache = new Map();
  const boundMedia = new WeakSet();
  const bypassClicks = new Set();

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  function showToast(message, tone = 'info') {
    let host = $('[data-v58-progress-toast]');
    if (!host) {
      host = document.createElement('div');
      host.dataset.v58ProgressToast = '1';
      host.className = 'v58-progress-toast';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    host.dataset.tone = tone;
    host.textContent = message;
    host.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => host.classList.remove('show'), 3200);
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safe / 60);
    const rest = safe % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  async function identity() {
    if (identityPromise) return identityPromise;
    identityPromise = (async () => {
      const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('config_unavailable');
      const cfg = await response.json();
      sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      const { data: { session } } = await sb.auth.getSession();
      user = session?.user || null;
      if (!user) return { authenticated: false, isStaff: false };

      const [{ data: p }, { data: w }] = await Promise.all([
        sb.from('profiles').select('id,role,status').eq('id', user.id).maybeSingle(),
        sb.from('workspaces').select('id,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
      ]);
      profile = p || null;
      workspace = w || null;
      if (workspace) {
        const { data: member } = await sb.from('workspace_members')
          .select('role,status')
          .eq('workspace_id', workspace.id)
          .eq('user_id', user.id)
          .maybeSingle();
        membership = member?.status === 'active' ? member : null;
      }
      const isStaff = profile?.role === 'admin' || ['owner', 'admin', 'instructor'].includes(membership?.role);
      return { authenticated: true, isStaff };
    })().catch(error => {
      console.warn('Academia Yamilet progress identity', error);
      return { authenticated: false, isStaff: false };
    });
    return identityPromise;
  }

  async function loadCourseState(courseId, force = false) {
    if (!courseId) return null;
    const me = await identity();
    if (!me.authenticated || !sb || !user) return null;
    if (!force && courseCache.has(courseId)) return courseCache.get(courseId);

    const [{ data: enrollment }, { data: modules, error: moduleError }] = await Promise.all([
      sb.from('enrollments').select('status').eq('user_id', user.id).eq('course_id', courseId).maybeSingle(),
      sb.from('modules').select('id,position').eq('course_id', courseId).order('position', { ascending: true })
    ]);
    if (moduleError) throw moduleError;

    const moduleRows = modules || [];
    const moduleIds = moduleRows.map(item => item.id);
    let lessons = [];
    if (moduleIds.length) {
      const { data, error } = await sb.from('lessons')
        .select('id,module_id,position,title,lesson_type')
        .in('module_id', moduleIds);
      if (error) throw error;
      lessons = data || [];
    }
    const modulePosition = new Map(moduleRows.map(item => [item.id, Number(item.position || 0)]));
    lessons.sort((a, b) => {
      const moduleDiff = (modulePosition.get(a.module_id) || 0) - (modulePosition.get(b.module_id) || 0);
      if (moduleDiff) return moduleDiff;
      return Number(a.position || 0) - Number(b.position || 0);
    });

    let progressRows = [];
    if (lessons.length) {
      const { data, error } = await sb.from('lesson_progress')
        .select('lesson_id,completed,progress_seconds,completed_at,updated_at')
        .eq('user_id', user.id)
        .in('lesson_id', lessons.map(item => item.id));
      if (error) throw error;
      progressRows = data || [];
    }

    const state = {
      courseId,
      lessons,
      progress: new Map(progressRows.map(row => [row.lesson_id, row])),
      canTrack: ['active', 'completed'].includes(enrollment?.status),
      isStaff: !!me.isStaff
    };
    courseCache.set(courseId, state);
    return state;
  }

  function isUnlocked(state, lessonId) {
    if (!state || state.isStaff || !state.canTrack) return true;
    const index = state.lessons.findIndex(item => item.id === lessonId);
    if (index <= 0) return index === 0;
    const previous = state.progress.get(state.lessons[index - 1].id);
    return !!previous?.completed;
  }

  function setLocked(el, locked) {
    if (!el) return;
    if (locked) {
      el.dataset.v58Locked = '1';
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('title', 'Completa la lección anterior para continuar.');
    } else {
      delete el.dataset.v58Locked;
      el.removeAttribute('aria-disabled');
      if (el.getAttribute('title') === 'Completa la lección anterior para continuar.') el.removeAttribute('title');
    }
  }

  async function applyLocks(courseId, force = false) {
    if (!courseId) return null;
    try {
      const state = await loadCourseState(courseId, force);
      if (!state) return null;
      const rows = [
        ...$$(`[data-course-detail] [data-open-lesson][data-course-id="${CSS.escape(courseId)}"]`),
        ...$$(`[data-lesson-detail] [data-mes-open-lesson][data-course-id="${CSS.escape(courseId)}"]`)
      ];
      rows.forEach(row => setLocked(row, !isUnlocked(state, row.dataset.openLesson || row.dataset.mesOpenLesson)));
      return state;
    } catch (error) {
      console.warn('Academia Yamilet progress lock sync', error);
      return null;
    }
  }

  function visibleContext() {
    const view = $('[data-lesson-view]:not(.hidden)');
    if (!view) return null;
    const button = $('[data-toggle-complete][data-course-id]', view);
    if (!button) return null;
    return { lessonId: button.dataset.toggleComplete, courseId: button.dataset.courseId };
  }

  function visibleCourseId() {
    return visibleContext()?.courseId || $('[data-course-detail] [data-open-lesson][data-course-id]')?.dataset.courseId || null;
  }

  function resumeNotice(seconds) {
    const shell = $('[data-lesson-detail] .video-shell, [data-lesson-detail] .lesson-video');
    if (!shell) return;
    let note = $('[data-v58-resume-note]');
    if (!note) {
      note = document.createElement('div');
      note.dataset.v58ResumeNote = '1';
      note.className = 'v58-resume-note';
      shell.insertAdjacentElement('afterend', note);
    }
    note.textContent = `Continuamos desde ${formatTime(seconds)} · tu avance se guarda automáticamente.`;
  }

  async function savePlayback(courseId, lessonId, seconds, markCompleted = false) {
    const state = await loadCourseState(courseId, false);
    if (!state?.canTrack || !user || !sb || !isUnlocked(state, lessonId)) return { ok: false };
    const current = state.progress.get(lessonId) || null;
    const completed = !!current?.completed || !!markCompleted;
    const normalizedSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      lesson_id: lessonId,
      completed,
      progress_seconds: normalizedSeconds,
      completed_at: completed ? (current?.completed_at || now) : null,
      updated_at: now
    };
    const { error } = await sb.from('lesson_progress').upsert(payload, { onConflict: 'user_id,lesson_id' });
    if (error) {
      console.warn('Academia Yamilet playback save', error);
      return { ok: false, error };
    }
    state.progress.set(lessonId, payload);
    if (markCompleted) courseCache.delete(courseId);
    return { ok: true, completed };
  }

  async function ensureStreamSdk() {
    if (window.Stream) return window.Stream;
    if (streamSdkPromise) return streamSdkPromise;
    streamSdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${STREAM_SDK}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Stream), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = STREAM_SDK;
      script.async = true;
      script.onload = () => resolve(window.Stream);
      script.onerror = () => reject(new Error('stream_sdk_unavailable'));
      document.head.appendChild(script);
    });
    return streamSdkPromise;
  }

  async function handleEnded(adapter, context) {
    const seconds = adapter.currentTime();
    const courseState = await loadCourseState(context.courseId, true);
    const alreadyCompleted = !!courseState?.progress.get(context.lessonId)?.completed;
    await savePlayback(context.courseId, context.lessonId, seconds, alreadyCompleted);
    if (alreadyCompleted) return;

    const completeButton = $(`[data-toggle-complete="${CSS.escape(context.lessonId)}"][data-course-id="${CSS.escape(context.courseId)}"]`);
    if (completeButton) {
      showToast('Video finalizado. Marcando la lección como completada…', 'ok');
      completeButton.click();
      window.setTimeout(() => savePlayback(context.courseId, context.lessonId, seconds, true), 1200);
    } else {
      await savePlayback(context.courseId, context.lessonId, seconds, true);
      showToast('Lección completada. Ya puedes continuar.', 'ok');
    }
  }

  async function bindAdapter(adapter, context) {
    if (!adapter?.element || boundMedia.has(adapter.element)) return;
    boundMedia.add(adapter.element);

    const state = await loadCourseState(context.courseId, true);
    if (!state?.canTrack || !isUnlocked(state, context.lessonId)) return;
    let row = state.progress.get(context.lessonId) || null;
    let lastSavedAt = 0;
    let saving = false;

    const flush = async (complete = false) => {
      if (saving || !adapter.element.isConnected) return;
      const seconds = adapter.currentTime();
      if (!Number.isFinite(seconds) || seconds < 0) return;
      saving = true;
      try {
        const result = await savePlayback(context.courseId, context.lessonId, seconds, complete);
        if (result.ok) {
          lastSavedAt = Date.now();
          row = { ...(row || {}), progress_seconds: Math.floor(seconds), completed: row?.completed || complete };
        }
      } finally {
        saving = false;
      }
    };

    const restore = () => {
      const saved = Math.max(0, Number(row?.progress_seconds || 0));
      const duration = adapter.duration();
      if (row?.completed || saved < MIN_RESUME_SECONDS || !Number.isFinite(duration) || duration <= saved + 4) return;
      try {
        adapter.seek(saved);
        resumeNotice(saved);
      } catch (error) {
        console.warn('Academia Yamilet resume playback', error);
      }
    };

    adapter.on('loadedmetadata', restore);
    adapter.on('durationchange', restore);
    adapter.on('timeupdate', () => {
      if (Date.now() - lastSavedAt >= SAVE_INTERVAL_MS) void flush(false);
    });
    adapter.on('pause', () => void flush(false));
    adapter.on('seeked', () => void flush(false));
    adapter.on('ended', () => void handleEnded(adapter, context));

    if (adapter.ready()) restore();
  }

  async function bindStream() {
    const context = visibleContext();
    if (!context) return;
    const iframe = $(`[data-cloudflare-stream-player="${CSS.escape(context.lessonId)}"] iframe`);
    if (!iframe || boundMedia.has(iframe)) return;
    try {
      const Stream = await ensureStreamSdk();
      if (typeof Stream !== 'function') return;
      const player = Stream(iframe);
      const adapter = {
        element: iframe,
        on: (name, handler) => player.addEventListener(name, handler),
        currentTime: () => Number(player.currentTime || 0),
        duration: () => Number(player.duration || 0),
        seek: value => { player.currentTime = Number(value || 0); },
        ready: () => Number(player.duration || 0) > 0
      };
      await bindAdapter(adapter, context);
    } catch (error) {
      console.warn('Academia Yamilet Stream progress', error);
    }
  }

  async function bindNativeVideo() {
    const context = visibleContext();
    const video = $('[data-lesson-view]:not(.hidden) .lesson-video');
    if (!context || !video || boundMedia.has(video)) return;
    const adapter = {
      element: video,
      on: (name, handler) => video.addEventListener(name, handler),
      currentTime: () => Number(video.currentTime || 0),
      duration: () => Number(video.duration || 0),
      seek: value => { video.currentTime = Number(value || 0); },
      ready: () => Number(video.readyState || 0) >= 1 && Number(video.duration || 0) > 0
    };
    await bindAdapter(adapter, context);
  }

  async function bindVisibleMedia() {
    await bindNativeVideo();
    await bindStream();
  }

  async function afterManualToggle(context, token) {
    await sleep(650);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (token !== navigationToken) return;
      courseCache.delete(context.courseId);
      await applyLocks(context.courseId, true);
      if ($('[data-course-view]:not(.hidden)')) break;
      await sleep(250);
    }
    if (token !== navigationToken) return;
    const lessonHidden = $('[data-lesson-view]')?.classList.contains('hidden');
    if (!lessonHidden) return;
    const row = $(`[data-course-detail] [data-open-lesson="${CSS.escape(context.lessonId)}"][data-course-id="${CSS.escape(context.courseId)}"]`);
    if (row) {
      const key = `${context.courseId}:${context.lessonId}`;
      bypassClicks.add(key);
      row.click();
      window.setTimeout(() => {
        void applyLocks(context.courseId, true);
        void bindVisibleMedia();
      }, 220);
    }
  }

  document.addEventListener('click', event => {
    const back = event.target.closest('[data-back-course],[data-back-courses],[data-shell-route]');
    if (back) navigationToken += 1;

    const completion = event.target.closest('[data-toggle-complete][data-course-id]');
    if (completion) {
      const context = { lessonId: completion.dataset.toggleComplete, courseId: completion.dataset.courseId };
      const token = navigationToken;
      window.setTimeout(() => void afterManualToggle(context, token), 0);
      return;
    }

    const courseButton = event.target.closest('[data-open-course]');
    if (courseButton) {
      window.setTimeout(() => void applyLocks(courseButton.dataset.openCourse, true), 180);
      return;
    }

    const lessonButton = event.target.closest('[data-open-lesson][data-course-id], [data-mes-open-lesson][data-course-id]');
    if (!lessonButton) return;
    const lessonId = lessonButton.dataset.openLesson || lessonButton.dataset.mesOpenLesson;
    const courseId = lessonButton.dataset.courseId;
    const key = `${courseId}:${lessonId}`;
    if (bypassClicks.delete(key)) {
      window.setTimeout(() => void bindVisibleMedia(), 180);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    void (async () => {
      const state = await loadCourseState(courseId, false) || await loadCourseState(courseId, true);
      await applyLocks(courseId, false);
      if (!state || isUnlocked(state, lessonId)) {
        bypassClicks.add(key);
        lessonButton.click();
        window.setTimeout(() => {
          void applyLocks(courseId, false);
          void bindVisibleMedia();
        }, 220);
        return;
      }
      showToast('Completa la lección anterior para desbloquear esta clase.', 'lock');
    })();
  }, true);

  document.addEventListener('yamilet:stream-ready', () => window.setTimeout(() => void bindStream(), 30));
  window.addEventListener('pageshow', () => window.setTimeout(() => {
    void applyLocks(visibleCourseId(), true);
    void bindVisibleMedia();
  }, 500));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) window.setTimeout(() => {
      void applyLocks(visibleCourseId(), true);
      void bindVisibleMedia();
    }, 180);
  });

  window.setInterval(() => {
    const courseId = visibleCourseId();
    if (courseId) void applyLocks(courseId, false);
    if ($('[data-lesson-view]:not(.hidden)')) void bindVisibleMedia();
  }, 1400);

  window.ACADEMIA_YAMILET_PROGRESS_V58 = {
    release: RELEASE,
    refresh: async courseId => applyLocks(courseId || visibleCourseId(), true)
  };
})();
