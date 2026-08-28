(() => {
  'use strict';

  const VERSION = '81.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) : 'Sin actividad';
  const initials = value => String(value || '?').trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
  const clampPct = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

  let client = null;
  let workspace = null;
  let session = null;
  let canView = false;
  let canManage = false;
  let courses = [];
  let directory = [];
  let invites = [];
  let searchValue = '';
  let courseFilter = 'all';
  let statusFilter = 'all';
  let inviteOpen = false;
  let inviteSeed = null;
  let activeStudentId = null;
  let recordCache = new Map();
  let booting = false;
  let booted = false;

  function host(){ return $('[data-students-admin-root]'); }
  function nav(){ return $('[data-students-admin-nav]'); }
  function section(){ return $('[data-students-admin]'); }
  function isStudentsRoute(){
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'students';
  }

  function statusLabel(status){
    return ({active:'Activo',paused:'Pausado',completed:'Completado',cancelled:'Cancelado'})[status] || String(status || 'Sin estado');
  }

  function statusClass(status){
    return ['active','paused','completed','cancelled'].includes(status) ? status : 'unknown';
  }

  function courseName(id){ return courses.find(course => course.id === id)?.title || 'Programa'; }

  function showAdmin(show){
    section()?.classList.toggle('hidden', !show);
    nav()?.classList.toggle('hidden', !show);
  }

  async function bootstrap(force = false){
    if (booting) return false;
    if (booted && !force) {
      if (isStudentsRoute()) showAdmin(true);
      return true;
    }
    booting = true;
    try {
      const cfgRes = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
      if(!cfgRes.ok) throw new Error('config_unavailable');
      const cfg = await cfgRes.json();
      client = window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const {data:{session:current}} = await client.auth.getSession();
      session = current;
      if(!session?.user) { showAdmin(false); return false; }

      const [{data:ws},{data:profile}] = await Promise.all([
        client.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug||'yamilet-mes').maybeSingle(),
        client.from('profiles').select('role').eq('id',session.user.id).maybeSingle()
      ]);
      if(!ws) { showAdmin(false); return false; }
      workspace = ws;
      const {data:member} = await client.from('workspace_members').select('role,status').eq('workspace_id',ws.id).eq('user_id',session.user.id).maybeSingle();
      canView = profile?.role === 'admin' || (member?.status === 'active' && ['owner','admin','instructor'].includes(member.role));
      canManage = profile?.role === 'admin' || (member?.status === 'active' && ['owner','admin'].includes(member.role));
      if(!canView) { showAdmin(false); return false; }

      showAdmin(true);
      await loadAll();
      booted = true;
      return true;
    } catch(error) {
      console.warn('Academia Yamilet students v81', error);
      const root = host();
      if (root) root.innerHTML = '<div class="students81-error"><strong>No fue posible cargar Estudiantes</strong><span>Revisa tu sesión e inténtalo nuevamente.</span></div>';
      return false;
    } finally {
      booting = false;
    }
  }

  async function loadAll(){
    if(!workspace || !client) return;
    const [courseRes,dirRes,inviteRes] = await Promise.all([
      client.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
      client.rpc('get_academy_student_directory',{target_workspace:workspace.id}),
      client.from('academy_student_invites').select('id,email,full_name,status,course_id,invited_at,last_sent_at,user_id').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(80)
    ]);
    if (courseRes.error) throw courseRes.error;
    if (dirRes.error) throw dirRes.error;
    courses = courseRes.data || [];
    directory = dirRes.data || [];
    invites = inviteRes.error ? [] : (inviteRes.data || []);
    recordCache.clear();
    render();
  }

  function groupedStudents(){
    const map = new Map();
    directory.forEach(row => {
      if (!map.has(row.user_id)) {
        map.set(row.user_id, {
          user_id: row.user_id,
          full_name: row.full_name || '',
          email: row.email || '',
          profile_status: row.profile_status || '',
          enrollments: [],
          last_activity: null
        });
      }
      const student = map.get(row.user_id);
      student.enrollments.push(row);
      if (row.last_activity && (!student.last_activity || new Date(row.last_activity) > new Date(student.last_activity))) student.last_activity = row.last_activity;
    });
    return [...map.values()].map(student => {
      const tracked = student.enrollments.filter(item => Number(item.total_lessons) > 0);
      student.progress_percent = tracked.length ? Math.round(tracked.reduce((sum,item) => sum + clampPct(item.progress_percent),0) / tracked.length) : 0;
      student.active_count = student.enrollments.filter(item => item.enrollment_status === 'active').length;
      student.completed_count = student.enrollments.filter(item => item.enrollment_status === 'completed').length;
      student.overall_status = student.active_count ? 'active' : student.enrollments.some(item => item.enrollment_status === 'paused') ? 'paused' : student.completed_count === student.enrollments.length && student.enrollments.length ? 'completed' : student.enrollments.some(item => item.enrollment_status === 'cancelled') ? 'cancelled' : 'active';
      return student;
    }).sort((a,b) => {
      const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0;
      const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0;
      return tb - ta || String(a.full_name || a.email).localeCompare(String(b.full_name || b.email),'es');
    });
  }

  function filteredStudents(){
    const q = searchValue.trim().toLowerCase();
    return groupedStudents().filter(student => {
      if (q) {
        const haystack = [student.full_name,student.email,...student.enrollments.map(item => item.course_title)].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (courseFilter !== 'all' && !student.enrollments.some(item => item.course_id === courseFilter)) return false;
      if (statusFilter !== 'all' && !student.enrollments.some(item => item.enrollment_status === statusFilter)) return false;
      return true;
    });
  }

  function summary(){
    const students = groupedStudents();
    const active = directory.filter(item => item.enrollment_status === 'active').length;
    const paused = directory.filter(item => item.enrollment_status === 'paused').length;
    const tracked = students.filter(item => item.enrollments.some(enrollment => Number(enrollment.total_lessons) > 0));
    const avg = tracked.length ? Math.round(tracked.reduce((sum,item) => sum + item.progress_percent,0) / tracked.length) : 0;
    return {students:students.length,active,paused,avg};
  }

  function render(){
    const root = host();
    if (!root) return;
    const stats = summary();
    const courseOptions = courses.map(course => `<option value="${esc(course.id)}" ${courseFilter===course.id?'selected':''}>${esc(course.title)}${course.status==='draft'?' · borrador':''}</option>`).join('');
    const inviteCourseOptions = courses.map(course => `<option value="${esc(course.id)}">${esc(course.title)}${course.status==='draft'?' · borrador':''}</option>`).join('');

    root.innerHTML = `<div class="students81" data-students81>
      <header class="students81-head">
        <div><span>GESTIÓN ACADÉMICA</span><h2>Estudiantes</h2><p>Consulta accesos, progreso, evaluaciones y certificados desde una ficha única por persona.</p></div>
        ${canManage ? `<button type="button" class="students81-primary" data-students81-toggle-invite>${inviteOpen?'Cerrar invitación':'+ Invitar estudiante'}</button>` : ''}
      </header>

      <section class="students81-stats">
        <article><i>◎</i><div><strong>${stats.students}</strong><span>Estudiantes</span></div></article>
        <article><i>✓</i><div><strong>${stats.active}</strong><span>Accesos activos</span></div></article>
        <article><i>Ⅱ</i><div><strong>${stats.paused}</strong><span>Accesos pausados</span></div></article>
        <article><i>↗</i><div><strong>${stats.avg}%</strong><span>Progreso promedio</span></div></article>
      </section>

      ${canManage ? `<section class="students81-invite ${inviteOpen?'open':''}" data-students81-invite>
        <div class="students81-invite-copy"><span>NUEVO ACCESO</span><h3>Invitar y asignar curso</h3><p>Si el correo ya tiene cuenta, el programa se asigna a esa persona. Si es nuevo, recibirá una invitación segura.</p></div>
        <form data-student-invite-form class="students81-invite-form">
          <label>Nombre<input name="full_name" required minlength="2" value="${esc(inviteSeed?.full_name || '')}" placeholder="Nombre completo"></label>
          <label>Correo<input type="email" name="email" required value="${esc(inviteSeed?.email || '')}" placeholder="correo@ejemplo.com"></label>
          <label>Curso<select name="course_id" required>${inviteCourseOptions}</select></label>
          <button type="submit">Invitar y asignar</button>
        </form>
        <div class="students81-message" data-invite-message aria-live="polite"></div>
      </section>` : ''}

      <section class="students81-directory">
        <div class="students81-directory-head"><div><span>DIRECTORIO</span><h3>Seguimiento de estudiantes</h3></div><small data-students81-count></small></div>
        <div class="students81-toolbar">
          <label class="students81-search"><span>⌕</span><input type="search" data-student-search value="${esc(searchValue)}" placeholder="Buscar por nombre, correo o curso"></label>
          <select data-students81-course aria-label="Filtrar por curso"><option value="all">Todos los cursos</option>${courseOptions}</select>
          <select data-students81-status aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="active" ${statusFilter==='active'?'selected':''}>Activos</option><option value="paused" ${statusFilter==='paused'?'selected':''}>Pausados</option><option value="completed" ${statusFilter==='completed'?'selected':''}>Completados</option><option value="cancelled" ${statusFilter==='cancelled'?'selected':''}>Cancelados</option></select>
        </div>
        <div class="students81-list" data-students81-list></div>
      </section>

      <section class="students81-record hidden" data-student-record></section>

      <details class="students81-invites" ${!invites.length?'':'open'}>
        <summary><span><b>Invitaciones recientes</b><small>${invites.length} registradas</small></span><i>⌄</i></summary>
        <div class="students81-invites-list">${renderInvites()}</div>
      </details>
    </div>`;

    bind();
    renderRows();
    if (activeStudentId) openRecord(activeStudentId,{scroll:false,force:true});
  }

  function renderInvites(){
    if(!invites.length) return '<div class="students81-empty">Todavía no hay invitaciones registradas.</div>';
    return invites.slice(0,12).map(invite => {
      const label = invite.status === 'sent' ? 'Enviada' : invite.status === 'linked' ? 'Cuenta existente' : invite.status === 'cancelled' ? 'Cancelada' : invite.status || 'Registrada';
      return `<div class="students81-invite-row"><span><strong>${esc(invite.full_name || 'Sin nombre')}</strong><small>${esc(invite.email || '')}</small></span><span>${esc(courseName(invite.course_id))}</span><span>${esc(label)}</span><time>${esc(fmt(invite.last_sent_at || invite.invited_at))}</time></div>`;
    }).join('');
  }

  function courseChips(student){
    const rows = student.enrollments.slice(0,2);
    const extra = student.enrollments.length - rows.length;
    return `<div class="students81-course-chips">${rows.map(item => `<span>${esc(item.course_title || 'Programa')}</span>`).join('')}${extra > 0 ? `<span>+${extra}</span>` : ''}</div>`;
  }

  function renderRows(){
    const list = $('[data-students81-list]');
    const count = $('[data-students81-count]');
    if (!list) return;
    const rows = filteredStudents();
    if (count) count.textContent = `${rows.length} ${rows.length === 1 ? 'persona' : 'personas'}`;
    if (!rows.length) {
      list.innerHTML = `<div class="students81-empty"><strong>No encontramos estudiantes</strong><span>Cambia los filtros o invita a una nueva persona.</span></div>`;
      return;
    }
    list.innerHTML = rows.map(student => `<article class="students81-row ${activeStudentId===student.user_id?'selected':''}" data-students81-open="${esc(student.user_id)}" tabindex="0" role="button">
      <div class="students81-person"><div class="students81-avatar">${esc(initials(student.full_name || student.email))}</div><div><strong>${esc(student.full_name || 'Estudiante')}</strong><span>${esc(student.email || 'Sin correo')}</span></div></div>
      <div class="students81-programs">${courseChips(student)}</div>
      <div class="students81-progress"><div><strong>${student.progress_percent}%</strong><span>avance</span></div><i><b style="width:${student.progress_percent}%"></b></i></div>
      <div class="students81-activity"><strong>${esc(fmt(student.last_activity))}</strong><span>Última actividad</span></div>
      <div class="students81-row-end"><span class="students81-status ${statusClass(student.overall_status)}">${statusLabel(student.overall_status)}</span><button type="button" data-students81-open-button="${esc(student.user_id)}">Ver expediente →</button></div>
    </article>`).join('');
    bindRows();
  }

  function bind(){
    $('[data-students81-toggle-invite]')?.addEventListener('click',() => {
      inviteOpen = !inviteOpen;
      if (!inviteOpen) inviteSeed = null;
      render();
      if (inviteOpen) $('[data-students81-invite]')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    $('[data-student-search]')?.addEventListener('input',event => { searchValue = event.target.value || ''; renderRows(); });
    $('[data-students81-course]')?.addEventListener('change',event => { courseFilter = event.target.value || 'all'; renderRows(); });
    $('[data-students81-status]')?.addEventListener('change',event => { statusFilter = event.target.value || 'all'; renderRows(); });
    $('[data-student-invite-form]')?.addEventListener('submit',inviteStudent);
  }

  function bindRows(){
    $$('[data-students81-open]').forEach(row => {
      row.addEventListener('click',event => {
        if (event.target.closest('button,select,a,input')) return;
        openRecord(row.dataset.students81Open);
      });
      row.addEventListener('keydown',event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openRecord(row.dataset.students81Open); }
      });
    });
    $$('[data-students81-open-button]').forEach(button => button.addEventListener('click',event => { event.stopPropagation(); openRecord(button.dataset.students81OpenButton); }));
  }

  async function inviteStudent(event){
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-invite-message]');
    const button = $('button[type="submit"]',form);
    const fd = new FormData(form);
    const body = {full_name:String(fd.get('full_name')||'').trim(),email:String(fd.get('email')||'').trim(),course_id:String(fd.get('course_id')||'')};
    if (!message || !button) return;
    button.disabled = true;
    message.className = 'students81-message';
    message.textContent = 'Creando acceso…';
    try {
      const {data,error} = await client.functions.invoke('invite-yamilet-student',{body});
      if(error || !data?.ok) throw error || new Error('invite_failed');
      message.className = 'students81-message ok';
      message.textContent = data.invitation_sent ? 'Invitación enviada y curso asignado.' : 'La cuenta ya existía; el curso quedó asignado y activo.';
      form.reset();
      inviteSeed = null;
      await loadAll();
    } catch(error) {
      console.warn('Academia Yamilet invite student',error);
      message.className = 'students81-message error';
      message.textContent = 'No fue posible crear la invitación. Verifica el correo e inténtalo nuevamente.';
    } finally {
      button.disabled = false;
    }
  }

  async function changeStatus(select){
    if (!canManage) return;
    const enrollmentId = select.dataset.enrollmentStatus;
    const previous = directory.find(item => item.enrollment_id === enrollmentId)?.enrollment_status;
    select.disabled = true;
    const {error} = await client.rpc('set_academy_enrollment_status',{target_enrollment:enrollmentId,target_status:select.value});
    select.disabled = false;
    if(error){
      if(previous) select.value = previous;
      select.title = 'No fue posible cambiar el acceso.';
      return;
    }
    recordCache.delete(activeStudentId);
    await loadAll();
  }

  async function loadCourseBreakdown(userId,enrollment){
    const {data:modules,error:moduleError} = await client.from('modules').select('id,title,position').eq('course_id',enrollment.course_id).order('position',{ascending:true});
    if (moduleError) return {modules:[]};
    const moduleRows = modules || [];
    const moduleIds = moduleRows.map(item => item.id);
    let lessons = [];
    if (moduleIds.length) {
      const {data,error} = await client.from('lessons').select('id,module_id,title,position').in('module_id',moduleIds);
      if (!error) lessons = data || [];
    }
    let progress = [];
    if (lessons.length) {
      const {data,error} = await client.from('lesson_progress').select('lesson_id,completed,updated_at').eq('user_id',userId).in('lesson_id',lessons.map(item => item.id));
      if (!error) progress = data || [];
    }
    const progressMap = new Map(progress.map(item => [item.lesson_id,item]));
    return {
      modules: moduleRows.map(module => {
        const rows = lessons.filter(lesson => lesson.module_id === module.id);
        const done = rows.filter(lesson => progressMap.get(lesson.id)?.completed).length;
        return {...module,total:rows.length,completed:done,percent:rows.length?Math.round(done/rows.length*100):0};
      })
    };
  }

  async function loadRecord(userId,force = false){
    if (!force && recordCache.has(userId)) return recordCache.get(userId);
    const student = groupedStudents().find(item => item.user_id === userId);
    if (!student) return null;
    const courseIds = student.enrollments.map(item => item.course_id);
    const breakdownEntries = await Promise.all(student.enrollments.map(async enrollment => [enrollment.course_id, await loadCourseBreakdown(userId,enrollment)]));
    const breakdown = Object.fromEntries(breakdownEntries);

    let assessments = [], attempts = [], certificates = [];
    if (courseIds.length) {
      const [assessmentRes,certificateRes] = await Promise.all([
        client.from('assessments').select('id,course_id,title,status,passing_score,max_attempts,assessment_type,position').in('course_id',courseIds).order('position',{ascending:true}),
        client.from('certificates').select('id,user_id,course_id,issued_at,verification_code,recipient_name,revoked_at,revoked_reason').eq('user_id',userId).in('course_id',courseIds).order('issued_at',{ascending:false})
      ]);
      if (!assessmentRes.error) assessments = assessmentRes.data || [];
      if (!certificateRes.error) certificates = certificateRes.data || [];
      const ids = assessments.map(item => item.id);
      if (ids.length) {
        const attemptRes = await client.from('assessment_attempts').select('id,assessment_id,user_id,attempt_number,status,score,passed,started_at,submitted_at,graded_at').eq('user_id',userId).in('assessment_id',ids).order('attempt_number',{ascending:false});
        if (!attemptRes.error) attempts = attemptRes.data || [];
      }
    }

    const value = {student,breakdown,assessments,attempts,certificates};
    recordCache.set(userId,value);
    return value;
  }

  function assessmentState(data,assessment){
    const rows = data.attempts.filter(item => item.assessment_id === assessment.id).sort((a,b) => Number(b.attempt_number||0)-Number(a.attempt_number||0));
    const passed = rows.find(item => item.passed === true);
    const latest = rows[0] || null;
    if (passed) return {label:'Aprobada',className:'passed',score:passed.score,attempts:rows.length};
    if (latest && ['submitted','graded','completed'].includes(String(latest.status||'').toLowerCase())) return {label:'No aprobada',className:'failed',score:latest.score,attempts:rows.length};
    if (latest) return {label:'En progreso',className:'started',score:latest.score,attempts:rows.length};
    return {label:'Pendiente',className:'pending',score:null,attempts:0};
  }

  function renderCourseRecord(data,enrollment){
    const detail = data.breakdown[enrollment.course_id] || {modules:[]};
    return `<article class="students81-course-record">
      <header><div><span>${esc(statusLabel(enrollment.enrollment_status))}</span><h4>${esc(enrollment.course_title || courseName(enrollment.course_id))}</h4><p>${Number(enrollment.completed_lessons)||0} de ${Number(enrollment.total_lessons)||0} lecciones · ${clampPct(enrollment.progress_percent)}%</p></div>${canManage?`<select data-enrollment-status="${esc(enrollment.enrollment_id)}"><option value="active" ${enrollment.enrollment_status==='active'?'selected':''}>Activo</option><option value="paused" ${enrollment.enrollment_status==='paused'?'selected':''}>Pausado</option><option value="completed" ${enrollment.enrollment_status==='completed'?'selected':''}>Completado</option><option value="cancelled" ${enrollment.enrollment_status==='cancelled'?'selected':''}>Cancelado</option></select>`:''}</header>
      <div class="students81-course-meter"><i style="width:${clampPct(enrollment.progress_percent)}%"></i></div>
      ${detail.modules.length ? `<div class="students81-module-list">${detail.modules.map((module,index) => `<div><span><b>${String(index+1).padStart(2,'0')}</b><strong>${esc(module.title)}</strong></span><em>${module.completed}/${module.total} · ${module.percent}%</em><i><b style="width:${module.percent}%"></b></i></div>`).join('')}</div>` : '<div class="students81-inline-empty">Este curso todavía no tiene módulos visibles.</div>'}
    </article>`;
  }

  function renderAssessmentRecord(data){
    if (!data.assessments.length) return '<div class="students81-inline-empty">No hay evaluaciones configuradas en los cursos de esta persona.</div>';
    return `<div class="students81-assessment-list">${data.assessments.map(assessment => {
      const state = assessmentState(data,assessment);
      const score = state.score === null || state.score === undefined ? '—' : `${Number(state.score)}%`;
      return `<div><span class="students81-assessment-icon">✓</span><span><strong>${esc(assessment.title)}</strong><small>${esc(courseName(assessment.course_id))} · ${state.attempts} ${state.attempts===1?'intento':'intentos'} · mínimo ${Number(assessment.passing_score)||0}%</small></span><em class="${state.className}">${esc(state.label)}</em><b>${esc(score)}</b></div>`;
    }).join('')}</div>`;
  }

  function renderCertificateRecord(data){
    if (!data.certificates.length) return '<div class="students81-inline-empty">Todavía no hay certificados emitidos para esta persona.</div>';
    return `<div class="students81-certificate-list">${data.certificates.map(cert => `<div><span class="students81-cert-icon">◇</span><span><strong>${esc(courseName(cert.course_id))}</strong><small>Emitido ${esc(fmt(cert.issued_at))} · ${esc(cert.verification_code || '')}</small></span><em class="${cert.revoked_at?'revoked':'valid'}">${cert.revoked_at?'Revocado':'Válido'}</em>${cert.verification_code?`<a href="./verificar.html?codigo=${encodeURIComponent(cert.verification_code)}" target="_blank" rel="noopener noreferrer">Verificar</a>`:''}</div>`).join('')}</div>`;
  }

  async function openRecord(userId,options = {}){
    const box = $('[data-student-record]');
    if (!box) return;
    activeStudentId = userId;
    renderRows();
    box.classList.remove('hidden');
    box.innerHTML = '<div class="students81-record-loading"><span></span><strong>Preparando expediente…</strong><small>Consultando progreso, evaluaciones y certificados.</small></div>';
    if (options.scroll !== false) box.scrollIntoView({behavior:'smooth',block:'start'});
    const data = await loadRecord(userId,!!options.force);
    if (!data || activeStudentId !== userId) return;
    const student = data.student;
    const activeCerts = data.certificates.filter(item => !item.revoked_at).length;
    const passedAssessments = data.assessments.filter(assessment => assessmentState(data,assessment).className === 'passed').length;
    const invite = invites.find(item => String(item.email||'').toLowerCase() === String(student.email||'').toLowerCase());

    box.innerHTML = `<div class="students81-record-shell">
      <header class="students81-record-head">
        <button type="button" data-close-record>← Directorio</button>
        <div class="students81-record-person"><div class="students81-record-avatar">${esc(initials(student.full_name || student.email))}</div><div><span>EXPEDIENTE ACADÉMICO</span><h3>${esc(student.full_name || 'Estudiante')}</h3><p>${esc(student.email || '')}</p></div></div>
        ${canManage ? `<button type="button" class="students81-assign" data-students81-assign>+ Asignar otro curso</button>` : ''}
      </header>

      <section class="students81-record-stats">
        <article><strong>${student.enrollments.length}</strong><span>${student.enrollments.length===1?'Curso':'Cursos'}</span></article>
        <article><strong>${student.progress_percent}%</strong><span>Progreso promedio</span></article>
        <article><strong>${passedAssessments}/${data.assessments.length}</strong><span>Evaluaciones aprobadas</span></article>
        <article><strong>${activeCerts}</strong><span>Certificados válidos</span></article>
        <article><strong>${esc(fmt(student.last_activity))}</strong><span>Última actividad</span></article>
      </section>

      <section class="students81-record-grid">
        <div class="students81-record-main">
          <article class="students81-record-panel"><header><div><span>FORMACIÓN</span><h4>Cursos y progreso</h4></div><small>${student.enrollments.length} asignados</small></header><div class="students81-course-records">${student.enrollments.map(enrollment => renderCourseRecord(data,enrollment)).join('')}</div></article>
          <article class="students81-record-panel"><header><div><span>EVALUACIONES</span><h4>Resultados e intentos</h4></div><a href="#admin/evaluations">Abrir constructor →</a></header>${renderAssessmentRecord(data)}</article>
          <article class="students81-record-panel"><header><div><span>CERTIFICACIÓN</span><h4>Certificados emitidos</h4></div><a href="#admin/certificates">Ver certificados →</a></header>${renderCertificateRecord(data)}</article>
        </div>
        <aside class="students81-record-side">
          <article><span>CUENTA</span><h4>Estado académico</h4><div><b>Perfil</b><strong>${esc(student.profile_status || 'Activo')}</strong></div><div><b>Acceso actual</b><strong>${esc(statusLabel(student.overall_status))}</strong></div><div><b>Última invitación</b><strong>${invite ? esc(fmt(invite.last_sent_at || invite.invited_at)) : 'Sin registro'}</strong></div></article>
          <article><span>SEGUIMIENTO</span><h4>Lectura rápida</h4><p>${student.progress_percent >= 100 ? 'La persona completó el contenido disponible en sus cursos.' : student.progress_percent >= 50 ? 'La persona ya superó la mitad de su recorrido académico.' : student.progress_percent > 0 ? 'La persona inició su recorrido y todavía tiene contenido pendiente.' : 'Todavía no hay progreso de lecciones registrado.'}</p><p>${passedAssessments === data.assessments.length && data.assessments.length ? 'Las evaluaciones configuradas están aprobadas.' : data.assessments.length ? `${data.assessments.length-passedAssessments} evaluación${data.assessments.length-passedAssessments===1?'':'es'} aún no aprobada${data.assessments.length-passedAssessments===1?'':'s'}.` : 'No hay evaluaciones configuradas para sus cursos.'}</p></article>
        </aside>
      </section>
    </div>`;

    $('[data-close-record]',box)?.addEventListener('click',() => { activeStudentId = null; box.classList.add('hidden'); box.innerHTML = ''; renderRows(); $('[data-students81-list]')?.scrollIntoView({behavior:'smooth',block:'start'}); });
    $('[data-students81-assign]',box)?.addEventListener('click',() => {
      inviteSeed = {full_name:student.full_name,email:student.email};
      inviteOpen = true;
      activeStudentId = null;
      render();
      $('[data-students81-invite]')?.scrollIntoView({behavior:'smooth',block:'center'});
    });
    $$('[data-enrollment-status]',box).forEach(select => select.addEventListener('change',() => changeStatus(select)));
  }

  function start(){
    if (isStudentsRoute()) bootstrap();
    window.addEventListener('hashchange',() => { if(isStudentsRoute()) bootstrap(); });
    window.addEventListener('pageshow',() => { if(isStudentsRoute()) bootstrap(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_STUDENTS = {
    version: VERSION,
    refresh: async () => { await bootstrap(); await loadAll(); },
    open: userId => openRecord(userId),
    bootstrap: () => bootstrap(true)
  };
})();
