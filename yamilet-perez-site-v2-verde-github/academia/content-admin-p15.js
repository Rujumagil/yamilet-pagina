(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const nav = document.querySelector('[data-content-admin-nav]');
  const section = document.querySelector('[data-content-admin]');
  const root = document.querySelector('[data-content-admin-root]');
  if (!section || !root) return;

  let sb;
  let workspace;
  let currentUser;
  let currentProfile;
  let membership;
  let courses = [];
  let selectedCourseId = null;
  let modules = [];
  let lessons = [];
  let resources = [];
  let lessonEditorState = null;

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const safeFileName = (value = 'archivo') => String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'archivo';

  const isStaff = () => currentProfile?.role === 'admin' || (!!membership && ['owner','admin','instructor'].includes(membership.role));
  const selectedCourse = () => courses.find(c => c.id === selectedCourseId) || null;
  const lessonsFor = moduleId => lessons.filter(l => l.module_id === moduleId).sort((a,b) => (a.position||0)-(b.position||0));
  const statusClass = status => status === 'published' ? '' : status === 'archived' ? 'archived' : 'draft';
  const lessonIcon = type => ({video:'▶',text:'Aa',audio:'♫',download:'↓',quiz:'?',live:'●'})[type] || '•';

  function setAdminStatus(message = '', ok = false) {
    const el = document.querySelector('[data-content-admin-status]');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('ok', !!ok);
  }

  function showAdmin(show) {
    section.classList.toggle('hidden', !show);
    nav?.classList.toggle('hidden', !show);
  }

  async function initClient() {
    const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('config_unavailable');
    const cfg = await response.json();
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return cfg.workspaceSlug || 'yamilet-mes';
  }

  async function bootstrap() {
    try {
      const workspaceSlug = await initClient();
      const { data: sessionData } = await sb.auth.getSession();
      currentUser = sessionData.session?.user || null;
      if (!currentUser) { showAdmin(false); return; }

      const [{ data: profile }, { data: ws }] = await Promise.all([
        sb.from('profiles').select('full_name,role,email').eq('id', currentUser.id).maybeSingle(),
        sb.from('workspaces').select('id,name,slug').eq('slug', workspaceSlug).maybeSingle()
      ]);
      currentProfile = profile;
      workspace = ws;
      if (!workspace) { showAdmin(false); return; }

      const { data: member } = await sb.from('workspace_members')
        .select('role,status').eq('workspace_id', workspace.id).eq('user_id', currentUser.id).maybeSingle();
      membership = member?.status === 'active' ? member : null;
      if (!isStaff()) { showAdmin(false); return; }

      showAdmin(true);
      nav?.addEventListener('click', () => section.scrollIntoView({ behavior:'smooth', block:'start' }));
      await loadCourses();
    } catch (error) {
      console.error('Yamilet content admin init', error);
      showAdmin(false);
    }
  }

  async function loadCourses() {
    const { data, error } = await sb.from('courses')
      .select('id,title,slug,subtitle,description,cover_url,cover_path,status,featured,instructor_name,duration_label,updated_at')
      .eq('workspace_id', workspace.id)
      .order('featured', { ascending:false }).order('created_at', { ascending:true });
    if (error) throw error;
    courses = data || [];
    if (!selectedCourseId || !courses.some(c => c.id === selectedCourseId)) selectedCourseId = courses[0]?.id || null;
    await loadCourseData();
  }

  async function loadCourseData() {
    lessonEditorState = null;
    if (!selectedCourseId) {
      modules = []; lessons = []; resources = [];
      render();
      return;
    }

    const [{ data: moduleRows, error: moduleError }, { data: resourceRows, error: resourceError }] = await Promise.all([
      sb.from('modules').select('id,course_id,title,description,position,created_at').eq('course_id', selectedCourseId).order('position'),
      sb.from('resources').select('id,course_id,lesson_id,title,description,resource_type,file_path,external_url,is_public,position,created_at').eq('course_id', selectedCourseId).order('position').order('created_at')
    ]);
    if (moduleError) throw moduleError;
    if (resourceError) throw resourceError;
    modules = moduleRows || [];
    resources = resourceRows || [];

    const moduleIds = modules.map(m => m.id);
    if (moduleIds.length) {
      const { data, error } = await sb.from('lessons')
        .select('id,module_id,title,description,lesson_type,video_url,content_html,duration_minutes,position,is_preview,transcript_text,captions_url,accessibility_notes,media_path,media_bucket,media_mime_type,media_filename,updated_at')
        .in('module_id', moduleIds);
      if (error) throw error;
      lessons = (data || []).sort((a,b) => {
        const ma = modules.find(m => m.id === a.module_id)?.position || 0;
        const mb = modules.find(m => m.id === b.module_id)?.position || 0;
        return ma-mb || (a.position||0)-(b.position||0);
      });
    } else lessons = [];
    render();
  }

  function render() {
    if (!selectedCourseId) {
      root.innerHTML = '<div class="empty">No hay cursos en Academia Yamilet.</div>';
      return;
    }
    const course = selectedCourse();
    const courseLessons = lessons.length;
    const resourceLessonOptions = lessons.map(l => `<option value="${l.id}">${escapeHtml(modules.find(m => m.id===l.module_id)?.title || 'Módulo')} · ${escapeHtml(l.title)}</option>`).join('');

    root.innerHTML = `
      <div class="admin-toolbar">
        <div><div class="kicker">Gestión académica</div><h2 style="margin:6px 0 0">Administrador de contenido</h2></div>
        <select data-admin-course-select aria-label="Seleccionar curso">${courses.map(c => `<option value="${c.id}" ${c.id===selectedCourseId?'selected':''}>${escapeHtml(c.title)}</option>`).join('')}</select>
      </div>
      <p class="admin-status" data-content-admin-status aria-live="polite"></p>

      <div class="course-admin-summary">
        <div><span>Estado</span><strong><span class="admin-chip ${statusClass(course.status)}">${escapeHtml(course.status)}</span></strong></div>
        <div><span>Módulos</span><strong>${modules.length}</strong></div>
        <div><span>Lecciones</span><strong>${courseLessons}</strong></div>
        <div><span>Recursos</span><strong>${resources.length}</strong></div>
      </div>

      <div class="admin-grid">
        <article class="admin-card">
          <div class="kicker">Curso</div><h3>Información de ${escapeHtml(course.title)}</h3>
          <form class="admin-form two" data-course-admin-form>
            <label>Título<input name="title" required maxlength="160" value="${escapeHtml(course.title)}"></label>
            <label>Quién imparte<input name="instructor_name" maxlength="120" value="${escapeHtml(course.instructor_name || '')}"></label>
            <label class="admin-span-2">Subtítulo<input name="subtitle" maxlength="220" value="${escapeHtml(course.subtitle || '')}"></label>
            <label class="admin-span-2">Descripción<textarea name="description" maxlength="3000">${escapeHtml(course.description || '')}</textarea></label>
            <label>Duración visible<input name="duration_label" maxlength="80" placeholder="Ej. 8 semanas" value="${escapeHtml(course.duration_label || '')}"></label>
            <label class="check-line" style="align-content:end"><span><input type="checkbox" name="featured" ${course.featured?'checked':''}> Curso destacado</span></label>
            <div class="admin-span-2 cover-admin">
              ${course.cover_url ? `<img src="${escapeHtml(course.cover_url)}" alt="Portada actual">` : '<div class="empty">Sin portada</div>'}
              <label>Nueva portada (JPG/PNG/WebP, máx. 5 MB)<input type="file" name="cover_file" accept="image/jpeg,image/png,image/webp"><span class="upload-note">La portada se guarda en el bucket público course-media bajo el curso actual.</span></label>
            </div>
            <div class="admin-actions end admin-span-2"><button class="btn primary" type="submit">Guardar curso</button></div>
          </form>
          <div class="publish-line"><div><strong>${course.status==='published'?'Curso publicado':'Curso no publicado'}</strong><div class="upload-note">Para publicar debe existir al menos un módulo y una lección.</div></div><button class="mini-btn ${course.status==='published'?'warn':'primary-mini'}" type="button" data-toggle-publication>${course.status==='published'?'Volver a borrador':'Publicar curso'}</button></div>
        </article>

        <article class="admin-card">
          <div class="kicker">Estructura</div><h3>Crear módulo</h3>
          <form class="admin-form" data-create-module-form>
            <label>Título del módulo<input name="title" required maxlength="160" placeholder="Nombre real del módulo"></label>
            <label>Descripción<textarea name="description" maxlength="1200" placeholder="Objetivo o descripción del módulo"></textarea></label>
            <button class="btn primary" type="submit">Agregar módulo</button>
          </form>
          <div class="admin-divider"></div>
          <div class="upload-note">No se genera contenido automáticamente. Los módulos y lecciones se crean únicamente con la información que cargue el equipo.</div>
        </article>
      </div>

      <article class="admin-card" style="margin-top:18px">
        <div class="kicker">Temario</div><h3>Módulos y lecciones</h3>
        <div class="module-admin-list">${renderModules()}</div>
        <div class="editor-shell ${lessonEditorState?'':'hidden'}" data-lesson-editor>${lessonEditorState ? renderLessonEditor() : ''}</div>
      </article>

      <article class="admin-card" style="margin-top:18px">
        <div class="kicker">Biblioteca del curso</div><h3>Recursos descargables</h3>
        <form class="admin-form two" data-resource-form>
          <label>Título<input name="title" required maxlength="160" placeholder="Nombre del recurso"></label>
          <label>Tipo<select name="resource_type"><option value="pdf">PDF</option><option value="audio">Audio</option><option value="video">Video</option><option value="template">Plantilla</option><option value="book">Libro</option><option value="image">Imagen</option><option value="link">Enlace</option></select></label>
          <label class="admin-span-2">Descripción<textarea name="description" maxlength="1200"></textarea></label>
          <label>Vincular a lección<select name="lesson_id"><option value="">Recurso general del curso</option>${resourceLessonOptions}</select></label>
          <label>Enlace externo<input name="external_url" type="url" placeholder="https://..."></label>
          <label class="admin-span-2">Archivo<input name="resource_file" type="file" accept="application/pdf,audio/*,video/mp4,video/webm,image/jpeg,image/png,image/webp,.zip,.epub"><span class="upload-note">Los archivos privados se guardan en digital-products. Puedes usar archivo o enlace externo.</span></label>
          <div class="admin-actions end admin-span-2"><button class="btn primary" type="submit">Agregar recurso</button></div>
        </form>
        <div class="resource-admin-list">${renderResources()}</div>
      </article>`;

    wireEvents();
  }

  function renderModules() {
    if (!modules.length) return '<div class="empty">Todavía no hay módulos. Crea el primero con el nombre real del contenido.</div>';
    return modules.map((module, index) => {
      const rows = lessonsFor(module.id);
      return `<article class="module-admin">
        <div class="module-admin-head">
          <div class="module-admin-copy"><small>Módulo ${index+1}</small><h4>${escapeHtml(module.title)}</h4><p>${escapeHtml(module.description || 'Sin descripción.')}</p></div>
          <div class="admin-actions"><button class="mini-btn" type="button" data-move-module="${module.id}" data-delta="-1" ${index===0?'disabled':''}>↑</button><button class="mini-btn" type="button" data-move-module="${module.id}" data-delta="1" ${index===modules.length-1?'disabled':''}>↓</button><button class="mini-btn" type="button" data-toggle-module-edit="${module.id}">Editar</button><button class="mini-btn primary-mini" type="button" data-new-lesson="${module.id}">+ Lección</button></div>
        </div>
        <form class="admin-form two hidden" data-module-edit-form="${module.id}" style="padding:0 16px 16px"><label>Título<input name="title" required maxlength="160" value="${escapeHtml(module.title)}"></label><label class="admin-span-2">Descripción<textarea name="description" maxlength="1200">${escapeHtml(module.description || '')}</textarea></label><div class="admin-actions end admin-span-2"><button class="mini-btn primary-mini" type="submit">Guardar módulo</button></div></form>
        <div class="module-admin-lessons">${rows.length ? rows.map((lesson, lessonIndex) => `<div class="lesson-admin-row"><span class="lesson-admin-icon">${lessonIcon(lesson.lesson_type)}</span><span class="lesson-admin-copy"><strong>${escapeHtml(lesson.title)}</strong><small>${escapeHtml(lesson.lesson_type)}${lesson.duration_minutes?` · ${lesson.duration_minutes} min`:''}${lesson.media_path?' · archivo cargado':''}</small></span><span class="admin-actions"><button class="mini-btn" type="button" data-move-lesson="${lesson.id}" data-module-id="${module.id}" data-delta="-1" ${lessonIndex===0?'disabled':''}>↑</button><button class="mini-btn" type="button" data-move-lesson="${lesson.id}" data-module-id="${module.id}" data-delta="1" ${lessonIndex===rows.length-1?'disabled':''}>↓</button><button class="mini-btn" type="button" data-edit-lesson="${lesson.id}">Editar</button></span></div>`).join('') : '<div class="lesson-admin-empty">Este módulo todavía no tiene lecciones.</div>'}</div>
      </article>`;
    }).join('');
  }

  function renderLessonEditor() {
    const lesson = lessonEditorState.lesson || null;
    const moduleId = lessonEditorState.moduleId;
    return `<div class="editor-head"><div><div class="kicker">${lesson?'Editar lección':'Nueva lección'}</div><h3>${lesson ? escapeHtml(lesson.title) : 'Agregar contenido al módulo'}</h3></div><button class="mini-btn" type="button" data-cancel-lesson>Cancelar</button></div>
      <form class="admin-form two" data-lesson-form>
        <input type="hidden" name="lesson_id" value="${lesson?.id || ''}"><input type="hidden" name="module_id" value="${moduleId}">
        <label>Título<input name="title" required maxlength="180" value="${escapeHtml(lesson?.title || '')}"></label>
        <label>Tipo<select name="lesson_type"><option value="video" ${lesson?.lesson_type==='video'?'selected':''}>Video</option><option value="text" ${lesson?.lesson_type==='text'?'selected':''}>Texto</option><option value="audio" ${lesson?.lesson_type==='audio'?'selected':''}>Audio</option><option value="download" ${lesson?.lesson_type==='download'?'selected':''}>Descargable</option><option value="live" ${lesson?.lesson_type==='live'?'selected':''}>En vivo</option><option value="quiz" ${lesson?.lesson_type==='quiz'?'selected':''}>Evaluación</option></select></label>
        <label class="admin-span-2">Descripción<textarea name="description" maxlength="1600">${escapeHtml(lesson?.description || '')}</textarea></label>
        <label>Duración en minutos<input name="duration_minutes" type="number" min="0" max="1440" value="${lesson?.duration_minutes || 0}"></label>
        <label>Video/enlace externo<input name="video_url" type="url" value="${escapeHtml(lesson?.video_url || '')}" placeholder="YouTube, Vimeo o URL externa"></label>
        <label class="admin-span-2">Contenido de texto / HTML<textarea class="code-field" name="content_html" placeholder="Texto, párrafos y HTML básico">${escapeHtml(lesson?.content_html || '')}</textarea></label>
        <label class="admin-span-2">Transcripción<textarea name="transcript_text">${escapeHtml(lesson?.transcript_text || '')}</textarea></label>
        <label>Subtítulos / captions URL<input name="captions_url" type="url" value="${escapeHtml(lesson?.captions_url || '')}"></label>
        <label>Notas de accesibilidad<input name="accessibility_notes" value="${escapeHtml(lesson?.accessibility_notes || '')}"></label>
        <label class="admin-span-2">Archivo de la lección<input name="lesson_media" type="file" accept="video/mp4,video/webm,video/quicktime,audio/*,application/pdf,image/jpeg,image/png,image/webp"><span class="upload-note">Video/audio/PDF privado, máximo 250 MB. Se entrega al estudiante mediante URL firmada temporal.</span>${lesson?.media_filename?`<span class="upload-note">Actual: ${escapeHtml(lesson.media_filename)}</span>`:''}</label>
        <label class="admin-span-2"><span><input type="checkbox" name="is_preview" ${lesson?.is_preview?'checked':''}> Permitir vista previa cuando aplique</span></label>
        <div class="admin-actions end admin-span-2">${lesson?.media_path?'<button class="mini-btn" type="button" data-preview-media>Previsualizar archivo</button>':''}<button class="btn primary" type="submit">${lesson?'Guardar cambios':'Crear lección'}</button></div>
      </form>`;
  }

  function renderResources() {
    if (!resources.length) return '<div class="empty">No hay recursos cargados todavía.</div>';
    return resources.map(resource => {
      const lesson = resource.lesson_id ? lessons.find(l => l.id === resource.lesson_id) : null;
      return `<div class="resource-admin-row"><div><strong>${escapeHtml(resource.title)}</strong><small>${escapeHtml(resource.resource_type)}${lesson?` · ${escapeHtml(lesson.title)}`:' · Recurso general'}${resource.file_path?' · archivo privado':resource.external_url?' · enlace externo':''}</small></div><button class="mini-btn" type="button" data-open-resource="${resource.id}">Abrir</button></div>`;
    }).join('');
  }

  function wireEvents() {
    root.querySelector('[data-admin-course-select]')?.addEventListener('change', async e => {
      selectedCourseId = e.target.value;
      setAdminStatus('Cargando curso…');
      await loadCourseData();
      setAdminStatus('');
    });

    root.querySelector('[data-course-admin-form]')?.addEventListener('submit', saveCourse);
    root.querySelector('[data-toggle-publication]')?.addEventListener('click', togglePublication);
    root.querySelector('[data-create-module-form]')?.addEventListener('submit', createModule);
    root.querySelector('[data-resource-form]')?.addEventListener('submit', createResource);

    root.querySelectorAll('[data-toggle-module-edit]').forEach(btn => btn.addEventListener('click', () => {
      root.querySelector(`[data-module-edit-form="${btn.dataset.toggleModuleEdit}"]`)?.classList.toggle('hidden');
    }));
    root.querySelectorAll('[data-module-edit-form]').forEach(form => form.addEventListener('submit', updateModule));
    root.querySelectorAll('[data-move-module]').forEach(btn => btn.addEventListener('click', () => moveModule(btn.dataset.moveModule, Number(btn.dataset.delta))));
    root.querySelectorAll('[data-new-lesson]').forEach(btn => btn.addEventListener('click', () => openLessonEditor(btn.dataset.newLesson)));
    root.querySelectorAll('[data-edit-lesson]').forEach(btn => btn.addEventListener('click', () => openLessonEditor(null, btn.dataset.editLesson)));
    root.querySelectorAll('[data-move-lesson]').forEach(btn => btn.addEventListener('click', () => moveLesson(btn.dataset.moduleId, btn.dataset.moveLesson, Number(btn.dataset.delta))));
    root.querySelectorAll('[data-open-resource]').forEach(btn => btn.addEventListener('click', () => openResource(btn.dataset.openResource)));

    root.querySelector('[data-cancel-lesson]')?.addEventListener('click', () => { lessonEditorState = null; render(); });
    root.querySelector('[data-lesson-form]')?.addEventListener('submit', saveLesson);
    root.querySelector('[data-preview-media]')?.addEventListener('click', previewLessonMedia);
  }

  async function saveCourse(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const course = selectedCourse();
    setAdminStatus('Guardando curso…');
    const update = {
      title: String(fd.get('title') || '').trim(),
      instructor_name: String(fd.get('instructor_name') || '').trim() || null,
      subtitle: String(fd.get('subtitle') || '').trim() || null,
      description: String(fd.get('description') || '').trim() || null,
      duration_label: String(fd.get('duration_label') || '').trim() || null,
      featured: fd.get('featured') === 'on',
      updated_at: new Date().toISOString()
    };

    const cover = form.elements.cover_file?.files?.[0];
    if (cover) {
      if (cover.size > 5 * 1024 * 1024) { setAdminStatus('La portada supera 5 MB.'); return; }
      const path = `courses/${course.id}/cover/${Date.now()}-${safeFileName(cover.name)}`;
      const { error: uploadError } = await sb.storage.from('course-media').upload(path, cover, { contentType:cover.type, upsert:false });
      if (uploadError) { setAdminStatus(`No fue posible subir la portada: ${uploadError.message}`); return; }
      const { data: publicData } = sb.storage.from('course-media').getPublicUrl(path);
      update.cover_path = path;
      update.cover_url = publicData.publicUrl;
    }

    const { error } = await sb.from('courses').update(update).eq('id', course.id).eq('workspace_id', workspace.id);
    if (error) { setAdminStatus(`No fue posible guardar: ${error.message}`); return; }
    setAdminStatus('Curso actualizado.', true);
    await loadCourses();
  }

  async function togglePublication() {
    const course = selectedCourse();
    const next = course.status === 'published' ? 'draft' : 'published';
    setAdminStatus(next === 'published' ? 'Validando y publicando…' : 'Regresando a borrador…');
    const { error } = await sb.rpc('set_academy_course_publication', { target_course:course.id, target_status:next });
    if (error) { setAdminStatus(error.message.includes('sin módulos') || error.message.includes('sin lecciones') ? error.message : `No fue posible cambiar el estado: ${error.message}`); return; }
    setAdminStatus(next === 'published' ? 'Curso publicado.' : 'Curso regresó a borrador.', true);
    await loadCourses();
  }

  async function createModule(event) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const title = String(fd.get('title') || '').trim();
    if (!title) return;
    setAdminStatus('Creando módulo…');
    const { error } = await sb.from('modules').insert({ course_id:selectedCourseId, title, description:String(fd.get('description') || '').trim() || null, position:modules.length + 1 });
    if (error) { setAdminStatus(`No fue posible crear el módulo: ${error.message}`); return; }
    setAdminStatus('Módulo creado.', true);
    await loadCourseData();
  }

  async function updateModule(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const id = form.dataset.moduleEditForm;
    setAdminStatus('Guardando módulo…');
    const { error } = await sb.from('modules').update({ title:String(fd.get('title') || '').trim(), description:String(fd.get('description') || '').trim() || null }).eq('id', id).eq('course_id', selectedCourseId);
    if (error) { setAdminStatus(`No fue posible guardar el módulo: ${error.message}`); return; }
    setAdminStatus('Módulo actualizado.', true);
    await loadCourseData();
  }

  async function moveModule(id, delta) {
    const ordered = [...modules].sort((a,b)=>(a.position||0)-(b.position||0));
    const index = ordered.findIndex(m => m.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setAdminStatus('Reordenando módulos…');
    const { error } = await sb.rpc('reorder_academy_modules', { target_course:selectedCourseId, ordered_ids:ordered.map(m=>m.id) });
    if (error) { setAdminStatus(`No fue posible reordenar: ${error.message}`); return; }
    setAdminStatus('Orden actualizado.', true);
    await loadCourseData();
  }

  function openLessonEditor(moduleId, lessonId = null) {
    const lesson = lessonId ? lessons.find(l => l.id === lessonId) : null;
    lessonEditorState = { moduleId:lesson?.module_id || moduleId, lesson };
    render();
    document.querySelector('[data-lesson-editor]')?.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  async function saveLesson(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    let lessonId = String(fd.get('lesson_id') || '');
    const moduleId = String(fd.get('module_id') || '');
    const existing = lessonId ? lessons.find(l => l.id === lessonId) : null;
    const payload = {
      module_id:moduleId,
      title:String(fd.get('title') || '').trim(),
      description:String(fd.get('description') || '').trim() || null,
      lesson_type:String(fd.get('lesson_type') || 'text'),
      video_url:String(fd.get('video_url') || '').trim() || null,
      content_html:String(fd.get('content_html') || '').trim() || null,
      duration_minutes:Math.max(0, Number(fd.get('duration_minutes') || 0)),
      is_preview:fd.get('is_preview') === 'on',
      transcript_text:String(fd.get('transcript_text') || '').trim() || null,
      captions_url:String(fd.get('captions_url') || '').trim() || null,
      accessibility_notes:String(fd.get('accessibility_notes') || '').trim() || null,
      updated_at:new Date().toISOString()
    };

    setAdminStatus(existing ? 'Guardando lección…' : 'Creando lección…');
    if (existing) {
      const { error } = await sb.from('lessons').update(payload).eq('id', lessonId).eq('module_id', moduleId);
      if (error) { setAdminStatus(`No fue posible guardar la lección: ${error.message}`); return; }
    } else {
      payload.position = lessonsFor(moduleId).length + 1;
      const { data, error } = await sb.from('lessons').insert(payload).select('id').single();
      if (error) { setAdminStatus(`No fue posible crear la lección: ${error.message}`); return; }
      lessonId = data.id;
    }

    const file = form.elements.lesson_media?.files?.[0];
    if (file) {
      if (file.size > 250 * 1024 * 1024) { setAdminStatus('La media supera el límite de 250 MB. La lección se guardó sin ese archivo.'); await loadCourseData(); return; }
      const path = `courses/${selectedCourseId}/lessons/${lessonId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await sb.storage.from('lesson-media').upload(path, file, { contentType:file.type || undefined, upsert:false });
      if (uploadError) { setAdminStatus(`La lección se guardó, pero el archivo no pudo subirse: ${uploadError.message}`); await loadCourseData(); return; }
      const { error: mediaUpdateError } = await sb.from('lessons').update({ media_path:path, media_bucket:'lesson-media', media_mime_type:file.type || null, media_filename:file.name, updated_at:new Date().toISOString() }).eq('id', lessonId);
      if (mediaUpdateError) { setAdminStatus(`El archivo subió, pero no se pudo vincular: ${mediaUpdateError.message}`); await loadCourseData(); return; }
    }

    setAdminStatus(existing ? 'Lección actualizada.' : 'Lección creada.', true);
    lessonEditorState = null;
    await loadCourseData();
  }

  async function moveLesson(moduleId, id, delta) {
    const ordered = lessonsFor(moduleId);
    const index = ordered.findIndex(l => l.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setAdminStatus('Reordenando lecciones…');
    const { error } = await sb.rpc('reorder_academy_lessons', { target_module:moduleId, ordered_ids:ordered.map(l=>l.id) });
    if (error) { setAdminStatus(`No fue posible reordenar: ${error.message}`); return; }
    setAdminStatus('Orden de lecciones actualizado.', true);
    await loadCourseData();
  }

  async function previewLessonMedia() {
    const lesson = lessonEditorState?.lesson;
    if (!lesson?.media_path) return;
    const bucket = lesson.media_bucket || 'lesson-media';
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(lesson.media_path, 600);
    if (error || !data?.signedUrl) { setAdminStatus('No fue posible generar la vista previa del archivo.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function createResource(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const externalUrl = String(fd.get('external_url') || '').trim() || null;
    const file = form.elements.resource_file?.files?.[0] || null;
    if (!file && !externalUrl) { setAdminStatus('Agrega un archivo o un enlace externo para el recurso.'); return; }

    const resourceId = crypto.randomUUID();
    let filePath = null;
    if (file) {
      if (file.size > 50 * 1024 * 1024) { setAdminStatus('El recurso supera el límite de 50 MB.'); return; }
      filePath = `courses/${selectedCourseId}/resources/${resourceId}/${Date.now()}-${safeFileName(file.name)}`;
      setAdminStatus('Subiendo recurso…');
      const { error: uploadError } = await sb.storage.from('digital-products').upload(filePath, file, { contentType:file.type || undefined, upsert:false });
      if (uploadError) { setAdminStatus(`No fue posible subir el recurso: ${uploadError.message}`); return; }
    }

    const { error } = await sb.from('resources').insert({
      id:resourceId,
      workspace_id:workspace.id,
      course_id:selectedCourseId,
      lesson_id:String(fd.get('lesson_id') || '') || null,
      title,
      description:String(fd.get('description') || '').trim() || null,
      resource_type:String(fd.get('resource_type') || 'pdf'),
      file_path:filePath,
      external_url:externalUrl,
      is_public:false,
      position:resources.length + 1,
      updated_at:new Date().toISOString()
    });
    if (error) {
      if (filePath) await sb.storage.from('digital-products').remove([filePath]);
      setAdminStatus(`No fue posible registrar el recurso: ${error.message}`);
      return;
    }
    setAdminStatus('Recurso agregado.', true);
    await loadCourseData();
  }

  async function openResource(id) {
    const resource = resources.find(r => r.id === id);
    if (!resource) return;
    if (resource.external_url) { window.open(resource.external_url, '_blank', 'noopener,noreferrer'); return; }
    if (!resource.file_path) { setAdminStatus('Este recurso todavía no tiene archivo.'); return; }
    const { data, error } = await sb.storage.from('digital-products').createSignedUrl(resource.file_path, 600);
    if (error || !data?.signedUrl) { setAdminStatus('No fue posible abrir el recurso.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  if (document.readyState === 'loading') {
    window.addEventListener('load', bootstrap, { once:true });
  } else {
    bootstrap();
  }
})();
