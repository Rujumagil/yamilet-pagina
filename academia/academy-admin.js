(() => {
  'use strict';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let clientPromise;

  async function getContext() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
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

  function fmt(value) {
    if (!value) return '';
    try { return new Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(value)); }
    catch { return ''; }
  }

  async function loadAdminData() {
    const ctx = await getContext();
    const { sb, workspace } = ctx;
    const { data: courses, error: coursesError } = await sb.from('courses').select('id,title,status,featured').eq('workspace_id', workspace.id).order('created_at', { ascending: true });
    if (coursesError) throw coursesError;
    const courseRows = courses || [];
    const courseIds = courseRows.map(c => c.id);

    let enrollments = [], events = [], tickets = [], certificates = [];
    const baseQueries = [
      sb.from('academy_events').select('id,course_id,title,event_type,start_at,status,modality,is_featured').eq('workspace_id', workspace.id).order('start_at', { ascending: true }).limit(20),
      sb.from('academy_support_tickets').select('id,user_id,course_id,subject,category,priority,status,created_at,last_message_at').eq('workspace_id', workspace.id).order('last_message_at', { ascending: false }).limit(20)
    ];
    if (courseIds.length) {
      baseQueries.push(sb.from('enrollments').select('user_id,course_id,status,enrolled_at,completed_at').in('course_id', courseIds).order('enrolled_at', { ascending: false }));
      baseQueries.push(sb.from('certificates').select('id,user_id,course_id,recipient_name,issued_at,verification_code,revoked_at').in('course_id', courseIds).order('issued_at', { ascending: false }).limit(20));
    }
    const results = await Promise.all(baseQueries);
    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;
    events = results[0].data || [];
    tickets = results[1].data || [];
    if (courseIds.length) {
      if (results[2].error) throw results[2].error;
      if (results[3].error) throw results[3].error;
      enrollments = results[2].data || [];
      certificates = results[3].data || [];
    }

    const userIds = [...new Set([...enrollments.map(e => e.user_id), ...tickets.map(t => t.user_id)].filter(Boolean))];
    let profiles = [];
    if (userIds.length) {
      const { data, error } = await sb.from('profiles').select('id,full_name,email,status').in('id', userIds);
      if (!error) profiles = data || [];
    }
    return { ...ctx, courses: courseRows, enrollments, events, tickets, certificates: certificates.filter(c => !c.revoked_at), profiles };
  }

  function statusLabel(v) {
    return ({open:'Abierto',in_progress:'En proceso',waiting_user:'Espera alumna',resolved:'Resuelto',closed:'Cerrado',published:'Publicado',draft:'Borrador',active:'Activa',completed:'Completada'})[v] || v || '—';
  }

  function profileName(data, id) {
    const p = data.profiles.find(item => item.id === id);
    return p?.full_name || p?.email || 'Alumna';
  }

  function courseName(data, id) {
    return data.courses.find(item => item.id === id)?.title || 'Academia Yamilet';
  }

  function row(icon, title, subtitle, status, cls = '') {
    return `<div class="academy-admin-row"><div class="academy-admin-row-icon">${icon}</div><div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div><span class="academy-admin-row-status ${cls}">${esc(status)}</span></div>`;
  }

  function recentStudents(data) {
    const active = data.enrollments.filter(e => ['active','completed'].includes(e.status)).slice(0,5);
    if (!active.length) return '<div class="academy-admin-empty"><strong>No hay alumnas inscritas</strong><span>Las nuevas inscripciones aparecerán aquí automáticamente.</span></div>';
    return `<div class="academy-admin-list">${active.map(e => row('A', profileName(data,e.user_id), `${courseName(data,e.course_id)} · ${fmt(e.enrolled_at)}`, statusLabel(e.status), e.status==='completed'?'':'')).join('')}</div>`;
  }

  function recentTickets(data) {
    if (!data.tickets.length) return '<div class="academy-admin-empty"><strong>Sin solicitudes de soporte</strong><span>Los tickets creados por alumnas aparecerán aquí para seguimiento.</span></div>';
    return `<div class="academy-admin-list">${data.tickets.slice(0,5).map(t => row('?', t.subject, `${profileName(data,t.user_id)} · ${courseName(data,t.course_id)}`, statusLabel(t.status), ['resolved','closed'].includes(t.status)?'closed':'warn')).join('')}</div>`;
  }

  function upcomingEvents(data) {
    const now = Date.now();
    const upcoming = data.events.filter(e => e.start_at && new Date(e.start_at).getTime() >= now && e.status === 'published').slice(0,5);
    if (!upcoming.length) return '<div class="academy-admin-empty"><strong>No hay eventos próximos</strong><span>Las sesiones publicadas aparecerán aquí cuando tengan fecha programada.</span></div>';
    return `<div class="academy-admin-list">${upcoming.map(e => row('◷', e.title, `${fmt(e.start_at)} · ${courseName(data,e.course_id)}`, e.modality || e.event_type || 'Evento')).join('')}</div>`;
  }

  function certificatesList(data) {
    if (!data.certificates.length) return '<div class="academy-admin-empty"><strong>Aún no hay certificados emitidos</strong><span>Los certificados válidos del workspace aparecerán aquí.</span></div>';
    return `<div class="academy-admin-list">${data.certificates.slice(0,5).map(c => row('✓', c.recipient_name || profileName(data,c.user_id), `${courseName(data,c.course_id)} · ${fmt(c.issued_at)}`, 'Emitido')).join('')}</div>`;
  }

  function renderMarkup(data) {
    const activeEnrollments = data.enrollments.filter(e => e.status === 'active');
    const uniqueStudents = new Set(activeEnrollments.map(e => e.user_id)).size;
    const openTickets = data.tickets.filter(t => !['resolved','closed'].includes(t.status)).length;
    const now = Date.now();
    const upcomingCount = data.events.filter(e => e.start_at && new Date(e.start_at).getTime() >= now && e.status === 'published').length;
    const publishedCourses = data.courses.filter(c => c.status === 'published').length;
    const roleLabel = data.role === 'owner' ? 'Propietaria del workspace' : data.role === 'admin' ? 'Administración' : 'Equipo académico';

    return `<div class="academy-admin-hero"><div><span class="academy-admin-kicker">CENTRO ADMINISTRATIVO</span><h2>Opera la Academia desde un solo lugar</h2><p>Consulta el estado académico, entra a los editores existentes y revisa alumnas, eventos, soporte y certificación sin mezclar esta experiencia con el aula de las alumnas.</p><span class="academy-admin-role">${esc(roleLabel)}</span></div><div class="academy-admin-stats"><article><strong>${data.courses.length}</strong><span>programas</span></article><article><strong>${uniqueStudents}</strong><span>alumnas activas</span></article><article><strong>${upcomingCount}</strong><span>eventos próximos</span></article><article><strong>${openTickets}</strong><span>tickets abiertos</span></article></div></div>

    <section class="academy-admin-section"><div class="academy-admin-section-head"><div><span>GESTIÓN PRINCIPAL</span><h3>Herramientas de operación</h3></div><p>Los accesos principales reutilizan los editores que ya funcionan dentro de la Academia.</p></div><div class="academy-admin-actions">
      <article class="academy-admin-action featured"><div class="academy-admin-action-icon">✎</div><small>Contenido</small><h4>Cursos y lecciones</h4><p>Edita programas, módulos, lecciones, recursos y publicación desde el administrador nativo.</p><button type="button" data-admin-open-native="content">Gestionar contenido</button></article>
      <article class="academy-admin-action featured"><div class="academy-admin-action-icon">A</div><small>Alumnas</small><h4>Accesos e inscripciones</h4><p>Invita alumnas, asigna cursos y consulta su progreso desde el administrador existente.</p><button type="button" data-admin-open-native="students">Gestionar alumnas</button></article>
      <article class="academy-admin-action"><div class="academy-admin-action-icon">◷</div><small>Seguimiento</small><h4>Clase gratuita</h4><p>Consulta las solicitudes de clase gratuita y el seguimiento operativo vinculado.</p><button type="button" data-admin-open-native="bookings">Ver reservaciones</button></article>
      <article class="academy-admin-action"><div class="academy-admin-action-icon">□</div><small>Agenda</small><h4>Eventos académicos</h4><p>Revisa las sesiones publicadas y próximas actividades del calendario académico.</p><button type="button" data-admin-route="calendar">Ver calendario</button></article>
      <article class="academy-admin-action"><div class="academy-admin-action-icon">?</div><small>Soporte</small><h4>Solicitudes de alumnas</h4><p>Monitorea aquí los tickets del workspace. La respuesta administrativa se añadirá en una etapa funcional posterior.</p><button type="button" data-admin-scroll="support">Revisar tickets</button></article>
      <article class="academy-admin-action"><div class="academy-admin-action-icon">✓</div><small>Certificación</small><h4>Certificados emitidos</h4><p>Consulta los certificados válidos del workspace y sus datos de emisión.</p><button type="button" data-admin-scroll="certificates">Ver certificados</button></article>
    </div></section>

    <section class="academy-admin-section"><div class="academy-admin-section-head"><div><span>OPERACIÓN EN VIVO</span><h3>Qué está pasando en la Academia</h3></div><p>Información consultada directamente desde Supabase para este workspace.</p></div><div class="academy-admin-ops-grid">
      <article class="academy-admin-panel"><div class="academy-admin-panel-head"><div><span>ALUMNAS</span><h4>Inscripciones recientes</h4></div><button type="button" data-admin-open-native="students">Abrir</button></div>${recentStudents(data)}</article>
      <article class="academy-admin-panel" data-admin-anchor="support"><div class="academy-admin-panel-head"><div><span>SOPORTE</span><h4>Tickets recientes</h4></div><span></span></div>${recentTickets(data)}</article>
      <article class="academy-admin-panel"><div class="academy-admin-panel-head"><div><span>AGENDA</span><h4>Próximos eventos</h4></div><button type="button" data-admin-route="calendar">Ver</button></div>${upcomingEvents(data)}</article>
    </div></section>

    <section class="academy-admin-section" data-admin-anchor="certificates"><div class="academy-admin-section-head"><div><span>CERTIFICACIÓN</span><h3>Estado de certificados</h3></div><p>Este bloque solo muestra certificados reales no revocados.</p></div><article class="academy-admin-panel">${certificatesList(data)}</article></section>

    <div class="academy-admin-health"><article><span>Cursos publicados</span><strong>${publishedCourses}</strong><small>de ${data.courses.length}</small></article><article><span>Inscripciones activas</span><strong>${activeEnrollments.length}</strong><small>accesos vigentes</small></article><article><span>Eventos próximos</span><strong>${upcomingCount}</strong><small>publicados</small></article><article><span>Soporte abierto</span><strong>${openTickets}</strong><small>requieren seguimiento</small></article><article><span>Certificados</span><strong>${data.certificates.length}</strong><small>emitidos y vigentes</small></article></div>`;
  }

  function openNative(target) {
    if (target === 'content') { $('[data-content-admin-nav]')?.click(); setTimeout(() => $('[data-content-admin]')?.classList.remove('hidden'), 30); }
    if (target === 'students') { $('[data-students-admin-nav]')?.click(); setTimeout(() => $('[data-students-admin]')?.classList.remove('hidden'), 30); }
    if (target === 'bookings') { $('[data-scroll-bookings]')?.click(); }
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
      const data = await loadAdminData();
      if (page.classList.contains('hidden')) return false;
      page.innerHTML = renderMarkup(data);
      bind(page);
    } catch (error) {
      console.error('Academia Yamilet admin', error);
      page.innerHTML = error?.message === 'forbidden' ? '<div class="academy-admin-denied"><strong>Acceso restringido</strong><span>Este centro está disponible únicamente para owner, admin o instructor del workspace.</span></div>' : '<div class="academy-admin-denied"><strong>No fue posible cargar el centro administrativo</strong><span>Vuelve a abrir Administrar o recarga la Academia.</span></div>';
    }
    return true;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="admin"]')) setTimeout(render, 120);
  });
  window.addEventListener('pageshow', () => setTimeout(render, 320));
  window.ACADEMIA_YAMILET_ADMIN = { render };
})();
