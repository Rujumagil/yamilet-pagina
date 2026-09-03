(() => {
  'use strict';

  const VERSION='117.0.0';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let sb=null;
  let workspace=null;
  let courses=[];
  let pending=[];
  let loading=false;
  let dataLoaded=false;
  let timer=null;

  function section(){
    const parts=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);
    if(parts[0]!=='admin')return null;
    return parts[1]||'overview';
  }

  const isOverview=()=>section()==='overview';
  const isStudents=()=>section()==='students';
  const supported=()=>isOverview()||isStudents();

  const fmt=value=>{
    if(!value)return 'Sin fecha';
    try{
      return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
    }catch{return 'Sin fecha';}
  };

  const defaultCourseId=()=>courses.find(c=>/método\s+mes|metodo\s+mes/i.test(c.title||''))?.id||courses.find(c=>c.status==='published')?.id||courses[0]?.id||'';
  const courseOptions=(selected='')=>courses.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.title)}${c.status==='draft'?' · borrador':''}</option>`).join('');

  function originLabel(item){
    const source=item.utm_source||'';
    const campaign=item.utm_campaign||'';
    const cta=item.landing_cta||item.utm_content||'';
    if(!source&&!campaign&&!cta)return 'Origen: acceso directo';
    return `Origen: ${[source,campaign,cta].filter(Boolean).join(' · ')}`;
  }

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
    workspace=ws;
    return sb;
  }

  async function loadData(){
    const api=await client();
    const [courseRes,pendingRes]=await Promise.all([
      api.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true}),
      api.rpc('get_academy_registration_requests',{target_workspace:workspace.id})
    ]);
    if(courseRes.error)throw courseRes.error;
    if(pendingRes.error)throw pendingRes.error;
    courses=courseRes.data||[];
    pending=pendingRes.data||[];
    dataLoaded=true;
  }

  function overviewRoot(){
    const page=$('[data-shell-page="admin"]');
    if(!page||page.classList.contains('hidden'))return null;
    return $('[data-admin-v79-root]',page);
  }

  function findStudentCard(root){
    const summary=$('.admin-v79-summary',root);
    if(!summary)return null;
    return $$('article',summary).find(card=>String(card.querySelector('span')?.textContent||'').trim()==='Estudiantes')||null;
  }

  function renderOverview(){
    if(!isOverview()||!dataLoaded)return false;
    const root=overviewRoot();
    if(!root)return false;
    const studentCard=findStudentCard(root);
    if(!studentCard)return false;

    const small=$('small',studentCard);
    if(small){
      small.innerHTML=`con acceso activo · <b>${pending.length}</b> registro${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'}`;
    }
    studentCard.dataset.pendingOverview='true';
    studentCard.style.cursor='pointer';
    studentCard.title=pending.length?'Abrir registros pendientes':'Abrir estudiantes';
    studentCard.onclick=()=>{location.hash='#admin/students';};

    let banner=$('[data-pending-overview-banner]',root);
    if(!pending.length){
      banner?.remove();
      return true;
    }

    if(!banner){
      banner=document.createElement('section');
      banner.className='admin-v79-section-head pending117-overview';
      banner.dataset.pendingOverviewBanner='true';
      const live=$('.admin-v79-live-grid',root);
      if(live)live.insertAdjacentElement('beforebegin',banner);
      else root.appendChild(banner);
    }

    const latest=pending[0]||{};
    const confirmed=pending.filter(item=>!!item.email_confirmed_at).length;
    banner.innerHTML=`<div><span>NUEVOS REGISTROS</span><h2>${pending.length} registro${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'} de activar</h2><p>${esc(latest.full_name||latest.email||'Nueva alumna')} · ${esc(latest.email||'')} · ${confirmed} correo${confirmed===1?'':'s'} confirmado${confirmed===1?'':'s'}</p></div><button type="button" data-pending-overview-open>Revisar registros</button>`;
    $('[data-pending-overview-open]',banner)?.addEventListener('click',()=>{location.hash='#admin/students';});
    return true;
  }

  function panelHost(){
    const root=$('[data-students81]');
    if(!root)return null;
    let panel=$('[data-pending111]',root);
    if(!panel){
      panel=document.createElement('section');
      panel.className='pending110';
      panel.dataset.pending111='true';
      const directory=$('.students81-directory',root);
      if(directory)directory.insertAdjacentElement('beforebegin',panel);
      else root.appendChild(panel);
    }
    return panel;
  }

  function stateLabel(item){
    if(!item.account_created)return '<span class="waiting">Solicitud recibida · cuenta pendiente</span>';
    if(item.email_confirmed_at)return '<span class="confirmed">Correo confirmado</span>';
    return '<span class="waiting">Cuenta creada · correo por confirmar</span>';
  }

  function renderStudents(){
    if(!isStudents()||!dataLoaded)return false;
    const panel=panelHost();
    if(!panel)return false;

    const confirmed=pending.filter(x=>!!x.email_confirmed_at).length;
    const accounts=pending.filter(x=>!!x.account_created).length;
    const defaultId=defaultCourseId();

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
    return true;
  }

  async function activate(button){
    if(button.disabled)return;
    const card=button.closest('[data-pending-user]');
    const userId=button.dataset.pending111Activate;
    const courseId=$('[data-pending111-course]',card)?.value||defaultCourseId();
    const status=$('[data-pending111-status]',card);
    if(!userId||!courseId||!status)return;

    button.disabled=true;
    status.className='';
    status.textContent='Activando acceso…';
    try{
      const api=await client();
      const {error}=await api.from('enrollments').insert({user_id:userId,course_id:courseId,status:'active'});
      if(error)throw error;
      status.className='ok';
      status.textContent='Curso activado correctamente.';
      await window.ACADEMIA_YAMILET_STUDENTS?.refresh?.();
      await refresh(true);
    }catch(error){
      console.warn('Academia Yamilet pending registration activation v117',error);
      status.className='error';
      status.textContent=String(error?.message||'').toLowerCase().includes('duplicate')?'Esta persona ya tiene ese curso asignado.':'No fue posible activar el curso.';
      button.disabled=false;
    }
  }

  function renderCurrent(){
    if(isOverview())return renderOverview();
    if(isStudents())return renderStudents();
    return false;
  }

  async function refresh(force=false){
    if(!supported()||loading)return false;
    loading=true;
    const panel=isStudents()?panelHost():null;
    if(force&&panel)panel.classList.add('is-loading');
    try{
      await loadData();
      renderCurrent();
      return true;
    }catch(error){
      console.warn('Academia Yamilet pending registrations v117',error);
      if(isStudents()){
        const host=panelHost();
        if(host)host.innerHTML='<div class="pending110-error"><strong>No fue posible cargar los nuevos registros.</strong><span>Verifica que tu sesión administrativa siga activa.</span></div>';
      }
      return false;
    }finally{
      loading=false;
      panelHost()?.classList.remove('is-loading');
    }
  }

  function schedule(delay=120,force=false){
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!supported())return;
      if(dataLoaded&&!force){
        renderCurrent();
        return;
      }
      refresh(force);
    },delay);
  }

  function needsRestore(){
    if(!dataLoaded)return true;
    if(isOverview()){
      const root=overviewRoot();
      if(!root)return false;
      return !findStudentCard(root)?.dataset.pendingOverview || (pending.length>0&&!$('[data-pending-overview-banner]',root));
    }
    if(isStudents()){
      const root=$('[data-students81]');
      return !!root&&!$('[data-pending111]',root);
    }
    return false;
  }

  function start(){
    const observer=new MutationObserver(()=>{
      if(!supported()||!needsRestore())return;
      requestAnimationFrame(()=>{
        if(dataLoaded)renderCurrent();
        else schedule(60,false);
      });
    });
    observer.observe(document.body,{childList:true,subtree:true});

    window.addEventListener('hashchange',()=>{
      if(supported())schedule(120,true);
    });
    window.addEventListener('pageshow',()=>{
      if(supported())schedule(180,true);
    });

    document.addEventListener('click',event=>{
      if(event.target.closest('[data-admin-v79-go="students"],a[href="#admin/students"]'))setTimeout(()=>schedule(80,true),120);
      if(event.target.closest('[data-admin-v79-go="overview"],a[href="#admin"]'))setTimeout(()=>schedule(80,true),120);
      if(event.target.closest('[data-admin-v79-refresh]'))setTimeout(()=>schedule(80,true),220);
    },true);

    if(supported())schedule(160,true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111=Object.freeze({version:VERSION,refresh:()=>refresh(true),render:renderCurrent});
})();
