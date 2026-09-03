(() => {
  'use strict';

  const VERSION='116.0.0';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let sb=null,workspace=null,courses=[],pending=[],loading=false,timer=null;

  const routeSection=()=>{const p=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);if(p[0]!=='admin')return null;return p[1]||'overview';};
  const isRoute=()=>routeSection()==='students';
  const isOverview=()=>routeSection()==='overview';
  const isSupportedRoute=()=>isRoute()||isOverview();
  const fmt=value=>{if(!value)return 'Sin fecha';try{return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return 'Sin fecha';}};
  const defaultCourseId=()=>courses.find(c=>/método\s+mes|metodo\s+mes/i.test(c.title||''))?.id||courses.find(c=>c.status==='published')?.id||courses[0]?.id||'';
  const courseOptions=(selected='')=>courses.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.title)}${c.status==='draft'?' · borrador':''}</option>`).join('');
  const originLabel=item=>{
    const source=item.utm_source||'';
    const campaign=item.utm_campaign||'';
    const cta=item.landing_cta||item.utm_content||'';
    if(!source&&!campaign&&!cta)return 'Origen: acceso directo';
    return `Origen: ${[source,campaign,cta].filter(Boolean).join(' · ')}`;
  };

  async function client(){
    if(sb&&workspace)return sb;
    const response=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error('config_unavailable');
    const cfg=await response.json();
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user)throw new Error('session_required');
    const {data:ws,error}=await sb.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug||'yamilet-mes').maybeSingle();
    if(error||!ws)throw error||new Error('workspace_not_found');
    workspace=ws;return sb;
  }

  async function loadData(){
    const api=await client();
    const [courseRes,pendingRes]=await Promise.all([
      api.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
      api.rpc('get_academy_registration_requests',{target_workspace:workspace.id})
    ]);
    if(courseRes.error)throw courseRes.error;if(pendingRes.error)throw pendingRes.error;
    courses=courseRes.data||[];pending=pendingRes.data||[];
  }

  function panelHost(){
    const root=$('[data-students81]');if(!root)return null;
    let panel=$('[data-pending111]',root);
    if(!panel){panel=document.createElement('section');panel.className='pending110';panel.dataset.pending111='true';const directory=$('.students81-directory',root);if(directory)directory.insertAdjacentElement('beforebegin',panel);else root.appendChild(panel);}
    return panel;
  }

  function stateLabel(item){
    if(!item.account_created)return '<span class="waiting">Solicitud recibida · cuenta pendiente</span>';
    if(item.email_confirmed_at)return '<span class="confirmed">Correo confirmado</span>';
    return '<span class="waiting">Cuenta creada · correo por confirmar</span>';
  }

  function renderOverview(){
    if(!isOverview())return false;
    const root=$('[data-admin-v79-root]');
    if(!root)return false;
    const summary=$('.admin-v79-summary',root);
    if(!summary)return false;

    const studentCard=$$('article',summary).find(card=>String(card.querySelector('span')?.textContent||'').trim()==='Estudiantes');
    if(studentCard){
      const small=$('small',studentCard);
      if(small)small.innerHTML=`con acceso activo · <b>${pending.length}</b> registro${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'}`;
      studentCard.dataset.pendingOverview='true';
      studentCard.style.cursor='pointer';
      studentCard.title=pending.length?'Abrir registros pendientes':'Abrir estudiantes';
      studentCard.onclick=()=>{location.hash='#admin/students';};
    }

    let banner=$('[data-pending-overview-banner]',root);
    if(!pending.length){banner?.remove();return true;}

    if(!banner){
      banner=document.createElement('section');
      banner.className='admin-v79-section-head';
      banner.dataset.pendingOverviewBanner='true';
      const live=$('.admin-v79-live-grid',root);
      if(live)live.insertAdjacentElement('beforebegin',banner);else root.appendChild(banner);
    }

    const latest=pending[0]||{};
    const confirmed=pending.filter(item=>!!item.email_confirmed_at).length;
    banner.innerHTML=`<div><span>NUEVOS REGISTROS</span><h2>${pending.length} registro${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'} de activar</h2><p>${esc(latest.full_name||latest.email||'Nueva alumna')} · ${esc(latest.email||'')} · ${confirmed} correo${confirmed===1?'':'s'} confirmado${confirmed===1?'':'s'}</p></div><button type="button" data-pending-overview-open>Revisar registros</button>`;
    $('[data-pending-overview-open]',banner)?.addEventListener('click',()=>{location.hash='#admin/students';});
    return true;
  }

  function render(){
    if(!isRoute())return;const panel=panelHost();if(!panel)return;
    const confirmed=pending.filter(x=>!!x.email_confirmed_at).length,accounts=pending.filter(x=>!!x.account_created).length,defaultId=defaultCourseId();
    panel.innerHTML=`<div class="pending110-head"><div><span>NUEVOS REGISTROS</span><h3>Pendientes de inscripción</h3><p>Toda solicitud enviada desde el registro público aparece aquí inmediatamente, incluso si la cuenta todavía está por crearse o confirmar.</p></div><div class="pending110-head-actions"><span><b>${pending.length}</b> pendientes</span><button type="button" data-pending111-refresh>Actualizar</button></div></div>
    <div class="pending110-summary"><span><b>${pending.length}</b> solicitudes recibidas</span><span><b>${accounts}</b> cuentas creadas</span><span><b>${confirmed}</b> correos confirmados</span></div>
    <div class="pending110-list">${pending.length?pending.map(item=>`<article class="pending110-card" data-pending-request="${esc(item.request_id||'')}" data-pending-user="${esc(item.user_id||'')}">
      <div class="pending110-person"><div class="pending110-avatar">${esc((item.full_name||item.email||'?').trim().slice(0,1).toUpperCase())}</div><div><strong>${esc(item.full_name||'Nueva alumna')}</strong><span>${esc(item.email||'')}</span><small>Registro: ${esc(fmt(item.registered_at))}</small></div></div>
      <div class="pending110-state">${stateLabel(item)}<small>${item.course_interest==='metodo-mes'?'Interés: Método MES®':'Registro público'}</small><small title="${esc(originLabel(item))}">${esc(originLabel(item))}</small></div>
      <div class="pending110-course"><label>Curso a activar<select data-pending111-course ${item.account_created?'':'disabled'}>${courseOptions(defaultId)}</select></label></div>
      <div class="pending110-action"><button type="button" data-pending111-activate="${esc(item.user_id||'')}" ${item.account_created&&courses.length?'':'disabled'}>${item.account_created?'Activar Método MES®':'Esperando creación de cuenta'}</button><small data-pending111-status>${item.account_created?'':'La solicitud ya está guardada. Actualiza cuando la cuenta se haya creado.'}</small></div>
    </article>`).join(''):`<div class="pending110-empty"><span>✓</span><div><strong>No hay registros pendientes</strong><p>Cuando una persona envíe el formulario de registro aparecerá aquí inmediatamente.</p></div></div>`}</div>`;
    $('[data-pending111-refresh]',panel)?.addEventListener('click',()=>refresh(true));
    $$('[data-pending111-activate]',panel).forEach(button=>button.addEventListener('click',()=>activate(button)));
  }

  async function activate(button){
    if(button.disabled)return;const card=button.closest('[data-pending-user]'),userId=button.dataset.pending111Activate,courseId=$('[data-pending111-course]',card)?.value||defaultCourseId(),status=$('[data-pending111-status]',card);
    if(!userId||!courseId||!status)return;button.disabled=true;status.className='';status.textContent='Activando acceso…';
    try{const api=await client();const {error}=await api.from('enrollments').insert({user_id:userId,course_id:courseId,status:'active'});if(error)throw error;status.className='ok';status.textContent='Curso activado correctamente.';await window.ACADEMIA_YAMILET_STUDENTS?.refresh?.();await refresh(false);}
    catch(error){console.warn('Academia Yamilet pending registration activation v116',error);status.className='error';status.textContent=String(error?.message||'').toLowerCase().includes('duplicate')?'Esta persona ya tiene ese curso asignado.':'No fue posible activar el curso.';button.disabled=false;}
  }

  async function refresh(showLoading=false){
    if(!isSupportedRoute()||loading)return;loading=true;const panel=isRoute()?panelHost():null;if(showLoading&&panel)panel.classList.add('is-loading');
    try{await loadData();if(isRoute())render();else if(isOverview())renderOverview();}
    catch(error){console.warn('Academia Yamilet pending registrations v116',error);if(isRoute()){const host=panelHost();if(host)host.innerHTML='<div class="pending110-error"><strong>No fue posible cargar los nuevos registros.</strong><span>Verifica que tu sesión administrativa siga activa.</span></div>';}}
    finally{loading=false;if(isRoute())panelHost()?.classList.remove('is-loading');}
  }

  function schedule(delay=120){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(isRoute()&&!$('[data-pending111]'))refresh(false);
      else if(isOverview()&&!$('[data-admin-v79-root] [data-pending-overview="true"]'))refresh(false);
    },delay);
  }

  function start(){
    const observer=new MutationObserver(()=>schedule(80));
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',()=>{if(isSupportedRoute())setTimeout(()=>refresh(false),120);});
    window.addEventListener('pageshow',()=>{if(isSupportedRoute())setTimeout(()=>refresh(false),180);});
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-admin-v79-go="students"],a[href="#admin/students"]'))setTimeout(()=>refresh(false),180);
      if(event.target.closest('[data-admin-v79-go="overview"],a[href="#admin"]'))setTimeout(()=>refresh(false),180);
    },true);
    if(isSupportedRoute())setTimeout(()=>refresh(false),160);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111=Object.freeze({version:VERSION,refresh});
})();