(() => {
  'use strict';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let clientPromise;

  async function getClient(){
    if(!clientPromise){
      clientPromise=(async()=>{
        const r=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}}); if(!r.ok) throw new Error('config');
        const cfg=await r.json();
        const sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
        return {sb,cfg};
      })();
    }
    return clientPromise;
  }

  function labelStatus(v){return ({open:'Abierto',in_progress:'En proceso',waiting_user:'Esperando respuesta',resolved:'Resuelto',closed:'Cerrado'})[v]||v||'Abierto';}
  function labelCategory(v){return ({academic:'Académico',technical:'Técnico',access:'Acceso',billing:'Pagos',other:'Otro'})[v]||v||'Otro';}
  function fmt(value){if(!value)return'';try{return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return'';}}

  async function loadData(){
    const {sb,cfg}=await getClient();
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user) throw new Error('no_session');
    const user=session.user;
    const [{data:profile},{data:workspace}]=await Promise.all([
      sb.from('profiles').select('id,email,full_name').eq('id',user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug||'yamilet-mes').maybeSingle()
    ]);
    if(!workspace) throw new Error('no_workspace');
    const [{data:courses},{data:tickets}]=await Promise.all([
      sb.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
      sb.from('academy_support_tickets').select('id,course_id,subject,category,priority,status,created_at,updated_at,last_message_at').eq('workspace_id',workspace.id).eq('user_id',user.id).order('last_message_at',{ascending:false}).limit(20)
    ]);
    return {sb,user,profile:profile||{},workspace,courses:courses||[],tickets:tickets||[]};
  }

  function faqMarkup(){return `<div class="academy-support-faq">
    <article><b>↪</b><strong>No puedo entrar</strong><p>Verifica correo, contraseña y que tu inscripción siga activa. También puedes solicitar acceso sin contraseña.</p><button type="button" data-support-action="profile">Ir a Mi perfil</button></article>
    <article><b>⌁</b><strong>No reproduce un video</strong><p>Recarga la lección una vez y revisa tu conexión. Si continúa, envía un ticket técnico indicando curso y lección.</p><button type="button" data-support-prefill="technical">Reportar video</button></article>
    <article><b>✓</b><strong>Mi progreso no cambia</strong><p>Marca la lección como completada y espera la confirmación. Si no se actualiza, crea una solicitud académica.</p><button type="button" data-support-prefill="academic">Reportar progreso</button></article>
    <article><b>◇</b><strong>Certificados</strong><p>Los certificados aparecen cuando un programa cumple sus requisitos y la certificación ha sido emitida.</p><button type="button" data-support-action="certificates">Ver certificados</button></article>
    <article><b>▤</b><strong>No veo un recurso</strong><p>Los materiales publicados aparecen en Mi biblioteca y, cuando corresponde, también dentro de la lección.</p><button type="button" data-support-action="library">Abrir biblioteca</button></article>
    <article><b>?</b><strong>Otra duda</strong><p>Usa el formulario de soporte. La solicitud quedará registrada en tu cuenta para seguimiento.</p><button type="button" data-support-prefill="other">Crear solicitud</button></article>
  </div>`;}

  function formMarkup(courses){return `<form class="academy-support-form" data-support-form>
    <label>Asunto<input name="subject" maxlength="160" minlength="3" required placeholder="Describe brevemente lo que necesitas"></label>
    <div class="academy-support-form-row"><label>Categoría<select name="category"><option value="academic">Académico</option><option value="technical">Técnico</option><option value="access">Acceso</option><option value="billing">Pagos</option><option value="other">Otro</option></select></label><label>Prioridad<select name="priority"><option value="normal">Normal</option><option value="low">Baja</option><option value="high">Alta</option></select></label></div>
    <label>Curso relacionado<select name="course_id"><option value="">General / no aplica</option>${courses.filter(c=>c.status==='published').map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label>
    <label>Cuéntanos qué sucede<textarea name="message" minlength="10" maxlength="3000" required placeholder="Incluye el nombre de la lección, mensaje que aparece y qué estabas intentando hacer."></textarea></label>
    <button class="academy-support-submit" type="submit">Enviar solicitud de soporte</button><div class="academy-support-form-status" data-support-status aria-live="polite"></div>
  </form>`;}

  function ticketsMarkup(tickets,courses){
    if(!tickets.length)return `<div class="academy-support-empty"><strong>Aún no tienes solicitudes</strong><span>Cuando envíes un ticket, podrás consultar aquí su estado y última actualización.</span></div>`;
    return `<div class="academy-support-ticket-list">${tickets.map(t=>{const course=courses.find(c=>c.id===t.course_id);return `<article class="academy-support-ticket"><div class="academy-support-ticket-icon">?</div><div><h4>${esc(t.subject)}</h4><p>${esc(course?.title||'Academia Yamilet')}</p><div class="academy-support-ticket-meta"><span class="academy-support-pill ${esc(t.status)}">${esc(labelStatus(t.status))}</span><span class="academy-support-pill">${esc(labelCategory(t.category))}</span><span class="academy-support-pill">${esc(t.priority||'normal')}</span></div></div><div class="academy-support-ticket-date">${esc(fmt(t.last_message_at||t.updated_at||t.created_at))}</div></article>`}).join('')}</div>`;
  }

  async function render(){
    const page=$('[data-shell-page="help"]'); if(!page||page.classList.contains('hidden'))return false;
    page.classList.add('academy-support-page');
    page.innerHTML=`<div class="academy-support-hero"><div><span class="academy-support-kicker">CENTRO DE AYUDA</span><h2>Estamos para acompañarte</h2><p>Encuentra soluciones rápidas o envía una solicitud al equipo de Academia Yamilet. Tus tickets quedan vinculados a tu cuenta para darles seguimiento.</p></div><div class="academy-support-hero-side"><div class="academy-support-hero-stat"><strong>—</strong><span>solicitudes</span></div><div class="academy-support-hero-stat"><strong>—</strong><span>abiertas</span></div><div class="academy-support-hero-stat"><strong>6</strong><span>temas frecuentes</span></div><div class="academy-support-hero-stat"><strong>24/7</strong><span>registro disponible</span></div></div></div><div class="academy-support-empty"><strong>Cargando tu centro de soporte…</strong><span>Estamos conectando tu cuenta de Academia.</span></div>`;
    try{
      const data=await loadData();
      const open=data.tickets.filter(t=>!['resolved','closed'].includes(t.status)).length;
      page.innerHTML=`<div class="academy-support-hero"><div><span class="academy-support-kicker">CENTRO DE AYUDA</span><h2>Estamos para acompañarte</h2><p>Resuelve dudas comunes o registra una solicitud. Cada ticket queda asociado a tu cuenta y, cuando aplica, a tu curso.</p><div class="academy-support-account-actions"><button type="button" class="primary" data-support-action="profile">Mi cuenta</button><button type="button" data-support-action="courses">Mis cursos</button><button type="button" data-support-action="library">Mi biblioteca</button></div></div><div class="academy-support-hero-side"><div class="academy-support-hero-stat"><strong>${data.tickets.length}</strong><span>solicitudes</span></div><div class="academy-support-hero-stat"><strong>${open}</strong><span>abiertas</span></div><div class="academy-support-hero-stat"><strong>6</strong><span>temas frecuentes</span></div><div class="academy-support-hero-stat"><strong>24/7</strong><span>registro disponible</span></div></div></div>
      <div class="academy-support-layout"><section class="academy-support-block"><div class="academy-support-block-head"><div><span class="academy-support-kicker">RESPUESTAS RÁPIDAS</span><h3>¿Qué necesitas resolver?</h3><p>Selecciona una guía o abre una solicitud si necesitas seguimiento.</p></div></div>${faqMarkup()}</section><section class="academy-support-block"><div class="academy-support-block-head"><div><span class="academy-support-kicker">NUEVA SOLICITUD</span><h3>Contactar a soporte</h3><p>Describe el problema con el mayor detalle posible.</p></div></div>${formMarkup(data.courses)}</section><section class="academy-support-block academy-support-history"><div class="academy-support-block-head"><div><span class="academy-support-kicker">MI HISTORIAL</span><h3>Solicitudes recientes</h3><p>Consulta el estado de los tickets registrados desde tu cuenta.</p></div></div>${ticketsMarkup(data.tickets,data.courses)}</section></div>`;
      bind(page,data);
    }catch(err){console.error('Academia Yamilet soporte',err);page.innerHTML=`<div class="academy-support-hero"><div><span class="academy-support-kicker">CENTRO DE AYUDA</span><h2>Ayuda y soporte</h2><p>No pudimos cargar el historial de soporte en este momento. Puedes seguir usando tu Academia y volver a intentarlo.</p></div></div><div class="academy-support-empty"><strong>No fue posible conectar soporte</strong><span>Recarga esta sección o inténtalo nuevamente más tarde.</span></div>`;}
    return true;
  }

  function bind(page,data){
    $$('[data-support-action]',page).forEach(btn=>btn.addEventListener('click',()=>document.querySelector(`[data-shell-route="${btn.dataset.supportAction}"]`)?.click()));
    $$('[data-support-prefill]',page).forEach(btn=>btn.addEventListener('click',()=>{const f=$('[data-support-form]',page);if(!f)return;f.category.value=btn.dataset.supportPrefill||'other';f.subject.focus();f.scrollIntoView({behavior:'smooth',block:'center'});}));
    const form=$('[data-support-form]',page); if(!form)return;
    form.addEventListener('submit',async e=>{
      e.preventDefault(); const st=$('[data-support-status]',form); const submit=$('button[type="submit"]',form);
      const fd=new FormData(form); const subject=String(fd.get('subject')||'').trim(); const message=String(fd.get('message')||'').trim();
      if(subject.length<3||message.length<10){st.textContent='Completa el asunto y describe el problema con un poco más de detalle.';st.className='academy-support-form-status error';return;}
      submit.disabled=true; st.textContent='Enviando solicitud…'; st.className='academy-support-form-status';
      try{
        const payload={workspace_id:data.workspace.id,user_id:data.user.id,course_id:fd.get('course_id')||null,subject,category:fd.get('category')||'academic',priority:fd.get('priority')||'normal'};
        const {data:ticket,error}=await data.sb.from('academy_support_tickets').insert(payload).select('id').single(); if(error)throw error;
        const {error:msgError}=await data.sb.from('academy_support_messages').insert({ticket_id:ticket.id,user_id:data.user.id,author_name:data.profile.full_name||data.user.email||'Alumna',author_role:'student',body:message}); if(msgError)throw msgError;
        st.textContent='Solicitud enviada correctamente. Ya quedó registrada en tu historial.';st.className='academy-support-form-status ok';form.reset();setTimeout(render,500);
      }catch(err){console.error('Academia Yamilet ticket',err);st.textContent='No fue posible enviar la solicitud. Intenta nuevamente.';st.className='academy-support-form-status error';}finally{submit.disabled=false;}
    });
  }

  function schedule(){[100,350,800].forEach(d=>setTimeout(render,d));}
  document.addEventListener('click',e=>{if(e.target.closest('[data-shell-route="help"]'))schedule();});
  window.addEventListener('pageshow',()=>setTimeout(render,300));
  window.ACADEMIA_YAMILET_SUPPORT={render};
})();
