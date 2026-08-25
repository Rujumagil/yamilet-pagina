(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  let clientPromise;
  let busy = false;

  async function context() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept:'application/json' } });
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:false }
        });
        return { sb, cfg };
      })();
    }
    const { sb, cfg } = await clientPromise;
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('no_session');
    const [{ data: profile }, { data: workspace }] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,status').eq('id', session.user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
    ]);
    if (!workspace) throw new Error('no_workspace');
    const { data: membership } = await sb.from('workspace_members')
      .select('role,status').eq('workspace_id', workspace.id).eq('user_id', session.user.id).maybeSingle();
    const role = membership?.status === 'active' ? membership.role : profile?.role;
    if (!['owner','admin'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
    return { sb, user: session.user, profile: profile || {}, workspace, role };
  }

  async function safe(query) {
    const result = await query;
    return result.error ? { data:[], error:result.error } : { data:result.data || [], error:null };
  }

  function money(value, currency = 'MXN') {
    try { return new Intl.NumberFormat('es-MX', { style:'currency', currency:currency || 'MXN' }).format(Number(value || 0)); }
    catch { return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim(); }
  }

  function fmt(value) {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
    catch { return '—'; }
  }

  function statusLabel(value) {
    return ({ pending:'Pendiente', approved:'Aprobada', paid:'Pagada', refunded:'Reembolsada', cancelled:'Cancelada', failed:'Fallida' })[value] || value || '—';
  }

  async function loadData() {
    const ctx = await context();
    const { sb, workspace } = ctx;
    const [productsResult, ordersResult] = await Promise.all([
      safe(sb.from('products').select('id,name,slug,price,currency,status,payment_url').eq('workspace_id', workspace.id).order('created_at', { ascending:true })),
      safe(sb.from('orders').select('id,product_id,user_id,provider,external_reference,payer_email,amount,currency,status,approved_at,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending:false }).limit(30))
    ]);
    if (productsResult.error || ordersResult.error) throw productsResult.error || ordersResult.error;
    const products = productsResult.data;
    const productIds = products.map(item => item.id);
    const contents = productIds.length ? (await safe(sb.from('product_contents').select('product_id,content_type,course_id').in('product_id', productIds))).data : [];
    const courseIds = [...new Set(contents.filter(item => item.content_type === 'course').map(item => item.course_id).filter(Boolean))];
    const enrollments = courseIds.length ? (await safe(sb.from('enrollments').select('id,user_id,course_id,status,enrolled_at').in('course_id', courseIds).in('status',['active','completed']).order('enrolled_at', { ascending:false }))).data : [];
    const userIds = [...new Set([...enrollments.map(item => item.user_id), ...ordersResult.data.map(item => item.user_id)].filter(Boolean))];
    const profiles = userIds.length ? (await safe(sb.from('profiles').select('id,full_name,email,status').in('id', userIds))).data : [];
    return { ...ctx, products, orders:ordersResult.data, contents, enrollments, profiles };
  }

  function productName(data, productId) {
    return data.products.find(item => item.id === productId)?.name || 'Producto';
  }

  function profileName(data, userId, fallback = '') {
    const profile = data.profiles.find(item => item.id === userId);
    return profile?.full_name || profile?.email || fallback || 'Alumna';
  }

  function usersForProduct(data, productId) {
    const courseId = data.contents.find(item => item.product_id === productId && item.content_type === 'course')?.course_id;
    if (!courseId) return [];
    const ids = [...new Set(data.enrollments.filter(item => item.course_id === courseId).map(item => item.user_id))];
    return ids.map(id => data.profiles.find(profile => profile.id === id)).filter(Boolean);
  }

  function renderManualSale(data, product) {
    const users = usersForProduct(data, product.id);
    const ready = product.status === 'active' && Number(product.price || 0) > 0;
    if (!users.length) {
      return `<div class="academy-sales-manual"><h4>Registrar venta manual</h4><p>No hay alumnas vinculadas a este curso todavía.</p></div>`;
    }
    return `<div class="academy-sales-manual">
      <div><span class="academy-sales-kicker">VENTA MANUAL</span><h4>${esc(product.name)}</h4><p>${ready ? 'Útil para transferencias, efectivo u otros cobros externos.' : 'Define un precio mayor a 0 y activa el producto para registrar una venta pagada.'}</p></div>
      <form data-sales-form="${esc(product.id)}">
        <label>Alumna<select name="user_id">${users.map(user => `<option value="${esc(user.id)}">${esc(user.full_name || user.email || 'Alumna')}</option>`).join('')}</select></label>
        <label>Importe<input name="amount" type="number" min="0.01" step="0.01" value="${esc(product.price || 0)}"></label>
        <label>Referencia<input name="reference" type="text" placeholder="Transferencia, folio, nota..."></label>
        <button type="submit" ${ready ? '' : 'disabled'}>Registrar como pagada</button>
        <span data-sales-form-status></span>
      </form>
    </div>`;
  }

  function renderOrders(data) {
    if (!data.orders.length) return '<div class="academy-sales-empty"><strong>Aún no hay compras registradas</strong><span>Las ventas manuales o las compras de un proveedor externo aparecerán aquí.</span></div>';
    return `<div class="academy-sales-orders">
      <div class="academy-sales-order academy-sales-order-head"><span>Alumna</span><span>Producto</span><span>Importe</span><span>Origen</span><span>Estado</span><span>Fecha</span></div>
      ${data.orders.map(order => `<div class="academy-sales-order">
        <span data-label="Alumna"><strong>${esc(profileName(data, order.user_id, order.payer_email))}</strong><small>${esc(order.payer_email || '')}</small></span>
        <span data-label="Producto">${esc(productName(data, order.product_id))}</span>
        <span data-label="Importe">${esc(money(order.amount, order.currency))}</span>
        <span data-label="Origen">${esc(order.provider || 'manual')}</span>
        <span data-label="Estado">${order.provider === 'manual'
          ? `<select data-order-status="${esc(order.id)}" data-current="${esc(order.status)}"><option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pendiente</option><option value="paid" ${['paid','approved'].includes(order.status) ? 'selected' : ''}>Pagada</option><option value="refunded" ${order.status === 'refunded' ? 'selected' : ''}>Reembolsada</option><option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelada</option></select>`
          : `<i class="academy-sales-pill ${esc(order.status)}">${esc(statusLabel(order.status))}</i>`}</span>
        <span data-label="Fecha">${esc(fmt(order.approved_at || order.created_at))}</span>
      </div>`).join('')}
    </div>`;
  }

  function markup(data) {
    const paid = data.orders.filter(order => ['paid','approved'].includes(order.status)).length;
    const refunded = data.orders.filter(order => order.status === 'refunded').length;
    return `<section class="academy-sales" data-academy-sales>
      <div class="academy-sales-heading">
        <div><span class="academy-sales-kicker">AUTOMATIZACIÓN DE VENTAS</span><h3>Compra → acceso → inscripción</h3><p>Una compra pagada activa automáticamente el producto y el curso. Un reembolso revoca el acceso cuando no existe otra compra válida del mismo producto.</p></div>
        <span class="academy-sales-live"><b></b> Automatización activa</span>
      </div>
      <div class="academy-sales-flow"><span><b>1</b> Compra aprobada</span><i>→</i><span><b>2</b> Acceso activo</span><i>→</i><span><b>3</b> Inscripción activa</span><i>→</i><span><b>4</b> Curso disponible</span></div>
      <div class="academy-sales-summary"><article><span>Compras</span><strong>${data.orders.length}</strong></article><article><span>Pagadas</span><strong>${paid}</strong></article><article><span>Reembolsadas</span><strong>${refunded}</strong></article></div>
      <div class="academy-sales-manual-grid">${data.products.map(product => renderManualSale(data, product)).join('')}</div>
      <div class="academy-sales-recent"><div class="academy-sales-recent-head"><div><span class="academy-sales-kicker">HISTORIAL</span><h4>Últimas compras</h4></div><button type="button" data-sales-refresh>Actualizar</button></div>${renderOrders(data)}</div>
    </section>`;
  }

  async function registerSale(form, data) {
    const productId = form.dataset.salesForm;
    const product = data.products.find(item => item.id === productId);
    const status = $('[data-sales-form-status]', form);
    const button = $('button[type="submit"]', form);
    const values = Object.fromEntries(new FormData(form).entries());
    const amount = Number(values.amount || 0);
    if (!product || product.status !== 'active' || Number(product.price || 0) <= 0 || amount <= 0) {
      status.textContent = 'Activa el producto y define un importe válido.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Registrando…';
    const { data: orderId, error } = await data.sb.rpc('admin_record_academy_sale', {
      target_product: productId,
      target_user: values.user_id,
      target_amount: amount,
      target_reference: String(values.reference || '').trim() || null,
      target_status: 'paid'
    });
    if (error) {
      status.textContent = error.message;
      button.disabled = false;
      return;
    }
    status.textContent = `Venta registrada · ${String(orderId || '').slice(0,8)}`;
    document.querySelector('[data-ops-refresh]')?.click();
    window.setTimeout(render, 250);
  }

  async function changeOrder(select, data) {
    const previous = select.dataset.current;
    select.disabled = true;
    const { error } = await data.sb.rpc('admin_change_academy_order_status', {
      target_order: select.dataset.orderStatus,
      target_status: select.value
    });
    if (error) {
      select.value = previous === 'approved' ? 'paid' : previous;
      select.title = error.message;
      select.disabled = false;
      return;
    }
    document.querySelector('[data-ops-refresh]')?.click();
    window.setTimeout(render, 200);
  }

  function bind(host, data) {
    $$('[data-sales-form]', host).forEach(form => form.addEventListener('submit', event => {
      event.preventDefault();
      registerSale(form, data);
    }));
    $$('[data-order-status]', host).forEach(select => select.addEventListener('change', () => changeOrder(select, data)));
    $('[data-sales-refresh]', host)?.addEventListener('click', () => render());
  }

  async function render() {
    if (busy) return;
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return;
    busy = true;
    let host = $('[data-sales-host]', page);
    if (!host) {
      host = document.createElement('div');
      host.dataset.salesHost = 'true';
      page.appendChild(host);
    }
    host.innerHTML = '<section class="academy-sales academy-sales-loading"><strong>Cargando automatización de ventas…</strong></section>';
    try {
      const data = await loadData();
      host.innerHTML = markup(data);
      bind(host, data);
    } catch (error) {
      console.error('Academia Yamilet sales admin', error);
      host.innerHTML = '<section class="academy-sales academy-sales-loading"><strong>No fue posible cargar la automatización de ventas.</strong><span>Actualiza la Academia e inténtalo de nuevo.</span></section>';
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="admin"]')) {
      window.setTimeout(render, 120);
      window.setTimeout(render, 700);
    }
  });
  window.setTimeout(render, 900);
})();
