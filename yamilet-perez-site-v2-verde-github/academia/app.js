(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const authView = document.querySelector('[data-auth-view]');
  const resetView = document.querySelector('[data-reset-view]');
  const deniedView = document.querySelector('[data-denied-view]');
  const dashboard = document.querySelector('[data-dashboard]');
  const statusEl = document.querySelector('[data-auth-status]');
  const resetStatusEl = document.querySelector('[data-reset-status]');
  const loginForm = document.querySelector('[data-login-form]');
  const resetForm = document.querySelector('[data-reset-form]');
  const magicBtn = document.querySelector('[data-magic-link]');
  const recoveryBtn = document.querySelector('[data-password-recovery]');
  const signoutBtn = document.querySelector('[data-signout]');
  const deniedSignoutBtn = document.querySelector('[data-denied-signout]');
  const courseView = document.querySelector('[data-course-view]');
  const lessonView = document.querySelector('[data-lesson-view]');

  let sb;
  let workspace;
  let membership;
  let currentUser;
  let currentProfile;
  let visibleCourses = [];
  let courseStates = [];
  let workspaceSlug = 'yamilet-mes';
  let recoveryMode = false;
  let dashboardLoading = false;
  let selectedCourseId = null;
  let selectedLessonId = null;

  const setStatus = (text, ok = false) => {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('ok', !!ok);
  };

  const setResetStatus = (text, ok = false) => {
    if (!resetStatusEl) return;
    resetStatusEl.textContent = text || '';
    resetStatusEl.classList.toggle('ok', !!ok);
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  const safeUrl = value => {
    try {
      const url = new URL(String(value || ''), window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };

  const formatDate = value => {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${value}T12:00:00Z`));
  };

  function sanitizeHtml(value = '') {
    if (!value) return '';
    const doc = new DOMParser().parseFromString(String(value), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(el => el.remove());
    doc.body.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || name === 'style' || ((name === 'href' || name === 'src') && val.startsWith('javascript:'))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  }

  function showView(target) {
    [authView, resetView, deniedView, dashboard].forEach(view => view?.classList.add('hidden'));
    target?.classList.remove('hidden');
  }

  function setManagerVisibility(visible) {
    document.querySelectorAll('[data-manager-only]').forEach(el => el.classList.toggle('hidden', !visible));
  }

  async function initSupabase() {
    const res = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('config_unavailable');
    const cfg = await res.json();
    workspaceSlug = cfg.workspaceSlug || workspaceSlug;
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  async function fetchVisibleCourses(workspaceId) {
    const { data, error } = await sb
      .from('courses')
      .select('id,title,subtitle,description,status,instructor_name,duration_label,cover_url,featured')
      .eq('workspace_id', workspaceId)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function fetchOwnEnrollments() {
    if (!currentUser) return new Map();
    const { data, error } = await sb
      .from('enrollments')
      .select('course_id,status,completed_at,enrolled_at')
      .eq('user_id', currentUser.id);
    if (error) throw error;
    return new Map((data || []).map(row => [row.course_id, row]));
  }

  async function fetchCourseState(course, enrollmentMap) {
    const enrollment = enrollmentMap.get(course.id) || null;
    const { data: modules, error: moduleError } = await sb
      .from('modules')
      .select('id,course_id,title,description,position')
      .eq('course_id', course.id)
      .order('position', { ascending: true });
    if (moduleError) throw moduleError;

    const moduleRows = modules || [];
    const moduleIds = moduleRows.map(m => m.id);
    let lessons = [];
    if (moduleIds.length) {
      const { data, error } = await sb
        .from('lessons')
        .select('id,module_id,title,description,lesson_type,video_url,content_html,duration_minutes,position,is_preview,transcript_text,captions_url,accessibility_notes,updated_at')
        .in('module_id', moduleIds);
      if (error) throw error;
      lessons = data || [];
    }

    const modulePosition = new Map(moduleRows.map(m => [m.id, m.position || 0]));
    lessons.sort((a, b) => (modulePosition.get(a.module_id) - modulePosition.get(b.module_id)) || ((a.position || 0) - (b.position || 0)) || a.title.localeCompare(b.title));

    let progressRows = [];
    if (lessons.length && currentUser) {
      const { data, error } = await sb
        .from('lesson_progress')
        .select('lesson_id,completed,progress_seconds,completed_at,updated_at')
        .eq('user_id', currentUser.id)
        .in('lesson_id', lessons.map(l => l.id));
      if (error) throw error;
      progressRows = data || [];
    }

    const progressById = new Map(progressRows.map(p => [p.lesson_id, p]));
    const total = lessons.length;
    const completed = lessons.filter(l => progressById.get(l.id)?.completed).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const unfinished = lessons.filter(l => !progressById.get(l.id)?.completed);
    const touchedUnfinished = unfinished
      .filter(l => progressById.get(l.id)?.updated_at)
      .sort((a, b) => new Date(progressById.get(b.id).updated_at) - new Date(progressById.get(a.id).updated_at));
    const continueLesson = touchedUnfinished[0] || unfinished[0] || null;
    const lastActivity = progressRows.reduce((latest, row) => {
      const ts = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      return Math.max(latest, ts);
    }, 0);
    const canTrack = !!enrollment && ['active', 'completed'].includes(enrollment.status) && course.status === 'published';

    return {
      course, enrollment, modules: moduleRows, lessons, progressById,
      total, completed, percent, continueLesson, lastActivity, canTrack
    };
  }

  async function refreshLearningState() {
    const enrollmentMap = await fetchOwnEnrollments();
    courseStates = await Promise.all(visibleCourses.map(course => fetchCourseState(course, enrollmentMap)));
    renderLearningDashboard();
  }

  function overallProgress() {
    const tracked = courseStates.filter(s => s.canTrack && s.total > 0);
    const total = tracked.reduce((sum, s) => sum + s.total, 0);
    const completed = tracked.reduce((sum, s) => sum + s.completed, 0);
    return total ? Math.round((completed / total) * 100) : 0;
  }

  function courseStatusLabel(state) {
    if (state.enrollment?.status === 'completed' && state.total > 0) return 'Completado';
    if (state.course.status !== 'published') return 'En preparación';
    return state.canTrack ? 'Disponible' : 'Vista de staff';
  }

  function renderCourses() {
    const list = document.querySelector('[data-course-list]');
    const count = document.querySelector('[data-course-count]');
    if (count) count.textContent = courseStates.length;
    if (!list) return;

    if (!courseStates.length) {
      list.innerHTML = '<div class="empty">Los cursos aparecerán aquí cuando se publiquen o se active tu inscripción.</div>';
      return;
    }

    list.innerHTML = courseStates.map(state => {
      const c = state.course;
      const cover = safeUrl(c.cover_url);
      const progressText = state.canTrack
        ? `${state.completed} de ${state.total} lecciones completadas`
        : `${state.total} ${state.total === 1 ? 'lección' : 'lecciones'}`;
      const action = state.total
        ? `<button class="btn primary course-action" type="button" data-open-course="${c.id}">${state.canTrack && state.continueLesson ? 'Continuar curso' : 'Ver contenido'}</button>`
        : `<button class="btn outline course-action" type="button" data-open-course="${c.id}">Ver curso</button>`;
      return `<article class="course-card learning-course-card">
        ${cover ? `<img class="course-cover" src="${escapeHtml(cover)}" alt="Portada de ${escapeHtml(c.title)}" loading="lazy">` : ''}
        <div class="course-card-body">
          <div class="course-card-top"><span class="tag">${courseStatusLabel(state)}</span><span class="course-percent">${state.canTrack ? `${state.percent}%` : ''}</span></div>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.subtitle || c.description || 'Contenido de Academia Yamilet.')}</p>
          <div class="progress-track" aria-label="Progreso ${state.percent}%"><span style="width:${state.canTrack ? state.percent : 0}%"></span></div>
          <div class="course-meta"><span>${escapeHtml(progressText)}</span>${c.duration_label ? `<span>${escapeHtml(c.duration_label)}</span>` : ''}</div>
          ${action}
        </div>
      </article>`;
    }).join('');
  }

  function renderContinue() {
    const host = document.querySelector('[data-continue-card]');
    if (!host) return;
    const trackable = courseStates.filter(s => s.canTrack && s.total > 0);
    const active = trackable
      .filter(s => s.continueLesson)
      .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0))[0];

    if (!active) {
      const hasLessons = courseStates.some(s => s.total > 0);
      host.innerHTML = hasLessons
        ? '<div class="continue-card complete-state"><div><span class="eyebrow">Todo al día</span><h3>No tienes una lección pendiente</h3><p>Cuando exista una nueva lección disponible aparecerá aquí automáticamente.</p></div></div>'
        : '<div class="continue-card empty-state"><div><span class="eyebrow">Próximamente</span><h3>El espacio de aprendizaje ya está listo</h3><p>Método MES todavía no tiene módulos ni lecciones cargados. No agregamos contenido ficticio.</p></div></div>';
      return;
    }

    const lesson = active.continueLesson;
    const module = active.modules.find(m => m.id === lesson.module_id);
    host.innerHTML = `<article class="continue-card">
      <div class="continue-copy"><span class="eyebrow">${escapeHtml(active.course.title)}</span><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(module?.title || 'Siguiente lección')} · ${active.percent}% completado</p><div class="progress-track"><span style="width:${active.percent}%"></span></div></div>
      <button class="btn primary" type="button" data-open-lesson="${lesson.id}" data-course-id="${active.course.id}">Continuar</button>
    </article>`;
  }

  function renderLearningDashboard() {
    renderCourses();
    renderContinue();
    const overall = document.querySelector('[data-overall-progress]');
    if (overall) overall.textContent = `${overallProgress()}%`;
    wireLearningActions();

    if (selectedCourseId) renderCourseDetail(selectedCourseId);
    if (selectedCourseId && selectedLessonId) renderLessonDetail(selectedCourseId, selectedLessonId);
  }

  function stateFor(courseId) {
    return courseStates.find(s => s.course.id === courseId) || null;
  }

  function lessonIcon(type) {
    return ({ video: '▶', text: 'Aa', audio: '♫', download: '↓', quiz: '?', live: '●' })[type] || '•';
  }

  function renderCourseDetail(courseId) {
    const state = stateFor(courseId);
    const host = document.querySelector('[data-course-detail]');
    if (!state || !host) return;
    selectedCourseId = courseId;
    selectedLessonId = null;
    lessonView?.classList.add('hidden');
    courseView?.classList.remove('hidden');

    const moduleHtml = state.modules.length ? state.modules.map(module => {
      const lessons = state.lessons.filter(l => l.module_id === module.id);
      const done = lessons.filter(l => state.progressById.get(l.id)?.completed).length;
      return `<article class="module-block">
        <div class="module-head"><div><span class="module-label">Módulo ${escapeHtml(module.position || '')}</span><h3>${escapeHtml(module.title)}</h3>${module.description ? `<p>${escapeHtml(module.description)}</p>` : ''}</div><span>${done}/${lessons.length}</span></div>
        <div class="lesson-list">${lessons.length ? lessons.map(lesson => {
          const completed = !!state.progressById.get(lesson.id)?.completed;
          return `<button class="lesson-row ${completed ? 'is-complete' : ''}" type="button" data-open-lesson="${lesson.id}" data-course-id="${courseId}">
            <span class="lesson-type">${lessonIcon(lesson.lesson_type)}</span><span class="lesson-copy"><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.duration_minutes ? `${lesson.duration_minutes} min` : escapeHtml(lesson.lesson_type || 'lección')}</small></span><span class="lesson-check">${completed ? '✓' : '→'}</span>
          </button>`;
        }).join('') : '<div class="module-empty">Este módulo todavía no tiene lecciones.</div>'}</div>
      </article>`;
    }).join('') : '<div class="empty">Este curso todavía no tiene módulos. Cuando carguemos el contenido real aparecerá aquí automáticamente.</div>';

    host.innerHTML = `<div class="course-detail-head"><div><span class="eyebrow">${courseStatusLabel(state)}</span><h2>${escapeHtml(state.course.title)}</h2><p>${escapeHtml(state.course.description || state.course.subtitle || 'Curso de Academia Yamilet.')}</p></div><div class="progress-orb"><strong>${state.percent}%</strong><span>progreso</span></div></div>
      <div class="progress-track large"><span style="width:${state.canTrack ? state.percent : 0}%"></span></div>
      <div class="syllabus">${moduleHtml}</div>`;
    wireLearningActions();
  }

  function videoMarkup(url) {
    const clean = safeUrl(url);
    if (!clean) return '';
    try {
      const parsed = new URL(clean);
      let id = '';
      if (parsed.hostname.includes('youtu.be')) id = parsed.pathname.slice(1).split('/')[0];
      if (parsed.hostname.includes('youtube.com')) id = parsed.searchParams.get('v') || (parsed.pathname.startsWith('/embed/') ? parsed.pathname.split('/embed/')[1] : '');
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `<div class="video-shell"><iframe src="https://www.youtube.com/embed/${id}" title="Video de la lección" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
      if (parsed.hostname.includes('vimeo.com')) {
        const vimeoId = parsed.pathname.split('/').filter(Boolean).pop();
        if (/^\d+$/.test(vimeoId || '')) return `<div class="video-shell"><iframe src="https://player.vimeo.com/video/${vimeoId}" title="Video de la lección" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
      }
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(clean)) return `<video class="lesson-video" controls preload="metadata" src="${escapeHtml(clean)}"></video>`;
      return `<a class="btn outline" href="${escapeHtml(clean)}" target="_blank" rel="noopener noreferrer">Abrir contenido multimedia</a>`;
    } catch { return ''; }
  }

  function renderLessonDetail(courseId, lessonId) {
    const state = stateFor(courseId);
    const host = document.querySelector('[data-lesson-detail]');
    if (!state || !host) return;
    const lessonIndex = state.lessons.findIndex(l => l.id === lessonId);
    if (lessonIndex < 0) return;
    const lesson = state.lessons[lessonIndex];
    const module = state.modules.find(m => m.id === lesson.module_id);
    const progress = state.progressById.get(lesson.id);
    selectedCourseId = courseId;
    selectedLessonId = lessonId;
    courseView?.classList.add('hidden');
    lessonView?.classList.remove('hidden');

    const media = lesson.video_url ? videoMarkup(lesson.video_url) : '';
    const body = lesson.content_html ? sanitizeHtml(lesson.content_html) : (lesson.description ? `<p>${escapeHtml(lesson.description)}</p>` : '<p class="muted">Esta lección aún no tiene contenido de texto cargado.</p>');
    const trackAction = state.canTrack
      ? `<button class="btn ${progress?.completed ? 'outline' : 'primary'}" type="button" data-toggle-complete="${lesson.id}" data-course-id="${courseId}">${progress?.completed ? '✓ Lección completada · marcar pendiente' : 'Marcar lección como completada'}</button>`
      : '<span class="staff-preview">Vista previa de staff · el progreso solo se registra para alumnos inscritos.</span>';
    const prev = state.lessons[lessonIndex - 1];
    const next = state.lessons[lessonIndex + 1];

    host.innerHTML = `<div class="lesson-breadcrumb"><span>${escapeHtml(state.course.title)}</span><span>›</span><span>${escapeHtml(module?.title || 'Módulo')}</span></div>
      <div class="lesson-title"><div><span class="eyebrow">${escapeHtml(lesson.lesson_type || 'Lección')}</span><h2>${escapeHtml(lesson.title)}</h2><p>${lesson.duration_minutes ? `${lesson.duration_minutes} minutos` : 'A tu ritmo'}</p></div><span class="lesson-complete-badge ${progress?.completed ? 'done' : ''}">${progress?.completed ? 'Completada' : 'Pendiente'}</span></div>
      ${media}
      <article class="lesson-content">${body}</article>
      ${lesson.transcript_text ? `<details class="transcript"><summary>Ver transcripción</summary><p>${escapeHtml(lesson.transcript_text).replace(/\n/g, '<br>')}</p></details>` : ''}
      <div class="lesson-actions">${trackAction}</div>
      <div class="lesson-nav">${prev ? `<button class="btn outline" type="button" data-open-lesson="${prev.id}" data-course-id="${courseId}">← ${escapeHtml(prev.title)}</button>` : '<span></span>'}${next ? `<button class="btn outline" type="button" data-open-lesson="${next.id}" data-course-id="${courseId}">${escapeHtml(next.title)} →</button>` : '<span></span>'}</div>`;
    wireLearningActions();
  }

  async function toggleLesson(courseId, lessonId) {
    const state = stateFor(courseId);
    if (!state?.canTrack || !currentUser) return;
    const existing = state.progressById.get(lessonId);
    const completed = !existing?.completed;
    const now = new Date().toISOString();
    const { error } = await sb.from('lesson_progress').upsert({
      user_id: currentUser.id,
      lesson_id: lessonId,
      completed,
      progress_seconds: existing?.progress_seconds || 0,
      completed_at: completed ? now : null,
      updated_at: now
    }, { onConflict: 'user_id,lesson_id' });
    if (error) {
      alert('No fue posible actualizar tu progreso. Verifica que tu inscripción siga activa.');
      return;
    }
    await refreshLearningState();
  }

  function wireLearningActions() {
    document.querySelectorAll('[data-open-course]').forEach(btn => btn.onclick = () => {
      renderCourseDetail(btn.dataset.openCourse);
      courseView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.querySelectorAll('[data-open-lesson]').forEach(btn => btn.onclick = () => {
      renderLessonDetail(btn.dataset.courseId, btn.dataset.openLesson);
      lessonView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.querySelectorAll('[data-toggle-complete]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      await toggleLesson(btn.dataset.courseId, btn.dataset.toggleComplete);
      btn.disabled = false;
    });
  }

  async function loadBookings() {
    const list = document.querySelector('[data-booking-list]');
    const count = document.querySelector('[data-booking-count]');
    if (!list) return;
    const { data, error } = await sb.from('free_class_bookings')
      .select('id,booking_date,full_name,email,status')
      .eq('workspace_id', workspace.id)
      .order('booking_date', { ascending: true }).limit(100);
    if (error) { list.innerHTML = '<div class="empty">No fue posible cargar las reservaciones.</div>'; return; }
    if (count) count.textContent = (data || []).filter(x => x.status === 'requested').length;
    if (!data?.length) { list.innerHTML = '<div class="empty">Todavía no hay solicitudes de clase gratuita.</div>'; return; }
    list.innerHTML = data.map(b => `<article class="booking-row"><strong>${formatDate(b.booking_date)}</strong><span>${escapeHtml(b.full_name)}</span><span>${escapeHtml(b.email)}</span><select data-booking-status="${b.id}"><option value="requested" ${b.status === 'requested' ? 'selected' : ''}>Solicitada</option><option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmada</option><option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completada</option><option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelada</option></select></article>`).join('');
    list.querySelectorAll('[data-booking-status]').forEach(select => select.addEventListener('change', async () => {
      select.disabled = true;
      const { error: updateError } = await sb.from('free_class_bookings').update({ status: select.value }).eq('workspace_id', workspace.id).eq('id', select.dataset.bookingStatus);
      select.disabled = false;
      if (updateError) alert('No fue posible actualizar la reservación.'); else await loadBookings();
    }));
  }

  async function loadDashboard(user) {
    if (!user || dashboardLoading || recoveryMode) return;
    dashboardLoading = true;
    try {
      currentUser = user;
      const [{ data: profile }, { data: ws, error: wsError }] = await Promise.all([
        sb.from('profiles').select('full_name,role,email').eq('id', user.id).maybeSingle(),
        sb.from('workspaces').select('id,name,slug,accent_color').eq('slug', workspaceSlug).maybeSingle()
      ]);
      if (wsError || !ws) { setStatus('No se encontró la configuración de Academia Yamilet.'); showView(authView); return; }
      currentProfile = profile;
      workspace = ws;
      const { data: member } = await sb.from('workspace_members').select('role,status').eq('workspace_id', ws.id).eq('user_id', user.id).maybeSingle();
      membership = member?.status === 'active' ? member : null;
      visibleCourses = await fetchVisibleCourses(ws.id);
      const isPlatformAdmin = profile?.role === 'admin';
      const isWorkspaceStaff = !!membership && ['owner', 'admin', 'instructor'].includes(membership.role);
      const canManageBookings = isPlatformAdmin || (!!membership && ['owner', 'admin'].includes(membership.role));
      const hasAcademyAccess = isPlatformAdmin || isWorkspaceStaff || visibleCourses.length > 0;
      if (!hasAcademyAccess) { showView(deniedView); return; }

      document.querySelector('[data-user-name]').textContent = profile?.full_name || user.email?.split('@')[0] || 'Alumno';
      document.querySelector('[data-user-role]').textContent = `${ws.name} · ${membership?.role || profile?.role || 'alumno'}`;
      setManagerVisibility(canManageBookings);
      showView(dashboard);
      await refreshLearningState();
      if (canManageBookings) await loadBookings();
    } catch (error) {
      console.error('Academia Yamilet dashboard', error);
      setStatus('No fue posible cargar tu Academia. Intenta nuevamente.');
      showView(authView);
    } finally { dashboardLoading = false; }
  }

  function accountEmail() {
    return String(loginForm?.querySelector('input[name=email]')?.value || '').trim().toLowerCase();
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    recoveryMode = false;
    selectedCourseId = null;
    selectedLessonId = null;
    setStatus('');
    showView(authView);
  }

  async function start() {
    try {
      await initSupabase();
      loginForm?.addEventListener('submit', async e => {
        e.preventDefault(); setStatus('Validando acceso…');
        const fd = new FormData(loginForm);
        const { data, error } = await sb.auth.signInWithPassword({ email: String(fd.get('email') || '').trim().toLowerCase(), password: String(fd.get('password') || '') });
        if (error) { setStatus('No se pudo iniciar sesión. Revisa tus datos o recupera tu contraseña.'); return; }
        setStatus('Acceso correcto.', true); await loadDashboard(data.user);
      });
      magicBtn?.addEventListener('click', async () => {
        const email = accountEmail(); if (!email) { setStatus('Escribe primero tu correo.'); return; }
        setStatus('Enviando enlace seguro…');
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: new URL('./', window.location.href).href, shouldCreateUser: false } });
        setStatus(error ? 'No fue posible enviar el enlace. Verifica que el correo esté registrado.' : 'Revisa tu correo. Te enviamos un enlace de acceso.', !error);
      });
      recoveryBtn?.addEventListener('click', async () => {
        const email = accountEmail(); if (!email) { setStatus('Escribe primero tu correo para recuperar la contraseña.'); return; }
        setStatus('Preparando recuperación segura…');
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('./?recovery=1', window.location.href).href });
        setStatus(error ? 'No fue posible iniciar la recuperación. Intenta nuevamente.' : 'Revisa tu correo. Te enviamos el enlace para crear una nueva contraseña.', !error);
      });
      resetForm?.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(resetForm), password = String(fd.get('password') || ''), confirm = String(fd.get('confirm_password') || '');
        if (password.length < 8) { setResetStatus('La contraseña debe tener al menos 8 caracteres.'); return; }
        if (password !== confirm) { setResetStatus('Las contraseñas no coinciden.'); return; }
        setResetStatus('Guardando nueva contraseña…');
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) { setResetStatus('No fue posible actualizar la contraseña. Solicita un nuevo enlace.'); return; }
        setResetStatus('Contraseña actualizada correctamente.', true); recoveryMode = false; history.replaceState({}, '', new URL('./', window.location.href).href); resetForm.reset(); await loadDashboard(data.user);
      });

      signoutBtn?.addEventListener('click', signOut);
      deniedSignoutBtn?.addEventListener('click', signOut);
      document.querySelector('[data-back-courses]')?.addEventListener('click', () => { courseView?.classList.add('hidden'); selectedCourseId = null; document.querySelector('#mis-cursos')?.scrollIntoView({ behavior: 'smooth' }); });
      document.querySelector('[data-back-course]')?.addEventListener('click', () => { lessonView?.classList.add('hidden'); if (selectedCourseId) { renderCourseDetail(selectedCourseId); courseView?.scrollIntoView({ behavior: 'smooth' }); } });
      document.querySelector('[data-scroll-home]')?.addEventListener('click', () => document.querySelector('#inicio')?.scrollIntoView({ behavior: 'smooth' }));
      document.querySelector('[data-scroll-continue]')?.addEventListener('click', () => document.querySelector('#continuar')?.scrollIntoView({ behavior: 'smooth' }));
      document.querySelector('[data-scroll-courses]')?.addEventListener('click', () => document.querySelector('#mis-cursos')?.scrollIntoView({ behavior: 'smooth' }));
      document.querySelector('[data-scroll-bookings]')?.addEventListener('click', () => document.querySelector('#reservas')?.scrollIntoView({ behavior: 'smooth' }));

      sb.auth.onAuthStateChange((event, session) => setTimeout(async () => {
        if (event === 'PASSWORD_RECOVERY') { recoveryMode = true; setResetStatus(''); showView(resetView); return; }
        if (event === 'SIGNED_OUT') { recoveryMode = false; showView(authView); return; }
        if (session?.user && !recoveryMode && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) await loadDashboard(session.user);
      }, 0));

      const { data } = await sb.auth.getSession();
      const recoveryHint = new URLSearchParams(location.search).get('recovery') === '1';
      if (recoveryHint && data.session?.user) { recoveryMode = true; showView(resetView); }
      else if (data.session?.user) await loadDashboard(data.session.user);
      else showView(authView);
    } catch (error) {
      console.error('Academia Yamilet init', error);
      setStatus('No fue posible conectar con Academia Yamilet. Intenta nuevamente en unos minutos.');
      showView(authView);
    }
  }

  start();
})();
