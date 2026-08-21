(() => {
  'use strict';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const dashboard = document.querySelector('[data-dashboard]');
  if (!dashboard) return;
  let sb = null;
  let workspace = null;
  let profile = null;
  let membership = null;
  let user = null;
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
  const isStaff = () => profile?.role === 'admin' || ['owner','admin','instructor'].includes(membership?.role);
  const initials = () => (profile?.full_name || user?.email || 'YA').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('');

  async function initClient(){
    const res = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error('config_unavailable');
    const cfg = await res.json();
    sb = window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data:{session}} = await sb.auth.getSession();
    user = session?.user || null;
    if(!user) return false;
    const [{data:p},{data:ws}] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,status').eq('id',user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
    ]);
    profile = p || null; workspace = ws || null;
    if(!workspace) return false;
    const {data:m} = await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',user.id).maybeSingle();
    membership = m?.status === 'active' ? m : null;
    return true;
  }

  function deny(){
    dashboard.classList.add('hidden');
    const auth = $('[data-auth-view]');
    const denied = $('[data-denied-view]');
    auth?.classList.add('hidden');
    denied?.classList.remove('hidden');
    const title = denied?.querySelector('h2');
    const copy = denied?.querySelector('.muted');
    if(title) title.textContent = 'Acceso restringido';
    if(copy) copy.textContent = 'Esta ruta es exclusiva para el equipo de Academia Yamilet. Tu acceso de alumna continúa disponible en la Academia.';
    const back = denied?.querySelector('[data-denied-signout]');
    if(back){back.textContent='Volver a la Academia'; back.onclick=()=>{window.location.href='../';};}
  }

  async function loadMetrics(){
    const [courses, enrollments, bookings] = await Promise.all([
      sb.from('courses').select('id,status').eq('workspace_id',workspace.id),
      sb.from('enrollments').select('id,status,course_id').in('status',['active','completed']),
      sb.from('free_class_bookings').select('id,status').eq('workspace_id',workspace.id)
    ]);
    const courseRows = courses.data || [];
    const enrollmentRows = enrollments.data || [];
    const bookingRows = bookings.data || [];
    $('[data-admin-course-count]') && ($('[data-admin-course-count]').textContent = courseRows.length);
    $('[data-admin-published-count]') && ($('[data-admin-published-count]').textContent = courseRows.filter(x=>x.status==='published').length);
    $('[data-admin-student-count]') && ($('[data-admin-student-count]').textContent = enrollmentRows.filter(x=>x.status==='active').length);
    $('[data-admin-booking-count]') && ($('[data-admin-booking-count]').textContent = bookingRows.filter(x=>x.status==='requested').length);
  }

  function setRoute(name){
    dashboard.dataset.adminRoute = name;
    $$('[data-admin-route-btn]').forEach(btn=>btn.classList.toggle('active',btn.dataset.adminRouteBtn===name));
    const title = $('[data-admin-breadcrumb]');
    if(title) title.textContent = ({overview:'Resumen',content:'Contenido',students:'Alumnas',bookings:'Reservas'})[name] || 'Administración';
    if(name==='content'){
      $('[data-content-admin-nav]')?.click();
      $('[data-content-admin]')?.classList.remove('hidden');
    }
    if(name==='students'){
      $('[data-students-admin-nav]')?.click();
      $('[data-students-admin]')?.classList.remove('hidden');
    }
    if(name==='bookings'){
      $('#reservas')?.classList.remove('hidden');
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function wire(){
    $$('[data-admin-route-btn]').forEach(btn=>btn.addEventListener('click',()=>setRoute(btn.dataset.adminRouteBtn)));
    $$('[data-admin-launch]').forEach(card=>card.addEventListener('click',()=>setRoute(card.dataset.adminLaunch)));
    const name = profile?.full_name || user?.email || 'Equipo Yamilet';
    $('[data-admin-name]') && ($('[data-admin-name]').textContent = name);
    $('[data-admin-role]') && ($('[data-admin-role]').textContent = membership?.role || profile?.role || 'staff');
    $('[data-admin-avatar]') && ($('[data-admin-avatar]').textContent = initials());
  }

  async function boot(){
    try{
      const ok = await initClient();
      if(!ok) return;
      if(!isStaff()){deny();return;}
      wire();
      setRoute('overview');
      await loadMetrics();
      setTimeout(()=>setRoute(dashboard.dataset.adminRoute || 'overview'),500);
    }catch(error){
      console.error('Academia Yamilet admin v34',error);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
