(() => {
  'use strict';

  const VERSION = '119.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char] || char));

  const CACHE_MS = 30000;
  let sb = null;
  let workspace = null;
  let courses = [];
  let pending = [];
  let loadPromise = null;
  let loadedAt = 0;

  function section() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    if (parts[0] !== 'admin') return null;
    return parts[1] || 'overview';
  }

  const isOverview = () => section() === 'overview';
  const isStudents = () => section() === 'students';
  const supported = () => isOverview() || isStudents();

  function fmt(value) {
    if (!value) return 'Sin fecha';
    try {
      return new Intl.DateTimeFormat('es-MX', {
        day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
      }).format(new Date(value));
    } catch {
      return 'Sin fecha';
    }
  }

  function defaultCourseId() {
    return courses.find(course => /método\s+mes|metodo\s+mes/i.test(course.title || ''))?.id
      || courses.find(course => course.status === 'published')?.id
      || courses[0]?.id
      || '';
  }

  function courseOptions(selected = '') {
    return courses.map(course => `<option value="${esc(course.id)}" ${course.id === selected ? 'selected' : ''}>${esc(course.title)}${course.status === 'draft' ? ' · borrador' : ''}</option>`).join('');
  }

  function originLabel(item) {
    const source = item.utm_source || '';
    const campaign = item.utm_campaign || '';
    const cta = item.landing_cta || item.utm_content || '';
    if (!source && !campaign && !cta) return 'Origen: acceso directo';
    return `Origen: ${[source, campaign, cta].filter(Boolean).join(' · ')}`;
  }

  async function client() {
    if (sb && workspace) return sb;
    const response = await fetch(CONFIG_ENDPOINT, { headers:{Accept:'application/json'}, cache:'no-store' });
    if (!response.ok) throw new Error('config_unavailable');
    const cfg = await response.json();
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    const { data:{session} } = await sb.auth.getSession();
    if (!session?.user) throw new Error('session_required');
    const { data:ws, error } = await sb.from('workspaces')
      .select('id,name,slug')
      .eq('slug', cfg.workspaceSlug || 'yamilet-mes')
      .maybeSingle();
    if (error || !ws) throw error || new Error('workspace_not_found');
    workspace = ws;
    return sb;
  }

  async function loadData(force = false) {
    if (!force && loadedAt && Date.now() - loadedAt < CACHE_MS) return true;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      const api = await client();
      const [courseRes, pendingRes] = await Promise.all([
        api.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
        api.rpc('get_academy_registration_requests',{target_workspace:workspace.id})
      ]);
      if (courseRes.error) throw courseRes.error;
      if (pendingRes.error) throw pendingRes.error;
      courses = courseRes.data || [];
      pending = pendingRes.data || [];
      loadedAt = Date.now();
      return true;
    })().finally(() => {
      loadPromise = null;
    });

    return loadPromise;
  }

  function overviewRoot() {
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return null;
    return $('[data-admin-v79-root]',page);
  }

  function findStudentCard(root) {
    const summary = $('.admin-v79-summary',root);
    if (!summary) return null;
    return $$('article',summary).find(card => String(card.querySelector('span')?.textContent || '').trim() === 'Estudiantes') || null;
  }

  function renderOverview() {
    if (!isOverview() || !loadedAt) return false;
    const root = overviewRoot();
    if (!root) return false;
    const studentCard = findStudentCard(root);
    if (!studentCard) return false;

    const small = $('small',studentCard);
    if (small) small.innerHTML = `con acceso activo · <b>${pending.length}</b> registro${pending.length === 1 ? '' : 's'} pendiente${pending.length === 1 ? '' : 's'}`;
    studentCard.dataset.pendingOverview = 'true';
    studentCard.style.cursor = 'pointer';
    studentCard.title = pending.length ? 'Abrir registros pendientes' : 'Abrir estudiantes';
    studentCard.onclick = () => { location.hash = '#admin/students'; };

    let banner = $('[data-pending-overview-banner]',root);
    if (!pending.length) {
      banner?.remove();
      return true;
    }

    if (!banner) {
      banner = document.createElement('section');
      banner.className = 'admin-v79-section-head pending117-overview';
      banner.dataset.pendingOverviewBanner = 'true';
      const live = $('.admin-v79-live-grid',root);
      if (live) live.insertAdjacentElement('beforebegin',banner);
      else root.appendChild(banner);
    }

    const latest = pending[0] || {};
    const confirmed = pending.filter(item => !!item.email_confirmed_at).length;
    banner.innerHTML = `<div><span>NUEVOS REGISTROS</span><h2>${pending.length} registro${pending.length === 1 ? '' : 's'} pendiente${pending.length === 1 ? '' : 's'} de activar</h2><p>${esc(latest.full_name || latest.email || 'Nueva alumna')} · ${esc(latest.email || '')} · ${confirmed} correo${confirmed === 1 ? '' : 's'} confirmado${confirmed === 1 ? '' : 's'}</p></div><button type="button" data-pending-overview-open>Revisar registros</button>`;
    $('[data-pending-overview-open]',banner)?.addEventListener('click',() => { location.hash = '#admin/students'; });
    return true;
  }

  function visibleAdminModule() {
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return null;
    return $('[data-admin-v79-module]',page);
  }

  function panelHost() {
    if (!isStudents()) return null;

    const nativeRoot = $('[data-students81]');
    if (nativeRoot) {
      let panel = $('[data-pending111]',nativeRoot);
      if (!panel) {
        panel = document.createElement('section');
        panel.className = 'pending110 pending119-integrated';
        panel.dataset.pending111 = 'true';
        panel.dataset.pendingHost = 'native';
        const directory = $('.students81-directory',nativeRoot);
        if (directory) directory.insertAdjacentElement('beforebegin',panel);
        else nativeRoot.prepend(panel);
      }
      return panel;
    }

    const module = visibleAdminModule();
    if (!module) return null;
    let panel = $('[data-pending111]',module);
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'pending110 pending119-fallback';
      panel.dataset.pending111 = 'true';
      panel.dataset.pendingHost = 'fallback';
      module.innerHTML = '';
      module.appendChild(panel);
    }
    return panel;
  }

  function stateLabel(item) {
    if (!item.account_created) return '<span class="waiting">Solicitud recibida · cuenta pendiente</span>';
    if (item.email_confirmed_at) return '<span class="confirmed">Correo confirmado</span>';
    return '<span class="waiting">Cuenta creada · correo por confirmar</span>';
  }

  function renderStudents() {
    if (!isStudents() || !loadedAt) return false;
    const panel = panelHost();
    if (!panel) return false;

    const confirmed = pending.filter(item => !!item.email_confirmed_at).length;
    const accounts = pending.filter(item => !!item.account_created).length;
    const ready = pending.filter(item => item.account_created && item.email_confirmed_at).length;
    const defaultId = defaultCourseId();

    panel.innerHTML = `<div class="pending110-head"><div><span>SOLICITUDES</span><h3>Nuevos registros</h3><p>Aprueba accesos desde aquí sin esperar a que el directorio general vuelva a cargarse.</p></div><div class="pending110-head-actions"><span><b>${pending.length}</b> pendientes</span><button type="button" data-pending111-refresh>Actualizar</button></div></div>
      <div class="pending110-summary"><span><b>${pending.length}</b> solicitudes</span><span><b>${accounts}</b> cuentas creadas</span><span><b>${confirmed}</b> correos confirmados</span><span><b>${ready}</b> listas para activar</span></div>
      <div class="pending110-list">${pending.length ? pending.map(item => `<article class="pending110-card" data-pending-request="${esc(item.request_id || '')}" data-pending-user="${esc(item.user_id || '')}">
        <div class="pending110-person"><div class="pending110-avatar">${esc((item.full_name || item.email || '?').trim().slice(0,1).toUpperCase())}</div><div><strong>${esc(item.full_name || 'Nueva alumna')}</strong><span>${esc(item.email || '')}</span><small>Registro: ${esc(fmt(item.registered_at))}</small></div></div>
        <div class="pending110-state">${stateLabel(item)}<small>${item.course_interest === 'metodo-mes' ? 'Interés: Método MES®' : 'Registro público'}</small><small title="${esc(originLabel(item))}">${esc(originLabel(item))}</small></div>
        <div class="pending110-course"><label>Curso a activar<select data-pending111-course ${item.account_created ? '' : 'disabled'}>${courseOptions(defaultId)}</select></label></div>
        <div class="pending110-action"><button type="button" data-pending111-activate="${esc(item.user_id || '')}" ${item.account_created && courses.length ? '' : 'disabled'}>${item.account_created ? 'Activar acceso' : 'Esperando creación de cuenta'}</button><small data-pending111-status>${item.email_confirmed_at ? 'Correo confirmado. Lista para aprobación.' : item.account_created ? 'Cuenta creada. Falta confirmar correo.' : 'La solicitud está guardada.'}</small></div>
      </article>`).join('') : `<div class="pending110-empty"><span>✓</span><div><strong>No hay registros pendientes</strong><p>Las nuevas solicitudes aparecerán aquí cuando lleguen.</p></div></div>`}</div>`;

    $('[data-pending111-refresh]',panel)?.addEventListener('click',() => refresh(true));
    $$('[data-pending111-activate]',panel).forEach(button => button.addEventListener('click',() => activate(button)));
    return true;
  }

  async function activate(button) {
    if (button.disabled) return;
    const card = button.closest('[data-pending-user]');
    const userId = button.dataset.pending111Activate;
    const courseId = $('[data-pending111-course]',card)?.value || defaultCourseId();
    const status = $('[data-pending111-status]',card);
    if (!userId || !courseId || !status) return;

    button.disabled = true;
    status.className = '';
    status.textContent = 'Activando acceso…';

    try {
      const api = await client();
      const { error } = await api.from('enrollments').insert({ user_id:userId, course_id:courseId, status:'active' });
      if (error) throw error;
      status.className = 'ok';
      status.textContent = 'Acceso activado correctamente.';
      loadedAt = 0;
      await loadData(true);
      renderStudents();
      await window.ACADEMIA_YAMILET_STUDENTS_RUNTIME?.refresh?.();
    } catch (error) {
      console.warn('Academia Yamilet pending registration activation v119',error);
      status.className = 'error';
      status.textContent = String(error?.message || '').toLowerCase().includes('duplicate')
        ? 'Esta persona ya tiene ese curso asignado.'
        : 'No fue posible activar el curso.';
      button.disabled = false;
    }
  }

  function renderCurrent() {
    if (isOverview()) return renderOverview();
    if (isStudents()) return renderStudents();
    return false;
  }

  async function mount(force = false) {
    if (!supported()) return false;
    try {
      await loadData(force);
      return renderCurrent();
    } catch (error) {
      console.warn('Academia Yamilet pending registrations v119',error);
      if (isStudents()) {
        const panel = panelHost();
        if (panel) panel.innerHTML = '<div class="pending110-error"><strong>No fue posible cargar los nuevos registros.</strong><span>El directorio puede seguir funcionando. Pulsa Actualizar para reintentar esta sección.</span><button type="button" data-pending111-retry>Reintentar</button></div>';
        $('[data-pending111-retry]',panel)?.addEventListener('click',() => refresh(true),{once:true});
      }
      return false;
    }
  }

  async function refresh(force = true) {
    if (!supported()) return false;
    const panel = isStudents() ? panelHost() : null;
    panel?.classList.add('is-loading');
    try {
      loadedAt = force ? 0 : loadedAt;
      return await mount(force);
    } finally {
      panelHost()?.classList.remove('is-loading');
    }
  }

  function onRouteChange() {
    if (!supported()) return;
    mount(false);
  }

  function start() {
    window.addEventListener('hashchange',onRouteChange);
    window.addEventListener('popstate',onRouteChange);
    document.addEventListener('click',event => {
      if (event.target.closest('[data-admin-v79-refresh]') && supported()) refresh(true);
    },true);
    if (supported()) mount(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111 = Object.freeze({
    version: VERSION,
    refresh: () => refresh(true),
    render: renderCurrent,
    mount: () => mount(false)
  });
})();
