(() => {
  'use strict';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const state={sb:null,user:null,workspace:null,courses:[],ready:false,notifications:[],events:[]};
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>v?new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'Sin fecha';
  const day=v=>new Intl.DateTimeFormat('es-MX',{day:'2-digit'}).format(new Date(v));
  const month=v=>new Intl.DateTimeFormat('es-MX',{month:'short'}).format(new Date(v)).replace('.','').toUpperCase();
  const route=name=>document.querySelector(`[data-shell-route="${name}"]`)?.click();
  const toast=msg=>{let el=$('.v24-toast');if(!el){el=document.createElement('div');el.className='v24-toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)};

  async function init(){
    try{
      const r=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});if(!r.ok)return;
      const cfg=await r.json();
      state.sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      state.sb.auth.onAuthStateChange((_e,s)=>{if(s?.user)bootstrap(s.user,cfg.workspaceSlug||'yamilet-mes')});
      const {data:{session}}=await state.sb.auth.getSession();if(session?.user)await bootstrap(session.user,cfg.workspaceSlug||'yamilet-mes');
    }catch(e){console.error('Yamilet v24 init',e)}
  }

  async function bootstrap(user,slug){
    if(state.ready&&state.user?.id===user.id)return;
    state.user=user;
    const {data:workspace}=await state.sb.from('workspaces').select('id,name,slug').eq('slug',slug).maybeSingle();
    state.workspace=workspace;if(!workspace)return;
    const {data:courses}=await state.sb.from('courses').select('id,title,status,workspace_id').eq('workspace_id',workspace.id).order('created_at',{ascending:true});
    state.courses=courses||[];
    state.ready=true;
    try{await state.sb.rpc('refresh_academy_notifications')}catch{}
    await Promise.all([loadNotifications(),loadUpcomingEvents(),ensureEligibleCertificates()]);
    mountNotificationCenter();
    mountUpcomingEvent();
    watchCertificatePage();
  }

  async function loadNotifications(){
    const {data}=await state.sb.from('academy_notifications').select('id,notification_type,title,body,target_path,entity_type,entity_id,created_at,read_at').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(40);
    state.notifications=data||[];
  }

  async function loadUpcomingEvents(){
    const {data}=await state.sb.from('academy_events').select('id,title,description,event_type,starts_at,ends_at,timezone,delivery_mode,location_text,meeting_url,status,is_featured,course_id').eq('workspace_id',state.workspace.id).eq('status','published').gte('starts_at',new Date().toISOString()).order('is_featured',{ascending:false}).order('starts_at',{ascending:true}).limit(12);
    state.events=data||[];
  }

  async function ensureEligibleCertificates(){
    for(const course of state.courses){
      try{
        const {data:existing}=await state.sb.from('certificates').select('id').eq('user_id',state.user.id).eq('course_id',course.id).is('revoked_at',null).maybeSingle();
        if(existing)continue;
        const {data:elig}=await state.sb.rpc('get_certificate_eligibility',{target_course:course.id});
        const row=Array.isArray(elig)?elig[0]:elig;
        if(row?.eligible)await state.sb.rpc('issue_academy_certificate',{target_course:course.id});
      }catch{}
    }
  }

  function iconFor(type){return ({certificate_ready:'🏅',event_upcoming:'◷',assessment_available:'✓',assessment_passed:'✓',assessment_failed:'↻',course_assigned:'▣',inactivity:'↗'})[type]||'•'}

  function mountNotificationCenter(){
    const wait=()=>{const actions=$('.academy-topbar-actions');if(!actions)return setTimeout(wait,140);if(actions.querySelector('[data-v24-bell]'))return renderNotifications();
      const wrap=document.createElement('div');wrap.className='v24-notification-wrap';wrap.innerHTML=`<button class="academy-icon-btn v24-bell" type="button" data-v24-bell aria-label="Notificaciones"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="v24-badge hidden" data-v24-count>0</span></button><div class="v24-notification-panel hidden" data-v24-panel><div class="v24-notification-head"><strong>Notificaciones</strong><button class="v24-mark-all" type="button" data-v24-mark-all>Marcar todo leído</button></div><div class="v24-notification-list" data-v24-list></div></div>`;
      actions.insertBefore(wrap,actions.firstChild);
      $('[data-v24-bell]',wrap).addEventListener('click',e=>{e.stopPropagation();$('[data-v24-panel]',wrap).classList.toggle('hidden')});
      $('[data-v24-mark-all]',wrap).addEventListener('click',markAllRead);
      document.addEventListener('click',e=>{if(!wrap.contains(e.target))$('[data-v24-panel]',wrap).classList.add('hidden')});
      renderNotifications();
    };wait();
  }

  function renderNotifications(){
    const list=$('[data-v24-list]'),badge=$('[data-v24-count]');if(!list||!badge)return;
    const unread=state.notifications.filter(n=>!n.read_at).length;badge.textContent=unread>99?'99+':String(unread);badge.classList.toggle('hidden',unread===0);
    list.innerHTML=state.notifications.length?state.notifications.map(n=>`<article class="v24-notification ${n.read_at?'':'unread'}" data-v24-notification="${n.id}" data-path="${esc(n.target_path||'')}"><div class="v24-notification-icon">${iconFor(n.notification_type)}</div><div><h4>${esc(n.title)}</h4><p>${esc(n.body||'')}</p><time>${esc(fmtDate(n.created_at))}</time></div></article>`).join(''):`<div class="v24-notification-empty">No tienes notificaciones nuevas.</div>`;
    $$('[data-v24-notification]',list).forEach(el=>el.addEventListener('click',()=>openNotification(el)));
  }

  async function openNotification(el){
    const id=el.dataset.v24Notification,path=el.dataset.path||'';
    await state.sb.from('academy_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',state.user.id);
    const item=state.notifications.find(n=>n.id===id);if(item)item.read_at=new Date().toISOString();renderNotifications();$('[data-v24-panel]')?.classList.add('hidden');
    if(path.startsWith('#calendar'))route('calendar');else if(path.startsWith('#certificate'))route('certificates');else if(path.startsWith('#assessment'))route('evaluations');else if(path.startsWith('#course'))route('courses');else route('home');
  }

  async function markAllRead(){
    const ids=state.notifications.filter(n=>!n.read_at).map(n=>n.id);if(!ids.length)return;
    const now=new Date().toISOString();await state.sb.from('academy_notifications').update({read_at:now}).eq('user_id',state.user.id).is('read_at',null);state.notifications.forEach(n=>n.read_at=n.read_at||now);renderNotifications();toast('Notificaciones marcadas como leídas');
  }

  function mountUpcomingEvent(){
    const wait=()=>{const main=$('.dashboard-main'),stats=$('.stats');if(!main||!stats)return setTimeout(wait,160);if($('[data-v24-next-event]'))return;
      const event=state.events[0];if(!event)return;
      const card=document.createElement('section');card.className='v24-next-event';card.dataset.v24NextEvent='1';
      const where=event.delivery_mode==='online'?'En línea':event.location_text||'Por confirmar';
      card.innerHTML=`<div class="v24-event-date"><strong>${esc(day(event.starts_at))}</strong><span>${esc(month(event.starts_at))}</span></div><div><div class="kicker">Próximo evento</div><h3>${esc(event.title)}</h3><p>${esc(event.description||'Actividad programada dentro de Academia Yamilet.')}</p><div class="v24-next-event-meta">${esc(fmtDate(event.starts_at))} · ${esc(where)}</div></div><button class="v24-event-action" type="button" data-v24-open-calendar>Ver calendario</button>`;
      stats.insertAdjacentElement('afterend',card);$('[data-v24-open-calendar]',card).addEventListener('click',()=>route('calendar'));
    };wait();
  }

  function watchCertificatePage(){
    const wait=()=>{const main=$('.dashboard-main');if(!main)return setTimeout(wait,180);const obs=new MutationObserver(()=>{const page=$('[data-shell-page="certificates"]');if(page&&!page.classList.contains('hidden'))setTimeout(()=>renderCertificates(page),120)});obs.observe(main,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});const page=$('[data-shell-page="certificates"]');if(page&&!page.classList.contains('hidden'))renderCertificates(page)};wait();
  }

  async function renderCertificates(page){
    if(page.dataset.v24Busy==='1')return;page.dataset.v24Busy='1';
    try{
      const {data:certs}=await state.sb.from('certificates').select('id,user_id,course_id,issued_at,verification_code,recipient_name,requirements_snapshot,revoked_at').eq('user_id',state.user.id).order('issued_at',{ascending:false});
      const existing=new Map((certs||[]).filter(c=>!c.revoked_at).map(c=>[c.course_id,c]));
      const eligible=[];
      for(const course of state.courses){try{const {data}=await state.sb.rpc('get_certificate_eligibility',{target_course:course.id});const row=Array.isArray(data)?data[0]:data;if(row)eligible.push({course,row})}catch{}}
      page.classList.add('v24-cert-page');
      const head=page.querySelector('.shell-page-heading');
      const cards=eligible.map(({course,row})=>{const cert=existing.get(course.id);return cert?certificateCard(course,cert):pendingCard(course,row)}).join('');
      const holder=document.createElement('div');holder.className='v24-certificates';holder.dataset.v24Certificates='1';holder.innerHTML=cards||`<div class="v24-cert-pending"><strong>Sin certificados por ahora</strong><p>Los certificados se emitirán automáticamente al completar todos los requisitos de tus cursos.</p></div>`;
      page.querySelector('[data-v24-certificates]')?.remove();(head||page.firstChild)?.insertAdjacentElement('afterend',holder);
      $$('[data-v24-print]',holder).forEach(b=>b.addEventListener('click',()=>printCertificate(b.dataset.v24Print)));
      $$('[data-v24-copy]',holder).forEach(b=>b.addEventListener('click',async()=>{await navigator.clipboard?.writeText(b.dataset.v24Copy||'');toast('Código copiado')}));
    }finally{page.dataset.v24Busy='0'}
  }

  function certificateCard(course,cert){const code=cert.verification_code||'Pendiente';return `<article class="v24-certificate" data-cert-id="${cert.id}"><div class="v24-certificate-top"><div><div class="kicker">Certificado verificable</div><h3>${esc(course.title)}</h3><p>Otorgado a ${esc(cert.recipient_name||'Alumno de Academia Yamilet')}</p></div><div class="v24-cert-seal">YP</div></div><div class="v24-certificate-body"><div><div class="v24-cert-code">${esc(code)}</div><div class="v24-cert-meta">Emitido ${esc(fmtDate(cert.issued_at))} · Academia Yamilet</div></div><div class="v24-cert-actions"><button class="v24-cert-btn" type="button" data-v24-copy="${esc(code)}">Copiar código</button><button class="v24-cert-btn primary" type="button" data-v24-print="${cert.id}">Imprimir / PDF</button></div></div></article>`}

  function pendingCard(course,row){return `<article class="v24-cert-pending"><div class="kicker">Certificado en progreso</div><h3>${esc(course.title)}</h3><p>Se emitirá automáticamente cuando cumplas todos los requisitos.</p><div class="v24-cert-progress"><div><strong>${row.completed_lessons}/${row.total_lessons}</strong><span>Lecciones</span></div><div><strong>${row.passed_assessments}/${row.required_assessments}</strong><span>Evaluaciones</span></div><div><strong>${row.eligible?'100%':'Pendiente'}</strong><span>Elegibilidad</span></div><div><strong>${row.eligible?'Listo':'En curso'}</strong><span>Estado</span></div></div></article>`}

  function printCertificate(id){
    const source=document.querySelector(`[data-cert-id="${CSS.escape(id)}"]`);if(!source)return;
    const clone=source.cloneNode(true);clone.classList.add('v24-certificate-print');clone.querySelectorAll('button').forEach(x=>x.remove());document.body.appendChild(clone);window.print();setTimeout(()=>clone.remove(),500);
  }

  init();
})();
