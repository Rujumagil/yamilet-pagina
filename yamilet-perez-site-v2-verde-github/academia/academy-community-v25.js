(() => {
  'use strict';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const state={sb:null,user:null,profile:null,workspace:null,membership:null,courses:[],ready:false,selectedThread:null,selectedTicket:null,activity:[]};
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const fmt=v=>v?new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'Sin fecha';
  const isStaff=()=>state.profile?.role==='admin'||['owner','admin','instructor'].includes(state.membership?.role);
  const profileName=()=>state.profile?.full_name||state.profile?.email||state.user?.email||'Usuario de Academia Yamilet';
  const courseName=id=>state.courses.find(c=>c.id===id)?.title||'Academia Yamilet';
  const statusLabel=s=>({open:'Abierto',resolved:'Resuelto',hidden:'Oculto',in_progress:'En atención',waiting_user:'Esperando respuesta',closed:'Cerrado'})[s]||s;
  const categoryLabel=s=>({academic:'Académico',technical:'Técnico',access:'Acceso',billing:'Pago / facturación',other:'Otro'})[s]||s;
  const roleLabel=s=>({owner:'Owner',admin:'Administración',instructor:'Instructor',student:'Alumna'})[s]||s||'Alumna';
  const activityIcon=t=>({lesson_completed:'✓',assessment_passed:'✓',assessment_attempt:'?',certificate_ready:'★',course_assigned:'▣',community_thread:'◌',community_reply:'↩',support_ticket:'?',support_reply:'↔'})[t]||'•';
  const setStatus=(el,msg='',kind='')=>{if(!el)return;el.textContent=msg;el.className='v25-status'+(kind?` ${kind}`:'')};

  async function init(){
    try{
      const r=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});if(!r.ok)return;
      const cfg=await r.json();
      state.sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      state.sb.auth.onAuthStateChange((_e,s)=>{if(s?.user)bootstrap(s.user,cfg.workspaceSlug||'yamilet-mes')});
      const {data:{session}}=await state.sb.auth.getSession();if(session?.user)await bootstrap(session.user,cfg.workspaceSlug||'yamilet-mes');
    }catch(e){console.error('Yamilet v25 init',e)}
  }

  async function bootstrap(user,slug){
    if(state.ready&&state.user?.id===user.id)return;
    state.user=user;
    const [{data:profile},{data:workspace}]=await Promise.all([
      state.sb.from('profiles').select('id,email,full_name,role,status').eq('id',user.id).maybeSingle(),
      state.sb.from('workspaces').select('id,name,slug').eq('slug',slug).maybeSingle()
    ]);
    state.profile=profile;state.workspace=workspace;if(!workspace)return;
    const [{data:member},{data:courses}]=await Promise.all([
      state.sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',user.id).maybeSingle(),
      state.sb.from('courses').select('id,title,status,cover_url,subtitle').eq('workspace_id',workspace.id).order('created_at',{ascending:true})
    ]);
    state.membership=member?.status==='active'?member:null;state.courses=courses||[];state.ready=true;
    await loadActivity();
    mountShellExtensions();
    mountHelpObserver();
    mountNotificationBridge();
    mountHomeActivity();
  }

  function mountShellExtensions(){
    const wait=()=>{
      const nav=$('.sidebar nav'),main=$('.dashboard-main');if(!nav||!main||!$('[data-shell-route="help"]'))return setTimeout(wait,140);
      if(!nav.querySelector('[data-v25-route="community"]')){
        const help=$('[data-shell-route="help"]',nav);
        const community=document.createElement('button');community.className='shell-nav-item v25-nav-item';community.type='button';community.dataset.v25Route='community';community.innerHTML='<span class="shell-nav-icon"><svg viewBox="0 0 24 24"><path d="M5 17.5 3 21l4.2-1.4A9 9 0 1 0 5 17.5Z"/><path d="M8 10h8M8 14h5"/></svg></span><span>Comunidad</span>';
        const activity=document.createElement('button');activity.className='shell-nav-item v25-nav-item';activity.type='button';activity.dataset.v25Route='activity';activity.innerHTML='<span class="shell-nav-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M4 19l3-3"/></svg></span><span>Mi actividad</span>';
        nav.insertBefore(community,help);nav.insertBefore(activity,help);
        community.addEventListener('click',()=>showCustom('community'));
        activity.addEventListener('click',()=>showCustom('activity'));
      }
      if(!$('[data-v25-page="community"]',main)){
        main.insertAdjacentHTML('beforeend','<section class="shell-page v25-page hidden" data-v25-page="community"></section><section class="shell-page v25-page hidden" data-v25-page="activity"></section>');
      }
      $$('[data-shell-route]').forEach(b=>{if(b.dataset.v25Bound)return;b.dataset.v25Bound='1';b.addEventListener('click',hideCustom,{capture:true})});
      const observer=new MutationObserver(()=>{if($$('[data-shell-page]').some(p=>!p.classList.contains('hidden')))hideCustom(false)});observer.observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
    };wait();
  }

  function hideCustom(clear=true){
    $$('[data-v25-page]').forEach(p=>p.classList.add('hidden'));$$('[data-v25-route]').forEach(b=>b.classList.remove('active'));
    if(clear){state.selectedThread=null;}
  }

  async function showCustom(name,targetId=null){
    const main=$('.dashboard-main');if(!main)return;
    $$('[data-shell-page]').forEach(p=>p.classList.add('hidden'));$('[data-course-view]')?.classList.add('hidden');$('[data-lesson-view]')?.classList.add('hidden');$('[data-content-admin]')?.classList.add('hidden');$('[data-students-admin]')?.classList.add('hidden');
    main.classList.add('shell-route-mode');main.classList.remove('shell-courses-mode');
    $$('[data-v25-page]').forEach(p=>p.classList.add('hidden'));$$('[data-shell-route]').forEach(b=>b.classList.remove('active'));$$('[data-v25-route]').forEach(b=>b.classList.toggle('active',b.dataset.v25Route===name));
    const page=$(`[data-v25-page="${name}"]`);if(!page)return;page.classList.remove('hidden');const bc=$('[data-shell-breadcrumb]');if(bc)bc.textContent=name==='community'?'Comunidad':'Mi actividad';
    if(name==='community'){if(targetId)state.selectedThread=targetId;await renderCommunity(page)}else{await renderActivity(page)}
    page.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function renderCommunity(page){
    const {data:threads,error}=await state.sb.from('academy_community_threads').select('id,course_id,lesson_id,user_id,author_name,author_role,title,body,status,created_at,updated_at').order('updated_at',{ascending:false}).limit(80);
    if(error){page.innerHTML=`<div class="v25-empty"><strong>No fue posible abrir Comunidad</strong><span>${esc(error.message)}</span></div>`;return}
    const rows=threads||[];let replies=[];
    if(rows.length){const {data}=await state.sb.from('academy_community_replies').select('id,thread_id,user_id,author_name,author_role,body,created_at').in('thread_id',rows.map(t=>t.id)).order('created_at',{ascending:true});replies=data||[]}
    if(!state.selectedThread||!rows.some(t=>t.id===state.selectedThread))state.selectedThread=rows[0]?.id||null;
    const selected=rows.find(t=>t.id===state.selectedThread)||null;const selectedReplies=replies.filter(r=>r.thread_id===selected?.id);
    page.innerHTML=`<div class="v25-heading"><div><div class="kicker">Acompañamiento compartido</div><h2>Comunidad</h2><p>Un espacio interno para conversar sobre el proceso, compartir aprendizajes y recibir orientación dentro de Academia Yamilet.</p></div><div class="v25-summary"><article><strong>${rows.length}</strong><span>Conversaciones</span></article><article><strong>${rows.filter(t=>t.status==='open').length}</strong><span>Abiertas</span></article><article><strong>${replies.length}</strong><span>Respuestas</span></article></div></div><div class="v25-layout"><div><article class="v25-card"><h3>Nueva conversación</h3><p class="v25-muted">Comparte una pregunta, reflexión o avance relacionado con uno de tus cursos.</p><form class="v25-form" data-v25-thread-form><label>Curso<select name="course_id" required>${state.courses.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></label><label>Título<input name="title" minlength="3" maxlength="160" required placeholder="¿Sobre qué quieres conversar?"></label><label>Mensaje<textarea name="body" minlength="2" maxlength="5000" required placeholder="Escribe tu reflexión o pregunta…"></textarea></label><button class="v25-btn primary" type="submit" ${state.courses.length?'':'disabled'}>Publicar en Comunidad</button><div class="v25-status" data-v25-thread-status></div></form></article><article class="v25-card" style="margin-top:18px"><h3>Conversaciones</h3><div class="v25-thread-list" style="margin-top:13px">${rows.length?rows.map(t=>threadListItem(t,replies)).join(''):'<div class="v25-empty"><strong>Comunidad lista</strong><span>Aún no hay conversaciones.</span></div>'}</div></article></div><article class="v25-card" data-v25-thread-detail>${selected?threadDetail(selected,selectedReplies):'<div class="v25-detail-empty"><div><strong>Selecciona una conversación</strong><div>Cuando haya publicaciones podrás abrirlas aquí.</div></div></div>'}</article></div>`;
    $('[data-v25-thread-form]',page)?.addEventListener('submit',e=>createThread(e,page));
    $$('[data-v25-thread]',page).forEach(el=>el.addEventListener('click',()=>{state.selectedThread=el.dataset.v25Thread;renderCommunity(page)}));
    $('[data-v25-reply-form]',page)?.addEventListener('submit',e=>createReply(e,page));
    $$('[data-v25-thread-status-action]',page).forEach(b=>b.addEventListener('click',()=>setThreadStatus(b.dataset.threadId,b.dataset.threadStatus,page)));
  }

  function threadListItem(t,replies){const count=replies.filter(r=>r.thread_id===t.id).length;return `<div class="v25-thread ${state.selectedThread===t.id?'active':''}" data-v25-thread="${t.id}"><div class="v25-thread-top"><span class="v25-pill ${esc(t.status)}">${esc(statusLabel(t.status))}</span><span class="v25-muted">${count} resp.</span></div><h4>${esc(t.title)}</h4><p>${esc(t.author_name||'Comunidad')} · ${esc(courseName(t.course_id))}</p><div class="v25-meta"><span>${esc(fmt(t.updated_at||t.created_at))}</span><span>·</span><span>${esc(roleLabel(t.author_role))}</span></div></div>`}

  function threadDetail(t,replies){const canManage=isStaff()||t.user_id===state.user.id;const staff=isStaff();return `<div class="v25-detail-head"><div class="v25-thread-top"><span class="v25-pill ${esc(t.status)}">${esc(statusLabel(t.status))}</span><span class="v25-muted">${esc(courseName(t.course_id))}</span></div><h3>${esc(t.title)}</h3><div class="v25-meta"><span>${esc(t.author_name||'Comunidad')}</span><span>·</span><span>${esc(roleLabel(t.author_role))}</span><span>·</span><span>${esc(fmt(t.created_at))}</span></div>${canManage?`<div class="v25-detail-actions">${t.status==='open'?`<button class="v25-btn" type="button" data-v25-thread-status-action data-thread-id="${t.id}" data-thread-status="resolved">Marcar resuelta</button>`:t.status==='resolved'?`<button class="v25-btn" type="button" data-v25-thread-status-action data-thread-id="${t.id}" data-thread-status="open">Reabrir</button>`:''}${staff&&t.status!=='hidden'?`<button class="v25-btn danger" type="button" data-v25-thread-status-action data-thread-id="${t.id}" data-thread-status="hidden">Ocultar</button>`:''}</div>`:''}</div><div class="v25-detail-body">${esc(t.body)}</div><div class="v25-replies">${replies.length?replies.map(replyItem).join(''):'<div class="v25-muted">Todavía no hay respuestas.</div>'}</div>${t.status==='open'?`<form class="v25-form v25-reply-form" data-v25-reply-form><input type="hidden" name="thread_id" value="${t.id}"><label>Responder<textarea name="body" maxlength="5000" required placeholder="Escribe una respuesta…"></textarea></label><button class="v25-btn primary" type="submit">Responder</button><div class="v25-status" data-v25-reply-status></div></form>`:'<div class="v25-empty" style="margin-top:16px"><strong>Conversación resuelta</strong><span>Puede reabrirse si todavía necesitas continuar.</span></div>'}`}
  function replyItem(r){const staff=['owner','admin','instructor'].includes(r.author_role);return `<div class="v25-reply ${staff?'staff':''}"><div class="v25-reply-head"><strong>${esc(r.author_name||'Academia Yamilet')} · ${esc(roleLabel(r.author_role))}</strong><span>${esc(fmt(r.created_at))}</span></div><p>${esc(r.body)}</p></div>`}

  async function createThread(e,page){e.preventDefault();const f=new FormData(e.currentTarget),st=$('[data-v25-thread-status]',page);setStatus(st,'Publicando…');const {data,error}=await state.sb.from('academy_community_threads').insert({course_id:f.get('course_id'),user_id:state.user.id,author_name:profileName(),author_role:state.membership?.role||state.profile?.role||'student',title:String(f.get('title')||'').trim(),body:String(f.get('body')||'').trim(),status:'open'}).select('id').single();if(error){setStatus(st,error.message,'error');return}state.selectedThread=data.id;e.currentTarget.reset();setStatus(st,'Conversación publicada.','ok');await loadActivity();await renderCommunity(page);mountHomeActivity(true)}
  async function createReply(e,page){e.preventDefault();const f=new FormData(e.currentTarget),st=$('[data-v25-reply-status]',page);setStatus(st,'Enviando…');const {error}=await state.sb.from('academy_community_replies').insert({thread_id:f.get('thread_id'),user_id:state.user.id,author_name:profileName(),author_role:state.membership?.role||state.profile?.role||'student',body:String(f.get('body')||'').trim()});if(error){setStatus(st,error.message,'error');return}e.currentTarget.reset();setStatus(st,'Respuesta enviada.','ok');await loadActivity();await renderCommunity(page);mountHomeActivity(true)}
  async function setThreadStatus(id,statusValue,page){const {error}=await state.sb.rpc('set_academy_community_thread_status',{target_thread:id,new_status:statusValue});if(error){alert(error.message);return}if(statusValue==='hidden')state.selectedThread=null;await renderCommunity(page)}

  function mountHelpObserver(){
    const wait=()=>{const main=$('.dashboard-main');if(!main)return setTimeout(wait,160);const inspect=()=>{const page=$('[data-shell-page="help"]');if(page&&!page.classList.contains('hidden')&&!$('[data-v25-support-root]',page))renderSupport(page,state.selectedTicket)};const obs=new MutationObserver(inspect);obs.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});$$('[data-shell-route="help"]').forEach(b=>b.addEventListener('click',()=>setTimeout(inspect,180)));inspect()};wait();
  }

  async function renderSupport(page,targetTicket=null){
    if(!page||page.dataset.v25SupportBusy==='1')return;page.dataset.v25SupportBusy='1';
    try{
      const {data:tickets,error}=await state.sb.from('academy_support_tickets').select('id,workspace_id,user_id,course_id,subject,category,priority,status,created_at,updated_at,last_message_at,closed_at').eq('workspace_id',state.workspace.id).order('last_message_at',{ascending:false}).limit(100);
      if(error){page.innerHTML=`<div data-v25-support-root class="v25-empty"><strong>No fue posible abrir soporte</strong><span>${esc(error.message)}</span></div>`;return}
      const rows=tickets||[];let profiles=new Map();if(isStaff()&&rows.length){const ids=[...new Set(rows.map(t=>t.user_id))];const {data}=await state.sb.from('profiles').select('id,full_name,email').in('id',ids);profiles=new Map((data||[]).map(p=>[p.id,p]))}
      if(targetTicket)state.selectedTicket=targetTicket;if(!state.selectedTicket||!rows.some(t=>t.id===state.selectedTicket))state.selectedTicket=rows[0]?.id||null;
      const selected=rows.find(t=>t.id===state.selectedTicket)||null;let messages=[];if(selected){const {data}=await state.sb.from('academy_support_messages').select('id,ticket_id,user_id,author_name,author_role,body,created_at').eq('ticket_id',selected.id).order('created_at',{ascending:true});messages=data||[]}
      page.innerHTML=`<div data-v25-support-root><div class="v25-heading"><div><div class="kicker">Ayuda dentro de tu academia</div><h2>Ayuda y soporte</h2><p>Resuelve dudas académicas, técnicas o de acceso sin salir de Academia Yamilet. Cada solicitud conserva su conversación e historial.</p></div><div class="v25-summary"><article><strong>${rows.length}</strong><span>Solicitudes</span></article><article><strong>${rows.filter(t=>['open','in_progress'].includes(t.status)).length}</strong><span>En atención</span></article><article><strong>${rows.filter(t=>t.status==='waiting_user').length}</strong><span>Por responder</span></article></div></div><div class="v25-support-shell"><div class="v25-support-side"><article class="v25-card"><h3>Nueva solicitud</h3><p class="v25-muted">Cuéntanos qué necesitas. Tu conversación quedará guardada en la Academia.</p><form class="v25-form" data-v25-ticket-form><label>Asunto<input name="subject" minlength="3" maxlength="160" required placeholder="Describe brevemente tu solicitud"></label><div class="v25-grid2"><label>Categoría<select name="category"><option value="academic">Académico</option><option value="technical">Técnico</option><option value="access">Acceso</option><option value="billing">Pago / facturación</option><option value="other">Otro</option></select></label><label>Prioridad<select name="priority"><option value="normal">Normal</option><option value="low">Baja</option><option value="high">Alta</option></select></label></div><label>Curso<select name="course_id"><option value="">General</option>${state.courses.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></label><label>Mensaje<textarea name="message" minlength="2" maxlength="5000" required placeholder="Explícanos lo que ocurre…"></textarea></label><button class="v25-btn primary" type="submit">Enviar solicitud</button><div class="v25-status" data-v25-ticket-status></div></form></article><article class="v25-card"><h3>Preguntas frecuentes</h3><div class="v25-faq" style="margin-top:12px"><details><summary>¿Dónde veo mis cursos?</summary><p>En “Mis cursos” encontrarás únicamente los programas que tienes asignados.</p></details><details><summary>¿Cómo recupero mi contraseña?</summary><p>Desde la pantalla de acceso utiliza “Cambiar mi contraseña” y abre el correo de recuperación más reciente.</p></details><details><summary>¿Cuándo aparece mi certificado?</summary><p>Se emite automáticamente cuando completas todas las lecciones y evaluaciones requeridas.</p></details></div></article></div><div class="v25-support-side"><article class="v25-card"><h3>${isStaff()?'Bandeja de soporte':'Mis solicitudes'}</h3><div class="v25-ticket-list" style="margin-top:13px">${rows.length?rows.map(t=>ticketListItem(t,profiles)).join(''):'<div class="v25-empty"><strong>Sin solicitudes</strong><span>Cuando necesites ayuda puedes crear una aquí.</span></div>'}</div></article><article class="v25-card v25-ticket-detail" data-v25-ticket-detail>${selected?ticketDetail(selected,messages,profiles):'<div class="v25-detail-empty"><div><strong>Selecciona una solicitud</strong><div>La conversación aparecerá aquí.</div></div></div>'}</article></div></div></div>`;
      $('[data-v25-ticket-form]',page)?.addEventListener('submit',e=>createTicket(e,page));
      $$('[data-v25-ticket]',page).forEach(el=>el.addEventListener('click',()=>{state.selectedTicket=el.dataset.v25Ticket;renderSupport(page)}));
      $('[data-v25-support-reply-form]',page)?.addEventListener('submit',e=>replyTicket(e,page));
      $('[data-v25-ticket-status-select]',page)?.addEventListener('change',e=>changeTicketStatus(e.target.dataset.ticketId,e.target.value,page));
    }finally{page.dataset.v25SupportBusy='0'}
  }

  function ticketListItem(t,profiles){const p=profiles.get(t.user_id);return `<div class="v25-ticket ${state.selectedTicket===t.id?'active':''}" data-v25-ticket="${t.id}"><div class="v25-ticket-top"><span class="v25-pill ${esc(t.status)}">${esc(statusLabel(t.status))}</span><span class="v25-pill ${esc(t.priority)}">${esc(t.priority)}</span></div><h4>${esc(t.subject)}</h4>${isStaff()?`<div class="v25-ticket-owner">${esc(p?.full_name||p?.email||'Usuario')}</div>`:''}<p>${esc(categoryLabel(t.category))}${t.course_id?' · '+esc(courseName(t.course_id)):''}</p><div class="v25-meta"><span>${esc(fmt(t.last_message_at||t.created_at))}</span></div></div>`}
  function ticketDetail(t,messages,profiles){const p=profiles.get(t.user_id);const closed=['closed','resolved'].includes(t.status);return `<div class="v25-detail-head"><div class="v25-ticket-top"><span class="v25-pill ${esc(t.status)}">${esc(statusLabel(t.status))}</span><span class="v25-muted">${esc(categoryLabel(t.category))}</span></div><h3>${esc(t.subject)}</h3><div class="v25-meta"><span>${isStaff()?esc(p?.full_name||p?.email||'Usuario'):esc(profileName())}</span><span>·</span><span>${esc(fmt(t.created_at))}</span>${t.course_id?`<span>·</span><span>${esc(courseName(t.course_id))}</span>`:''}</div>${isStaff()?`<div class="v25-status-select"><label class="v25-muted">Estado</label><select data-v25-ticket-status-select data-ticket-id="${t.id}"><option value="open" ${t.status==='open'?'selected':''}>Abierto</option><option value="in_progress" ${t.status==='in_progress'?'selected':''}>En atención</option><option value="waiting_user" ${t.status==='waiting_user'?'selected':''}>Esperando alumna</option><option value="resolved" ${t.status==='resolved'?'selected':''}>Resuelto</option><option value="closed" ${t.status==='closed'?'selected':''}>Cerrado</option></select></div>`:''}</div><div class="v25-replies">${messages.length?messages.map(replyItem).join(''):'<div class="v25-muted">Aún no hay mensajes.</div>'}</div>${!closed?`<form class="v25-form v25-reply-form" data-v25-support-reply-form><input type="hidden" name="ticket_id" value="${t.id}"><label>Responder<textarea name="body" maxlength="5000" required placeholder="Escribe tu respuesta…"></textarea></label><button class="v25-btn primary" type="submit">Enviar respuesta</button><div class="v25-status" data-v25-support-reply-status></div></form>`:'<div class="v25-empty" style="margin-top:16px"><strong>Solicitud ${esc(statusLabel(t.status).toLowerCase())}</strong><span>El historial se conserva para futuras consultas.</span></div>'}`}

  async function createTicket(e,page){e.preventDefault();const f=new FormData(e.currentTarget),st=$('[data-v25-ticket-status]',page);setStatus(st,'Creando solicitud…');const payload={workspace_id:state.workspace.id,user_id:state.user.id,course_id:f.get('course_id')||null,subject:String(f.get('subject')||'').trim(),category:f.get('category'),priority:f.get('priority'),status:'open'};const {data,error}=await state.sb.from('academy_support_tickets').insert(payload).select('id').single();if(error){setStatus(st,error.message,'error');return}const {error:messageError}=await state.sb.from('academy_support_messages').insert({ticket_id:data.id,user_id:state.user.id,author_name:profileName(),author_role:state.membership?.role||state.profile?.role||'student',body:String(f.get('message')||'').trim()});if(messageError){setStatus(st,'La solicitud se creó, pero el primer mensaje no pudo guardarse: '+messageError.message,'error');state.selectedTicket=data.id;await renderSupport(page);return}state.selectedTicket=data.id;e.currentTarget.reset();setStatus(st,'Solicitud enviada.','ok');await loadActivity();await renderSupport(page);mountHomeActivity(true)}
  async function replyTicket(e,page){e.preventDefault();const f=new FormData(e.currentTarget),st=$('[data-v25-support-reply-status]',page);setStatus(st,'Enviando…');const {error}=await state.sb.from('academy_support_messages').insert({ticket_id:f.get('ticket_id'),user_id:state.user.id,author_name:profileName(),author_role:state.membership?.role||state.profile?.role||'student',body:String(f.get('body')||'').trim()});if(error){setStatus(st,error.message,'error');return}e.currentTarget.reset();setStatus(st,'Respuesta enviada.','ok');await loadActivity();await renderSupport(page);mountHomeActivity(true)}
  async function changeTicketStatus(id,value,page){const {error}=await state.sb.rpc('set_academy_support_ticket_status',{target_ticket:id,target_status:value});if(error){alert(error.message);return}await renderSupport(page)}

  async function loadActivity(){if(!state.workspace)return[];const {data,error}=await state.sb.rpc('get_academy_recent_activity',{target_workspace:state.workspace.id,limit_count:30});state.activity=error?[]:(data||[]);return state.activity}
  async function renderActivity(page){await loadActivity();const rows=state.activity;page.innerHTML=`<div class="v25-heading"><div><div class="kicker">Tu recorrido</div><h2>Mi actividad</h2><p>Consulta tus avances recientes en cursos, evaluaciones, certificados, Comunidad y soporte.</p></div><div class="v25-summary"><article><strong>${rows.length}</strong><span>Movimientos</span></article><article><strong>${rows.filter(x=>x.activity_type==='lesson_completed').length}</strong><span>Lecciones</span></article><article><strong>${rows.filter(x=>x.activity_type==='assessment_passed').length}</strong><span>Evaluaciones</span></article></div></div><div class="v25-activity-grid"><article class="v25-card"><div class="v25-timeline">${rows.length?rows.map(activityItem).join(''):'<div class="v25-empty"><strong>Tu recorrido comienza aquí</strong><span>Cuando avances en tus cursos, tu actividad aparecerá en esta línea de tiempo.</span></div>'}</div></article><aside class="v25-activity-aside"><div class="kicker">Progreso consciente</div><h3>Cada paso cuenta</h3><p>Esta vista no crea un historial paralelo: reúne en un solo lugar los movimientos reales que ya existen en tu expediente académico.</p></aside></div>`;$$('[data-v25-path]',page).forEach(el=>el.addEventListener('click',()=>navigatePath(el.dataset.v25Path)))}
  function activityItem(a){return `<div class="v25-activity" data-v25-path="${esc(a.target_path||'')}"><div class="v25-activity-icon">${activityIcon(a.activity_type)}</div><div><h4>${esc(a.title)}</h4><p>${esc(a.detail||'')}</p></div><time>${esc(fmt(a.occurred_at))}</time></div>`}

  function mountHomeActivity(force=false){
    const wait=()=>{const anchor=$('#continuar'),main=$('.dashboard-main');if(!anchor||!main)return setTimeout(wait,170);let block=$('[data-v25-home-activity]');if(block&&force)block.remove();else if(block)return;block=document.createElement('section');block.className='v25-home-activity';block.dataset.v25HomeActivity='1';const rows=state.activity.slice(0,3);block.innerHTML=`<div class="v25-home-activity-head"><div><div class="kicker">Actividad reciente</div><h3>Tu recorrido en la Academia</h3></div><button class="v25-btn" type="button" data-v25-open-activity>Ver todo</button></div>${rows.length?`<div class="v25-home-list">${rows.map(a=>`<div class="v25-home-item" data-v25-home-path="${esc(a.target_path||'')}"><strong>${esc(a.title)}</strong><span>${esc(a.detail||'')} · ${esc(fmt(a.occurred_at))}</span></div>`).join('')}</div>`:'<div class="v25-muted">Tu actividad aparecerá aquí conforme avances.</div>'}`;anchor.insertAdjacentElement('afterend',block);$('[data-v25-open-activity]',block)?.addEventListener('click',()=>showCustom('activity'));$$('[data-v25-home-path]',block).forEach(el=>el.addEventListener('click',()=>navigatePath(el.dataset.v25HomePath)))};wait();
  }

  function navigatePath(path=''){
    if(path.startsWith('#community/')){showCustom('community',path.split('/')[1]);return}
    if(path.startsWith('#support/')){state.selectedTicket=path.split('/')[1];$('[data-shell-route="help"]')?.click();setTimeout(()=>renderSupport($('[data-shell-page="help"]'),state.selectedTicket),220);return}
    if(path.startsWith('#assessment')){$('[data-shell-route="evaluations"]')?.click();return}
    if(path.startsWith('#certificate')){$('[data-shell-route="certificates"]')?.click();return}
    if(path.startsWith('#course')){$('[data-shell-route="courses"]')?.click();return}
    if(path.startsWith('#calendar')){$('[data-shell-route="calendar"]')?.click();return}
    $('[data-shell-route="home"]')?.click();
  }

  function mountNotificationBridge(){
    document.addEventListener('click',async e=>{const item=e.target.closest?.('[data-v24-notification]');if(!item)return;const path=item.dataset.path||'';if(!path.startsWith('#community/')&&!path.startsWith('#support/'))return;e.preventDefault();e.stopImmediatePropagation();const id=item.dataset.v24Notification;try{await state.sb.from('academy_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.user.id)}catch{}item.classList.remove('unread');$('[data-v24-panel]')?.classList.add('hidden');const badge=$('[data-v24-count]');if(badge&&!badge.classList.contains('hidden')){const current=Math.max(0,(parseInt(badge.textContent,10)||1)-1);badge.textContent=String(current);badge.classList.toggle('hidden',current===0)}navigatePath(path)},true);
  }

  init();
})();
