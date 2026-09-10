(() => {
  'use strict';

  const VERSION = '144.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';

  let clientPromise = null;
  let contextPromise = null;
  let scheduled = false;
  let refreshing = false;
  let nativeOpen = false;
  let filter = 'all';
  let searchText = '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function formatDate(value) {
    if (!value) return 'Sin fecha';
    try {
      return new Intl.DateTimeFormat('es-MX', {
        day:'2-digit', month:'short', year:'numeric', timeZone:'UTC'
      }).format(new Date(`${value}T12:00:00Z`));
    } catch {
      return value;
    }
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        if (!window.supabase?.createClient) throw new Error('supabase_client_missing');
        const response = await fetch(CONFIG_ENDPOINT, {
          headers:{Accept:'application/json'},
          cache:'no-store'
        });
        if (!response.ok) throw new Error('booking_config_unavailable');
        const config = await response.json();
        const sb = window.supabase.createClient(config.url, config.anonKey, {
          auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}
        });
        sb.auth.onAuthStateChange((event) => {
          contextPromise = null;
          if (event === 'SIGNED_OUT') {
            nativeOpen = false;
            document.querySelector('[data-booking144-admin-tab]')?.remove();
          } else if (['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
            window.setTimeout(prepare, 80);
          }
        });
        return {sb, config};
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
        const {sb, config} = await getClient();
        const {data:{session}, error:sessionError} = await sb.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) return null;

        const [profileResult, workspaceResult] = await Promise.all([
          sb.from('profiles').select('id,role,status').eq('id', session.user.id).maybeSingle(),
          sb.from('workspaces').select('id,slug').eq('slug', config.workspaceSlug || 'yamilet-mes').maybeSingle()
        ]);

        if (profileResult.error) throw profileResult.error;
        if (workspaceResult.error) throw workspaceResult.error;
        const workspace = workspaceResult.data;
        if (!workspace) return null;

        const {data:membership, error:membershipError} = await sb.from('workspace_members')
          .select('role,status')
          .eq('workspace_id', workspace.id)
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (membershipError) throw membershipError;

        const profile = profileResult.data || {};
        const canManage = profile.role === 'admin'
          || (membership?.status === 'active' && ['owner','admin'].includes(membership.role));

        return {sb, config, session, profile, workspace, membership, canManage};
      })().catch(error => {
        console.warn('Academia Yamilet citas context', error);
        return null;
      });
    }
    return contextPromise;
  }

  function shellMarkup() {
    return `
      <section class="booking144-native booking142-panel" data-booking144-native data-booking144-version="${VERSION}">
        <div class="booking142-shell">
          <header class="booking142-head">
            <div>
              <span>GESTIÓN DE SOLICITUDES</span>
              <h2>Citas y sesiones</h2>
              <p>Consulta las solicitudes enviadas desde yamiletperez.com y cambia su estado conforme Yamilet les da seguimiento.</p>
            </div>
            <button type="button" data-booking144-refresh>Actualizar citas</button>
          </header>

          <section class="booking142-stats">
            <article><strong data-booking144-new>0</strong><span>Nuevas</span><small>por atender</small></article>
            <article><strong data-booking144-confirmed>0</strong><span>Confirmadas</span><small>con seguimiento</small></article>
            <article><strong data-booking144-completed>0</strong><span>Realizadas</span><small>histórico</small></article>
            <article><strong data-booking144-cancelled>0</strong><span>Canceladas</span><small>sin seguimiento</small></article>
          </section>

          <div class="booking142-tools">
            <label class="booking142-search">
              <span>Buscar persona</span>
              <input type="search" data-booking144-search placeholder="Nombre, correo o fecha" autocomplete="off">
            </label>
            <div class="booking142-filters" aria-label="Filtrar citas">
              <button type="button" class="active" data-booking144-filter="all">Todas</button>
              <button type="button" data-booking144-filter="requested">Nuevas</button>
              <button type="button" data-booking144-filter="confirmed">Confirmadas</button>
              <button type="button" data-booking144-filter="completed">Realizadas</button>
              <button type="button" data-booking144-filter="cancelled">Canceladas</button>
            </div>
          </div>

          <div class="booking142-count">
            <span data-booking144-visible></span>
            <span data-booking144-status></span>
          </div>

          <div class="booking142-list" data-booking144-list>
            <div class="booking142-empty">Cargando citas…</div>
          </div>
        </div>
      </section>`;
  }

  function currentRoot() {
    return $('[data-booking144-native]');
  }

  function rows(root = currentRoot()) {
    return root ? $$('.booking-row', root) : [];
  }

  function rowState(row) {
    return $('[data-booking144-status-select]', row)?.value || row.dataset.booking142Status || 'requested';
  }

  function setStatus(text = '', root = currentRoot()) {
    const el = root && $('[data-booking144-status]', root);
    if (el) el.textContent = text;
  }

  function updateStats(root = currentRoot()) {
    if (!root) return;
    const all = rows(root);
    const counts = {
      requested: all.filter(row => rowState(row) === 'requested').length,
      confirmed: all.filter(row => rowState(row) === 'confirmed').length,
      completed: all.filter(row => rowState(row) === 'completed').length,
      cancelled: all.filter(row => rowState(row) === 'cancelled').length
    };
    const map = {
      '[data-booking144-new]': counts.requested,
      '[data-booking144-confirmed]': counts.confirmed,
      '[data-booking144-completed]': counts.completed,
      '[data-booking144-cancelled]': counts.cancelled
    };
    Object.entries(map).forEach(([selector, value]) => {
      const el = $(selector, root);
      if (el) el.textContent = value;
    });

    const tab = $('[data-booking144-admin-tab]');
    if (tab) {
      const label = $('b', tab);
      if (label) label.textContent = counts.requested ? `Citas (${counts.requested})` : 'Citas';
    }
  }

  function applyFilter(root = currentRoot()) {
    if (!root) return;
    const term = searchText.trim().toLowerCase();
    let visible = 0;

    rows(root).forEach(row => {
      const matchesState = filter === 'all' || rowState(row) === filter;
      const matchesText = !term || row.textContent.toLowerCase().includes(term);
      const show = matchesState && matchesText;
      row.classList.toggle('booking142-hidden', !show);
      if (show) visible += 1;
    });

    const count = $('[data-booking144-visible]', root);
    if (count) count.textContent = `${visible} ${visible === 1 ? 'solicitud visible' : 'solicitudes visibles'}`;
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

  function bindRows(root) {
    $$('[data-booking144-status-select]', root).forEach(select => {
      if (select.dataset.booking144Bound === 'true') return;
      select.dataset.booking144Bound = 'true';
      select.addEventListener('change', async () => {
        const row = select.closest('.booking-row');
        const previous = row?.dataset.booking142Status || 'requested';
        select.disabled = true;
        try {
          await updateBookingStatus(select.dataset.bookingId, select.value);
          if (row) row.dataset.booking142Status = select.value;
          setStatus('Estado actualizado', root);
          updateStats(root);
          applyFilter(root);
        } catch (error) {
          console.error('Academia Yamilet actualizar cita', error);
          select.value = previous;
          setStatus('No fue posible actualizar el estado', root);
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  function renderBookings(data, root = currentRoot()) {
    if (!root) return;
    const list = $('[data-booking144-list]', root);
    if (!list) return;

    if (!data.length) {
      list.innerHTML = `
        <div class="booking142-empty">
          <strong>No hay solicitudes todavía.</strong><br>
          <span>Cuando alguien agende desde la página de Yamilet aparecerá aquí.</span>
        </div>`;
      updateStats(root);
      applyFilter(root);
      return;
    }

    list.innerHTML = data.map(booking => `
      <article class="booking-row" data-booking142-status="${esc(booking.status || 'requested')}">
        <strong>${esc(formatDate(booking.booking_date))}</strong>
        <span>${esc(booking.full_name || 'Sin nombre')}</span>
        <span><a href="mailto:${esc(booking.email || '')}">${esc(booking.email || 'Sin correo')}</a></span>
        <select
          data-booking144-status-select
          data-booking-id="${esc(booking.id)}"
          aria-label="Estado de ${esc(booking.full_name || 'la solicitud')}">
          <option value="requested" ${booking.status === 'requested' ? 'selected' : ''}>Solicitada</option>
          <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>Confirmada</option>
          <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>Realizada</option>
          <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>Cancelada</option>
        </select>
      </article>`).join('');

    bindRows(root);
    updateStats(root);
    applyFilter(root);
  }

  async function refreshBookings(forceContext = false, root = currentRoot()) {
    if (!root || refreshing) return;
    refreshing = true;
    setStatus('Actualizando…', root);

    try {
      const ctx = await getContext(forceContext);
      const list = $('[data-booking144-list]', root);
      if (!ctx?.canManage) {
        if (list) list.innerHTML = '<div class="booking142-empty">Esta cuenta no tiene permisos para administrar citas.</div>';
        return;
      }

      const {data, error} = await ctx.sb.from('free_class_bookings')
        .select('id,booking_date,full_name,email,status,source,page_url,created_at')
        .eq('workspace_id', ctx.workspace.id)
        .order('created_at', {ascending:false})
        .limit(200);

      if (error) throw error;
      renderBookings(data || [], root);
      setStatus(`Actualizado ${new Intl.DateTimeFormat('es-MX', {
        hour:'2-digit', minute:'2-digit'
      }).format(new Date())}`, root);
    } catch (error) {
      console.error('Academia Yamilet cargar citas', error);
      const list = $('[data-booking144-list]', root);
      if (list) {
        list.innerHTML = '<div class="booking142-empty">No fue posible consultar las citas. Pulsa “Actualizar citas” para intentar nuevamente.</div>';
      }
      setStatus('Error al actualizar', root);
    } finally {
      refreshing = false;
    }
  }

  function bindNative(root) {
    if (!root || root.dataset.booking144Bound === 'true') return;
    root.dataset.booking144Bound = 'true';

    $('[data-booking144-refresh]', root)?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      await refreshBookings(true, root);
      event.currentTarget.disabled = false;
    });

    $('[data-booking144-search]', root)?.addEventListener('input', event => {
      searchText = event.target.value;
      applyFilter(root);
    });

    $$('[data-booking144-filter]', root).forEach(button => {
      button.addEventListener('click', () => {
        filter = button.dataset.booking144Filter || 'all';
        $$('[data-booking144-filter]', root).forEach(item => {
          item.classList.toggle('active', item === button);
        });
        applyFilter(root);
      });
    });
  }

  function updateAdminChrome() {
    const adminRoot = $('[data-admin-v79-root]');
    if (!adminRoot) return;

    const title = $('.admin-v79-top h1', adminRoot);
    const copy = $('.admin-v79-top p', adminRoot);
    if (title) title.textContent = 'Citas';
    if (copy) copy.textContent = 'Solicitudes de sesión recibidas desde la página pública de Yamilet.';

    $$('.admin-v79-nav button', adminRoot).forEach(button => button.classList.remove('active'));
    $('[data-booking144-admin-tab]', adminRoot)?.classList.add('active');

    const breadcrumb = $('[data-shell-breadcrumb]');
    if (breadcrumb) breadcrumb.textContent = 'Administración · Citas';
    document.title = 'Citas | Academia Yamilet';

    const refresh = $('[data-admin-v79-refresh]', adminRoot);
    if (refresh) {
      if (!refresh.dataset.booking144OriginalText) {
        refresh.dataset.booking144OriginalText = refresh.textContent || 'Actualizar';
      }
      refresh.textContent = 'Actualizar citas';
    }
  }

  function restoreAdminRefresh() {
    const refresh = $('[data-admin-v79-refresh]');
    if (refresh?.dataset.booking144OriginalText) {
      refresh.textContent = refresh.dataset.booking144OriginalText;
      delete refresh.dataset.booking144OriginalText;
    }
  }

  async function openNative() {
    const ctx = await getContext(true);
    if (!ctx?.canManage) return;

    nativeOpen = true;
    filter = 'all';
    searchText = '';

    const module = $('[data-admin-v79-module]');
    if (!module) return;
    module.innerHTML = shellMarkup();

    const root = currentRoot();
    bindNative(root);
    updateAdminChrome();
    await refreshBookings(false, root);
    root?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  async function mountAdminTab() {
    const nav = $('.admin-v79-nav');
    if (!nav) return false;

    const ctx = await getContext();
    if (!ctx?.canManage) return false;

    let tab = $('[data-booking144-admin-tab]', nav);
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.dataset.booking144AdminTab = 'true';
      tab.innerHTML = '<span>◉</span><b>Citas</b>';

      const agenda = $('[data-admin-v79-go="agenda"]', nav);
      if (agenda) nav.insertBefore(tab, agenda);
      else nav.appendChild(tab);
    }

    if (nativeOpen) tab.classList.add('active');
    return true;
  }

  async function updateTabCount() {
    const tab = $('[data-booking144-admin-tab]');
    if (!tab || nativeOpen) return;
    try {
      const ctx = await getContext();
      if (!ctx?.canManage) return;
      const {count, error} = await ctx.sb.from('free_class_bookings')
        .select('id', {count:'exact', head:true})
        .eq('workspace_id', ctx.workspace.id)
        .eq('status', 'requested');
      if (error) return;
      const label = $('b', tab);
      if (label) label.textContent = count ? `Citas (${count})` : 'Citas';
    } catch {}
  }

  async function prepare() {
    const mounted = await mountAdminTab();
    if (!mounted) return;
    if (nativeOpen) {
      const root = currentRoot();
      if (root) updateAdminChrome();
    } else {
      updateTabCount();
    }
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
    document.addEventListener('click', event => {
      const customTab = event.target.closest('[data-booking144-admin-tab]');
      if (customTab) {
        event.preventDefault();
        event.stopPropagation();
        openNative();
        return;
      }

      if (nativeOpen && event.target.closest('[data-admin-v79-refresh]')) {
        event.preventDefault();
        event.stopPropagation();
        const root = currentRoot();
        refreshBookings(true, root);
        return;
      }

      if (nativeOpen && event.target.closest('[data-admin-v79-go]')) {
        nativeOpen = false;
        restoreAdminRefresh();
        return;
      }

      if (nativeOpen && event.target.closest('.admin-v79-top-actions a[href="#home"]')) {
        nativeOpen = false;
        restoreAdminRefresh();
      }
    }, true);

    window.addEventListener('hashchange', () => {
      if (nativeOpen && !String(location.hash || '').startsWith('#admin')) {
        nativeOpen = false;
        restoreAdminRefresh();
      }
      window.setTimeout(schedule, 80);
    });

    const observer = new MutationObserver(() => {
      const nav = $('.admin-v79-nav');
      if (!nav) return;
      const tabMissing = !$('[data-booking144-admin-tab]', nav);
      const nativeWasReplaced = nativeOpen && !currentRoot();
      if (nativeWasReplaced) {
        nativeOpen = false;
        restoreAdminRefresh();
      }
      if (tabMissing || nativeWasReplaced) schedule();
    });
    observer.observe(document.body, {
      childList:true,
      subtree:true
    });

    window.addEventListener('pageshow', () => window.setTimeout(schedule, 80));
    window.setTimeout(schedule, 150);
    window.setTimeout(schedule, 700);
    window.setTimeout(schedule, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
