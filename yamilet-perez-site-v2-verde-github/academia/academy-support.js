(() => {
  'use strict';

  const VERSION = '78.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let clientPromise = null;
  let renderTimer = null;

  function currentRoute() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function host() {
    const main = $('.dashboard-main');
    if (!main) return null;
    let node = $('[data-aula-pages-v71]', main);
    if (!node) {
      node = document.createElement('section');
      node.className = 'aula-v71-page-host';
      node.dataset.aulaPagesV71 = 'true';
      main.appendChild(node);
    }
    return node;
  }

  function setIndependentMode(active) {
    const main = $('.dashboard-main');
    const page = host();
    if (!main || !page) return;
    if (active) {
      main.dataset.v78Route = 'help';
      page.hidden = false;
      Array.from(main.children).forEach(child => {
        const keep = child === page || child.classList.contains('academy-topbar');
        if (!keep) child.dataset.v78Suppressed = 'true';
      });
    } else if (main.dataset.v78Route === 'help') {
      delete main.dataset.v78Route;
      Array.from(main.children).forEach(child => delete child.dataset.v78Suppressed);
    }
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, {headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error('support_config');
        const config = await response.json();
        const sb = window.supabase.createClient(config.url, config.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
        return {sb,config};
      })().catch(error => { clientPromise = null; throw error; });
    }
    return clientPromise;
  }

  function labelStatus(value) {
    return ({open:'Abierto',in_progress:'En proceso',waiting_user:'Esperando respuesta',resolved:'Resuelto',closed:'Cerrado'})[value] || value || 'Abierto';
  }

  function labelCategory(value) {
    return ({academic:'Académico',technical:'Técnico',access:'Acceso',billing:'Pagos',other:'General'})[value] || value || 'General';
  }

  function labelPriority(value) {
    return ({low:'Baja',normal:'Normal',high:'Alta',urgent:'Urgente'})[value] || value || 'Normal';
  }

  function fmt(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
    } catch { return ''; }
  }

  async function loadData() {
    const {sb,config} = await getClient();
    const {data:{session}} = await sb.auth.getSession();
    if (!session?.user) throw new Error('support_session');
    const user = session.user;
    const [{data:profile},{data:workspace}] = await Promise.all([
      sb.from('profiles').select('id,email,full_name').eq('id',user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug',config.workspaceSlug||'yamilet-mes').maybeSingle()
    ]);
    if (!workspace) throw new Error('support_workspace');
    const [{data:courses},{data:tickets}] = await Promise.all([
      sb.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
      sb.from('academy_support_tickets').select('id,course_id,subject,category,priority,status,created_at,updated_at,last_message_at').eq('workspace_id',workspace.id).eq('user_id',user.id).order('last_message_at',{ascending:false}).limit(20)
    ]);
    return {sb,user,profile:profile||{},workspace,courses:courses||[],tickets:tickets||[]};
  }

  function faqMarkup() {
    return `<div class="v78-support-faq">
      <article><span>↪</span><div><strong>No puedo entrar</strong><p>Verifica tu correo y contraseña. También puedes usar el acceso sin contraseña desde la pantalla de inicio.</p><a href="#profile">Revisar mi cuenta</a></div></article>
      <article><span>▶</span><div><strong>No reproduce un video</strong><p>Recarga la lección y revisa tu conexión. Si continúa, envía una solicitud técnica indicando curso y lección.</p><button type="button" data-v78-support-prefill="technical">Reportar video</button></div></article>
      <article><span>✓</span><div><strong>Mi progreso no cambia</strong><p>Marca la lección como completada y espera la confirmación. Si no se actualiza, registra una solicitud académica.</p><button type="button" data-v78-support-prefill="academic">Reportar progreso</button></div></article>
      <article><span>◇</span><div><strong>Certificados</strong><p>Los certificados aparecen cuando cumples los requisitos configurados para el programa.</p><a href="#certificates">Ver certificados</a></div></article>
      <article><span>▤</span><div><strong>No veo un recurso</strong><p>Los materiales publicados aparecen en Mi biblioteca y, cuando corresponde, también dentro de la lección.</p><a href="#resources">Abrir biblioteca</a></div></article>
      <article><span>?</span><div><strong>Otra consulta</strong><p>Registra una solicitud y podrás consultar su estado en tu historial de soporte.</p><button type="button" data-v78-support-prefill="other">Crear solicitud</button></div></article>
    </div>`;
  }

  function formMarkup(courses) {
    return `<form class="v78-support-form" data-v78-support-form>
      <label>Asunto<input name="subject" maxlength="160" minlength="3" required placeholder="Describe brevemente lo que necesitas"></label>
      <div class="v78-support-form-row">
        <label>Categoría<select name="category"><option value="academic">Académico</option><option value="technical">Técnico</option><option value="access">Acceso</option><option value="billing">Pagos</option><option value="other">General</option></select></label>
        <label>Prioridad<select name="priority"><option value="normal">Normal</option><option value="low">Baja</option><option value="high">Alta</option></select></label>
      </div>
      <label>Curso relacionado<select name="course_id"><option value="">General / no aplica</option>${courses.filter(course => course.status === 'published').map(course => `<option value="${esc(course.id)}">${esc(course.title)}</option>`).join('')}</select></label>
      <label>¿Qué sucede?<textarea name="message" minlength="10" maxlength="3000" required placeholder="Incluye el nombre de la lección, el mensaje que aparece y qué estabas intentando hacer."></textarea></label>
      <button type="submit">Enviar solicitud</button>
      <div class="v78-support-form-status" data-v78-support-status aria-live="polite"></div>
    </form>`;
  }

  function ticketsMarkup(tickets, courses) {
    if (!tickets.length) return `<div class="v78-support-empty-history"><span>✓</span><div><strong>Aún no tienes solicitudes</strong><p>Cuando envíes una solicitud, aquí podrás consultar su estado y última actualización.</p></div></div>`;
    return `<div class="v78-support-ticket-list">${tickets.map(ticket => {
      const course = courses.find(item => item.id === ticket.course_id);
      return `<article class="v78-support-ticket"><span class="v78-support-ticket-icon">?</span><div><h4>${esc(ticket.subject)}</h4><p>${esc(course?.title || 'Academia Yamilet')}</p><div class="v78-support-ticket-meta"><span class="${esc(ticket.status)}">${esc(labelStatus(ticket.status))}</span><span>${esc(labelCategory(ticket.category))}</span><span>${esc(labelPriority(ticket.priority))}</span></div></div><time>${esc(fmt(ticket.last_message_at||ticket.updated_at||ticket.created_at))}</time></article>`;
    }).join('')}</div>`;
  }

  function renderSupport(data) {
    const page = host();
    if (!page) return;
    setIndependentMode(true);
    const open = data.tickets.filter(ticket => !['resolved','closed'].includes(ticket.status)).length;
    page.innerHTML = `<div class="v78-support-page">
      <section class="v78-support-heading"><div><span>Centro de ayuda</span><h1>Ayuda y soporte</h1><p>Resuelve dudas comunes o registra una solicitud. Cada caso queda asociado a tu cuenta para poder darle seguimiento.</p></div><a href="#profile">Mi perfil</a></section>
      <section class="v78-support-summary">
        <article><strong>${data.tickets.length}</strong><span>Solicitudes</span></article>
        <article><strong>${open}</strong><span>Abiertas</span></article>
        <article><strong>6</strong><span>Temas frecuentes</span></article>
        <article><strong>24/7</strong><span>Registro disponible</span></article>
      </section>
      <section class="v78-support-hero">
        <div><span>Soporte de Academia Yamilet</span><h2>¿Qué necesitas resolver?</h2><p>Empieza por una respuesta rápida. Si necesitas seguimiento, registra una solicitud con los datos de tu curso o lección.</p><div class="v78-support-quick-links"><a href="#courses">Mis cursos</a><a href="#resources">Mi biblioteca</a><a href="#certificates">Certificados</a></div></div>
        <div class="v78-support-hero-mark"><strong>?</strong><span>Estamos para ayudarte</span></div>
      </section>
      <section class="v78-support-grid">
        <article class="v78-support-block"><div class="v78-support-block-head"><span>Respuestas rápidas</span><h2>Soluciones frecuentes</h2><p>Selecciona una opción para ir directamente al área correcta o preparar una solicitud.</p></div>${faqMarkup()}</article>
        <article class="v78-support-block"><div class="v78-support-block-head"><span>Nueva solicitud</span><h2>Contactar a soporte</h2><p>Describe el problema con el mayor detalle posible.</p></div>${formMarkup(data.courses)}</article>
      </section>
      <section class="v78-support-history"><div class="v78-support-block-head"><div><span>Seguimiento</span><h2>Solicitudes recientes</h2><p>Consulta el estado de los casos registrados desde tu cuenta.</p></div><small>${data.tickets.length} ${data.tickets.length === 1 ? 'solicitud' : 'solicitudes'}</small></div>${ticketsMarkup(data.tickets,data.courses)}</section>
    </div>`;
    bind(page, data);
  }

  function bind(page, data) {
    $$('[data-v78-support-prefill]', page).forEach(button => button.addEventListener('click', () => {
      const form = $('[data-v78-support-form]', page);
      if (!form) return;
      form.category.value = button.dataset.v78SupportPrefill || 'other';
      form.subject.focus();
      form.scrollIntoView({behavior:'smooth',block:'center'});
    }));
    const form = $('[data-v78-support-form]', page);
    if (!form) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = $('[data-v78-support-status]', form);
      const submit = $('button[type="submit"]', form);
      const fd = new FormData(form);
      const subject = String(fd.get('subject') || '').trim();
      const message = String(fd.get('message') || '').trim();
      if (subject.length < 3 || message.length < 10) {
        status.textContent = 'Completa el asunto y describe el problema con un poco más de detalle.';
        status.dataset.type = 'error';
        return;
      }
      submit.disabled = true;
      status.textContent = 'Enviando solicitud…';
      status.dataset.type = '';
      try {
        const payload = {workspace_id:data.workspace.id,user_id:data.user.id,course_id:fd.get('course_id')||null,subject,category:fd.get('category')||'academic',priority:fd.get('priority')||'normal'};
        const {data:ticket,error} = await data.sb.from('academy_support_tickets').insert(payload).select('id').single();
        if (error) throw error;
        const {error:messageError} = await data.sb.from('academy_support_messages').insert({ticket_id:ticket.id,user_id:data.user.id,author_name:data.profile.full_name||data.user.email||'Estudiante',author_role:'student',body:message});
        if (messageError) throw messageError;
        status.textContent = 'Solicitud enviada correctamente. Ya quedó registrada en tu historial.';
        status.dataset.type = 'ok';
        form.reset();
        setTimeout(() => render(true), 500);
      } catch (error) {
        console.error('Academia Yamilet support ticket', error);
        status.textContent = 'No fue posible enviar la solicitud. Intenta nuevamente.';
        status.dataset.type = 'error';
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function render(force = false) {
    if (currentRoute() !== 'help') {
      setIndependentMode(false);
      return false;
    }
    const page = host();
    if (!page) return false;
    setIndependentMode(true);
    page.innerHTML = '<section class="v78-support-loading"><span></span><p>Preparando el centro de ayuda…</p></section>';
    try {
      const data = await loadData();
      if (currentRoute() !== 'help') return false;
      renderSupport(data);
      window.scrollTo({top:0,behavior:'auto'});
      return true;
    } catch (error) {
      console.error('Academia Yamilet support v78', error);
      page.innerHTML = '<section class="v78-support-error"><strong>No fue posible conectar el centro de ayuda</strong><span>El resto de la Academia sigue disponible. Intenta nuevamente más tarde.</span><a href="#home">Volver al inicio</a></section>';
      return false;
    }
  }

  function schedule(delay = 100) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => render(), delay);
  }

  function start() {
    const observer = new MutationObserver(() => {
      if (currentRoute() === 'help') schedule(90);
    });
    observer.observe(document.body, {childList:true,subtree:true});
    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="help"],[data-quick-help],a[href="#help"]')) schedule(100);
    }, true);
    window.addEventListener('hashchange', () => schedule(90));
    window.addEventListener('popstate', () => schedule(90));
    window.addEventListener('pageshow', () => schedule(180));
    schedule(260);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();

  window.ACADEMIA_YAMILET_SUPPORT = {render:() => render(true),version:VERSION};
})();
