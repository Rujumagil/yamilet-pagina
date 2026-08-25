(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let clientPromise;

  async function context() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept:'application/json' } });
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
        return { sb, cfg };
      })();
    }
    const { sb, cfg } = await clientPromise;
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('no_session');
    const user = session.user;
    const [{ data: profile }, { data: workspace }] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,status').eq('id', user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
    ]);
    if (!workspace) throw new Error('no_workspace');
    const { data: membership } = await sb.from('workspace_members').select('role,status').eq('workspace_id', workspace.id).eq('user_id', user.id).maybeSingle();
    const role = membership?.status === 'active' ? membership.role : profile?.role;
    if (!['owner','admin','instructor'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
    return { sb, user, profile: profile || {}, workspace, role };
  }

  const safe = async query => {
    const result = await query;
    if (result.error) {
      console.warn('Academia Yamilet admin query', result.error);
      return { data: [], error: result.error };
    }
    return { data: result.data || [], error: null };
  };

  function fmt(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(value)); }
    catch { return '—'; }
  }

  async function loadData() {
    const ctx = await context();
    const { sb, workspace } = ctx;
    const coursesResult = await safe(sb.from('courses').select('id,title,status,featured').eq('workspace_id', workspace.id).order('created_at', { ascending:true }));
    const courses = coursesResult.data;
    const courseIds = courses.map(c => c.id);

    const [eventsResult, ticketsResult] = await Promise.all([
      safe(sb.from('academy_events').select('id,course_id,title,event_type,starts_at,status,delivery_mode,is_featured').eq('workspace_id', workspace.id).order('starts_at', { ascending:true }).limit(20)),
      safe(sb.from('academy_support_tickets').select('id,user_id,course_id,subject,category,priority,status,created_at,last_message_at').eq('workspace_id', workspace.id).order('last_message_at', { ascending:false }).limit(20))
    ]);

    let enrollmentsResult = { data:[], error:null };
    let certificatesResult = { data:[], error:null };
    if (courseIds.length) {
      [enrollmentsResult, certificatesResult] = await Promise.all([
        safe(sb.from('enrollments').select('user_id,course_id,status,enrolled_at,completed_at').in('course_id', courseIds).order('enrolled_at', { ascending:false })),
        safe(sb.from('certificates').select('id,user_id,course_id,recipient_name,issued_at,verification_code,revoked_at').in('course_id', courseIds).order('issued_at', { ascending:false }).limit(20))
      ]);
    }

    const userIds = [...new Set([...enrollmentsResult.data.map(e => e.user_id), ...ticketsResult.data.map(t => t.user_id)].filter(Boolean))];
    let profiles = [];
    if (userIds.length) profiles = (await safe(sb.from('profiles').select('id,full_name,email,status').in('id', userIds))).data;

    return {
      ...ctx,
      courses,
      events: eventsResult.data,
      tickets: ticketsResult.data,
      enrollments: enrollmentsResult.data,
      certificates: certificatesResult.data.filter(c => !c.revoked_at),
      profiles,
      errors: {
        courses: coursesResult.error,
        events: eventsResult.error,
        tickets: ticketsResult.error,
        enrollments: enrollmentsResult.error,
        certificates: certificatesResult.error
      }
    };
  }

  function profileName(data, id) {
    const p = data.profiles.find(row => row.id === id);
    return p?.full_name || p?.email || 'Alumna';
  }

  function courseName(data, id) {
    return data.courses.find(row => row.id === id)?.title || 'Academia Yamilet';
  }

  function state(title, copy) {
    return `<div class="academy-admin-empty"><strong>${esc(title)}</strong><span>${esc(copy)}</span></div>`;
  }

  function recentStudents(data) {
    if (data.errors.enrollments) return state('No fue posible consultar alumnas', 'Revisa permisos de inscripciones para este workspace.');
    const rows = data.enrollments.filter(e => ['active','completed'].includes(e.status)).slice(0,5);
    if (!rows.length) return state('No hay alumnas inscritas', 'Las nuevas inscripciones aparecerán aquí automáticamente.');
    return `<div class="academy-admin-list">${rows.map(e => `<div class="academy-admin-row"><div class="academy-admin-row-icon">A</div><div><strong>${esc(profileName(data,e.user_id))}</strong><small>${esc(courseName(data,e.course_id))} · ${esc(fmt(e.enrolled_at))}</small></div><span class="academy-admin-row-status">${e.status === 'completed' ? 'Completada' : 'Activa'}</span></div>`).join('')}</div>`;
  }

  function upcomingEvents(data) {
    if (data.errors.events) return state('Agenda no disponible', 'La consulta de eventos no pudo completarse.');
    const now = Date.now();
    const rows = data.events.filter(e => e.starts_at && new Date(e.starts_at).getTime() >= now && e.status === 'published').slice(0,5);
    if (!rows.length) return state('No hay eventos próximos', 'Las sesiones publicadas aparecerán aquí cuando tengan fecha programada.');
    return `<div class="academy-admin-list">${rows.map(e => `<div class="academy-admin-row"><div class="academy-admin-row-icon">◷</div><div><strong>${esc(e.title)}</strong><small>${esc(fmt(e.starts_at))} · ${esc(courseName(data,e.course_id))}</small></div><span class="academy-admin-row-status">${esc(e.delivery_mode || e.event_type || 'Evento')}</span></div>`).join('')}</div>`;
  }

  function recentTickets(data) {
    if (data.errors.tickets) return state('Soporte no disponible', 'La consulta de soporte no pudo completarse.');
    if (!data.tickets.length) return state('Sin solicitudes de soporte', 'Los tickets creados por alumnas aparecerán aquí para seguimiento.');
    return `<div class="academy-admin-list">${data.tickets.slice(0,5).map(t => `<div class="academy-admin-row"><div class="academy-admin-row-icon">?</div><div><strong>${esc(t.subject)}</strong><small>${esc(profileName(data,t.user_id))} · ${esc(courseName(data,t.course_id))}</small></div><span class="academy-admin-row-status">${esc(t.status || 'Abierto')}</span></div>`).join('')}</div>`;
  }

  function certificates(data) {
    if (data.errors.certificates) return state('Certificados no disponibles', 'La consulta de certificados no pudo completarse.');
    if (!data.certificates.length) return state('Aún no hay certificados emitidos', 'Los certificados válidos aparecerán aquí.');
    return `<div class="academy-admin-list">${data.certificates.slice(0,5).map(c => `<div class="academy-admin-row"><div class="academy-admin-row-icon">✓</div><div><strong>${esc(c.recipient_name || profileName(data,c.user_id))}</strong><small>${esc(courseName(data,c.course_id))} · ${esc(fmt(c.issued_at))}</small></div><span class="academy-admin-row-status">Emitido</span></div>`).join('')}</div>`;
  }

  function markup(data) {
    const activeEnrollments = data.enrollments.filter(e => e.status === 'active');
    const uniqueStudents = new Set(activeEnrollments.map(e => e.user_id)).size;
    const openTickets = data.tickets.filter(t => !['resolved','closed'].includes(t.status)).length;
    const upcomingCount = data.events.filter(e => e.starts_at && new Date(e.starts_at).getTime() >= Date.now() && e.status === 'published').length;
    const published = data.courses.filter(c => c.status === 'published').length;
    const roleLabel = data.role === 'owner' ? 'Propietaria del workspace' : data.role === 'admin' ? 'Administración' : 'Equipo académico';

    return `<div class="academy-admin-hero"><div><span class="academy-admin-kicker">CENTRO ADMINISTRATIVO</span><h2>Opera la Academia desde un solo lugar</h2><p>Consulta cursos, alumnas, agenda, soporte y certificación con información real del workspace.</p><span class="academy-admin-role">${esc(roleLabel)}</span></div><div class="academy-admin-stats"><article><strong>${data.courses.length}</strong><span>programas</span></article><article><strong>${uniqueStudents}</strong><span>alumnas activas</span></article><article><strong>${upcomingCount}</strong><span>eventos próximos</span></article><article><strong>${openTickets}</strong><span>tickets abiertos</span></article></div></div>
      <section class="academy-admin-section"><div class="academy-admin-section-head"><div><span>GESTIÓN PRINCIPAL</span><h3>Herramientas de operación</h3></div><p>Accesos administrativos del workspace Academia Yamilet.</p></div><div class="academy-admin-actions">
        <article class="academy-admin-action featured"><div class="academy-admin-action-icon">✎</div><small>Contenido</small><h4>Cursos y lecciones</h4><p>Edita programas, módulos y lecciones.</p><button type="button" data-admin-open-native="content">Gestionar contenido</button></article>
        <article class="academy-admin-action featured"><div class="academy-admin-action-icon">A</div><small>Alumnas</small><h4>Inscripciones</h4><p>Gestiona alumnas y cursos asignados.</p><button type="button" data-admin-open-native="students">Gestionar alumnas</button></article>
        <article class="academy-admin-action"><div class="academy-admin-action-icon">□</div><small>Agenda</small><h4>Eventos académicos</h4><p>Consulta sesiones y actividades.</p><button type="button" data-admin-route="calendar">Ver calendario</button></article>
        <article class="academy-admin-action"><div class="academy-admin-action-icon">?</div><small>Soporte</small><h4>Solicitudes de alumnas</h4><p>Consulta y responde tickets desde Operación y Control.</p><button type="button" data-admin-scroll="support">Revisar soporte</button></article>
      </div></section>
      <section class="academy-admin-section"><div class="academy-admin-section-head"><div><span>OPERACIÓN EN VIVO</span><h3>Qué está pasando en la Academia</h3></div><p>Información consultada directamente desde Supabase.</p></div><div class="academy-admin-ops-grid">
        <article class="academy-admin-panel"><div class="academy-admin-panel-head"><div><span>ALUMNAS</span><h4>Inscripciones recientes</h4></div><button type="button" data-admin-open-native="students">Abrir</button></div>${recentStudents(data)}</article>
        <article class="academy-admin-panel" data-admin-anchor="support"><div class="academy-admin-panel-head"><div><span>SOPORTE</span><h4>Tickets recientes</h4></div></div>${recentTickets(data)}</article>
        <article class="academy-admin-panel"><div class="academy-admin-panel-head"><div><span>AGENDA</span><h4>Próximos eventos</h4></div><button type="button" data-admin-route="calendar">Ver</button></div>${upcomingEvents(data)}</article>
      </div></section>
      <section class="academy-admin-section" data-admin-anchor="certificates"><div class="academy-admin-section-head"><div><span>CERTIFICACIÓN</span><h3>Estado de certificados</h3></div></div><article class="academy-admin-panel">${certificates(data)}</article></section>
      <div class="academy-admin-health"><article><span>Cursos publicados</span><strong>${published}</strong><small>de ${data.courses.length}</small></article><article><span>Inscripciones activas</span><strong>${activeEnrollments.length}</strong><small>accesos vigentes</small></article><article><span>Eventos próximos</span><strong>${upcomingCount}</strong><small>publicados</small></article><article><span>Soporte abierto</span><strong>${openTickets}</strong><small>requieren seguimiento</small></article><article><span>Certificados</span><strong>${data.certificates.length}</strong><small>emitidos y vigentes</small></article></div>`;
  }

  function openNative(target) {
    if (target === 'content') { $('[data-content-admin-nav]')?.click(); setTimeout(() => $('[data-content-admin]')?.classList.remove('hidden'), 30); }
    if (target === 'students') { $('[data-students-admin-nav]')?.click(); setTimeout(() => $('[data-students-admin]')?.classList.remove('hidden'), 30); }
  }

  function bind(page) {
    $$('[data-admin-open-native]', page).forEach(btn => btn.addEventListener('click', () => openNative(btn.dataset.adminOpenNative)));
    $$('[data-admin-route]', page).forEach(btn => btn.addEventListener('click', () => $(`[data-shell-route="${btn.dataset.adminRoute}"]`)?.click()));
    $$('[data-admin-scroll]', page).forEach(btn => btn.addEventListener('click', () => $(`[data-admin-anchor="${btn.dataset.adminScroll}"]`, page)?.scrollIntoView({ behavior:'smooth', block:'start' })));
  }

  async function render() {
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return false;
    page.classList.add('academy-admin-page');
    page.innerHTML = '<div class="academy-admin-loading"><strong>Cargando centro administrativo…</strong><span>Consultando operación académica y permisos del workspace.</span></div>';
    try {
      const data = await loadData();
      if (page.classList.contains('hidden')) return false;
      page.innerHTML = markup(data);
      bind(page);
      window.setTimeout(() => window.ACADEMIA_YAMILET_ADMIN_OPERATIONS?.render?.(), 40);
    } catch (error) {
      console.error('Academia Yamilet admin v2', error);
      page.innerHTML = error?.message === 'forbidden'
        ? '<div class="academy-admin-denied"><strong>Acceso restringido</strong><span>Este centro está disponible únicamente para owner, admin o instructor del workspace.</span></div>'
        : '<div class="academy-admin-denied"><strong>No fue posible cargar el centro administrativo</strong><span>Recarga la Academia. Si el problema continúa, revisa la sesión de esta cuenta.</span></div>';
    }
    return true;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="admin"]')) window.setTimeout(render, 120);
  });
  window.addEventListener('pageshow', () => window.setTimeout(render, 320));
  window.ACADEMIA_YAMILET_ADMIN = { render };
})();
