(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const WORKSPACE_SLUG = 'yamilet-mes';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));
  const esc = (value='') => String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtDate = (value, opts={}) => {
    if (!value) return 'Sin fecha';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(value+'T12:00:00') : new Date(value);
    if (Number.isNaN(d.getTime())) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:opts.year===false?undefined:'numeric'}).format(d);
  };
  const initials = (name='') => String(name||'YP').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('');
  const dayDiff = value => value ? Math.floor((Date.now()-new Date(value).getTime())/86400000) : 9999;

  let sb = null;
  let workspace = null;
  let user = null;
  let profile = null;
  let membership = null;
  let model = null;
  let agendaFilter = 'all';

  const boot = $('[data-boot]');
  const authView = $('[data-auth-view]');
  const deniedView = $('[data-denied-view]');
  const admin = $('[data-admin]');

  function finishBoot(){
    boot?.classList.add('is-done');
    setTimeout(()=>boot?.classList.add('hidden'),260);
  }
  function show(view){
    [authView,deniedView,admin].forEach(x=>x?.classList.add('hidden'));
    view?.classList.remove('hidden');
    finishBoot();
  }
  function status(el,text,ok=false){
    if(!el) return;
    el.textContent=text||'';
    el.style.color=ok?'#377f59':'';
  }

  async function initSupabase(){
    const res = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!res.ok) throw new Error('No fue posible cargar la configuración.');
    const cfg = await res.json();
    sb = window.supabase.createClient(cfg.url,cfg.anonKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return cfg.workspaceSlug || WORKSPACE_SLUG;
  }

  async function loadContext(workspaceSlug){
    const auth = await sb.auth.getUser();
    if(auth.error || !auth.data?.user) return false;
    user = auth.data.user;

    const [p,w] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,platform_role,status').eq('id',user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug',workspaceSlug).maybeSingle()
    ]);
    if(p.error) throw p.error;
    if(w.error) throw w.error;
    profile = p.data || null;
    workspace = w.data || null;
    if(!workspace) throw new Error('No encontramos el espacio de Yamilet.');

    const m = await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',user.id).maybeSingle();
    if(m.error) throw m.error;
    membership = m.data || null;
    return true;
  }

  function canManage(){
    if(profile?.status && profile.status !== 'active') return false;
    if(['admin','super_admin'].includes(profile?.role)) return true;
    if(['admin','super_admin'].includes(profile?.platform_role)) return true;
    return membership?.status === 'active' && ['owner','admin'].includes(membership?.role);
  }

  async function fetchData(){
    const [courseRes,bookingRes,registrationRes] = await Promise.all([
      sb.from('courses').select('id,title,slug,status,workspace_id').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
      sb.from('free_class_bookings').select('id,booking_date,full_name,email,status,source,page_url,utm_source,utm_medium,utm_campaign,created_at,updated_at').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(250),
      sb.rpc('get_academy_crm_registrations',{target_workspace:workspace.id})
    ]);
    if(courseRes.error) throw courseRes.error;
    if(bookingRes.error) throw bookingRes.error;
    if(registrationRes.error) throw registrationRes.error;

    const courses = courseRes.data || [];
    const courseIds = courses.map(x=>x.id);
    let enrollments=[], modules=[], lessons=[], studentProfiles=[], progress=[];

    if(courseIds.length){
      const [eRes,mRes] = await Promise.all([
        sb.from('enrollments').select('id,user_id,course_id,status,enrolled_at,completed_at').in('course_id',courseIds).order('enrolled_at',{ascending:false}),
        sb.from('modules').select('id,course_id,title,position').in('course_id',courseIds)
      ]);
      if(eRes.error) throw eRes.error;
      if(mRes.error) throw mRes.error;
      enrollments=eRes.data||[]; modules=mRes.data||[];
    }

    const moduleIds = modules.map(x=>x.id);
    if(moduleIds.length){
      const lRes = await sb.from('lessons').select('id,module_id,title,position').in('module_id',moduleIds);
      if(lRes.error) throw lRes.error;
      lessons=lRes.data||[];
    }

    const studentIds = [...new Set(enrollments.map(x=>x.user_id).filter(Boolean))];
    if(studentIds.length){
      const pRes = await sb.from('profiles').select('id,email,full_name,status,created_at').in('id',studentIds);
      if(pRes.error) throw pRes.error;
      studentProfiles=pRes.data||[];
    }

    const lessonIds = lessons.map(x=>x.id);
    if(studentIds.length && lessonIds.length){
      const prRes = await sb.from('lesson_progress').select('user_id,lesson_id,completed,progress_seconds,completed_at,updated_at').in('user_id',studentIds).in('lesson_id',lessonIds);
      if(prRes.error) throw prRes.error;
      progress=prRes.data||[];
    }

    return buildModel({
      registrations:registrationRes.data||[],bookings:bookingRes.data||[],courses,enrollments,modules,lessons,studentProfiles,progress
    });
  }

  function buildModel(raw){
    const profileById = new Map(raw.studentProfiles.map(p=>[p.id,p]));
    const modulesByCourse = new Map();
    raw.modules.forEach(m=>{
      if(!modulesByCourse.has(m.course_id)) modulesByCourse.set(m.course_id,[]);
      modulesByCourse.get(m.course_id).push(m);
    });
    const lessonsByModule = new Map();
    raw.lessons.forEach(l=>{
      if(!lessonsByModule.has(l.module_id)) lessonsByModule.set(l.module_id,[]);
      lessonsByModule.get(l.module_id).push(l);
    });
    const lessonCourse = new Map();
    raw.modules.forEach(m=>(lessonsByModule.get(m.id)||[]).forEach(l=>lessonCourse.set(l.id,m.course_id)));

    const progressByUser = new Map();
    raw.progress.forEach(p=>{
      if(!progressByUser.has(p.user_id)) progressByUser.set(p.user_id,[]);
      progressByUser.get(p.user_id).push(p);
    });

    const enrollByUser = new Map();
    raw.enrollments.forEach(e=>{
      if(!enrollByUser.has(e.user_id)) enrollByUser.set(e.user_id,[]);
      enrollByUser.get(e.user_id).push(e);
    });

    const students=[...enrollByUser.entries()].map(([userId,enrs])=>{
      const p=profileById.get(userId)||{};
      const active=enrs.filter(e=>['active','completed'].includes(e.status));
      const courseSet=new Set(active.map(e=>e.course_id));
      const allowedLessons=raw.lessons.filter(l=>courseSet.has(lessonCourse.get(l.id)));
      const allowedSet=new Set(allowedLessons.map(l=>l.id));
      const pr=(progressByUser.get(userId)||[]).filter(x=>allowedSet.has(x.lesson_id));
      const completed=new Set(pr.filter(x=>x.completed).map(x=>x.lesson_id)).size;
      const percent=allowedLessons.length?Math.round((completed/allowedLessons.length)*100):0;
      const lastActivity=pr.map(x=>x.updated_at||x.completed_at).filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0]||active.map(x=>x.enrolled_at).filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0]||null;
      return {userId,name:p.full_name||p.email||'Alumna',email:p.email||'',enrollments:enrs,active:enrs.some(e=>e.status==='active'),completedCourses:enrs.filter(e=>e.status==='completed').length,percent,totalLessons:allowedLessons.length,completedLessons:completed,lastActivity,risk:enrs.some(e=>e.status==='active')&&dayDiff(lastActivity)>=7};
    }).sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name));

    const activeStudents=students.filter(s=>s.active);
    const avgProgress=activeStudents.length?Math.round(activeStudents.reduce((a,s)=>a+s.percent,0)/activeStudents.length):0;
    const studentEmails=new Set(students.map(s=>s.email.toLowerCase()).filter(Boolean));

    const contacts=new Map();
    const touch=(email,patch)=>{
      const key=(email||'').trim().toLowerCase();
      if(!key) return;
      const prev=contacts.get(key)||{email:key,name:key,source:'Web',stage:'Nuevo',lastActivity:null,registration:null,booking:null,student:null};
      const next={...prev,...patch};
      if(patch.name && patch.name!==key) next.name=patch.name;
      if(patch.lastActivity && (!prev.lastActivity || new Date(patch.lastActivity)>new Date(prev.lastActivity))) next.lastActivity=patch.lastActivity;
      contacts.set(key,next);
    };

    raw.registrations.forEach(r=>touch(r.email,{name:r.full_name||r.email,source:r.utm_source||r.registration_source||'Academia',stage:'Nuevo',lastActivity:r.registered_at,registration:r}));
    raw.bookings.forEach(b=>{
      const stage=b.status==='confirmed'?'Cita confirmada':b.status==='completed'?'Seguimiento':b.status==='requested'?'Cita solicitada':b.status==='cancelled'?'Cancelada':'Nuevo';
      touch(b.email,{name:b.full_name||b.email,source:b.utm_source||b.source||'Página',stage,lastActivity:b.updated_at||b.created_at,booking:b});
    });
    students.forEach(s=>touch(s.email,{name:s.name,source:'Academia',stage:s.active?'Alumna':'Exalumna',lastActivity:s.lastActivity,student:s}));

    const contactRows=[...contacts.values()].map(c=>{
      if(c.student?.active) c.stage='Alumna';
      else if(c.booking?.status==='completed') c.stage='Seguimiento';
      else if(c.booking?.status==='confirmed') c.stage='Cita confirmada';
      else if(c.booking?.status==='requested') c.stage='Cita solicitada';
      else c.stage='Nuevo';
      c.nextAction=c.stage==='Nuevo'?'Contactar':c.stage==='Cita solicitada'?'Confirmar cita':c.stage==='Cita confirmada'?'Realizar sesión':c.stage==='Seguimiento'?'Dar seguimiento':c.stage==='Alumna'?(c.student?.risk?'Revisar progreso':'Acompañar'):'Revisar';
      c.whatsapp=c.registration?.whatsapp_e164||'';
      c.country=c.registration?.country_name||'';
      return c;
    }).sort((a,b)=>new Date(b.lastActivity||0)-new Date(a.lastActivity||0));

    const prospects=contactRows.filter(c=>!studentEmails.has(c.email));
    const upcoming=raw.bookings.filter(b=>['requested','confirmed'].includes(b.status)&&String(b.booking_date||'')>=new Date().toISOString().slice(0,10)).sort((a,b)=>String(a.booking_date).localeCompare(String(b.booking_date)));
    const attention=[];
    raw.registrations.slice(0,5).forEach(r=>attention.push({type:'lead',title:r.full_name||r.email,copy:'Registro pendiente de atención',route:'crm'}));
    raw.bookings.filter(b=>b.status==='requested').slice(0,5).forEach(b=>attention.push({type:'booking',title:b.full_name||b.email,copy:'Solicitó una cita · '+fmtDate(b.booking_date,{year:false}),route:'agenda'}));
    activeStudents.filter(s=>s.risk).slice(0,5).forEach(s=>attention.push({type:'student',title:s.name,copy:'Sin actividad reciente · '+s.percent+'% de avance',route:'students'}));

    const activity=[];
    raw.bookings.slice(0,6).forEach(b=>activity.push({at:b.created_at,type:'booking',title:b.full_name||b.email,copy:'Nueva cita · '+fmtDate(b.booking_date,{year:false})}));
    raw.registrations.slice(0,6).forEach(r=>activity.push({at:r.registered_at,type:'lead',title:r.full_name||r.email,copy:'Nuevo registro en Academia'}));
    raw.enrollments.slice(0,6).forEach(e=>{const s=students.find(x=>x.userId===e.user_id);activity.push({at:e.enrolled_at,type:'student',title:s?.name||'Alumna',copy:'Inscripción '+e.status});});
    activity.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));

    return {...raw,students,activeStudents,avgProgress,contacts:contactRows,prospects,upcoming,attention,activity};
  }

  function renderAll(){
    renderHeader();
    renderMetrics();
    renderFunnel();
    renderAttention();
    renderUpcoming();
    renderStudentProgress();
    renderActivity();
    renderCRM();
    renderPipeline();
    renderStudents();
    renderAgenda();
  }

  function renderHeader(){
    const name=profile?.full_name||'Yamilet';
    const first=name.split(/\s+/)[0]||'Yamilet';
    $('[data-admin-name]').textContent=name;
    $('[data-first-name]').textContent=first;
    $('[data-avatar]').textContent=initials(name);
    $('[data-admin-role]').textContent=membership?.role==='owner'?'Propietaria':'Administradora';
    const hour=new Date().getHours();
    $('[data-greeting]').textContent=hour<12?'Buenos días':hour<19?'Buenas tardes':'Buenas noches';
    $('[data-last-update]').textContent=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(new Date());
  }

  function renderMetrics(){
    const requested=model.bookings.filter(x=>x.status==='requested');
    $('[data-metric-prospects]').textContent=model.prospects.length;
    $('[data-metric-new]').textContent=model.registrations.length;
    $('[data-metric-students]').textContent=model.activeStudents.length;
    $('[data-metric-student-risk]').textContent=model.activeStudents.filter(x=>x.risk).length;
    $('[data-metric-bookings]').textContent=requested.length;
    $('[data-metric-next-booking]').textContent=model.upcoming[0]?fmtDate(model.upcoming[0].booking_date,{year:false}):'Sin próximas';
    $('[data-metric-progress]').textContent=model.avgProgress+'%';
    $('[data-metric-lessons]').textContent=model.lessons.length;
    $('[data-nav-crm-count]').textContent=model.prospects.length;
    $('[data-nav-student-count]').textContent=model.activeStudents.length;
    $('[data-nav-booking-count]').textContent=requested.length;
  }

  function renderFunnel(){
    const counts={
      'Nuevo':model.contacts.filter(c=>c.stage==='Nuevo').length,
      'Cita':model.contacts.filter(c=>['Cita solicitada','Cita confirmada'].includes(c.stage)).length,
      'Seguimiento':model.contacts.filter(c=>c.stage==='Seguimiento').length,
      'Alumna':model.contacts.filter(c=>c.stage==='Alumna').length
    };
    const max=Math.max(1,...Object.values(counts));
    $('[data-dashboard-funnel]').innerHTML=Object.entries(counts).map(([name,count])=>`
      <div class="funnel-stage" style="--pct:${Math.max(8,Math.round(count/max*100))}%"><small>${esc(name)}</small><strong>${count}</strong><span>${name==='Alumna'?'activas en Academia':'contactos'}</span></div>`).join('');
  }

  function renderAttention(){
    const host=$('[data-attention-list]');
    $('[data-attention-count]').textContent=model.attention.length;
    if(!model.attention.length){host.innerHTML='<div class="empty-state">✓ Todo al día. No hay acciones urgentes.</div>';return;}
    host.innerHTML=model.attention.slice(0,5).map(x=>`
      <div class="attention-item"><span class="attention-icon">${x.type==='booking'?'□':x.type==='student'?'◉':'◎'}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.copy)}</small></div><button data-route="${x.route}">Ver →</button></div>`).join('');
    wireRouteButtons(host);
  }

  function renderUpcoming(){
    const host=$('[data-upcoming-bookings]');
    if(!model.upcoming.length){host.innerHTML='<div class="empty-state">No hay citas próximas.</div>';return;}
    host.innerHTML=model.upcoming.slice(0,5).map(b=>{
      const d=new Date(b.booking_date+'T12:00:00');
      return `<div class="appointment-item"><div class="appointment-date"><b>${d.getDate()}</b><span>${new Intl.DateTimeFormat('es-MX',{month:'short'}).format(d)}</span></div><div><strong>${esc(b.full_name||b.email)}</strong><small>${esc(b.email)}</small></div><span class="status ${esc(b.status)}">${b.status==='requested'?'Solicitada':'Confirmada'}</span></div>`;
    }).join('');
  }

  function renderStudentProgress(){
    const host=$('[data-student-progress]');
    if(!model.activeStudents.length){host.innerHTML='<div class="empty-state">Aún no hay alumnas activas.</div>';return;}
    host.innerHTML=model.activeStudents.slice(0,6).map(s=>`
      <div class="student-row"><span class="student-avatar">${initials(s.name)}</span><div><strong>${esc(s.name)}</strong><small>${s.risk?'Requiere seguimiento':'Actividad: '+(s.lastActivity?fmtDate(s.lastActivity):'sin registro')}</small><div class="progress-track"><span style="width:${s.percent}%"></span></div></div><em>${s.percent}%</em></div>`).join('');
  }

  function renderActivity(){
    const host=$('[data-activity-list]');
    if(!model.activity.length){host.innerHTML='<div class="empty-state">Sin actividad reciente.</div>';return;}
    host.innerHTML=model.activity.slice(0,7).map(x=>`
      <div class="activity-item"><span class="activity-icon">${x.type==='booking'?'□':x.type==='student'?'◉':'◎'}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.copy)}</small></div><time>${fmtDate(x.at,{year:false})}</time></div>`).join('');
  }

  function whatsappHref(value=''){
    const digits=String(value||'').replace(/[^0-9]/g,'');
    return digits.length>=7?'https://wa.me/'+digits:'';
  }

  function registrationStatusLabel(value=''){
    return ({requested:'Registro recibido',account_created:'Cuenta creada',email_confirmed:'Correo confirmado',dismissed:'Descartado'})[value]||'Sin estado';
  }

  function bookingStatusLabel(value=''){
    return ({requested:'Solicitada',confirmed:'Confirmada',completed:'Realizada',cancelled:'Cancelada'})[value]||value||'Sin cita';
  }

  function closeContactDetail(){
    $('[data-contact-drawer]')?.classList.remove('open');
    $('[data-contact-scrim]')?.classList.remove('show');
    $('[data-contact-drawer]')?.setAttribute('aria-hidden','true');
    document.body.classList.remove('contact-detail-open');
  }

  function openContactDetail(email){
    const key=String(email||'').trim().toLowerCase();
    const contact=model?.contacts?.find(c=>c.email===key);
    if(!contact)return;
    const r=contact.registration||null;
    const b=contact.booking||null;
    const s=contact.student||null;
    const whatsapp=contact.whatsapp||r?.whatsapp_e164||'';
    const wa=whatsappHref(whatsapp);
    const country=r?.country_name||contact.country||'No registrado';
    const source=r?.utm_source||r?.registration_source||b?.utm_source||b?.source||contact.source||'Web';
    const campaign=r?.utm_campaign||b?.utm_campaign||'—';
    const detail=$('[data-contact-detail]');
    detail.innerHTML=`
      <section class="contact-profile">
        <span class="contact-profile-avatar">${initials(contact.name)}</span>
        <div><span class="status ${contact.stage==='Alumna'?'active':contact.stage.startsWith('Cita')?'confirmed':'requested'}">${esc(contact.stage)}</span><h2>${esc(contact.name)}</h2><p>${esc(contact.email)}</p></div>
      </section>

      <div class="contact-actions">
        <a href="mailto:${encodeURIComponent(contact.email)}">✉ Enviar correo</a>
        ${wa?'<a class="whatsapp" href="'+esc(wa)+'" target="_blank" rel="noopener">◉ Abrir WhatsApp</a>':'<span class="disabled">WhatsApp no registrado</span>'}
      </div>

      <section class="contact-detail-section">
        <div class="contact-section-title"><span class="eyebrow">Contacto</span><h3>Datos personales</h3></div>
        <dl class="contact-data-grid">
          <div><dt>Correo</dt><dd>${esc(contact.email)}</dd></div>
          <div><dt>WhatsApp</dt><dd>${whatsapp?esc(whatsapp):'No registrado'}</dd></div>
          <div><dt>País / región</dt><dd>${esc(country)}</dd></div>
          <div><dt>Código internacional</dt><dd>${r?.dial_code?esc(r.dial_code):'—'}</dd></div>
        </dl>
      </section>

      <section class="contact-detail-section">
        <div class="contact-section-title"><span class="eyebrow">Registro</span><h3>Ingreso a Academia Yamilet</h3></div>
        ${r?`<dl class="contact-data-grid">
          <div><dt>Estado</dt><dd>${esc(registrationStatusLabel(r.request_status))}</dd></div>
          <div><dt>Fecha de registro</dt><dd>${fmtDate(r.registered_at)}</dd></div>
          <div><dt>Correo confirmado</dt><dd>${r.email_confirmed_at?'Sí · '+fmtDate(r.email_confirmed_at):'Pendiente'}</dd></div>
          <div><dt>Interés</dt><dd>${esc(r.course_interest||'Método MES®')}</dd></div>
          <div><dt>Origen</dt><dd>${esc(source)}</dd></div>
          <div><dt>Campaña</dt><dd>${esc(campaign)}</dd></div>
        </dl>`:'<div class="contact-empty-block">No existe un registro de Academia asociado a este contacto.</div>'}
      </section>

      <section class="contact-detail-section">
        <div class="contact-section-title"><span class="eyebrow">Agenda</span><h3>Cita y seguimiento</h3></div>
        ${b?`<dl class="contact-data-grid">
          <div><dt>Fecha</dt><dd>${fmtDate(b.booking_date)}</dd></div>
          <div><dt>Estado</dt><dd>${esc(bookingStatusLabel(b.status))}</dd></div>
          <div><dt>Origen</dt><dd>${esc(b.utm_source||b.source||'Página Yamilet')}</dd></div>
          <div><dt>Registrada</dt><dd>${fmtDate(b.created_at)}</dd></div>
        </dl>`:'<div class="contact-empty-block">Todavía no tiene una cita registrada.</div>'}
      </section>

      <section class="contact-detail-section">
        <div class="contact-section-title"><span class="eyebrow">Academia</span><h3>Progreso de aprendizaje</h3></div>
        ${s?`<div class="contact-progress-card">
          <div><strong>${s.percent}%</strong><span>${s.active?'Alumna activa':'Sin curso activo'}</span></div>
          <div class="progress-track"><span style="width:${s.percent}%"></span></div>
          <small>${s.completedLessons} de ${s.totalLessons} lecciones completadas · Última actividad: ${s.lastActivity?fmtDate(s.lastActivity):'sin actividad'}</small>
        </div>`:'<div class="contact-empty-block">Todavía no tiene un curso activo.</div>'}
      </section>
    `;
    $('[data-contact-drawer]')?.classList.add('open');
    $('[data-contact-scrim]')?.classList.add('show');
    $('[data-contact-drawer]')?.setAttribute('aria-hidden','false');
    document.body.classList.add('contact-detail-open');
  }

  function wireContactOpeners(root=document){
    $('[data-contact-email]',root).forEach(el=>{
      if(el.dataset.contactBound)return;
      el.dataset.contactBound='1';
      const open=()=>openContactDetail(el.dataset.contactEmail);
      el.addEventListener('click',event=>{
        if(event.target.closest('a,button,select,input'))return;
        open();
      });
      el.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}
      });
    });
  }

  function renderCRM(filter=''){
    const q=filter.trim().toLowerCase();
    const rows=model.contacts.filter(c=>!q||c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q)||String(c.whatsapp||'').includes(q));
    const host=$('[data-crm-table]');
    host.innerHTML=rows.length?rows.map(c=>`
      <tr class="crm-row" tabindex="0" data-contact-email="${esc(c.email)}"><td><strong>${esc(c.name)}</strong><small>${esc(c.email)}${c.whatsapp?' · '+esc(c.whatsapp):''}</small></td><td><span class="status ${c.stage==='Alumna'?'active':c.stage.startsWith('Cita')?'confirmed':'requested'}">${esc(c.stage)}</span></td><td>${esc(c.source||'Web')}</td><td>${c.lastActivity?fmtDate(c.lastActivity):'—'}</td><td><button class="action-chip contact-open-btn" type="button" data-contact-email="${esc(c.email)}">Ver ficha →</button></td></tr>`).join(''):'<tr><td colspan="5">Sin resultados.</td></tr>';
    $('[data-contact-email]',host).forEach(el=>{
      if(el.tagName==='BUTTON'){
        el.addEventListener('click',event=>{event.stopPropagation();openContactDetail(el.dataset.contactEmail);});
      }
    });
    wireContactOpeners(host);
  }

  function renderPipeline(){
    const stages=['Nuevo','Cita solicitada','Cita confirmada','Seguimiento','Alumna'];
    $('[data-pipeline-board]').innerHTML=stages.map(stage=>{
      const rows=model.contacts.filter(c=>c.stage===stage);
      return `<section class="pipeline-col"><div class="pipeline-col-head"><strong>${stage}</strong><span>${rows.length}</span></div>${rows.map(c=>`<article class="deal-card" tabindex="0" data-contact-email="${esc(c.email)}"><strong>${esc(c.name)}</strong><small>${esc(c.email)}</small><em>${esc(c.nextAction)} →</em></article>`).join('')||'<div class="empty-state">Vacío</div>'}</section>`;
    }).join('');
    wireContactOpeners($('[data-pipeline-board]'));
  }

  function renderStudents(){
    const host=$('[data-students-grid]');
    const rows=model.students.filter(s=>s.active||s.completedCourses);
    host.innerHTML=rows.length?rows.map(s=>`
      <article class="student-card" tabindex="0" data-contact-email="${esc(s.email)}"><div class="student-card-head"><span class="student-avatar">${initials(s.name)}</span><div><h3>${esc(s.name)}</h3><div class="email">${esc(s.email)}</div></div></div><div class="student-card-stats"><div><span>Estado</span><strong>${s.active?'Activa':'Completó'}</strong></div><div><span>Última actividad</span><strong>${s.lastActivity?fmtDate(s.lastActivity,{year:false}):'Sin actividad'}</strong></div></div><div class="progress-track"><span style="width:${s.percent}%"></span></div><footer><span>${s.completedLessons} de ${s.totalLessons} lecciones</span><strong>${s.percent}% · Ver ficha →</strong></footer></article>`).join(''):'<div class="empty-state">No hay alumnas registradas.</div>';
    wireContactOpeners(host);
  }

  function renderAgenda(){
    const rows=model.bookings.filter(b=>agendaFilter==='all'||b.status===agendaFilter);
    const host=$('[data-agenda-list]');
    host.innerHTML=rows.length?rows.map(b=>{
      const d=b.booking_date?new Date(b.booking_date+'T12:00:00'):null;
      return `<article class="agenda-card" data-booking-id="${b.id}"><div class="agenda-date"><strong>${d?d.getDate():'—'}</strong><span>${d?new Intl.DateTimeFormat('es-MX',{month:'short'}).format(d):'fecha'}</span></div><div><h3>${esc(b.full_name||b.email)}</h3><p>${esc(b.email)}</p></div><div class="agenda-source">Origen: ${esc(b.utm_source||b.source||'Página')}</div><select aria-label="Estado de cita" data-booking-status><option value="requested" ${b.status==='requested'?'selected':''}>Solicitada</option><option value="confirmed" ${b.status==='confirmed'?'selected':''}>Confirmada</option><option value="completed" ${b.status==='completed'?'selected':''}>Realizada</option><option value="cancelled" ${b.status==='cancelled'?'selected':''}>Cancelada</option></select></article>`;
    }).join(''):'<div class="empty-state">No hay citas con este estado.</div>';
    $$('[data-booking-status]',host).forEach(select=>select.addEventListener('change',async()=>{
      const card=select.closest('[data-booking-id]');
      select.disabled=true;
      const {error}=await sb.from('free_class_bookings').update({status:select.value,updated_at:new Date().toISOString()}).eq('id',card.dataset.bookingId).eq('workspace_id',workspace.id);
      select.disabled=false;
      if(error){alert('No fue posible actualizar la cita.');return;}
      await refresh();
    }));
  }

  function setRoute(route){
    const page=$('[data-page="'+route+'"]')||$('[data-page="dashboard"]');
    $$('.page').forEach(x=>x.classList.remove('active'));
    page.classList.add('active');
    $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.route===route));
    const names={dashboard:['Yamilet Admin · Resumen','Dashboard general'],crm:['Yamilet Admin · CRM','Contactos'],pipeline:['Yamilet Admin · Pipeline','Pipeline'],students:['Yamilet Admin · Academia','Alumnas'],agenda:['Yamilet Admin · Agenda','Citas'],blog:['Yamilet Admin · Contenido','Blog'],agents:['Yamilet Admin · Compás Fly','Agentes']};
    const meta=names[route]||names.dashboard;
    $('[data-breadcrumb]').textContent=meta[0];$('[data-page-title]').textContent=meta[1];
    location.hash=route==='dashboard'?'dashboard':route;
    closeMenu();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function wireRouteButtons(root=document){
    $$('[data-route]',root).forEach(btn=>{
      if(btn.dataset.routeBound) return;
      btn.dataset.routeBound='1';
      btn.addEventListener('click',e=>{e.preventDefault();setRoute(btn.dataset.route);});
    });
  }

  function openMenu(){$('[data-sidebar]')?.classList.add('open');$('[data-menu-scrim]')?.classList.add('show')}
  function closeMenu(){$('[data-sidebar]')?.classList.remove('open');$('[data-menu-scrim]')?.classList.remove('show')}

  async function refresh(){
    $('[data-refresh]')?.setAttribute('disabled','disabled');
    try{model=await fetchData();renderAll();}
    catch(error){console.error('Yamilet Admin refresh',error);alert('No fue posible actualizar todos los datos.');}
    finally{$('[data-refresh]')?.removeAttribute('disabled');}
  }

  function wire(){
    wireRouteButtons();
    $('[data-open-menu]')?.addEventListener('click',openMenu);
    $('[data-close-menu]')?.addEventListener('click',closeMenu);
    $('[data-menu-scrim]')?.addEventListener('click',closeMenu);
    $('[data-refresh]')?.addEventListener('click',refresh);
    $('[data-user-menu]')?.addEventListener('click',()=> $('[data-user-dropdown]')?.classList.toggle('hidden'));
    $('[data-close-contact]')?.addEventListener('click',closeContactDetail);
    $('[data-contact-scrim]')?.addEventListener('click',closeContactDetail);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeContactDetail();});
    $('[data-signout]')?.addEventListener('click',async()=>{await sb.auth.signOut();location.reload();});
    $('[data-denied-signout]')?.addEventListener('click',async()=>{await sb?.auth.signOut();location.reload();});
    $('[data-crm-search]')?.addEventListener('input',e=>renderCRM(e.target.value));
    $$('[data-status-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      agendaFilter=btn.dataset.statusFilter;
      $$('[data-status-filter]').forEach(x=>x.classList.toggle('active',x===btn));
      renderAgenda();
    }));
    addEventListener('hashchange',()=>setRoute((location.hash||'#dashboard').slice(1)));
  }

  async function startAdmin(){
    window.YAMILET_ADMIN_CONTEXT = Object.freeze({ sb, workspace, user, profile, membership });
    document.dispatchEvent(new CustomEvent('yamilet-admin-ready'));
    renderHeader();
    show(admin);
    wire();
    await refresh();
    setRoute((location.hash||'#dashboard').slice(1));
  }

  async function bootApp(){
    try{
      const slug=await initSupabase();
      const hasUser=await loadContext(slug);
      if(!hasUser){show(authView);return;}
      if(!canManage()){show(deniedView);return;}
      await startAdmin();
    }catch(error){
      console.error('Yamilet Admin boot',error);
      show(authView);
      status($('[data-login-status]'),'No fue posible iniciar el sistema. Intenta nuevamente.');
    }
  }

  $('[data-login-form]')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const email=String(new FormData(form).get('email')||'').trim().toLowerCase();
    const password=String(new FormData(form).get('password')||'');
    const st=$('[data-login-status]');
    status(st,'Validando acceso…',true);
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      if(!sb) await initSupabase();
      const {error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      location.reload();
    }catch(error){console.error(error);status(st,'Correo o contraseña incorrectos.');submit.disabled=false;}
  });

  bootApp();
})();