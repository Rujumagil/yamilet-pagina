(() => {
  'use strict';

  const VERSION = '79.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const SECTIONS = new Set(['overview','courses','content','students','agenda','evaluations','certificates','support','operations','settings']);
  const LABELS = {
    overview:'Resumen', courses:'Cursos', content:'Contenido', students:'Estudiantes', agenda:'Agenda',
    evaluations:'Evaluaciones', certificates:'Certificados', support:'Soporte', operations:'Operación', settings:'Configuración'
  };
  let clientPromise = null;
  let dataCache = null;
  let renderTimer = null;
  let lastRoute = '';
  let observer = null;

  function routeParts() {
    return String(location.hash || '#home').replace(/^#/, '').split('/').filter(Boolean).map(part => decodeURIComponent(part));
  }

  function adminSection() {
    const parts = routeParts();
    if (parts[0] !== 'admin') return null;
    const requested = parts[1] || 'overview';
    return SECTIONS.has(requested) ? requested : 'overview';
  }

  function go(section = 'overview') {
    const next = section === 'overview' ? '#admin' : `#admin/${encodeURIComponent(section)}`;
    if (location.hash === next) {
      schedule(20, true);
      return;
    }
    location.hash = next;
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, {headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error('admin_config');
        const config = await response.json();
        const sb = window.supabase.createClient(config.url, config.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
        return {sb,config};
      })().catch(error => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }

  async function context() {
    const {sb,config} = await getClient();
    const {data:{session}} = await sb.auth.getSession();
    if (!session?.user) throw new Error('admin_session');
    const user = session.user;
    const [{data:profile},{data:workspace}] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,status').eq('id',user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug',config.workspaceSlug||'yamilet-mes').maybeSingle()
    ]);
    if (!workspace) throw new Error('admin_workspace');
    const {data:membership} = await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',user.id).maybeSingle();
    const role = membership?.status === 'active' ? membership.role : profile?.role;
    if (!['owner','admin','instructor'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
    return {sb,config,user,profile:profile||{},workspace,role};
  }

  async function safe(query) {
    const result = await query;
    if (result.error) {
      console.warn('Academia Yamilet admin v79 query', result.error);
      return [];
    }
    return result.data || [];
  }

  async function loadData(force = false) {
    if (dataCache && !force) return dataCache;
    const ctx = await context();
    const {sb,workspace} = ctx;
    const [courses,events,tickets] = await Promise.all([
      safe(sb.from('courses').select('id,title,subtitle,status,featured,category,duration_label,updated_at').eq('workspace_id',workspace.id).order('featured',{ascending:false}).order('created_at',{ascending:true})),
      safe(sb.from('academy_events').select('id,course_id,title,event_type,starts_at,status,delivery_mode,is_featured').eq('workspace_id',workspace.id).order('starts_at',{ascending:true}).limit(80)),
      safe(sb.from('academy_support_tickets').select('id,user_id,course_id,subject,category,priority,status,created_at,last_message_at').eq('workspace_id',workspace.id).order('last_message_at',{ascending:false}).limit(80))
    ]);
    const courseIds = courses.map(course => course.id);
    let enrollments = [], certificates = [], assessments = [];
    if (courseIds.length) {
      [enrollments,certificates,assessments] = await Promise.all([
        safe(sb.from('enrollments').select('user_id,course_id,status,enrolled_at,completed_at').in('course_id',courseIds).order('enrolled_at',{ascending:false})),
        safe(sb.from('certificates').select('id,user_id,course_id,recipient_name,issued_at,verification_code,revoked_at').in('course_id',courseIds).order('issued_at',{ascending:false}).limit(80)),
        safe(sb.from('assessments').select('id,course_id,title,status,assessment_type,updated_at').in('course_id',courseIds).order('position',{ascending:true}))
      ]);
    }
    const userIds = [...new Set([...enrollments.map(item=>item.user_id),...tickets.map(item=>item.user_id),...certificates.map(item=>item.user_id)].filter(Boolean))];
    const profiles = userIds.length ? await safe(sb.from('profiles').select('id,full_name,email,status').in('id',userIds)) : [];
    dataCache = {...ctx,courses,events,tickets,enrollments,certificates:certificates.filter(item=>!item.revoked_at),assessments,profiles};
    return dataCache;
  }

  function profileName(data,id) {
    const profile = data.profiles.find(item => item.id === id);
    return profile?.full_name || profile?.email || 'Estudiante';
  }

  function courseName(data,id) {
    return data.courses.find(item => item.id === id)?.title || 'Academia Yamilet';
  }

  function fmt(value, time = false) {
    if (!value) return 'Sin fecha';
    try {
      return new Intl.DateTimeFormat('es-MX', time ? {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'} : {day:'2-digit',month:'short',year:'numeric'}).format(new Date(value));
    } catch { return 'Sin fecha'; }
  }

  function roleLabel(role) {
    if (role === 'owner') return 'Propietario';
    if (role === 'admin') return 'Administrador';
    return 'Instructor';
  }

  function page() {
    return $('[data-shell-page="admin"]');
  }

  function ensureRoot() {
    const target = page();
    if (!target) return null;
    target.classList.add('admin-v79-active');
    let root = $('[data-admin-v79-root]',target);
    if (!root) {
      root = document.createElement('div');
      root.dataset.adminV79Root = 'true';
      root.className = 'admin-v79-root';
      target.prepend(root);
    }
    return root;
  }

  function updateChrome(section) {
    document.body.dataset.adminV79Section = section;
    const breadcrumb = $('[data-shell-breadcrumb]');
    if (breadcrumb) breadcrumb.textContent = section === 'overview' ? 'Administración' : `Administración · ${LABELS[section]}`;
    document.title = `${section === 'overview' ? 'Administración' : LABELS[section]} | Academia Yamilet`;
  }

  function nav(section) {
    const items = [
      ['overview','⌂'],['courses','▤'],['content','✎'],['students','◎'],['agenda','◷'],['evaluations','✓'],['certificates','◇'],['support','?'],['operations','⌁'],['settings','⚙']
    ];
    return `<nav class="admin-v79-nav" aria-label="Módulos administrativos">${items.map(([id,icon]) => `<button type="button" class="${id===section?'active':''}" data-admin-v79-go="${id}"><span>${icon}</span><b>${LABELS[id]}</b></button>`).join('')}</nav>`;
  }

  function shell(section, body, options = {}) {
    const root = ensureRoot();
    if (!root) return null;
    root.innerHTML = `<div class="admin-v79-shell">
      <header class="admin-v79-top"><div><span>CENTRO ADMINISTRATIVO</span><h1>${esc(options.title || LABELS[section])}</h1><p>${esc(options.copy || 'Gestiona Academia Yamilet desde un espacio separado de la experiencia de aprendizaje.')}</p></div><div class="admin-v79-top-actions"><button type="button" data-admin-v79-refresh>Actualizar</button><a href="#home">Salir de administración</a></div></header>
      ${nav(section)}
      <main class="admin-v79-module" data-admin-v79-module>${body}</main>
    </div>`;
    bindShell(root);
    return $('[data-admin-v79-module]',root);
  }

  function bindShell(root) {
    $$('[data-admin-v79-go]',root).forEach(button => button.addEventListener('click',()=>go(button.dataset.adminV79Go)));
    $('[data-admin-v79-refresh]',root)?.addEventListener('click',()=>schedule(10,true));
  }

  function statCard(value,label,copy='') {
    return `<article><strong>${esc(value)}</strong><span>${esc(label)}</span>${copy?`<small>${esc(copy)}</small>`:''}</article>`;
  }

  function overview(data) {
    const activeEnrollments = data.enrollments.filter(item=>item.status==='active');
    const uniqueStudents = new Set(activeEnrollments.map(item=>item.user_id)).size;
    const openTickets = data.tickets.filter(item=>!['resolved','closed'].includes(item.status)).length;
    const now = Date.now();
    const upcoming = data.events.filter(item=>item.status==='published' && item.starts_at && new Date(item.starts_at).getTime()>=now);
    const published = data.courses.filter(item=>item.status==='published').length;
    const certificates = data.certificates.length;
    const recent = activeEnrollments.slice(0,5);
    const nextEvents = upcoming.slice(0,4);
    const tickets = data.tickets.filter(item=>!['resolved','closed'].includes(item.status)).slice(0,4);
    const module = shell('overview',`<section class="admin-v79-summary">
        ${statCard(data.courses.length,'Programas',`${published} publicados`)}
        ${statCard(uniqueStudents,'Estudiantes','con acceso activo')}
        ${statCard(upcoming.length,'Eventos próximos','publicados')}
        ${statCard(openTickets,'Tickets abiertos','requieren seguimiento')}
        ${statCard(certificates,'Certificados','vigentes')}
      </section>
      <section class="admin-v79-quick-grid">
        <article class="featured" data-admin-v79-go-card="content"><span>CONTENIDO</span><h2>Cursos y lecciones</h2><p>Edita programas, semanas, lecciones, recursos y videos desde el editor académico existente.</p><b>Gestionar contenido →</b></article>
        <article data-admin-v79-go-card="students"><span>ACCESOS</span><h2>Estudiantes</h2><p>Gestiona inscripciones, cursos asignados y seguimiento de acceso.</p><b>Gestionar estudiantes →</b></article>
        <article data-admin-v79-go-card="agenda"><span>AGENDA</span><h2>Sesiones y eventos</h2><p>Programa clases, talleres, webinars y encuentros.</p><b>Abrir agenda →</b></article>
        <article data-admin-v79-go-card="evaluations"><span>EVALUACIONES</span><h2>Constructor académico</h2><p>Crea evaluaciones, preguntas, puntajes e intentos.</p><b>Gestionar evaluaciones →</b></article>
      </section>
      <section class="admin-v79-live-grid">
        <article><header><div><span>ESTUDIANTES</span><h3>Inscripciones recientes</h3></div><button data-admin-v79-go="students">Ver todos</button></header>${recent.length?`<div class="admin-v79-list">${recent.map(item=>`<div><i>◎</i><span><strong>${esc(profileName(data,item.user_id))}</strong><small>${esc(courseName(data,item.course_id))} · ${esc(fmt(item.enrolled_at))}</small></span><em>Activo</em></div>`).join('')}</div>`:'<div class="admin-v79-empty">Aún no hay inscripciones activas.</div>'}</article>
        <article><header><div><span>AGENDA</span><h3>Próximos eventos</h3></div><button data-admin-v79-go="agenda">Ver agenda</button></header>${nextEvents.length?`<div class="admin-v79-list">${nextEvents.map(item=>`<div><i>◷</i><span><strong>${esc(item.title)}</strong><small>${esc(fmt(item.starts_at,true))}</small></span><em>${esc(item.delivery_mode||'Evento')}</em></div>`).join('')}</div>`:'<div class="admin-v79-empty">No hay eventos próximos publicados.</div>'}</article>
        <article><header><div><span>SOPORTE</span><h3>Casos por atender</h3></div><button data-admin-v79-go="support">Abrir soporte</button></header>${tickets.length?`<div class="admin-v79-list">${tickets.map(item=>`<div><i>?</i><span><strong>${esc(item.subject)}</strong><small>${esc(profileName(data,item.user_id))}</small></span><em>${esc(item.status||'Abierto')}</em></div>`).join('')}</div>`:'<div class="admin-v79-empty">No hay solicitudes abiertas.</div>'}</article>
      </section>`,{title:'Administración',copy:'Controla contenido, estudiantes, agenda, evaluaciones, soporte y certificación sin mezclar herramientas en una sola pantalla.'});
    $$('[data-admin-v79-go-card]',module).forEach(card=>card.addEventListener('click',()=>go(card.dataset.adminV79GoCard)));
  }

  function courses(data) {
    const module = shell('courses',`<section class="admin-v79-section-head"><div><span>PROGRAMAS</span><h2>Cursos de Academia Yamilet</h2><p>Consulta el estado de los programas y entra al editor de contenido cuando necesites modificar módulos o lecciones.</p></div><button type="button" data-admin-v79-go="content">Editar contenido</button></section>
      <section class="admin-v79-course-grid">${data.courses.length?data.courses.map(course=>`<article><div class="admin-v79-course-state ${esc(course.status||'draft')}">${course.status==='published'?'PUBLICADO':'BORRADOR'}</div><span>${esc(course.category||'Academia Yamilet')}</span><h3>${esc(course.title)}</h3><p>${esc(course.subtitle||course.duration_label||'Programa académico')}</p><div><small>${course.featured?'Destacado · ':''}${esc(course.duration_label||'')}</small><button type="button" data-admin-v79-go="content">Editar →</button></div></article>`).join(''):'<div class="admin-v79-empty large">No hay cursos creados en este workspace.</div>'}</section>`,{title:'Cursos',copy:'Vista administrativa de los programas del workspace Academia Yamilet.'});
  }

  function certificatesView(data) {
    const rows = data.certificates;
    shell('certificates',`<section class="admin-v79-summary compact">${statCard(rows.length,'Emitidos','vigentes')}${statCard(new Set(rows.map(item=>item.user_id)).size,'Personas certificadas')}${statCard(new Set(rows.map(item=>item.course_id)).size,'Programas con certificados')}</section>
      <section class="admin-v79-section-head"><div><span>CERTIFICACIÓN</span><h2>Certificados emitidos</h2><p>Consulta los reconocimientos vigentes y sus códigos de verificación.</p></div></section>
      ${rows.length?`<div class="admin-v79-table"><div class="head"><span>Estudiante</span><span>Programa</span><span>Fecha</span><span>Código</span></div>${rows.map(item=>`<div><span data-label="Estudiante"><strong>${esc(item.recipient_name||profileName(data,item.user_id))}</strong></span><span data-label="Programa">${esc(courseName(data,item.course_id))}</span><span data-label="Fecha">${esc(fmt(item.issued_at))}</span><span data-label="Código"><code>${esc(item.verification_code||'—')}</code></span></div>`).join('')}</div>`:'<div class="admin-v79-empty large">Aún no hay certificados emitidos.</div>'}`,{title:'Certificados',copy:'Seguimiento administrativo de certificados emitidos y vigentes.'});
  }

  function settings(data) {
    shell('settings',`<section class="admin-v79-settings-grid">
      <article><span>WORKSPACE</span><h2>${esc(data.workspace.name||'Academia Yamilet')}</h2><p>Identificador: <code>${esc(data.workspace.slug||'')}</code></p><div><b>Estado</b><strong>Activo</strong></div></article>
      <article><span>TU ACCESO</span><h2>${esc(roleLabel(data.role))}</h2><p>${esc(data.profile.full_name||data.user.email||'Equipo Academia Yamilet')}</p><div><b>Permisos</b><strong>${data.role==='instructor'?'Académicos':'Administrativos'}</strong></div></article>
      <article><span>SEGURIDAD</span><h2>Acceso protegido</h2><p>Los datos administrativos siguen sujetos a autenticación y políticas RLS del workspace.</p><div><b>Cliente</b><strong>Clave pública</strong></div></article>
      <article><span>PUBLICACIÓN</span><h2>Catálogo y Academia</h2><p>Los cursos publicados se exponen según las reglas del catálogo; las lecciones privadas requieren inscripción.</p><div><b>Cursos publicados</b><strong>${data.courses.filter(item=>item.status==='published').length}</strong></div></article>
    </section>`,{title:'Configuración',copy:'Resumen operativo del workspace y de tu nivel de acceso.'});
  }

  function loading(section) {
    shell(section,'<div class="admin-v79-loading"><span></span><strong>Preparando módulo administrativo…</strong><small>Consultando datos y permisos del workspace.</small></div>',{title:LABELS[section],copy:'Cargando información administrativa.'});
  }

  function mountNative(section, selector, triggerSelector) {
    const mount = shell(section,'<div class="admin-v79-loading"><span></span><strong>Abriendo herramienta…</strong><small>Conectando el editor existente con esta ruta administrativa.</small></div>',{
      title:LABELS[section],
      copy:section==='content'?'Gestiona cursos, módulos, lecciones, recursos y videos.':'Gestiona cuentas, inscripciones y acceso académico.'
    });
    const attach = () => {
      const target = $(selector);
      if (!target || !mount) return false;
      target.classList.remove('hidden');
      mount.innerHTML = '';
      mount.appendChild(target);
      target.classList.add('admin-v79-native-panel');
      return true;
    };
    $(triggerSelector)?.click();
    [60,180,420,900,1600].forEach(delay=>setTimeout(attach,delay));
  }

  function legacyModule(section) {
    const details = {
      agenda:['[data-event-admin-host]','Agenda','Programa sesiones, talleres, webinars y encuentros para estudiantes.'],
      evaluations:['[data-assessment-admin-host]','Evaluaciones','Construye evaluaciones, preguntas y reglas de aprobación.'],
      operations:['[data-academy-ops]','Operación','Consulta compras, accesos, registros y soporte.'],
      support:['[data-academy-ops]','Soporte','Atiende solicitudes y conversaciones de soporte.']
    }[section];
    const mount = shell(section,'<div class="admin-v79-loading"><span></span><strong>Preparando herramienta…</strong><small>Conectando el módulo administrativo.</small></div>',{title:details[1],copy:details[2]});
    if (section==='operations' || section==='support') window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.render?.();
    const attach = () => {
      const target = $(details[0],page());
      if (!target || !mount) return false;
      mount.innerHTML='';
      mount.appendChild(target);
      target.classList.add('admin-v79-legacy-panel');
      if (section==='support') setTimeout(()=> $('[data-ops-tab="support"]',target)?.click(),40);
      return true;
    };
    [80,220,500,900,1500,2400].forEach(delay=>setTimeout(attach,delay));
  }

  function hideNativeOutside(section) {
    if (!['content','students'].includes(section)) {
      $('[data-content-admin]')?.classList.add('hidden');
      $('[data-students-admin]')?.classList.add('hidden');
    }
  }

  async function render(force = false) {
    const section = adminSection();
    if (!section) {
      delete document.body.dataset.adminV79Section;
      return false;
    }
    const target = page();
    if (!target || target.classList.contains('hidden')) return false;
    lastRoute = location.hash;
    updateChrome(section);
    hideNativeOutside(section);
    if (section==='content') { mountNative('content','[data-content-admin]','[data-content-admin-nav]'); return true; }
    if (section==='students') { mountNative('students','[data-students-admin]','[data-students-admin-nav]'); return true; }
    if (['agenda','evaluations','operations','support'].includes(section)) { legacyModule(section); return true; }
    loading(section);
    try {
      const data = await loadData(force);
      if (location.hash !== lastRoute && adminSection() !== section) return false;
      if (section==='courses') courses(data);
      else if (section==='certificates') certificatesView(data);
      else if (section==='settings') settings(data);
      else overview(data);
      return true;
    } catch (error) {
      console.error('Academia Yamilet admin v79',error);
      const root = ensureRoot();
      if (!root) return false;
      root.innerHTML = error?.message==='forbidden'
        ? '<div class="admin-v79-denied"><strong>Acceso restringido</strong><span>Este centro está disponible para el equipo autorizado de Academia Yamilet.</span><a href="#home">Volver al inicio</a></div>'
        : '<div class="admin-v79-denied"><strong>No fue posible cargar administración</strong><span>Revisa tu sesión e inténtalo nuevamente.</span><button type="button" data-admin-v79-retry>Reintentar</button></div>';
      $('[data-admin-v79-retry]',root)?.addEventListener('click',()=>schedule(10,true));
      return false;
    }
  }

  function schedule(delay = 100, force = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(()=>render(force),delay);
  }

  function start() {
    document.addEventListener('click',event=>{
      const button = event.target.closest('[data-admin-v79-go]');
      if (button) { event.preventDefault(); go(button.dataset.adminV79Go); return; }
      if (event.target.closest('[data-shell-route="admin"]')) setTimeout(()=>schedule(70),0);
    },true);
    window.addEventListener('hashchange',()=>schedule(80));
    window.addEventListener('popstate',()=>schedule(80));
    window.addEventListener('pageshow',()=>schedule(180));
    observer = new MutationObserver(()=>{
      if (!adminSection()) return;
      const target = page();
      if (target && !target.classList.contains('hidden') && !$('[data-admin-v79-root]',target)) schedule(40);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    [260,700,1400].forEach(delay=>setTimeout(()=>render(),delay));
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_ADMIN_V79 = {version:VERSION,render:()=>render(true),go};
})();
