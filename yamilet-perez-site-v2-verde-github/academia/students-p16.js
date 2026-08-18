(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  let client, workspace, session, canView = false, canManage = false, courses = [], directory = [], invites = [];
  const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) : '—';
  const initials = name => String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('');

  function host(){ return document.querySelector('[data-students-admin-root]'); }
  function nav(){ return document.querySelector('[data-students-admin-nav]'); }
  function section(){ return document.querySelector('[data-students-admin]'); }

  async function bootstrap(){
    try{
      const cfgRes = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
      if(!cfgRes.ok) return;
      const cfg = await cfgRes.json();
      client = window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const {data:{session:current}} = await client.auth.getSession();
      session = current;
      if(!session?.user) return;

      const [{data:ws},{data:profile}] = await Promise.all([
        client.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug||'yamilet-mes').maybeSingle(),
        client.from('profiles').select('role').eq('id',session.user.id).maybeSingle()
      ]);
      if(!ws) return;
      workspace = ws;
      const {data:member} = await client.from('workspace_members').select('role,status').eq('workspace_id',ws.id).eq('user_id',session.user.id).maybeSingle();
      canView = profile?.role === 'admin' || (member?.status==='active' && ['owner','admin','instructor'].includes(member.role));
      canManage = profile?.role === 'admin' || (member?.status==='active' && ['owner','admin'].includes(member.role));
      if(!canView) return;

      nav()?.classList.remove('hidden');
      section()?.classList.remove('hidden');
      nav()?.addEventListener('click',()=>section()?.scrollIntoView({behavior:'smooth',block:'start'}));
      await loadAll();
    }catch(error){ console.warn('Yamilet students admin',error); }
  }

  async function loadAll(){
    if(!workspace) return;
    const [courseRes,dirRes,inviteRes] = await Promise.all([
      client.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
      client.rpc('get_academy_student_directory',{target_workspace:workspace.id}),
      client.from('academy_student_invites').select('id,email,full_name,status,course_id,invited_at,last_sent_at,user_id').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(50)
    ]);
    courses = courseRes.data || [];
    directory = dirRes.data || [];
    invites = inviteRes.data || [];
    render();
  }

  function render(){
    const root = host(); if(!root) return;
    const unique = new Set(directory.map(x=>x.user_id)).size;
    const active = directory.filter(x=>x.enrollment_status==='active').length;
    const paused = directory.filter(x=>x.enrollment_status==='paused').length;
    const avg = directory.length ? Math.round(directory.reduce((s,x)=>s+(Number(x.progress_percent)||0),0)/directory.length) : 0;
    const courseOptions = courses.map(c=>`<option value="${c.id}">${esc(c.title)}${c.status==='draft'?' · borrador':''}</option>`).join('');

    root.innerHTML = `
      <div class="students-head"><div><div class="kicker">Administración académica</div><h2>Alumnas e inscripciones</h2><p>Invita alumnas, asigna cursos y consulta su avance sin salir de Academia Yamilet.</p></div></div>
      <div class="student-stats"><article class="student-stat"><span>Alumnas</span><strong>${unique}</strong></article><article class="student-stat"><span>Accesos activos</span><strong>${active}</strong></article><article class="student-stat"><span>Pausados</span><strong>${paused}</strong></article><article class="student-stat"><span>Progreso promedio</span><strong>${avg}%</strong></article></div>
      ${canManage ? `<section class="invite-card"><h3>Invitar alumna</h3><p>Si el correo ya existe, se asigna el curso a esa cuenta. Si es nuevo, recibirá una invitación segura de Supabase.</p><form data-student-invite-form class="invite-grid"><label>Nombre<input name="full_name" required minlength="2" placeholder="Nombre completo"></label><label>Correo<input type="email" name="email" required placeholder="correo@ejemplo.com"></label><label>Curso<select name="course_id" required>${courseOptions}</select></label><button class="btn primary" type="submit">Invitar y asignar</button></form><div class="invite-message" data-invite-message></div></section>` : ''}
      <div class="students-toolbar"><input type="search" data-student-search placeholder="Buscar por nombre, correo o curso"><span class="muted">${directory.length} inscripción${directory.length===1?'':'es'}</span></div>
      <div class="students-list" data-students-list></div>
      <section class="student-record hidden" data-student-record></section>
      <section class="invites-block"><div class="panel-head"><div><div class="kicker">Historial</div><h3>Invitaciones recientes</h3></div></div><div class="invites-list">${renderInvites()}</div></section>`;

    bind();
    renderRows(directory);
  }

  function renderInvites(){
    if(!invites.length) return '<div class="empty-students">Todavía no hay invitaciones registradas.</div>';
    return invites.map(i=>{
      const c = courses.find(x=>x.id===i.course_id);
      const label = i.status==='sent'?'Enviada':i.status==='linked'?'Cuenta existente':i.status==='cancelled'?'Cancelada':i.status;
      return `<div class="invite-row"><span><strong>${esc(i.full_name||'Sin nombre')}</strong></span><span>${esc(i.email)}</span><span>${esc(c?.title||'Curso')}</span><span>${esc(label)} · ${fmt(i.last_sent_at||i.invited_at)}</span></div>`;
    }).join('');
  }

  function renderRows(rows){
    const list = document.querySelector('[data-students-list]'); if(!list) return;
    if(!rows.length){ list.innerHTML='<div class="empty-students">Aún no hay alumnas inscritas en este workspace.</div>'; return; }
    list.innerHTML = rows.map(r=>`<article class="student-row">
      <div class="student-main"><div class="student-avatar">${esc(initials(r.full_name||r.email))}</div><div class="student-copy"><strong>${esc(r.full_name||'Alumna')}</strong><span>${esc(r.email||'Sin correo')}</span></div></div>
      <div class="student-course"><strong>${esc(r.course_title)}</strong><span class="status-pill ${esc(r.enrollment_status)}">${statusLabel(r.enrollment_status)}</span></div>
      <div class="student-progress"><strong>${Number(r.progress_percent)||0}%</strong><div class="progress-track"><span style="width:${Number(r.progress_percent)||0}%"></span></div><span>${Number(r.completed_lessons)||0}/${Number(r.total_lessons)||0} lecciones</span></div>
      <div class="student-actions">${canManage?`<select data-enrollment-status="${r.enrollment_id}"><option value="active" ${r.enrollment_status==='active'?'selected':''}>Activo</option><option value="paused" ${r.enrollment_status==='paused'?'selected':''}>Pausado</option><option value="completed" ${r.enrollment_status==='completed'?'selected':''}>Completado</option><option value="cancelled" ${r.enrollment_status==='cancelled'?'selected':''}>Cancelado</option></select>`:''}<button class="btn outline" type="button" data-open-student="${r.user_id}" data-course-id="${r.course_id}">Expediente</button></div>
    </article>`).join('');
    bindRows();
  }

  function statusLabel(s){ return ({active:'Activo',paused:'Pausado',completed:'Completado',cancelled:'Cancelado'})[s] || s; }

  function bind(){
    document.querySelector('[data-student-search]')?.addEventListener('input',e=>{
      const q=String(e.target.value||'').trim().toLowerCase();
      renderRows(!q?directory:directory.filter(r=>[r.full_name,r.email,r.course_title,r.enrollment_status].some(v=>String(v||'').toLowerCase().includes(q))));
    });
    document.querySelector('[data-student-invite-form]')?.addEventListener('submit',inviteStudent);
  }

  function bindRows(){
    document.querySelectorAll('[data-enrollment-status]').forEach(select=>select.onchange=()=>changeStatus(select));
    document.querySelectorAll('[data-open-student]').forEach(btn=>btn.onclick=()=>openRecord(btn.dataset.openStudent,btn.dataset.courseId));
  }

  async function inviteStudent(e){
    e.preventDefault();
    const form=e.currentTarget, msg=document.querySelector('[data-invite-message]');
    const fd=new FormData(form); const body={full_name:String(fd.get('full_name')||'').trim(),email:String(fd.get('email')||'').trim(),course_id:String(fd.get('course_id')||'')};
    msg.className='invite-message'; msg.textContent='Creando acceso…';
    const {data,error}=await client.functions.invoke('invite-yamilet-student',{body});
    if(error || !data?.ok){ msg.className='invite-message error'; msg.textContent='No fue posible crear la invitación. Verifica el correo e inténtalo nuevamente.'; return; }
    msg.className='invite-message ok'; msg.textContent=data.invitation_sent?'Invitación enviada y curso asignado.':'La cuenta ya existía; el curso quedó asignado y activo.';
    form.reset(); await loadAll();
  }

  async function changeStatus(select){
    const previous = directory.find(x=>x.enrollment_id===select.dataset.enrollmentStatus)?.enrollment_status;
    select.disabled=true;
    const {error}=await client.rpc('set_academy_enrollment_status',{target_enrollment:select.dataset.enrollmentStatus,target_status:select.value});
    select.disabled=false;
    if(error){ alert('No fue posible cambiar el acceso.'); if(previous) select.value=previous; return; }
    await loadAll();
  }

  async function openRecord(userId,courseId){
    const row=directory.find(x=>x.user_id===userId&&x.course_id===courseId); const box=document.querySelector('[data-student-record]'); if(!row||!box)return;
    box.classList.remove('hidden'); box.innerHTML='<div class="empty-students">Cargando expediente…</div>'; box.scrollIntoView({behavior:'smooth',block:'start'});
    const {data:mods}=await client.from('modules').select('id,title,position').eq('course_id',courseId).order('position',{ascending:true});
    const modRows=mods||[]; const ids=modRows.map(m=>m.id); let lessons=[];
    if(ids.length){ const res=await client.from('lessons').select('id,module_id,title,position').in('module_id',ids); lessons=res.data||[]; }
    let progress=[]; if(lessons.length){ const res=await client.from('lesson_progress').select('lesson_id,completed,updated_at').eq('user_id',userId).in('lesson_id',lessons.map(l=>l.id)); progress=res.data||[]; }
    const progressMap=new Map(progress.map(p=>[p.lesson_id,p]));
    const modulesHtml=modRows.length?modRows.map(m=>{ const ls=lessons.filter(l=>l.module_id===m.id); const done=ls.filter(l=>progressMap.get(l.id)?.completed).length; const pct=ls.length?Math.round(done/ls.length*100):0; return `<article class="record-module"><div class="record-module-head"><h4>${esc(m.title)}</h4><span>${done}/${ls.length} · ${pct}%</span></div><div class="progress-track"><span style="width:${pct}%"></span></div></article>`; }).join(''):'<div class="empty-students">El curso todavía no tiene módulos cargados.</div>';
    box.innerHTML=`<div class="record-head"><div><div class="kicker">Expediente académico</div><h3>${esc(row.full_name||'Alumna')}</h3><p>${esc(row.email||'')} · ${esc(row.course_title)}</p></div><button class="btn outline" type="button" data-close-record>Cerrar</button></div><div class="record-grid"><article><span>Estado</span><strong>${statusLabel(row.enrollment_status)}</strong></article><article><span>Progreso</span><strong>${Number(row.progress_percent)||0}%</strong></article><article><span>Última actividad</span><strong>${fmt(row.last_activity)}</strong></article></div><div class="record-modules">${modulesHtml}</div>`;
    box.querySelector('[data-close-record]')?.addEventListener('click',()=>box.classList.add('hidden'));
  }

  window.addEventListener('load',bootstrap,{once:true});
})();
