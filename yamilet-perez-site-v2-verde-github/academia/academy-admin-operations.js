(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let contextPromise;
  let cache = null;
  let activeTab = 'purchases';

  async function getContext() {
    if (!contextPromise) {
      contextPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.user) throw new Error('no_session');
        const user = session.user;
        const [{ data: profile }, { data: workspace }] = await Promise.all([
          sb.from('profiles').select('id,email,full_name,role,status').eq('id', user.id).maybeSingle(),
          sb.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
        ]);
        if (!workspace) throw new Error('no_workspace');
        const { data: membership } = await sb.from('workspace_members')
          .select('role,status')
          .eq('workspace_id', workspace.id)
          .eq('user_id', user.id)
          .maybeSingle();
        const role = membership?.status === 'active' ? membership.role : profile?.role;
        if (!['owner', 'admin', 'instructor'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
        return { sb, cfg, user, profile: profile || {}, workspace, role };
      })();
    }
    return contextPromise;
  }

  function formatDate(value, withTime = false) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('es-MX', withTime
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short', year: 'numeric' }
      ).format(new Date(value));
    } catch { return '—'; }
  }

  function money(value, currency = 'MXN') {
    const amount = Number(value || 0);
    try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(amount); }
    catch { return `${amount.toFixed(2)} ${currency || ''}`.trim(); }
  }

  function statusLabel(value) {
    const labels = {
      active: 'Activo', completed: 'Completado', suspended: 'Suspendido', revoked: 'Revocado', expired: 'Vencido',
      approved: 'Aprobada', pending: 'Pendiente', paid: 'Pagada', failed: 'Fallida', cancelled: 'Cancelada', refunded: 'Reembolsada',
      open: 'Abierto', in_progress: 'En proceso', waiting_user: 'Esperando alumna', resolved: 'Resuelto', closed: 'Cerrado',
      granted: 'Otorgado', reactivated: 'Reactivado'
    };
    return labels[value] || value || '—';
  }

  function profileName(data, userId, fallback = '') {
    const profile = data.profiles.find(row => row.id === userId);
    return profile?.full_name || profile?.email || fallback || 'Alumna';
  }

  function productName(data, productId) {
    return data.products.find(row => row.id === productId)?.name || 'Producto';
  }

  async function loadData(force = false) {
    if (cache && !force) return cache;
    const ctx = await getContext();
    const { sb, workspace } = ctx;
    const safe = async promise => {
      const result = await promise;
      return result.error ? { data: [], error: result.error } : { data: result.data || [], error: null };
    };

    const [productsResult, ordersResult, ticketsResult] = await Promise.all([
      safe(sb.from('products').select('id,name,slug,product_type,price,currency,status,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false })),
      safe(sb.from('orders').select('id,product_id,user_id,provider,payer_email,amount,currency,status,approved_at,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100)),
      safe(sb.from('academy_support_tickets').select('id,user_id,course_id,subject,category,priority,status,created_at,updated_at,last_message_at,closed_at').eq('workspace_id', workspace.id).order('last_message_at', { ascending: false }).limit(100))
    ]);

    const products = productsResult.data;
    const productIds = products.map(row => row.id);
    const [accessResult, historyResult] = productIds.length ? await Promise.all([
      safe(sb.from('student_access').select('id,user_id,product_id,status,source,reference,granted_at,expires_at,updated_at').in('product_id', productIds).order('updated_at', { ascending: false }).limit(100)),
      safe(sb.from('access_history').select('id,access_id,user_id,product_id,action,previous_status,new_status,reference,notes,performed_by,created_at').in('product_id', productIds).order('created_at', { ascending: false }).limit(100))
    ]) : [{ data: [], error: null }, { data: [], error: null }];

    const userIds = [...new Set([
      ...ordersResult.data.map(row => row.user_id),
      ...accessResult.data.map(row => row.user_id),
      ...historyResult.data.map(row => row.user_id),
      ...ticketsResult.data.map(row => row.user_id)
    ].filter(Boolean))];

    let profiles = [];
    if (userIds.length) {
      const profileResult = await safe(sb.from('profiles').select('id,full_name,email,status').in('id', userIds));
      profiles = profileResult.data;
    }

    cache = {
      ...ctx,
      products,
      orders: ordersResult.data,
      accesses: accessResult.data,
      history: historyResult.data,
      tickets: ticketsResult.data,
      profiles,
      readErrors: {
        products: productsResult.error,
        orders: ordersResult.error,
        accesses: accessResult.error,
        history: historyResult.error,
        tickets: ticketsResult.error
      }
    };
    return cache;
  }

  function emptyState(title, copy) {
    return `<div class="academy-ops-empty"><strong>${esc(title)}</strong><span>${esc(copy)}</span></div>`;
  }

  function renderPurchases(data) {
    if (data.readErrors.orders) return emptyState('Compras no disponibles para este rol', 'La consulta está protegida por permisos administrativos.');
    if (!data.orders.length) return emptyState('Aún no hay compras registradas', 'Cuando exista una compra vinculada a Academia Yamilet aparecerá aquí automáticamente.');
    return `<div class="academy-ops-table"><div class="academy-ops-row academy-ops-head"><span>Alumna</span><span>Producto</span><span>Importe</span><span>Estado</span><span>Fecha</span></div>${data.orders.map(order => `<div class="academy-ops-row"><span data-label="Alumna"><strong>${esc(profileName(data, order.user_id, order.payer_email))}</strong><small>${esc(order.payer_email || '')}</small></span><span data-label="Producto">${esc(productName(data, order.product_id))}</span><span data-label="Importe">${esc(money(order.amount, order.currency))}</span><span data-label="Estado"><i class="academy-ops-pill ${esc(order.status || '')}">${esc(statusLabel(order.status))}</i></span><span data-label="Fecha">${esc(formatDate(order.approved_at || order.created_at))}</span></div>`).join('')}</div>`;
  }

  function renderAccesses(data) {
    if (data.readErrors.accesses) return emptyState('Accesos no disponibles para este rol', 'La consulta está protegida por permisos administrativos.');
    if (!data.products.length) return emptyState('No hay productos configurados', 'Primero debe existir un producto académico para gestionar accesos comerciales desde este panel.');
    if (!data.accesses.length) return emptyState('Aún no hay accesos por producto', 'Las inscripciones académicas ya funcionan; este bloque mostrará los accesos comerciales cuando existan productos vinculados.');
    return `<div class="academy-ops-table"><div class="academy-ops-row academy-ops-head"><span>Alumna</span><span>Producto</span><span>Origen</span><span>Estado</span><span>Vigencia</span></div>${data.accesses.map(access => `<div class="academy-ops-row"><span data-label="Alumna"><strong>${esc(profileName(data, access.user_id))}</strong></span><span data-label="Producto">${esc(productName(data, access.product_id))}</span><span data-label="Origen">${esc(access.source || 'manual')}</span><span data-label="Estado"><i class="academy-ops-pill ${esc(access.status || '')}">${esc(statusLabel(access.status))}</i></span><span data-label="Vigencia">${access.expires_at ? esc(formatDate(access.expires_at)) : 'Sin vencimiento'}</span></div>`).join('')}</div>`;
  }

  function renderHistory(data) {
    if (data.readErrors.history) return emptyState('Registros no disponibles para este rol', 'La consulta está protegida por permisos administrativos.');
    if (!data.history.length) return emptyState('Sin movimientos de acceso todavía', 'Activaciones, suspensiones, reactivaciones y revocaciones aparecerán aquí con fecha y responsable.');
    return `<div class="academy-ops-table"><div class="academy-ops-row academy-ops-head"><span>Acción</span><span>Alumna</span><span>Producto</span><span>Cambio</span><span>Fecha</span></div>${data.history.map(item => `<div class="academy-ops-row"><span data-label="Acción"><strong>${esc(statusLabel(item.action))}</strong></span><span data-label="Alumna">${esc(profileName(data, item.user_id))}</span><span data-label="Producto">${esc(productName(data, item.product_id))}</span><span data-label="Cambio">${esc(statusLabel(item.previous_status))} → ${esc(statusLabel(item.new_status))}</span><span data-label="Fecha">${esc(formatDate(item.created_at, true))}</span></div>`).join('')}</div>`;
  }

  function renderTickets(data) {
    if (data.readErrors.tickets) return emptyState('Soporte no disponible', 'No fue posible consultar los tickets con este rol.');
    if (!data.tickets.length) return emptyState('No hay tickets abiertos ni históricos', 'Las solicitudes de las alumnas aparecerán aquí y podrás responderlas desde este panel.');
    return `<div class="academy-ops-ticket-list">${data.tickets.map(ticket => `<article class="academy-ops-ticket"><div><span class="academy-ops-kicker">${esc(ticket.category || 'Soporte')}</span><h4>${esc(ticket.subject)}</h4><p>${esc(profileName(data, ticket.user_id))} · ${esc(formatDate(ticket.last_message_at || ticket.created_at, true))}</p></div><div class="academy-ops-ticket-actions"><i class="academy-ops-pill ${esc(ticket.status || '')}">${esc(statusLabel(ticket.status))}</i><button type="button" data-ops-open-ticket="${esc(ticket.id)}">Abrir</button></div></article>`).join('')}</div><div data-ops-ticket-detail></div>`;
  }

  function tabContent(data) {
    if (activeTab === 'access') return renderAccesses(data);
    if (activeTab === 'history') return renderHistory(data);
    if (activeTab === 'support') return renderTickets(data);
    return renderPurchases(data);
  }

  function renderShell(data) {
    const openTickets = data.tickets.filter(ticket => !['resolved', 'closed'].includes(ticket.status)).length;
    const approvedOrders = data.orders.filter(order => ['approved', 'paid'].includes(order.status)).length;
    const activeAccesses = data.accesses.filter(access => access.status === 'active').length;
    return `<section class="academy-ops" data-academy-ops>
      <div class="academy-ops-heading"><div><span class="academy-ops-kicker">OPERACIÓN Y CONTROL</span><h3>Compras, accesos, registros y soporte</h3><p>Información real del workspace de Academia Yamilet. Compras y accesos permanecen en modo consulta hasta cerrar el flujo comercial.</p></div><button type="button" data-ops-refresh>Actualizar</button></div>
      <div class="academy-ops-summary"><article><span>Productos</span><strong>${data.products.length}</strong></article><article><span>Compras aprobadas</span><strong>${approvedOrders}</strong></article><article><span>Accesos activos</span><strong>${activeAccesses}</strong></article><article><span>Tickets abiertos</span><strong>${openTickets}</strong></article></div>
      <div class="academy-ops-tabs" role="tablist" aria-label="Operación administrativa">
        <button type="button" class="${activeTab === 'purchases' ? 'active' : ''}" data-ops-tab="purchases">Compras <b>${data.orders.length}</b></button>
        <button type="button" class="${activeTab === 'access' ? 'active' : ''}" data-ops-tab="access">Accesos <b>${data.accesses.length}</b></button>
        <button type="button" class="${activeTab === 'history' ? 'active' : ''}" data-ops-tab="history">Registros <b>${data.history.length}</b></button>
        <button type="button" class="${activeTab === 'support' ? 'active' : ''}" data-ops-tab="support">Soporte <b>${data.tickets.length}</b></button>
      </div>
      <div class="academy-ops-content" data-ops-content>${tabContent(data)}</div>
    </section>`;
  }

  async function openTicket(page, ticketId, data) {
    const detail = $('[data-ops-ticket-detail]', page);
    if (!detail) return;
    const ticket = data.tickets.find(row => row.id === ticketId);
    if (!ticket) return;
    detail.innerHTML = '<div class="academy-ops-ticket-detail"><strong>Cargando conversación…</strong></div>';
    const { data: messages, error } = await data.sb.from('academy_support_messages')
      .select('id,user_id,author_name,author_role,body,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) {
      detail.innerHTML = '<div class="academy-ops-ticket-detail"><strong>No fue posible cargar la conversación.</strong></div>';
      return;
    }
    detail.innerHTML = `<section class="academy-ops-ticket-detail">
      <div class="academy-ops-ticket-detail-head"><div><span class="academy-ops-kicker">TICKET DE SOPORTE</span><h4>${esc(ticket.subject)}</h4><p>${esc(profileName(data, ticket.user_id))}</p></div><button type="button" data-ops-close-ticket>×</button></div>
      <div class="academy-ops-messages">${(messages || []).length ? messages.map(message => `<article class="${message.user_id === data.user.id ? 'staff' : ''}"><div><strong>${esc(message.author_name || profileName(data, message.user_id))}</strong><span>${esc(formatDate(message.created_at, true))}</span></div><p>${esc(message.body)}</p></article>`).join('') : '<p class="academy-ops-muted">Este ticket aún no tiene mensajes visibles.</p>'}</div>
      <form class="academy-ops-reply" data-ops-reply-form>
        <label>Estado<select name="status"><option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Abierto</option><option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>En proceso</option><option value="waiting_user" ${ticket.status === 'waiting_user' ? 'selected' : ''}>Esperando alumna</option><option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resuelto</option><option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Cerrado</option></select></label>
        <label>Respuesta<textarea name="body" rows="4" maxlength="3000" placeholder="Escribe una respuesta para la alumna"></textarea></label>
        <div class="academy-ops-reply-actions"><span data-ops-reply-status aria-live="polite"></span><button type="submit">Guardar y responder</button></div>
      </form>
    </section>`;
    $('[data-ops-close-ticket]', detail)?.addEventListener('click', () => { detail.innerHTML = ''; });
    $('[data-ops-reply-form]', detail)?.addEventListener('submit', event => submitReply(event, ticket, data, page));
  }

  async function submitReply(event, ticket, data, page) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.status.value;
    const body = form.body.value.trim();
    const feedback = $('[data-ops-reply-status]', form);
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    feedback.textContent = 'Guardando…';
    try {
      const now = new Date().toISOString();
      if (body) {
        const { error: messageError } = await data.sb.from('academy_support_messages').insert({
          ticket_id: ticket.id,
          user_id: data.user.id,
          author_name: data.profile.full_name || data.profile.email || data.user.email || 'Equipo Academia Yamilet',
          author_role: data.role || 'admin',
          body
        });
        if (messageError) throw messageError;
      }
      const update = {
        status,
        last_message_at: body ? now : ticket.last_message_at,
        closed_at: ['resolved', 'closed'].includes(status) ? now : null
      };
      const { error: ticketError } = await data.sb.from('academy_support_tickets').update(update).eq('id', ticket.id);
      if (ticketError) throw ticketError;
      cache = null;
      const fresh = await loadData(true);
      activeTab = 'support';
      renderInto(page, fresh);
    } catch (error) {
      console.error('Academia Yamilet admin soporte', error);
      feedback.textContent = 'No fue posible guardar el cambio.';
    } finally {
      button.disabled = false;
    }
  }

  function bind(page, data) {
    $$('[data-ops-tab]', page).forEach(button => button.addEventListener('click', () => {
      activeTab = button.dataset.opsTab || 'purchases';
      const content = $('[data-ops-content]', page);
      if (content) content.innerHTML = tabContent(data);
      $$('[data-ops-tab]', page).forEach(item => item.classList.toggle('active', item.dataset.opsTab === activeTab));
      bindContent(page, data);
    }));
    $('[data-ops-refresh]', page)?.addEventListener('click', async () => {
      const fresh = await loadData(true);
      renderInto(page, fresh);
    });
    bindContent(page, data);
  }

  function bindContent(page, data) {
    $$('[data-ops-open-ticket]', page).forEach(button => button.addEventListener('click', () => openTicket(page, button.dataset.opsOpenTicket, data)));
  }

  function renderInto(page, data) {
    const previous = $('[data-academy-ops]', page);
    const holder = document.createElement('div');
    holder.innerHTML = renderShell(data);
    const section = holder.firstElementChild;
    if (previous) previous.replaceWith(section);
    else page.appendChild(section);
    bind(page, data);
  }

  async function render(force = false) {
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return false;
    try {
      const data = await loadData(force);
      renderInto(page, data);
      return true;
    } catch (error) {
      console.warn('Academia Yamilet operaciones admin', error);
      return false;
    }
  }

  function schedule(force = false) {
    [350, 900, 1600].forEach(delay => window.setTimeout(() => render(force), delay));
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="admin"]')) schedule(false);
  });
  window.addEventListener('pageshow', () => schedule(false));
  window.ACADEMIA_YAMILET_ADMIN_OPERATIONS = { render: () => render(true) };
})();