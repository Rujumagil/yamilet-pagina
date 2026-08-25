(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const EVENT_TYPES = { session:'Sesión', workshop:'Taller', live_class:'Clase en vivo', orientation:'Orientación', webinar:'Webinar', community:'Comunidad' };
  const STATUS_LABELS = { draft:'Borrador', published:'Publicada', cancelled:'Cancelada', completed:'Completada' };
  const MODE_LABELS = { online:'Online', in_person:'Presencial', hybrid:'Híbrida' };
  let clientPromise;
  let editingId = null;
  let cachedData = null;
  let renderBusy = false;

  async function context() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers:{ Accept:'application/json' } });
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
        return { sb, cfg };
      })();
    }
    const { sb, cfg } = await clientPromise;
    const { data:{ session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('no_session');
    const [{ data:workspace }, { data:profile }] = await Promise.all([
      sb.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle(),
      sb.from('profiles').select('id,full_name,email,role').eq('id', session.user.id).maybeSingle()
    ]);
    if (!workspace) throw new Error('no_workspace');
    const { data:membership } = await sb.from('workspace_members').select('role,status').eq('workspace_id', workspace.id).eq('user_id', session.user.id).maybeSingle();
    const role = membership?.status === 'active' ? membership.role : profile?.role;
    if (!['owner','admin','instructor'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
    return { sb, cfg, workspace, user:session.user, profile:profile || {}, role };
  }

  async function loadData() {
    const ctx = await context();
    const { sb, workspace } = ctx;
    const [{ data:courses, error:courseError }, { data:events, error:eventError }] = await Promise.all([
      sb.from('courses').select('id,title,status').eq('workspace_id', workspace.id).order('created_at',{ ascending:true }),
      sb.from('academy_events').select('id,workspace_id,course_id,title,description,event_type,starts_at,ends_at,timezone,delivery_mode,location_text,meeting_url,status,is_featured,created_at,updated_at').eq('workspace_id', workspace.id).order('starts_at',{ ascending:true }).limit(120)
    ]);
    if (courseError) throw courseError;
    if (eventError) throw eventError;
    cachedData = { ...ctx, courses:courses || [], events:events || [] };
    return cachedData;
  }

  function localInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDate(value) {
    if (!value) return 'Sin fecha';
    try { return new Intl.DateTimeFormat('es-MX',{ dateStyle:'medium', timeStyle:'short' }).format(new Date(value)); }
    catch { return 'Sin fecha'; }
  }

  function courseName(data, id) {
    return data.courses.find(course => course.id === id)?.title || 'Toda la Academia';
  }

  function counts(data) {
    const now = Date.now();
    return {
      total:data.events.length,
      upcoming:data.events.filter(event => event.status === 'published' && new Date(event.starts_at).getTime() >= now).length,
      draft:data.events.filter(event => event.status === 'draft').length,
      live:data.events.filter(event => event.status === 'published' && ['online','hybrid'].includes(event.delivery_mode) && new Date(event.starts_at).getTime() >= now).length
    };
  }

  function defaultStart() {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0,0,0);
    return localInput(d);
  }

  function editor(data) {
    const event = editingId ? data.events.find(item => item.id === editingId) : null;
    const start = event ? localInput(event.starts_at) : defaultStart();
    const end = event ? localInput(event.ends_at) : '';
    return `<section class="event-admin-editor" data-event-admin-editor>
      <div class="event-admin-editor-head"><div><span class="event-admin-kicker">${event ? 'EDITAR EVENTO' : 'NUEVA ACTIVIDAD'}</span><h4>${event ? esc(event.title) : 'Programar sesión o evento'}</h4><p>Los borradores solo los ve el equipo. Al publicar, la actividad aparece automáticamente en el calendario de las alumnas.</p></div>${event ? '<button type="button" data-event-new>Crear otro</button>' : ''}</div>
      <form data-event-form>
        <div class="event-admin-form-grid">
          <label class="wide">Título<input name="title" required maxlength="180" value="${esc(event?.title || '')}" placeholder="Ej. Sesión en vivo · Integración MES"></label>
          <label>Tipo<select name="event_type">${Object.entries(EVENT_TYPES).map(([value,label]) => `<option value="${value}" ${event?.event_type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label>Curso<select name="course_id"><option value="">Toda la Academia</option>${data.courses.map(course => `<option value="${esc(course.id)}" ${event?.course_id === course.id ? 'selected' : ''}>${esc(course.title)}</option>`).join('')}</select></label>
          <label>Inicio<input type="datetime-local" name="starts_at" required value="${esc(start)}"></label>
          <label>Fin<input type="datetime-local" name="ends_at" value="${esc(end)}"></label>
          <label>Modalidad<select name="delivery_mode"><option value="online" ${!event || event.delivery_mode === 'online' ? 'selected' : ''}>Online</option><option value="in_person" ${event?.delivery_mode === 'in_person' ? 'selected' : ''}>Presencial</option><option value="hybrid" ${event?.delivery_mode === 'hybrid' ? 'selected' : ''}>Híbrida</option></select></label>
          <label>Estado<select name="status"><option value="draft" ${!event || event.status === 'draft' ? 'selected' : ''}>Borrador</option><option value="published" ${event?.status === 'published' ? 'selected' : ''}>Publicada</option><option value="cancelled" ${event?.status === 'cancelled' ? 'selected' : ''}>Cancelada</option><option value="completed" ${event?.status === 'completed' ? 'selected' : ''}>Completada</option></select></label>
          <label class="wide">Enlace de sesión<input type="url" name="meeting_url" value="${esc(event?.meeting_url || '')}" placeholder="https://zoom.us/... o https://meet.google.com/..."></label>
          <label class="wide">Ubicación presencial<input name="location_text" value="${esc(event?.location_text || '')}" placeholder="Dirección o lugar de encuentro"></label>
          <label class="wide">Descripción<textarea name="description" rows="3" placeholder="Objetivo, materiales o instrucciones para las alumnas.">${esc(event?.description || '')}</textarea></label>
          <label class="event-admin-check wide"><input type="checkbox" name="is_featured" ${event?.is_featured ? 'checked' : ''}><span>Destacar esta actividad en la agenda</span></label>
        </div>
        <div class="event-admin-form-actions"><span data-event-save-status></span><button type="submit">${event ? 'Guardar cambios' : 'Crear actividad'}</button></div>
      </form>
    </section>`;
  }

  function eventCard(data, event) {
    const isUpcoming = new Date(event.starts_at).getTime() >= Date.now();
    return `<article class="event-admin-card" data-event-card="${esc(event.id)}">
      <div class="event-admin-card-date"><span>${isUpcoming ? 'PRÓXIMA' : 'PASADA'}</span><strong>${esc(formatDate(event.starts_at))}</strong></div>
      <div class="event-admin-card-copy"><div class="event-admin-card-top"><span>${esc(EVENT_TYPES[event.event_type] || event.event_type)}</span><span class="event-admin-status ${esc(event.status)}">${esc(STATUS_LABELS[event.status] || event.status)}</span></div><h5>${esc(event.title)}</h5><p>${esc(event.description || 'Sin descripción.')}</p><div class="event-admin-card-meta"><span>${esc(courseName(data,event.course_id))}</span><span>${esc(MODE_LABELS[event.delivery_mode] || event.delivery_mode)}</span>${event.ends_at ? `<span>Hasta ${esc(formatDate(event.ends_at))}</span>` : ''}${event.is_featured ? '<span>Destacada</span>' : ''}</div></div>
      <div class="event-admin-card-actions"><button type="button" data-event-edit="${esc(event.id)}">Editar</button>${event.meeting_url ? `<a href="${esc(event.meeting_url)}" target="_blank" rel="noopener noreferrer">Abrir enlace</a>` : ''}</div>
    </article>`;
  }

  function list(data) {
    if (!data.events.length) return `<section class="event-admin-list"><div class="event-admin-empty"><strong>No hay sesiones programadas</strong><span>Crea la primera actividad desde el formulario. Nada se publicará hasta que cambies su estado a Publicada.</span></div></section>`;
    const future = data.events.filter(event => new Date(event.starts_at).getTime() >= Date.now()).sort((a,b) => new Date(a.starts_at)-new Date(b.starts_at));
    const past = data.events.filter(event => new Date(event.starts_at).getTime() < Date.now()).sort((a,b) => new Date(b.starts_at)-new Date(a.starts_at));
    return `<section class="event-admin-list"><div class="event-admin-list-head"><div><span class="event-admin-kicker">AGENDA CONFIGURADA</span><h4>Sesiones y eventos</h4></div><button type="button" data-event-refresh>Actualizar</button></div><div class="event-admin-cards">${[...future,...past].map(event => eventCard(data,event)).join('')}</div></section>`;
  }

  function markup(data) {
    const stat = counts(data);
    return `<section class="event-admin" data-event-admin>
      <div class="event-admin-heading"><div><span class="event-admin-kicker">CALENDARIO Y SESIONES EN VIVO</span><h3>Gestiona la agenda académica</h3><p>Programa clases, talleres, webinars y encuentros. Al publicar una actividad, las alumnas inscritas reciben aviso y la ven en su calendario.</p></div><div class="event-admin-stats"><span><strong>${stat.upcoming}</strong><small>próximas</small></span><span><strong>${stat.live}</strong><small>online</small></span><span><strong>${stat.draft}</strong><small>borradores</small></span></div></div>
      ${editor(data)}${list(data)}
    </section>`;
  }

  function payloadFromForm(form, data) {
    const values = Object.fromEntries(new FormData(form).entries());
    const start = new Date(values.starts_at);
    const end = values.ends_at ? new Date(values.ends_at) : null;
    if (Number.isNaN(start.getTime())) throw new Error('Define una fecha y hora de inicio válidas.');
    if (end && Number.isNaN(end.getTime())) throw new Error('La fecha de fin no es válida.');
    if (end && end <= start) throw new Error('La hora de fin debe ser posterior al inicio.');
    if (['online','hybrid'].includes(values.delivery_mode) && values.status === 'published' && !/^https:\/\//i.test(String(values.meeting_url || '').trim())) throw new Error('Agrega un enlace https antes de publicar una sesión online o híbrida.');
    if (['in_person','hybrid'].includes(values.delivery_mode) && values.status === 'published' && !String(values.location_text || '').trim()) throw new Error('Agrega una ubicación antes de publicar una sesión presencial o híbrida.');
    return {
      workspace_id:data.workspace.id,
      course_id:values.course_id || null,
      title:String(values.title || '').trim(),
      description:String(values.description || '').trim() || null,
      event_type:values.event_type,
      starts_at:start.toISOString(),
      ends_at:end ? end.toISOString() : null,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
      delivery_mode:values.delivery_mode,
      location_text:String(values.location_text || '').trim() || null,
      meeting_url:String(values.meeting_url || '').trim() || null,
      status:values.status,
      is_featured:form.elements.is_featured.checked
    };
  }

  async function save(form, data) {
    const statusNode = $('[data-event-save-status]', form);
    const button = $('button[type="submit"]', form);
    try {
      const payload = payloadFromForm(form, data);
      const previous = editingId ? data.events.find(item => item.id === editingId) : null;
      if (previous?.status === 'published' && payload.status === 'cancelled' && !window.confirm('¿Cancelar esta sesión? Las alumnas recibirán un aviso de cancelación.')) return;
      button.disabled = true;
      statusNode.textContent = editingId ? 'Guardando cambios…' : 'Creando actividad…';
      let result;
      if (editingId) {
        result = await data.sb.from('academy_events').update(payload).eq('id', editingId).eq('workspace_id', data.workspace.id).select('id').maybeSingle();
      } else {
        result = await data.sb.from('academy_events').insert({ ...payload, created_by:data.user.id }).select('id').maybeSingle();
      }
      if (result.error) throw result.error;
      editingId = null;
      statusNode.textContent = 'Agenda actualizada.';
      window.ACADEMIA_YAMILET_CALENDAR?.refresh?.();
      window.setTimeout(render, 180);
    } catch (error) {
      statusNode.textContent = error?.message || 'No fue posible guardar la actividad.';
      button.disabled = false;
    }
  }

  function bind(host, data) {
    $('[data-event-form]',host)?.addEventListener('submit', event => { event.preventDefault(); save(event.currentTarget,data); });
    $('[data-event-new]',host)?.addEventListener('click', () => { editingId = null; render(); });
    $('[data-event-refresh]',host)?.addEventListener('click', () => render());
    $$('[data-event-edit]',host).forEach(button => button.addEventListener('click', () => { editingId = button.dataset.eventEdit; render(); window.setTimeout(() => $('[data-event-admin-editor]')?.scrollIntoView({behavior:'smooth',block:'start'}),120); }));
  }

  async function render() {
    if (renderBusy) return;
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return false;
    renderBusy = true;
    let host = $('[data-event-admin-host]',page);
    if (!host) { host = document.createElement('div'); host.dataset.eventAdminHost = 'true'; page.appendChild(host); }
    host.innerHTML = '<section class="event-admin event-admin-loading"><strong>Cargando agenda académica…</strong></section>';
    try {
      const data = await loadData();
      if (page.classList.contains('hidden')) return false;
      host.innerHTML = markup(data);
      bind(host,data);
      return true;
    } catch (error) {
      console.error('Academia Yamilet event admin',error);
      host.innerHTML = '<section class="event-admin event-admin-loading"><strong>No fue posible cargar la agenda administrativa.</strong><span>Actualiza la Academia e inténtalo nuevamente.</span></section>';
      return false;
    } finally { renderBusy = false; }
  }

  document.addEventListener('click',event => {
    if (event.target.closest('[data-shell-route="admin"]')) window.setTimeout(render,140);
  });
  window.addEventListener('pageshow',() => window.setTimeout(render,700));
  window.ACADEMIA_YAMILET_EVENT_ADMIN = { render };
})();