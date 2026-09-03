(() => {
  'use strict';

  const VERSION = '91.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const DATA_TTL = 30000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const SECTIONS = new Set(['overview','courses','content','students','agenda','evaluations','certificates','support','operations','settings']);
  const DYNAMIC_SECTIONS = new Set(['agenda','evaluations','certificates','support','operations','settings']);
  const LABELS = {
    overview:'Resumen', courses:'Cursos', content:'Contenido', students:'Estudiantes', agenda:'Agenda',
    evaluations:'Evaluaciones', certificates:'Certificados', support:'Soporte', operations:'Operación', settings:'Configuración'
  };

  let clientPromise = null;
  let contextPromise = null;
  let contextCache = null;
  let dataPromise = null;
  let dataCache = null;
  let dataCacheAt = 0;
  let renderTimer = null;
  let renderFrame = null;
  let renderToken = 0;
  let activeRenderPromise = null;
  let activeRenderSection = null;
  let currentRole = null;
  const nativeMountPromises = new Map();

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
      if (!alreadyPrepared(section)) schedule(0, false);
      return;
    }
    location.hash = next;
  }

  function invalidateContext() {
    contextCache = null;
    contextPromise = null;
    currentRole = null;
  }

  function invalidateData() {
    dataCache = null;
    dataCacheAt = 0;
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, {headers:{Accept:'application/json'}, cache:'no-store'});
        if (!response.ok) throw new Error('admin_config');
        const config = await response.json();
        const sb = window.supabase.createClient(config.url, config.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
        sb.auth.onAuthStateChange((event, session) => {
          const cachedUser = contextCache?.user?.id || null;
          const nextUser = session?.user?.id || null;
          if (event === 'SIGNED_OUT' || (cachedUser && cachedUser !== nextUser)) {
            invalidateContext();
            invalidateData();
          }
        });
        return {sb,config};
      })().catch(error => {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  async function context(force = false) {
    if (contextCache && !force) return contextCache;
    if (contextPromise && !force) return contextPromise;
    if (force) invalidateContext();

    contextPromise = (async () => {
      const {sb,config} = await getClient();
      const {data:{session}, error:sessionError} = await sb.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) throw new Error('admin_session');
      const user = session.user;
      const [profileRes, workspaceRes] = await Promise.all([
        sb.from('profiles').select('id,email,full_name,role,status').eq('id',user.id).maybeSingle(),
        sb.from('workspaces').select('id,name,slug').eq('slug',config.workspaceSlug||'yamilet-mes').maybeSingle()
      ]);
      if (workspaceRes.error) throw workspaceRes.error;
      const workspace = workspaceRes.data;
      const profile = profileRes.data || {};
      if (!workspace) throw new Error('admin_workspace');

      const {data:membership, error:membershipError} = await sb.from('workspace_members')
        .select('role,status')
        .eq('workspace_id',workspace.id)
        .eq('user_id',user.id)
        .maybeSingle();
      if (membershipError) throw membershipError;

      const role = membership?.status === 'active' ? membership.role : profile?.role;
      if (!['owner','admin','instructor'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
      currentRole = role;
      contextCache = {sb,config,user,profile,workspace,role};
      return contextCache;
    })().finally(() => {
      contextPromise = null;
    });

    return contextPromise;
  }

  async function safe(query) {
    const result = await query;
    if (result.error) {
      console.warn('Academia Yamilet admin v91 query', result.error);
      return [];
    }
    return result.data || [];
  }

  async function loadData(force = false) {
    const fresh = dataCache && (Date.now() - dataCacheAt) < DATA_TTL;
    if (fresh && !force) return dataCache;
    if (dataPromise && !force) return dataPromise;
    if (force && dataPromise) await dataPromise.catch(() => {});
    if (force) invalidateData();

    dataPromise = (async () => {
      const ctx = await context();
      const {sb,workspace} = ctx;
      const [courses,events,tickets] = await Promise.all([
        safe(sb.from('courses').select('id,title,subtitle,status,featured,category,duration_label,updated_at').eq('workspace_id',workspace.id).order('featured',{ascending:false}).order('created_at',{ascending:true})),
        safe(sb.from('academy_events').select('id,course_id,title,event_type,starts_at,status,delivery_mode,is_featured').eq('workspace_id',workspace.id).order('starts_at',{ascending:true}).limit(80)),
        safe(sb.from('academy_support_tickets').select('id,user_id,course_id,subject,category,priority,status,created_at,last_message_at').eq('workspace_id',workspace.id).order('last_message_at',{ascending:false}).limit(80))
      ]);
      const courseIds = courses.map(course => course.id);
      let enrollments = [];
      let certificates = [];
      if (courseIds.length) {
        [enrollments,certificates] = await Promise.all([
          safe(sb.from('enrollments').select('user_id,course_id,status,enrolled_at,completed_at').in('course_id',courseIds).order('enrolled_at',{ascending:false})),
          safe(sb.from('certificates').select('id,user_id,course_id,recipient_name,issued_at,verification_code,revoked_at').in('course_id',courseIds).order('issued_at',{ascending:false}).limit(80))
        ]);
      }
      const userIds = [...new Set([...enrollments.map(item=>item.user_id),...tickets.map(item=>item.user_id),...certificates.map(item=>item.user_id)].filter(Boolean))];
      const profiles = userIds.length ? await safe(sb.from('profiles').select('id,full_name,email,status').in('id',userIds)) : [];
      dataCache = {...ctx,courses,events,tickets,enrollments,certificates:certificates.filter(item=>!item.revoked_at),profiles};
      dataCacheAt = Date.now();
      return dataCache;
    })().finally(() => {
      dataPromise = null;
    });

    return dataPromise;
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
    } catch {
      return 'Sin fecha';
    }
  }

  function page() {
    return $('[data-shell-page="admin"]');
  }

  function handleRootClick(event) {
    const navButton = event.target.closest('[data-admin-v79-go]');
    if (navButton) {
      event.preventDefault();
      go(navButton.dataset.adminV79Go);
      return;
    }
    const card = event.target.closest('[data-admin-v79-go-card]');
    if (card) {
      event.preventDefault();
      go(card.dataset.adminV79GoCard);
      return;
    }
    if (event.target.closest('[data-admin-v79-refresh]')) {
      event.preventDefault();
      schedule(0, true);
    }
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
    if (root.dataset.adminV91Bound !== 'true') {
      root.dataset.adminV91Bound = 'true';
      root.addEventListener('click', handleRootClick);
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
    return allowedNavItems().map(([id,icon]) => `<button type="button" class="${id===section?'active':''}" data-admin-v79-go="${id}"><span>${icon}</span><b>${LABELS[id]}</b></button>`).join('');
  }

  function ensureShell(section, options = {}) {
    const root = ensureRoot();
    if (!root) return null;
    let shellNode = $('.admin-v79-shell',root);
    if (!shellNode) {
      root.innerHTML = `<div class="admin-v79-shell">
        <header class="admin-v79-top"><div><span>CENTRO ADMINISTRATIVO</span><h1></h1><p></p></div><div class="admin-v79-top-actions"><button type="button" data-admin-v79-refresh>Actualizar</button><a href="#home">Salir de administración</a></div></header>
        <nav class="admin-v79-nav" aria-label="Módulos administrativos"></nav>
        <main class="admin-v79-module" data-admin-v79-module></main>
      </div>`;
      shellNode = $('.admin-v79-shell',root);
    }

    const title = $('.admin-v79-top h1',root);
    const copy = $('.admin-v79-top p',root);
    const navNode = $('.admin-v79-nav',root);
    if (title) title.textContent = options.title || LABELS[section];
    if (copy) copy.textContent = options.copy || 'Gestiona Academia Yamilet desde un espacio separado de la experiencia de aprendizaje.';
    if (navNode) navNode.innerHTML = nav(section);
    root.dataset.adminV79RenderedSection = section;
    root.dataset.adminV91Role = currentRole || '';
    return $('[data-admin-v79-module]',root);
  }

  function shell(section, body, options = {}) {
    const module = ensureShell(section, options);
    if (!module) return null;
    module.style.display = '';
    if (body !== undefined) module.innerHTML = body;
    return module;
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
    shell('overview',`<section class="admin-v79-summary">
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
  }

  function courses(data) {
    shell('courses',`<section class="admin-v79-section-head"><div><span>PROGRAMAS</span><h2>Cursos de Academia Yamilet</h2><p>Consulta el estado de los programas y entra al editor de contenido cuando necesites modificar módulos o lecciones.</p></div><button type="button" data-admin-v79-go="content">Editar contenido</button></section>
      <section class="admin-v79-course-grid">${data.courses.length?data.courses.map(course=>`<article><div class="admin-v79-course-state ${esc(course.status||'draft')}">${course.status==='published'?'PUBLICADO':'BORRADOR'}</div><span>${esc(course.category||'Academia Yamilet')}</span><h3>${esc(course.title)}</h3><p>${esc(course.subtitle||course.duration_label||'Programa académico')}</p><div><small>${course.featured?'Destacado · ':''}${esc(course.duration_label||'')}</small><button type="button" data-admin-v79-go="content">Editar →</button></div></article>`).join(''):'<div class="admin-v79-empty large">No hay cursos creados en este workspace.</div>'}</section>`,{title:'Cursos',copy:'Vista administrativa de los programas del workspace Academia Yamilet.'});
  }

  function loading(section, title = 'Preparando módulo administrativo…', copy = 'Cargando la herramienta de esta sección.') {
    shell(section,`<div class="admin-v79-loading"><span></span><strong>${esc(title)}</strong><small>${esc(copy)}</small></div>`,{title:LABELS[section],copy:'Esta herramienta se carga únicamente cuando entras a su subruta.'});
  }

  function waitForElement(selector, timeout = 3500) {
    const existing = $(selector);
    if (existing) return Promise.resolve(existing);
    return new Promise(resolve => {
      const scope = page() || document.body;
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      };
      const observer = new MutationObserver(() => {
        const found = $(selector);
        if (found) finish(found);
      });
      observer.observe(scope,{childList:true,subtree:true});
      const timer = setTimeout(() => finish($(selector)), timeout);
    });
  }

  async function kickNativeRuntime(section) {
    if (section === 'content') {
      const ready = await window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.load?.();
      if (ready !== false) window.ACADEMIA_YAMILET_CONTENT_CMS?.enhance?.();
      return ready !== false;
    }
    if (section === 'students') {
      const ready = await window.ACADEMIA_YAMILET_CONTENT_RUNTIME?.loadStudents?.();
      if (ready !== false) await window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.load?.();
      return ready !== false;
    }
    return false;
  }

  function revealNative(section, target, mount) {
    if (!target || adminSection() !== section) return false;
    target.classList.remove('hidden');
    target.classList.add('admin-v79-native-panel');
    if (mount) {
      mount.innerHTML = '';
      mount.style.display = 'none';
    }
    return true;
  }

  function mountNative(section, selector, triggerSelector) {
    if (nativeMountPromises.has(section)) return nativeMountPromises.get(section);
    const promise = (async () => {
      const mount = shell(section,'<div class="admin-v79-loading"><span></span><strong>Abriendo herramienta…</strong><small>Conectando el editor con esta ruta administrativa.</small></div>',{
        title:LABELS[section],
        copy:section==='content'?'Gestiona cursos, módulos, lecciones, recursos y videos.':'Gestiona cuentas, inscripciones y acceso académico.'
      });

      const existing = $(selector);
      if (existing) return revealNative(section,existing,mount);

      $(triggerSelector)?.click();
      const runtimePromise = kickNativeRuntime(section).catch(error => {
        console.warn(`Academia Yamilet admin v91 ${section} runtime`,error);
        return false;
      });
      const target = await waitForElement(selector,3500);
      await runtimePromise;
      if (revealNative(section,target,mount)) return true;

      if (adminSection() === section && mount) {
        mount.style.display = '';
        mount.innerHTML = '<div class="admin-v79-denied"><strong>No fue posible abrir esta herramienta</strong><span>La sesión sigue activa. Intenta cargar nuevamente este módulo.</span><button type="button" data-admin-v79-refresh>Reintentar</button></div>';
      }
      return false;
    })().finally(() => {
      nativeMountPromises.delete(section);
    });
    nativeMountPromises.set(section,promise);
    return promise;
  }

  function hideNativeOutside(section) {
    if (section !== 'content') $('[data-content-admin]')?.classList.add('hidden');
    if (section !== 'students') $('[data-students-admin]')?.classList.add('hidden');
  }

  function kickDynamic(section) {
    if (section === 'agenda' || section === 'support') return window.ACADEMIA_YAMILET_EVENT_ADMIN?.load?.();
    if (section === 'evaluations') return window.ACADEMIA_YAMILET_ASSESSMENT_RUNTIME?.load?.();
    if (section === 'certificates') return window.ACADEMIA_YAMILET_CERTIFICATE_RUNTIME_V84?.load?.();
    if (section === 'operations') return window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.load?.();
    if (section === 'settings') return window.ACADEMIA_YAMILET_COMMERCIAL_ADMIN?.load?.();
    return undefined;
  }

  function alreadyPrepared(section) {
    const root = ensureRoot();
    if (!root || root.dataset.adminV79RenderedSection !== section) return false;
    if (!$('[data-admin-v79-module]',root)) return false;
    if (section === 'content') return !!$('[data-content-admin]:not(.hidden)');
    if (section === 'students') return !!$('[data-students-admin]:not(.hidden)') || !!$('[data-pending111]');
    if (DYNAMIC_SECTIONS.has(section)) return true;
    if (section === 'overview' || section === 'courses') return true;
    return false;
  }

  function isRenderCurrent(section, token) {
    return token === renderToken && adminSection() === section;
  }

  async function performRender(section, force, token) {
    const target = page();
    if (!target || target.classList.contains('hidden')) return false;

    try {
      const ctx = await context();
      if (!isRenderCurrent(section,token)) return false;
      if (section === 'operations' && ctx.role === 'instructor') {
        go('overview');
        return false;
      }

      updateChrome(section);
      hideNativeOutside(section);
      if (!force && alreadyPrepared(section)) return true;

      if (section === 'content') return await mountNative('content','[data-content-admin]','[data-content-admin-nav]');
      if (section === 'students') return await mountNative('students','[data-students-admin]','[data-students-admin-nav]');

      if (DYNAMIC_SECTIONS.has(section)) {
        loading(section);
        Promise.resolve(kickDynamic(section)).catch(error => console.warn(`Academia Yamilet admin v91 ${section}`,error));
        return true;
      }

      const cached = dataCache && (Date.now() - dataCacheAt) < DATA_TTL;
      if (!cached || force) loading(section,'Preparando información…','Sincronizando únicamente los datos necesarios.');
      const data = await loadData(force);
      if (!isRenderCurrent(section,token)) return false;
      if (section === 'courses') courses(data);
      else overview(data);
      return true;
    } catch (error) {
      if (!isRenderCurrent(section,token)) return false;
      console.error('Academia Yamilet admin v91',error);
      const root = ensureRoot();
      if (!root) return false;
      root.innerHTML = error?.message==='forbidden'
        ? '<div class="admin-v79-denied"><strong>Acceso restringido</strong><span>Este centro está disponible para el equipo autorizado de Academia Yamilet.</span><a href="#home">Volver al inicio</a></div>'
        : '<div class="admin-v79-denied"><strong>No fue posible cargar administración</strong><span>Revisa tu sesión e inténtalo nuevamente.</span><button type="button" data-admin-v79-refresh>Reintentar</button></div>';
      root.dataset.adminV91Bound = 'false';
      ensureRoot();
      return false;
    }
  }

  function render(force = false) {
    const section = adminSection();
    if (!section) {
      delete document.body.dataset.adminV79Section;
      delete document.body.dataset.academyAdminRole;
      activeRenderPromise = null;
      activeRenderSection = null;
      return Promise.resolve(false);
    }

    if (!force && activeRenderPromise && activeRenderSection === section) return activeRenderPromise;
    if (!force && alreadyPrepared(section)) {
      updateChrome(section);
      return Promise.resolve(true);
    }

    const token = ++renderToken;
    activeRenderSection = section;
    const promise = performRender(section,force,token).finally(() => {
      if (activeRenderPromise === promise) {
        activeRenderPromise = null;
        activeRenderSection = null;
      }
    });
    activeRenderPromise = promise;
    return promise;
  }

  function schedule(delay = 0, force = false) {
    clearTimeout(renderTimer);
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderTimer = setTimeout(() => {
      renderFrame = requestAnimationFrame(() => {
        renderFrame = null;
        render(force);
      });
    }, Math.max(0,delay));
  }

  function start() {
    document.addEventListener('click',event => {
      if (event.target.closest('[data-shell-route="admin"]')) schedule(0,false);
    },true);
    window.addEventListener('hashchange',() => schedule(0,false));
    window.addEventListener('popstate',() => schedule(0,false));
    window.addEventListener('pageshow',() => {
      if (adminSection()) schedule(0,false);
    });
    if (adminSection()) schedule(0,false);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_ADMIN = {
    version:VERSION,
    render:()=>render(false),
    refresh:()=>render(true),
    go,
    invalidate:()=>{invalidateData(); return render(true);},
    context:()=>context(false)
  };
  window.ACADEMIA_YAMILET_ADMIN_V79 = window.ACADEMIA_YAMILET_ADMIN;
})();