(() => {
  'use strict';

  const VERSION = '143.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  let filter = 'all';
  let query = '';
  let scheduled = false;
  let clientPromise = null;
  let contextPromise = null;
  let refreshing = false;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function rows() {
    return $$('.booking-row', $('[data-booking-list]') || document);
  }

  function state(row) {
    return $('[data-booking-status]', row)?.value || 'requested';
  }

  function formatDate(value) {
    if (!value) return 'Sin fecha';
    try {
      return new Intl.DateTimeFormat('es-MX', {day:'2-digit', month:'short', year:'numeric', timeZone:'UTC'})
        .format(new Date(`${value}T12:00:00Z`));
    } catch {
      return value;
    }
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const res = await fetch(CONFIG_ENDPOINT, {headers:{Accept:'application/json'}, cache:'no-store'});
        if (!res.ok) throw new Error('booking_config_unavailable');
        const cfg = await res.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}
        });
        sb.auth.onAuthStateChange((event) => {
          contextPromise = null;
          if (['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) window.setTimeout(prepare, 50);
          if (event === 'SIGNED_OUT') unmountNav();
        });
        return {sb, cfg};
      })().catch(error => {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  async function getContext(force = false) {
    if (force) contextPromise = null;
    if (!contextPromise) {
      contextPromise = (async () => {
        const {sb, cfg} = await getClient();
        const {data:{session}} = await sb.auth.getSession();
        if (!session?.user) return null;
        const [{data:profile}, {data:workspace}] = await Promise.all([
          sb.from('profiles').select('id,role,status').eq('id', session.user.id).maybeSingle(),
          sb.from('workspaces').select('id,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
        ]);
        if (!workspace) return null;
        const {data:membership} = await sb.from('workspace_members')
          .select('role,status')
          .eq('workspace_id', workspace.id)
          .eq('user_id', session.user.id)
          .maybeSingle();
        const canManage = profile?.role === 'admin' || (membership?.status === 'active' && ['owner','admin'].includes(membership.role));
        return {sb, cfg, session, profile, workspace, membership, canManage};
      })().catch(error => {
        console.warn('Academia Yamilet citas context', error);
        return null;
      });
    }
    return contextPromise;
  }

  function counts() {
    const all = rows();
    return {
      requested: all.filter(r => state(r) === 'requested').length,
      confirmed: all.filter(r => state(r) === 'confirmed').length,
      completed: all.filter(r => state(r) === 'completed').length,
      cancelled: all.filter(r => state(r) === 'cancelled').length
    };
  }

  function applyFilter() {
    const term = query.trim().toLowerCase();
    let visible = 0;
    rows().forEach(row => {
      const matchesState = filter === 'all' || state(row) === filter;
      const matchesText = !term || row.textContent.toLowerCase().includes(term);
      const show = matchesState && matchesText;
      row.classList.toggle('booking142-hidden', !show);
      if (show) visible += 1;
    });
    const count = $('[data-booking142-visible]');
    if (count) count.textContent = `${visible} ${visible === 1 ? 'solicitud visible' : 'solicitudes visibles'}`;
  }

  function updateStats() {
    const c = counts();
    const map = {
      '[data-booking142-new]': c.requested,
      '[data-booking142-confirmed]': c.confirmed,
      '[data-booking142-completed]': c.completed,
      '[data-booking142-cancelled]': c.cancelled
    };
    Object.entries(map).forEach(([selector, value]) => {
      const el = $(selector);
      if (el) el.textContent = value;
    });
    const globalCount = $('[data-booking-count]');
    if (globalCount) globalCount.textContent = c.requested;
    const label = globalCount?.closest('article')?.querySelector('span');
    if (label) label.textContent = 'Citas por atender';
  }

  function setRefreshStatus(text = '') {
    const el = $('[data-booking143-status]');
    if (el) el.textContent = text;
  }

  function ensureShell(panel, list) {
    if ($('[data-booking142-shell]', panel)) return;
    panel.classList.add('booking142-panel');
    const shell = document.createElement('div');
    shell.className = 'booking142-shell';
    shell.dataset.booking142Shell = 'true';
    shell.dataset.booking143Version = VERSION;
    shell.innerHTML = `
      <header class="booking142-head">
        <div><span>GESTIÓN DE SOLICITUDES</span><h2>Citas y sesiones</h2><p>Las solicitudes enviadas desde yamiletperez.com se consultan directamente desde la Academia para que Yamilet pueda darles seguimiento.</p></div>
        <button type="button" data-booking143-refresh>Actualizar citas</button>
      </header>
      <section class="booking142-stats">
        <article><strong data-booking142-new>0</strong><span>Nuevas</span><small>por atender</small></article>
        <article><strong data-booking142-confirmed>0</strong><span>Confirmadas</span><small>con seguimiento</small></article>
        <article><strong data-booking142-completed>0</strong><span>Realizadas</span><small>histórico</small></article>
        <article><strong data-booking142-cancelled>0</strong><span>Canceladas</span><small>sin seguimiento</small></article>
      </section>
      <div class="booking142-tools">
        <label class="booking142-search"><span>Buscar persona</span><input type="search" data-booking142-search placeholder="Nombre, correo o fecha"></label>
        <div class="booking142-filters">
          <button type="button" class="active" data-booking142-filter="all">Todas</button>
          <button type="button" data-booking142-filter="requested">Nuevas</button>
          <button type="button" data-booking142-filter="confirmed">Confirmadas</button>
          <button type="button" data-booking142-filter="completed">Realizadas</button>
          <button type="button" data-booking142-filter="cancelled">Canceladas</button>
        </div>
      </div>
      <div class="booking142-count"><span data-booking142-visible></span><span data-booking143-status style="margin-left:10px"></span></div>`;
    panel.insertBefore(shell, list);
    list.classList.add('booking142-list');

    $('[data-booking142-search]', shell)?.addEventListener('input', e => {
      query = e.target.value;
      applyFilter();
    });
    $$('[data-booking142-filter]', shell).forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.booking142Filter || 'all';
      $$('[data-booking142-filter]', shell).forEach(item => item.classList.toggle('active', item === button));
      applyFilter();
    }));
    $('[data-booking143-refresh]', shell)?.addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      await refreshBookings(true);
      e.currentTarget.disabled = false;
    });
  }

  async function updateBookingStatus(id, status) {
    const ctx = await getContext();
    if (!ctx?.canManage) throw new Error('forbidden');
    const {error} = await ctx.sb.from('free_class_bookings')
      .update({status})
      .eq('workspace_id', ctx.workspace.id)
      .eq('id', id);
    if (error) throw error;
  }

  function renderRows(list, data) {
    if (!data.length) {
      list.innerHTML = '<div class="booking142-empty"><strong>No hay solicitudes todavía.</strong><br><span>Cuando alguien agende desde la página de Yamilet aparecerá aquí.</span></div>';
      updateStats();
      applyFilter();
      return;
    }

    list.innerHTML = data.map(b => `
      <article class="booking-row" data-booking142-status="${esc(b.status || 'requested')}">
        <strong>${esc(formatDate(b.booking_date))}</strong>
        <span>${esc(b.full_name || 'Sin nombre')}</span>
        <span><a href="mailto:${esc(b.email || '')}">${esc(b.email || 'Sin correo')}</a></span>
        <select data-booking-status="${esc(b.id)}" aria-label="Estado de ${esc(b.full_name || 'la solicitud')}">
          <option value="requested" ${b.status === 'requested' ? 'selected' : ''}>Solicitada</option>
          <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmada</option>
          <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Realizada</option>
          <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelada</option>
        </select>
      </article>`).join('');

    $$('[data-booking-status]', list).forEach(select => {
      select.addEventListener('change', async () => {
        const row = select.closest('.booking-row');
        const previous = row?.dataset.booking142Status || 'requested';
        select.disabled = true;
        try {
          await updateBookingStatus(select.dataset.bookingStatus, select.value);
          if (row) row.dataset.booking142Status = select.value;
          setRefreshStatus('Estado actualizado');
          updateStats();
          applyFilter();
        } catch (error) {
          console.error('Academia Yamilet actualizar cita', error);
          select.value = previous;
          setRefreshStatus('No fue posible actualizar el estado');
        } finally {
          select.disabled = false;
        }
      });
    });

    updateStats();
    applyFilter();
  }

  async function refreshBookings(forceContext = false) {
    if (refreshing) return;
    const panel = $('#reservas');
    const list = $('[data-booking-list]');
    if (!panel || !list) return;
    ensureShell(panel, list);
    refreshing = true;
    setRefreshStatus('Actualizando…');
    try {
      const ctx = await getContext(forceContext);
      if (!ctx?.canManage) {
        list.innerHTML = '<div class="booking142-empty">Esta cuenta no tiene permisos para administrar citas.</div>';
        return;
      }
      const {data, error} = await ctx.sb.from('free_class_bookings')
        .select('id,booking_date,full_name,email,status,source,page_url,created_at')
        .eq('workspace_id', ctx.workspace.id)
        .order('created_at', {ascending:false})
        .limit(200);
      if (error) throw error;
      renderRows(list, data || []);
      setRefreshStatus(`Actualizado ${new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(new Date())}`);
    } catch (error) {
      console.error('Academia Yamilet cargar citas', error);
      list.innerHTML = '<div class="booking142-empty">No fue posible consultar las citas. Usa “Actualizar citas” para intentar nuevamente.</div>';
      setRefreshStatus('Error al actualizar');
    } finally {
      refreshing = false;
    }
  }

  function unmountNav() {
    const legacy = $('[data-scroll-bookings]');
    if (!legacy) return;
    legacy.classList.add('hidden');
    legacy.setAttribute('aria-hidden','true');
    legacy.tabIndex = -1;
    delete legacy.dataset.booking142Mounted;
  }

  async function mountNav() {
    const panel = $('#reservas');
    const legacy = $('[data-scroll-bookings]');
    const adminItems = $('.academy-nav-group-admin .academy-nav-group-items');
    if (!panel || !legacy || !adminItems) return false;
    const ctx = await getContext();
    if (!ctx?.canManage) return false;

    legacy.textContent = 'Citas / Solicitudes';
    legacy.classList.remove('hidden');
    legacy.removeAttribute('aria-hidden');
    legacy.tabIndex = 0;
    if (legacy.parentElement !== adminItems) adminItems.appendChild(legacy);

    if (legacy.dataset.booking142Mounted !== 'true') {
      legacy.dataset.booking142Mounted = 'true';
      legacy.addEventListener('click', async () => {
        panel.classList.remove('hidden');
        panel.style.setProperty('display','block','important');
        panel.style.setProperty('grid-column','1 / -1','important');
        await refreshBookings(true);
        requestAnimationFrame(() => panel.scrollIntoView({behavior:'smooth',block:'start'}));
      });
    }
    return true;
  }

  async function prepare() {
    const mounted = await mountNav();
    if (!mounted) return;
    const panel = $('#reservas');
    const list = $('[data-booking-list]');
    if (!panel || !list) return;
    ensureShell(panel, list);
    if (!panel.classList.contains('hidden')) await refreshBookings();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      prepare();
    });
  }

  function boot() {
    const observer = new MutationObserver(records => {
      if (records.some(r => [...(r.addedNodes || [])].some(n => n.nodeType === 1) || r.type === 'attributes')) schedule();
    });
    observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['class']});

    document.addEventListener('click', event => {
      if (event.target.closest('[data-admin-target="bookings"]')) {
        window.setTimeout(async () => {
          const panel = $('#reservas');
          if (panel) {
            panel.classList.remove('hidden');
            panel.style.setProperty('display','block','important');
          }
          await refreshBookings(true);
        }, 40);
      }
      if (event.target.closest('[data-shell-route="admin"]')) window.setTimeout(prepare, 80);
    }, true);

    window.addEventListener('pageshow', () => window.setTimeout(prepare, 50));
    window.setTimeout(prepare, 150);
    window.setTimeout(prepare, 700);
    window.setTimeout(prepare, 1600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
