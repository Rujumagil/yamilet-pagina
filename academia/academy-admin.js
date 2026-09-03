(() => {
  'use strict';

  const VERSION = '90.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
  const SECTIONS = new Set(['overview','courses','content','students','agenda','evaluations','certificates','support','operations','settings']);
  const DYNAMIC_SECTIONS = new Set(['agenda','evaluations','certificates','support','operations','settings']);
  const LABELS = {
    overview:'Resumen', courses:'Cursos', content:'Contenido', students:'Estudiantes', agenda:'Agenda',
    evaluations:'Evaluaciones', certificates:'Certificados', support:'Soporte', operations:'Operación', settings:'Configuración'
  };
  let clientPromise = null;
  let dataCache = null;
  let renderTimer = null;
  let lastRoute = '';
  let observer = null;
  let currentRole = null;

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
    currentRole = role;
    return {sb,config,user,profile:profile||{},workspace,role};
  }

  async function safe(query) {
    const result = await query;
    if (result.error) {
      console.warn('Academia Yamilet admin v90 query', result.error);
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
    let enrollments = [], certificates = [];
    if (courseIds.length) {
      [enrollments,certificates] = await Promise.all([
        safe(sb.from('enrollments').select('user_id,course_id,status,enrolled_at,completed_at').in('course_id',courseIds).order('enrolled_at',{ascending:false})),
        safe(sb.from('certificates').select('id,user_id,course_id,recipient_name,issued_at,verification_code,revoked_at').in('course_id',courseIds).order('issued_at',{ascending:false}).limit(80))
      ]);
    }
    const userIds = [...new Set([...enrollments.map(item=>item.user_id),...tickets.map(item=>item.user_id),...certificates.map(item=>item.user_id)].filter(Boolean))];
    const profiles = userIds.length ? await safe(sb.from('profiles').select('id,full_name,email,status').in('id',userIds)) : [];
    dataCache = {...ctx,courses,events,tickets,enrollments,certificates:certificates.filter(item=>!item.revoked_at),profiles};
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
    document.body.dataset.academyAdminRole = currentRole || '';
    const breadcrumb = $('[data-shell-breadcrumb]');
    if (breadcrumb) breadcrumb.textContent = section === 'overview' ? 'Administración' : `Administración · ${LABELS[section]}`;
    document.title = `${section === 'overview' ? 'Administración' : LABELS[section]} | Academia Yamilet`;
  }

  function allowedNavItems() {
    const items = [
      ['overview','⌂'],['courses','▤'],['content','✎'],['students','◎'],['agenda','◷'],['evaluations','✓'],['certificates','◇'],['support','?'],['operations','⌁'],['settings','⚙']
    ];
    return items.filter(([id]) => !(id === 'operations' && currentRole === 'instructor'));
  }

  function nav(section) {
    return `<nav class="admin-v79-nav" aria-label="Módulos administrativos">${allowedNavItems().map(([id,icon]) => `<button type="button" class="${id===section?'active':''}" data-admin-v79-go="${id}"><span>${icon}</span><b>${LABELS[id]}</b></button>`).join('')}</nav>`;
  }

  function shell(section, body, options = {}) {
    const root = ensureRoot();
    if (!root) return null;
    root.dataset.adminV79RenderedSection = section;
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
    const recent = activeEnrollments.slice(0,5);
    const nextEvents = upcoming.slice(0,4);
    const tickets = data.tickets.filter(item=>!['resolved','closed'].includes(item.status)).slice(0,4);
    const module = shell('overview',`<section class="admin-v79-summary">
        ${statCard(data.courses.length,'Programas',`${published} publicados`)}
        ${statCard(uniqueStudents,'Estudiantes','con acceso activo')}
        ${statCard(upcoming.length,'Eventos próximos','publicados')}
        ${statCard(openTickets,'Tickets abiertos','requieren seguimiento')}
        ${statCard(data.certificates.length,'Certificados','vigentes')}
      </section>
      <section class="admin-v79-quick-grid">
        <article class="featured" data-admin-v79-go-card="content"><span>CONTENIDO</span><h2>Cursos y lecciones</h2><p>Edita programas, semanas, lecciones, recursos y videos desde el editor académico.</p><b>Gestionar contenido →</b></article>
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
    shell('courses',`<section class="admin-v79-section-head"><div><span>PROGRAMAS</span><h2>Cursos de Academia Yamilet</h2><p>Consulta el estado de los programas y entra al editor de contenido cuando necesites modificar módulos o lecciones.</p></div><button type="button" data-admin-v79-go="content">Editar contenido</button></section>
      <section class="admin-v79-course-grid">${data.courses.length?data.courses.map(course=>`<article><div class="admin-v79-course-state ${esc(course.status||'draft')}">${course.status==='published'?'PUBLICADO':'BORRADOR'}</div><span>${esc(course.category||'Academia Yamilet')}</span><h3>${esc(course.title)}</h3><p>${esc(course.subtitle||course.duration_label||'Programa académico')}</p><div><small>${course.featured?'Destacado · ':''}${esc(course.duration_label||'')}</small><button type="button" data-admin-v79-go="content">Editar →</button></div></article>`).join(''):'<div class="admin-v79-empty large">No hay cursos creados en este workspace.</div>'}</section>`,{title:'Cursos',copy:'Vista administrativa de los programas del workspace Academia Yamilet.'});
  }

  function loading(section) {
    shell(section,'<div class="admin-v79-loading"><span></span><strong>Preparando módulo administrativo…</strong><small>Cargando la herramienta de esta sección.</small></div>',{title:LABELS[section],copy:'Esta herramienta se carga únicamente cuando entras a su subruta.'});
  }

  function kickNativeRuntime(section) {
    if (section === 'content') {
      window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.load?.();
      [80,240,600,1200].forEach(delay=>setTimeout(()=>window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.(),delay));
    }
    if (section === 'students') {
      window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.loadStudents?.();
      [100,300,700,1300].forEach(delay=>setTimeout(()=>window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.(),delay));
    }
  }

  function mountNative(section, selector, triggerSelector) {
    const mount = shell(section,'<div class="admin-v79-loading"><span></span><strong>Abriendo herramienta…</strong><small>Conectando el editor con esta ruta administrativa.</small></div>',{
      title:LABELS[section],
      copy:section==='content'?'Gestiona cursos, módulos, lecciones, recursos y videos.':'Gestiona cuentas, inscripciones y acceso académico.'
    });

    const attach = () => {
      const target = $(selector);
      if (!target || !mount) return false;
      target.classList.remove('hidden');
      target.classList.add('admin-v79-native-panel');
      mount.innerHTML = '';
      mount.style.display = 'none';
      return true;
    };

    $(triggerSelector)?.click();
    kickNativeRuntime(section);
    [40,120,260,520,900,1600].forEach(delay=>setTimeout(attach,delay));
  }

  function hideNativeOutside(section) {
    if (section !== 'content') $('[data-content-admin]')?.classList.add('hidden');
    if (section !== 'students') $('[data-students-admin]')?.classList.add('hidden');
  }

  function kickDynamic(section) {
    if (section === 'agenda' || section === 'support') {
      window.ACADEMIA_YAMILET_EVENT_ADMIN?.load?.();
      return;
    }
    if (section === 'evaluations') {
      window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME?.load?.();
      return;
    }
    if (section === 'certificates') {
      window.ACADEMIA_YAMILET_CERTIFICATE_RUNTIME_V84?.load?.();
      return;
    }
    if (section === 'operations') {
      window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.load?.();
      return;
    }
    if (section === 'settings') {
      window.ACADEMIA_YAMILET_COMMERCIAL_ADMIN?.load?.();
    }
  }

  function alreadyPrepared(section) {
    const root = ensureRoot();
    if (!root) return false;
    if (root.dataset.adminV79RenderedSection !== section) return false;
    if (!$('[data-admin-v79-module]',root)) return false;

    if (section === 'content') return !!$('[data-content-admin]:not(.hidden)');
    if (section === 'students') return !!$('[data-students-admin]:not(.hidden)');
    if (DYNAMIC_SECTIONS.has(section)) return true;
    return false;
  }

  async function render(force = false) {
    const section = adminSection();
    if (!section) {
      delete document.body.dataset.adminV79Section;
      delete document.body.dataset.academyAdminRole;
      return false;
    }
    const target = page();
    if (!target || target.classList.contains('hidden')) return false;
    lastRoute = location.hash;

    try {
      const ctx = await context();
      if (section === 'operations' && ctx.role === 'instructor') {
        go('overview');
        return false;
      }
      updateChrome(section);
      hideNativeOutside(section);

      if (!force && alreadyPrepared(section)) return true;

      if (section==='content') {
        mountNative('content','[data-content-admin]','[data-content-admin-nav]');
        return true;
      }
      if (section==='students') {
        mountNative('students','[data-students-admin]','[data-students-admin-nav]');
        return true;
      }
      if (DYNAMIC_SECTIONS.has(section)) {
        loading(section);
        kickDynamic(section);
        return true;
      }

      loading(section);
      const data = await loadData(force);
      if (location.hash !== lastRoute && adminSection() !== section) return false;
      if (section==='courses') courses(data);
      else overview(data);
      return true;
    } catch (error) {
      console.error('Academia Yamilet admin v90',error);
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

  window.ACADEMIA_YAMILET_ADMIN = {version:VERSION,render:()=>render(false),refresh:()=>render(true),go};
  window.ACADEMIA_YAMILET_ADMIN_V79 = window.ACADEMIA_YAMILET_ADMIN;
})();