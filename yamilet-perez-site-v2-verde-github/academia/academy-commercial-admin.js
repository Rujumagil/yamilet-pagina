(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  let clientPromise;
  let renderBusy = false;

  async function context() {
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
    const [{ data: profile }, { data: workspace }] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,status').eq('id', session.user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
    ]);
    if (!workspace) throw new Error('no_workspace');
    const { data: membership } = await sb.from('workspace_members')
      .select('role,status').eq('workspace_id', workspace.id).eq('user_id', session.user.id).maybeSingle();
    const role = membership?.status === 'active' ? membership.role : profile?.role;
    if (!['owner','admin','instructor'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
    return { sb, cfg, user: session.user, profile: profile || {}, workspace, role };
  }

  async function safe(query) {
    const result = await query;
    return result.error ? { data: [], error: result.error } : { data: result.data || [], error: null };
  }

  function money(value, currency = 'MXN') {
    try { return new Intl.NumberFormat('es-MX', { style:'currency', currency: currency || 'MXN' }).format(Number(value || 0)); }
    catch { return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim(); }
  }

  async function loadData() {
    const ctx = await context();
    const { sb, workspace } = ctx;
    const productsResult = await safe(sb.from('products')
      .select('id,name,slug,product_type,description,price,currency,status,external_reference,payment_url,updated_at')
      .eq('workspace_id', workspace.id).order('created_at', { ascending: true }));
    if (productsResult.error) throw productsResult.error;
    const products = productsResult.data;
    const productIds = products.map(item => item.id);

    const contentsResult = productIds.length
      ? await safe(sb.from('product_contents').select('id,product_id,content_type,course_id').in('product_id', productIds))
      : { data: [], error: null };
    const courseIds = [...new Set(contentsResult.data.map(item => item.course_id).filter(Boolean))];
    const coursesResult = courseIds.length
      ? await safe(sb.from('courses').select('id,title,status').in('id', courseIds))
      : { data: [], error: null };
    const enrollmentsResult = courseIds.length
      ? await safe(sb.from('enrollments').select('id,user_id,course_id,status,enrolled_at').in('course_id', courseIds).order('enrolled_at', { ascending:false }))
      : { data: [], error: null };
    const userIds = [...new Set(enrollmentsResult.data.map(item => item.user_id).filter(Boolean))];
    const profilesResult = userIds.length
      ? await safe(sb.from('profiles').select('id,full_name,email,status').in('id', userIds))
      : { data: [], error: null };
    const accessesResult = productIds.length
      ? await safe(sb.from('student_access').select('id,user_id,product_id,status,source,reference,granted_at,expires_at,updated_at').in('product_id', productIds).order('updated_at', { ascending:false }))
      : { data: [], error: null };

    return {
      ...ctx,
      products,
      contents: contentsResult.data,
      courses: coursesResult.data,
      enrollments: enrollmentsResult.data,
      profiles: profilesResult.data,
      accesses: accessesResult.data
    };
  }

  function profileName(data, userId) {
    const row = data.profiles.find(item => item.id === userId);
    return row?.full_name || row?.email || 'Alumna';
  }

  function profileEmail(data, userId) {
    return data.profiles.find(item => item.id === userId)?.email || '';
  }

  function courseForProduct(data, productId) {
    const link = data.contents.find(item => item.product_id === productId && item.content_type === 'course');
    return data.courses.find(item => item.id === link?.course_id) || null;
  }

  function accessFor(data, userId, productId) {
    return data.accesses.find(item => item.user_id === userId && item.product_id === productId) || null;
  }

  function renderProductCard(data, product) {
    const course = courseForProduct(data, product.id);
    const linkedEnrollments = course ? data.enrollments.filter(item => item.course_id === course.id && ['active','completed'].includes(item.status)) : [];
    const activeAccesses = data.accesses.filter(item => item.product_id === product.id && item.status === 'active');
    return `<article class="academy-commerce-card" data-commerce-product="${esc(product.id)}">
      <div class="academy-commerce-card-head">
        <div><span class="academy-commerce-kicker">PRODUCTO ACADÉMICO</span><h4>${esc(product.name)}</h4><p>${course ? `Vinculado a ${esc(course.title)}` : 'Sin curso vinculado'}</p></div>
        <span class="academy-commerce-state ${esc(product.status || 'draft')}">${product.status === 'active' ? 'Activo' : 'Configuración'}</span>
      </div>
      <div class="academy-commerce-metrics">
        <span><b>${esc(money(product.price, product.currency))}</b><small>Precio</small></span>
        <span><b>${linkedEnrollments.length}</b><small>Inscripciones</small></span>
        <span><b>${activeAccesses.length}</b><small>Accesos comerciales</small></span>
      </div>
      <form class="academy-commerce-form" data-commerce-product-form="${esc(product.id)}">
        <label>Precio<input type="number" name="price" min="0" step="0.01" value="${esc(product.price ?? 0)}"></label>
        <label>Moneda<select name="currency"><option value="MXN" ${product.currency === 'MXN' ? 'selected' : ''}>MXN</option><option value="USD" ${product.currency === 'USD' ? 'selected' : ''}>USD</option><option value="EUR" ${product.currency === 'EUR' ? 'selected' : ''}>EUR</option></select></label>
        <label>Estado<select name="status"><option value="draft" ${product.status !== 'active' ? 'selected' : ''}>En configuración</option><option value="active" ${product.status === 'active' ? 'selected' : ''}>Activo</option></select></label>
        <label class="wide">Enlace de pago<input type="url" name="payment_url" placeholder="https://..." value="${esc(product.payment_url || '')}"></label>
        <label class="wide">Descripción<textarea name="description" rows="3">${esc(product.description || '')}</textarea></label>
        <div class="academy-commerce-form-actions wide"><span data-commerce-save-status></span><button type="submit">Guardar configuración</button></div>
      </form>
      ${renderAccessManager(data, product, linkedEnrollments)}
    </article>`;
  }

  function renderAccessManager(data, product, enrollments) {
    if (!enrollments.length) return `<div class="academy-commerce-access"><div><span class="academy-commerce-kicker">ACCESOS</span><h5>Sin alumnas disponibles</h5><p>Cuando haya una inscripción al curso, podrás vincularla al producto desde aquí.</p></div></div>`;
    return `<div class="academy-commerce-access">
      <div><span class="academy-commerce-kicker">ACCESOS</span><h5>Vincular inscripción con producto</h5><p>Otorga o cambia el acceso comercial. El curso se sincroniza automáticamente.</p></div>
      <div class="academy-commerce-access-list">${enrollments.map(enrollment => {
        const access = accessFor(data, enrollment.user_id, product.id);
        return `<div class="academy-commerce-access-row">
          <span><strong>${esc(profileName(data, enrollment.user_id))}</strong><small>${esc(profileEmail(data, enrollment.user_id))}</small></span>
          <span class="academy-commerce-access-state ${esc(access?.status || 'none')}">${access ? esc(access.status) : 'Sin acceso comercial'}</span>
          ${access
            ? `<select data-commerce-access-status="${esc(access.id)}"><option value="active" ${access.status === 'active' ? 'selected' : ''}>Activo</option><option value="suspended" ${access.status === 'suspended' ? 'selected' : ''}>Suspendido</option><option value="revoked" ${access.status === 'revoked' ? 'selected' : ''}>Revocado</option><option value="expired" ${access.status === 'expired' ? 'selected' : ''}>Vencido</option></select>`
            : `<button type="button" data-commerce-grant="${esc(enrollment.user_id)}" data-product-id="${esc(product.id)}">Otorgar acceso</button>`}
        </div>`;
      }).join('')}</div>
    </div>`;
  }

  function renderMarkup(data) {
    if (!data.products.length) return `<section class="academy-commerce"><div class="academy-commerce-heading"><span class="academy-commerce-kicker">CONFIGURACIÓN COMERCIAL</span><h3>Productos de la Academia</h3><p>No hay productos configurados todavía.</p></div></section>`;
    return `<section class="academy-commerce" data-academy-commerce>
      <div class="academy-commerce-heading"><div><span class="academy-commerce-kicker">CONFIGURACIÓN COMERCIAL</span><h3>Producto, precio y acceso</h3><p>Administra la configuración comercial sin entrar a Supabase. Activar un producto no crea un cobro por sí solo: el enlace de pago debe configurarse aparte.</p></div><button type="button" data-commerce-refresh>Actualizar</button></div>
      <div class="academy-commerce-grid">${data.products.map(product => renderProductCard(data, product)).join('')}</div>
    </section>`;
  }

  async function saveProduct(form, data, productId) {
    const status = $('[data-commerce-save-status]', form);
    const button = $('button[type="submit"]', form);
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.price = Number(payload.price || 0);
    payload.payment_url = String(payload.payment_url || '').trim() || null;
    payload.description = String(payload.description || '').trim() || null;
    if (payload.status === 'active' && payload.price <= 0) {
      status.textContent = 'Define un precio mayor a 0 antes de activar el producto.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Guardando…';
    const { error } = await data.sb.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', productId);
    if (error) {
      status.textContent = `No se pudo guardar: ${error.message}`;
      button.disabled = false;
      return;
    }
    status.textContent = 'Configuración guardada.';
    document.querySelector('[data-ops-refresh]')?.click();
    window.setTimeout(render, 300);
  }

  async function grantAccess(button, data) {
    button.disabled = true;
    button.textContent = 'Otorgando…';
    const { error } = await data.sb.rpc('admin_grant_product_access', {
      target_user: button.dataset.commerceGrant,
      target_product: button.dataset.productId,
      access_source: 'manual',
      access_reference: 'academy-admin-panel',
      access_expires_at: null
    });
    if (error) {
      button.textContent = 'Error';
      button.title = error.message;
      button.disabled = false;
      return;
    }
    document.querySelector('[data-ops-refresh]')?.click();
    await render();
  }

  async function changeAccess(select, data) {
    const previous = select.dataset.previous || select.value;
    select.disabled = true;
    const { error } = await data.sb.rpc('admin_change_student_access_status', {
      target_access: select.dataset.commerceAccessStatus,
      new_status: select.value
    });
    if (error) {
      select.value = previous;
      select.title = error.message;
      select.disabled = false;
      return;
    }
    document.querySelector('[data-ops-refresh]')?.click();
    await render();
  }

  function bind(host, data) {
    $$('[data-commerce-product-form]', host).forEach(form => form.addEventListener('submit', event => {
      event.preventDefault();
      saveProduct(form, data, form.dataset.commerceProductForm);
    }));
    $$('[data-commerce-grant]', host).forEach(button => button.addEventListener('click', () => grantAccess(button, data)));
    $$('[data-commerce-access-status]', host).forEach(select => {
      select.dataset.previous = select.value;
      select.addEventListener('change', () => changeAccess(select, data));
    });
    $('[data-commerce-refresh]', host)?.addEventListener('click', () => render());
  }

  async function render() {
    if (renderBusy) return;
    const page = $('[data-shell-page="admin"]');
    if (!page || page.classList.contains('hidden')) return;
    renderBusy = true;
    let host = $('[data-commerce-host]', page);
    if (!host) {
      host = document.createElement('div');
      host.dataset.commerceHost = 'true';
      page.appendChild(host);
    }
    host.innerHTML = '<section class="academy-commerce academy-commerce-loading"><strong>Cargando configuración comercial…</strong></section>';
    try {
      const data = await loadData();
      host.innerHTML = renderMarkup(data);
      bind(host, data);
    } catch (error) {
      console.error('Academia Yamilet commercial admin', error);
      host.innerHTML = '<section class="academy-commerce academy-commerce-loading"><strong>No fue posible cargar la configuración comercial.</strong><span>Actualiza la Academia e inténtalo nuevamente.</span></section>';
    } finally {
      renderBusy = false;
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="admin"]')) window.setTimeout(render, 80);
  });
  window.setTimeout(render, 500);
})();
