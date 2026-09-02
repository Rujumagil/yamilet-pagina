(() => {
  'use strict';

  const VERSION='111.0.0';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let sb=null,workspace=null,courses=[],pending=[],loading=false,timer=null;

  const isRoute=()=>{const p=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);return p[0]==='admin'&&p[1]==='students';};
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
      api.rpc('get_academy_pending_registrations',{target_workspace:workspace.id})
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

  function render(){
    if(!isRoute())return;const panel=panelHost();if(!panel)return;
    const confirmed=pending.filter(x=>!!x.email_confirmed_at).length,defaultId=defaultCourseId();
    panel.innerHTML=`<div class="pending110-head"><div><span>NUEVOS REGISTROS</span><h3>Pendientes de inscripción</h3><p>Personas que crearon su cuenta y aún no tienen un curso asignado. El origen permite identificar qué página, campaña o CTA generó el registro.</p></div><div class="pending110-head-actions"><span><b>${pending.length}</b> pendientes</span><button type="button" data-pending111-refresh>Actualizar</button></div></div>
    <div class="pending110-summary"><span><b>${pending.length}</b> cuentas nuevas</span><span><b>${confirmed}</b> correos confirmados</span><span><b>${Math.max(0,pending.length-confirmed)}</b> por confirmar correo</span></div>
    <div class="pending110-list">${pending.length?pending.map(item=>`<article class="pending110-card" data-pending-user="${esc(item.user_id)}">
      <div class="pending110-person"><div class="pending110-avatar">${esc((item.full_name||item.email||'?').trim().slice(0,1).toUpperCase())}</div><div><strong>${esc(item.full_name||'Nueva alumna')}</strong><span>${esc(item.email||'')}</span><small>Registro: ${esc(fmt(item.registered_at))}</small></div></div>
      <div class="pending110-state"><span class="${item.email_confirmed_at?'confirmed':'waiting'}">${item.email_confirmed_at?'Correo confirmado':'Correo por confirmar'}</span><small>${item.course_interest==='metodo-mes'?'Interés: Método MES®':'Registro público'}</small><small title="${esc(originLabel(item))}">${esc(originLabel(item))}</small></div>
      <div class="pending110-course"><label>Curso a activar<select data-pending111-course>${courseOptions(defaultId)}</select></label></div>
      <div class="pending110-action"><button type="button" data-pending111-activate="${esc(item.user_id)}" ${courses.length?'':'disabled'}>Activar Método MES®</button><small data-pending111-status></small></div>
    </article>`).join(''):`<div class="pending110-empty"><span>✓</span><div><strong>No hay registros pendientes</strong><p>Cuando una persona cree su cuenta aparecerá aquí con el origen de su registro.</p></div></div>`}</div>`;
    $('[data-pending111-refresh]',panel)?.addEventListener('click',()=>refresh(true));
    $$('[data-pending111-activate]',panel).forEach(button=>button.addEventListener('click',()=>activate(button)));
  }

  async function activate(button){
    if(button.disabled)return;const card=button.closest('[data-pending-user]'),userId=button.dataset.pending111Activate,courseId=$('[data-pending111-course]',card)?.value||defaultCourseId(),status=$('[data-pending111-status]',card);
    if(!userId||!courseId||!status)return;button.disabled=true;status.className='';status.textContent='Activando acceso…';
    try{const api=await client();const {error}=await api.from('enrollments').insert({user_id:userId,course_id:courseId,status:'active'});if(error)throw error;status.className='ok';status.textContent='Curso activado correctamente.';await window.ACADEMIA_YAMILET_STUDENTS?.refresh?.();await refresh(false);}
    catch(error){console.warn('Academia Yamilet pending registration activation v111',error);status.className='error';status.textContent=String(error?.message||'').toLowerCase().includes('duplicate')?'Esta persona ya tiene ese curso asignado.':'No fue posible activar el curso.';button.disabled=false;}
  }

  async function refresh(showLoading=false){
    if(!isRoute()||loading)return;loading=true;const panel=panelHost();if(showLoading&&panel)panel.classList.add('is-loading');
    try{await loadData();render();}catch(error){console.warn('Academia Yamilet pending registrations v111',error);const host=panelHost();if(host)host.innerHTML='<div class="pending110-error"><strong>No fue posible cargar los nuevos registros.</strong><span>Verifica que tu sesión administrativa siga activa.</span></div>';}
    finally{loading=false;panelHost()?.classList.remove('is-loading');}
  }

  function schedule(delay=120){clearTimeout(timer);timer=setTimeout(()=>{if(isRoute()&&!$('[data-pending111]'))refresh(false);},delay);}
  function start(){const observer=new MutationObserver(()=>schedule(80));observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('hashchange',()=>{if(isRoute())refresh(false);});window.addEventListener('pageshow',()=>{if(isRoute())refresh(false);});document.addEventListener('click',event=>{if(event.target.closest('[data-admin-v79-go="students"],a[href="#admin/students"]'))setTimeout(()=>refresh(false),180);},true);if(isRoute())refresh(false);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111=Object.freeze({version:VERSION,refresh});
})();
