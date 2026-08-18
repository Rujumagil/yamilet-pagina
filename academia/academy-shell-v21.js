(() => {
  'use strict';
  const RELEASE = '20260818.21';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    home:'<svg viewBox="0 0 24 24"><path d="M3 10.8 12 3l9 7.8"/><path d="M5 9.8V21h14V9.8"/><path d="M9 21v-6h6v6"/></svg>',
    courses:'<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></svg>',
    evaluations:'<svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="m8.5 13 2.2 2.2 4.8-5"/></svg>',
    library:'<svg viewBox="0 0 24 24"><path d="M4 4h5v16H4zM10 4h5v16h-5z"/><path d="m16.5 5 3-1 3.5 14-3 1z"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/></svg>',
    certificates:'<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5"/><path d="m9 13-2 8 5-3 5 3-2-8"/><path d="m10 9 1.3 1.3L14 7.7"/></svg>',
    help:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.3 1.7c-1 1-2 1.5-2 3M12 17h.01"/></svg>',
    profile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>',
    explore:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    admin:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };
  const state = { sb:null, session:null, user:null, profile:null, workspace:null, membership:null, courses:[], route:'home', ready:false };
  const isManager = () => state.profile?.role === 'admin' || ['owner','admin'].includes(state.membership?.role);
  const isStaff = () => state.profile?.role === 'admin' || ['owner','admin','instructor'].includes(state.membership?.role);
  const initials = () => (state.profile?.full_name || state.user?.email || 'Y').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join('');
  const fmtDate = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(String(value).slice(0,10)+'T12:00:00Z')) : 'Sin fecha';

  async function client() {
    const r = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}}); if(!r.ok) throw new Error('config');
    const c = await r.json();
    state.sb = window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data:{session}} = await state.sb.auth.getSession(); state.session=session; state.user=session?.user||null;
    if(!state.user) return false;
    const [{data:profile},{data:workspace}] = await Promise.all([
      state.sb.from('profiles').select('id,email,full_name,avatar_url,role,status').eq('id',state.user.id).maybeSingle(),
      state.sb.from('workspaces').select('id,name,slug').eq('slug',c.workspaceSlug||'yamilet-mes').maybeSingle()
    ]);
    state.profile=profile||null; state.workspace=workspace||null; if(!workspace) return false;
    const {data:member}=await state.sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',state.user.id).maybeSingle();
    state.membership=member?.status==='active'?member:null;
    const {data:courses}=await state.sb.from('courses').select('id,title,subtitle,description,status,cover_url,featured,instructor_name,duration_label').eq('workspace_id',workspace.id).order('featured',{ascending:false}).order('created_at',{ascending:true});
    state.courses=courses||[]; state.ready=true; return true;
  }

  function navButton(route,label,icon,cls='') { return `<button class="shell-nav-item ${cls}" type="button" data-shell-route="${route}"><span class="shell-nav-icon">${icons[icon]}</span><span>${label}</span></button>`; }
  function buildNav() {
    const nav=$('.sidebar nav'); if(!nav || nav.dataset.shellV21) return; nav.dataset.shellV21='true';
    nav.insertAdjacentHTML('beforeend', `<div class="shell-sidebar-label">MI ESPACIO</div>
      ${navButton('home','Inicio','home')}${navButton('courses','Mis cursos','courses')}${navButton('evaluations','Evaluaciones','evaluations')}${navButton('library','Mi biblioteca','library')}${navButton('calendar','Calendario','calendar')}${navButton('certificates','Certificados','certificates')}${navButton('help','Ayuda y soporte','help')}${navButton('profile','Mi perfil','profile')}${navButton('explore','Explorar cursos','explore','shell-nav-secondary')}${isStaff()?navButton('admin','Administrar','admin','shell-nav-admin'):''}`);
    $$('.shell-nav-item',nav).forEach(b=>b.addEventListener('click',()=>route(b.dataset.shellRoute)));
  }

  function buildTopbar() {
    const main=$('.dashboard-main'); if(!main || $('.academy-topbar',main)) return;
    main.insertAdjacentHTML('afterbegin', `<header class="academy-topbar">
      <div class="academy-topbar-brand"><small>YAMILET PÉREZ · MÉTODO MES</small><strong data-shell-breadcrumb>Inicio</strong></div>
      <div class="academy-search-wrap"><input class="academy-search" type="search" placeholder="Buscar cursos, lecciones, libros o ayuda" aria-label="Buscar en Academia Yamilet"><button class="academy-search-clear" type="button" aria-label="Limpiar búsqueda">×</button><div class="academy-search-results hidden" data-search-results></div></div>
      <div class="academy-topbar-actions"><button class="academy-icon-btn" type="button" data-quick-help title="Ayuda">?</button><a class="academy-icon-btn" href="../es/" title="Volver a Yamilet Pérez">↗</a><button class="academy-avatar" type="button" data-avatar-button title="Mi perfil">${esc(initials())}</button></div>
    </header>`);
    $('[data-quick-help]')?.addEventListener('click',()=>route('help')); $('[data-avatar-button]')?.addEventListener('click',()=>route('profile'));
    $('.academy-search-clear')?.addEventListener('click',()=>{const i=$('.academy-search');if(i){i.value='';renderSearch('');i.focus();}});
    $('.academy-search')?.addEventListener('input',e=>renderSearch(e.target.value));
  }

  function ensurePages() {
    const main=$('.dashboard-main'); if(!main || $('[data-shell-page="evaluations"]')) return;
    ['evaluations','library','calendar','certificates','help','profile','explore','admin'].forEach(name=>main.insertAdjacentHTML('beforeend',`<section class="shell-page hidden" data-shell-page="${name}"><div class="shell-empty"><div><strong>Preparando ${name}…</strong><span>Cargando Academia Yamilet.</span></div></div></section>`));
  }
  function allShellPages(){return $$('[data-shell-page]')}
  function hideNativeFocus(){ $('[data-course-view]')?.classList.add('hidden'); $('[data-lesson-view]')?.classList.add('hidden'); $('[data-content-admin]')?.classList.add('hidden'); $('[data-students-admin]')?.classList.add('hidden'); }
  function activeNav(name){$$('[data-shell-route]').forEach(b=>b.classList.toggle('active',b.dataset.shellRoute===name)); const bc=$('[data-shell-breadcrumb]'); if(bc) bc.textContent=({home:'Inicio',courses:'Mis cursos',evaluations:'Evaluaciones',library:'Mi biblioteca',calendar:'Calendario',certificates:'Certificados',help:'Ayuda y soporte',profile:'Mi perfil',explore:'Explorar cursos',admin:'Administrar'})[name]||'Academia Yamilet';}

  async function route(name){
    state.route=name; const main=$('.dashboard-main'); if(!main)return; activeNav(name); allShellPages().forEach(p=>p.classList.add('hidden')); hideNativeFocus();
    const reservations=$('#reservas'); if(reservations){reservations.style.removeProperty('grid-column');reservations.style.removeProperty('grid-row');}
    main.classList.remove('shell-route-mode','shell-courses-mode');
    if(name==='home'){ window.scrollTo({top:0,behavior:'smooth'}); return; }
    if(name==='courses'){main.classList.add('shell-courses-mode'); $('#mis-cursos')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    main.classList.add('shell-route-mode'); const page=$(`[data-shell-page="${name}"]`); page?.classList.remove('hidden');
    if(name==='evaluations') await renderEvaluations(page); if(name==='library') await renderLibrary(page); if(name==='calendar') await renderCalendar(page); if(name==='certificates') await renderCertificates(page); if(name==='help') renderHelp(page); if(name==='profile') renderProfile(page); if(name==='explore') renderExplore(page); if(name==='admin') renderAdmin(page);
    page?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function renderEvaluations(page){
    const ids=state.courses.map(c=>c.id); let assessments=[]; let attempts=[];
    if(ids.length){ const {data}=await state.sb.from('assessments').select('id,course_id,module_id,title,description,assessment_type,passing_score,max_attempts,time_limit_minutes,status,position').in('course_id',ids).order('position',{ascending:true}); assessments=data||[]; }
    if(assessments.length){ const {data}=await state.sb.from('assessment_attempts').select('assessment_id,attempt_number,status,score,passed,submitted_at').eq('user_id',state.user.id).in('assessment_id',assessments.map(a=>a.id)); attempts=data||[]; }
    const byId=new Map(); attempts.forEach(a=>{const prev=byId.get(a.assessment_id);if(!prev||a.attempt_number>prev.attempt_number)byId.set(a.assessment_id,a)});
    const approved=[...byId.values()].filter(a=>a.passed).length;
    page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Aprendizaje y comprobación</div><h2>Evaluaciones</h2><p>Consulta las evaluaciones vinculadas a tus cursos y el estado de tus intentos.</p></div><div class="shell-summary"><article><strong>${assessments.length}</strong><span>Asignadas</span></article><article><strong>${approved}</strong><span>Aprobadas</span></article><article><strong>${attempts.length}</strong><span>Intentos</span></article></div></div>${assessments.length?`<div class="shell-grid two">${assessments.map(a=>{const at=byId.get(a.id);const course=state.courses.find(c=>c.id===a.course_id);return `<article class="shell-card"><div class="eyebrow">${esc(course?.title||'Curso')}</div><h3>${esc(a.title)}</h3><p>${esc(a.description||'Evaluación académica del programa.')}</p><div class="shell-card-footer"><span class="shell-pill ${at?.passed?'':'muted'}">${at?.passed?'Aprobada':at?'Intentada':'Pendiente'}</span><span>${a.passing_score!=null?`${esc(a.passing_score)}% mínimo`:''}</span></div></article>`}).join('')}</div>`:`<div class="shell-empty"><div><strong>Aún no hay evaluaciones asignadas</strong><span>Cuando Método MES incorpore evaluaciones aparecerán aquí automáticamente.</span></div></div>`}`;
  }

  async function renderLibrary(page){
    let resources=[];
    if(state.workspace){ const {data}=await state.sb.from('resources').select('id,course_id,title,description,resource_type,file_path,external_url,is_public,created_at').eq('workspace_id',state.workspace.id).order('position',{ascending:true}); resources=data||[]; }
    page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Material de acompañamiento</div><h2>Mi biblioteca</h2><p>Libros, manuales, ejercicios y recursos vinculados a tus programas.</p></div><div class="shell-summary"><article><strong>${resources.length}</strong><span>Recursos</span></article><article><strong>${new Set(resources.map(r=>r.course_id).filter(Boolean)).size}</strong><span>Cursos</span></article></div></div>${resources.length?`<div class="shell-grid two">${resources.map(r=>`<article class="shell-card library-card"><div class="library-icon">${esc((r.resource_type||'R').slice(0,1).toUpperCase())}</div><div><div class="library-meta">${esc(r.resource_type||'recurso')}</div><h3>${esc(r.title)}</h3><p>${esc(r.description||'Material de Academia Yamilet.')}</p><div class="shell-card-footer">${r.external_url?`<a class="shell-action primary" href="${esc(r.external_url)}" target="_blank" rel="noopener">Abrir recurso</a>`:`<button class="shell-action" type="button" disabled>Disponible en el curso</button>`}</div></div></article>`).join('')}</div>`:`<div class="shell-empty"><div><strong>Tu biblioteca está preparada</strong><span>Los libros y recursos de Método MES aparecerán aquí al cargarlos desde Contenido.</span></div></div>`}`;
  }

  async function renderCalendar(page){
    const now=new Date(); const days=[...Array(7)].map((_,i)=>{const d=new Date(now);d.setDate(now.getDate()+i);return d}); let bookings=[];
    if(isManager()){const {data}=await state.sb.from('free_class_bookings').select('id,booking_date,full_name,email,status').eq('workspace_id',state.workspace.id).gte('booking_date',now.toISOString().slice(0,10)).order('booking_date',{ascending:true}).limit(20);bookings=data||[];}
    page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Tu tiempo y tus encuentros</div><h2>Calendario</h2><p>${isManager()?'Visualiza las solicitudes próximas de clase gratuita y la actividad programada.':'Tus sesiones y encuentros académicos aparecerán aquí cuando sean programados.'}</p></div></div><div class="calendar-strip">${days.map((d,i)=>`<div class="calendar-day ${i===0?'today':''}"><span>${new Intl.DateTimeFormat('es-MX',{weekday:'short'}).format(d)}</span><strong>${d.getDate()}</strong><span>${new Intl.DateTimeFormat('es-MX',{month:'short'}).format(d)}</span></div>`).join('')}</div>${bookings.length?`<div class="shell-grid" style="grid-template-columns:1fr">${bookings.map(b=>`<article class="calendar-event"><div class="calendar-event-date">${fmtDate(b.booking_date)}</div><div><strong>${esc(b.full_name)}</strong><small>${esc(b.email)}</small></div><span class="shell-pill ${b.status==='confirmed'?'gold':'muted'}">${esc(b.status||'requested')}</span></article>`).join('')}</div>`:`<div class="shell-empty"><div><strong>No hay eventos próximos</strong><span>${isManager()?'Las nuevas reservaciones de clase gratis aparecerán aquí y también en Compás One.':'Cuando se programe una sesión, la verás aquí.'}</span></div></div>`}`;
  }

  async function renderCertificates(page){
    const {data}=await state.sb.from('certificates').select('id,course_id,issued_at,verification_code,recipient_name,revoked_at').eq('user_id',state.user.id).order('issued_at',{ascending:false}); const certs=(data||[]).filter(c=>!c.revoked_at);
    page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Reconocimiento de tu proceso</div><h2>Certificados</h2><p>Aquí se conservarán los certificados obtenidos al completar los requisitos de cada programa.</p></div><div class="shell-summary"><article><strong>${certs.length}</strong><span>Obtenidos</span></article><article><strong>${state.courses.length}</strong><span>Programas</span></article></div></div>${certs.length?`<div class="shell-grid two">${certs.map(c=>{const course=state.courses.find(x=>x.id===c.course_id);return `<article class="shell-card"><div class="eyebrow">Certificado</div><h3>${esc(course?.title||'Academia Yamilet')}</h3><p>Emitido a ${esc(c.recipient_name||state.profile?.full_name||'alumna')} el ${fmtDate(c.issued_at)}.</p><div class="shell-card-footer"><span class="shell-pill gold">Verificado</span><span class="library-meta">${esc(c.verification_code||'')}</span></div></article>`}).join('')}</div>`:`<div class="shell-empty"><div><strong>Tu área de certificados está lista</strong><span>Los certificados se habilitarán cuando completes un programa que tenga certificación configurada.</span></div></div>`}`;
  }

  function renderHelp(page){page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Estamos para acompañarte</div><h2>Ayuda y soporte</h2><p>Encuentra rutas rápidas para resolver acceso, contenido y navegación dentro de Academia Yamilet.</p></div></div><div class="shell-grid"><article class="shell-card"><div class="eyebrow">Acceso</div><h3>Contraseña y sesión</h3><p>Desde la pantalla de acceso puedes solicitar un enlace seguro o cambiar tu contraseña.</p></article><article class="shell-card"><div class="eyebrow">Aprendizaje</div><h3>Contenido del curso</h3><p>Si una lección o recurso todavía no aparece, revisa primero que el curso esté publicado y tu acceso activo.</p></article><article class="shell-card"><div class="eyebrow">Navegación</div><h3>Volver a Yamilet</h3><p>Puedes regresar a la página principal sin cerrar tu sesión de Academia.</p><div class="shell-card-footer"><a class="shell-action primary" href="../es/">Ver página</a></div></article></div>`;}

  function renderProfile(page){const p=state.profile||{};page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Tu cuenta</div><h2>Mi perfil</h2><p>Administra la información básica con la que apareces dentro de Academia Yamilet.</p></div></div><div class="profile-shell"><article class="shell-card profile-identity"><div class="profile-big-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="Perfil">`:esc(initials())}</div><h3>${esc(p.full_name||'Usuario')}</h3><p>${esc(p.email||state.user.email||'')}</p><div class="shell-card-footer" style="justify-content:center"><span class="shell-pill gold">${esc(state.membership?.role||p.role||'student')}</span></div></article><article class="shell-card"><div class="eyebrow">Información personal</div><h3>Datos de cuenta</h3><form class="profile-form" data-profile-form><label>Nombre completo<input name="full_name" value="${esc(p.full_name||'')}" maxlength="120" required></label><label>Correo<input value="${esc(p.email||state.user.email||'')}" disabled></label><div><button class="shell-action primary" type="submit">Guardar cambios</button></div><div class="shell-status-line" data-profile-status></div></form></article></div>`; $('[data-profile-form]',page)?.addEventListener('submit',saveProfile);}
  async function saveProfile(e){e.preventDefault();const f=e.currentTarget;const name=f.full_name.value.trim();const st=$('[data-profile-status]',f);if(!name)return;st.textContent='Guardando…';const {error}=await state.sb.from('profiles').update({full_name:name}).eq('id',state.user.id);if(error){st.textContent='No fue posible guardar los cambios.';st.className='shell-status-line error';return;}state.profile.full_name=name;st.textContent='Perfil actualizado.';st.className='shell-status-line ok';const h=$('[data-user-name]');if(h)h.textContent=name;}

  function renderExplore(page){page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Catálogo Yamilet</div><h2>Explorar cursos</h2><p>Programas disponibles dentro de tu acceso actual. Nuevas formaciones se incorporarán aquí conforme se publiquen.</p></div><div class="shell-summary"><article><strong>${state.courses.length}</strong><span>Disponibles</span></article></div></div>${state.courses.length?`<div class="shell-grid">${state.courses.map(c=>`<article class="shell-card"><div class="eyebrow">${c.status==='published'?'Disponible':'En preparación'}</div><h3>${esc(c.title)}</h3><p>${esc(c.subtitle||c.description||'Programa de Academia Yamilet.')}</p><div class="shell-card-footer"><span class="shell-pill ${c.status==='published'?'gold':'muted'}">${esc(c.status)}</span><button class="shell-action primary" type="button" data-open-course>Ver en Mis cursos</button></div></article>`).join('')}</div>`:`<div class="shell-empty"><div><strong>No hay programas disponibles</strong><span>El catálogo se actualizará cuando se publiquen nuevos cursos.</span></div></div>`}`;$$('[data-open-course]',page).forEach(b=>b.addEventListener('click',()=>route('courses')));}

  function renderAdmin(page){ if(!isStaff()){page.innerHTML='<div class="shell-empty"><div><strong>Acceso restringido</strong><span>Esta área está disponible únicamente para el equipo de Academia Yamilet.</span></div></div>';return;} page.innerHTML=`<div class="shell-page-heading"><div><div class="kicker">Operación académica</div><h2>Administrar</h2><p>Gestiona contenido, alumnas y seguimiento desde un centro separado de la experiencia principal.</p></div></div><div class="shell-grid"><article class="shell-card admin-launcher" data-admin-target="content"><div class="admin-launcher-icon">✎</div><div class="eyebrow">Contenido</div><h3>Cursos y lecciones</h3><p>Edita Método MES, módulos, lecciones, recursos y publicación.</p></article><article class="shell-card admin-launcher" data-admin-target="students"><div class="admin-launcher-icon">♙</div><div class="eyebrow">Alumnas</div><h3>Accesos e inscripciones</h3><p>Invita alumnas, asigna cursos y consulta su progreso.</p></article><article class="shell-card admin-launcher" data-admin-target="bookings"><div class="admin-launcher-icon">◷</div><div class="eyebrow">Seguimiento</div><h3>Clase gratuita</h3><p>Consulta reservas y confirma solicitudes de Método MES.</p></article></div>`; $$('[data-admin-target]',page).forEach(card=>card.addEventListener('click',()=>openNativeAdmin(card.dataset.adminTarget))); }
  function openNativeAdmin(target){const main=$('.dashboard-main');allShellPages().forEach(p=>p.classList.add('hidden'));main.classList.add('shell-route-mode');hideNativeFocus();if(target==='content'){const old=$('[data-content-admin-nav]');old?.click();$('[data-content-admin]')?.classList.remove('hidden');}if(target==='students'){const old=$('[data-students-admin-nav]');old?.click();$('[data-students-admin]')?.classList.remove('hidden');}if(target==='bookings'){$('#reservas')?.classList.remove('hidden');$('#reservas')?.style.setProperty('grid-column','1/-1','important');$('#reservas')?.style.setProperty('grid-row','auto','important');}}

  function renderSearch(query){const box=$('[data-search-results]');if(!box)return;const q=String(query||'').trim().toLowerCase();if(q.length<2){box.classList.add('hidden');box.innerHTML='';return;}const staticItems=[['Evaluaciones','evaluations'],['Mi biblioteca','library'],['Calendario','calendar'],['Certificados','certificates'],['Ayuda y soporte','help'],['Mi perfil','profile']];const hits=[...state.courses.filter(c=>(c.title+' '+(c.subtitle||'')).toLowerCase().includes(q)).map(c=>({title:c.title,type:'Curso',route:'courses'})),...staticItems.filter(([t])=>t.toLowerCase().includes(q)).map(([title,route])=>({title,type:'Sección',route}))].slice(0,8);box.innerHTML=hits.length?hits.map((h,i)=>`<button class="academy-search-result" type="button" data-search-index="${i}"><strong>${esc(h.title)}</strong><small>${esc(h.type)}</small></button>`).join(''):`<div class="shell-empty" style="min-height:90px;padding:18px">Sin resultados para “${esc(query)}”.</div>`;box.classList.remove('hidden');$$('[data-search-index]',box).forEach((b,i)=>b.addEventListener('click',()=>{box.classList.add('hidden');route(hits[i].route)}));}

  async function boot(){
    const dashboard=$('[data-dashboard]'); if(!dashboard)return;
    try{const ok=await client();if(!ok)return;buildNav();buildTopbar();ensurePages();activeNav('home');
      const avatar=$('.academy-avatar');if(avatar && state.profile?.avatar_url)avatar.innerHTML=`<img src="${esc(state.profile.avatar_url)}" alt="Perfil">`;
      window.ACADEMIA_YAMILET_SHELL={release:RELEASE,route,state};
    }catch(e){console.error('Yamilet shell v21',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,250));else setTimeout(boot,250);
  window.addEventListener('yamilet:session-ready',()=>setTimeout(boot,50));
  const obs=new MutationObserver(()=>{if($('[data-dashboard]')&&!$('[data-dashboard]').classList.contains('hidden')&&!state.ready)boot();});obs.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();