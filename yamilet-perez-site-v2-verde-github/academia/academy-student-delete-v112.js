(() => {
  'use strict';

  const VERSION = '112.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let sb = null;
  let workspace = null;
  let actor = null;
  let canManage = false;
  let checking = new Map();
  let lastRecordUser = '';
  let timer = null;

  const isStudentsRoute = () => {
    const p = String(location.hash || '').replace(/^#/,'').split('/').filter(Boolean);
    return p[0] === 'admin' && p[1] === 'students';
  };

  async function context(){
    if(sb && workspace && actor) return {sb,workspace,actor,canManage};
    const response = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error('config_unavailable');
    const cfg = await response.json();
    sb = window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data:{session}} = await sb.auth.getSession();
    actor = session?.user || null;
    if(!actor) throw new Error('session_required');
    const [{data:ws},{data:profile}] = await Promise.all([
      sb.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug||'yamilet-mes').maybeSingle(),
      sb.from('profiles').select('role').eq('id',actor.id).maybeSingle()
    ]);
    if(!ws) throw new Error('workspace_not_found');
    workspace = ws;
    const {data:member} = await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',actor.id).maybeSingle();
    canManage = profile?.role === 'admin' || (member?.status === 'active' && ['owner','admin'].includes(member.role));
    return {sb,workspace,actor,canManage};
  }

  async function targetState(userId){
    if(checking.has(userId)) return checking.get(userId);
    const promise = (async()=>{
      const {sb,workspace,actor,canManage} = await context();
      if(!canManage) return {allowed:false,protected:true,reason:'Sin permisos administrativos'};
      if(userId === actor.id) return {allowed:false,protected:true,reason:'Tu propia cuenta está protegida'};
      const [{data:profile},{data:member}] = await Promise.all([
        sb.from('profiles').select('role,full_name,email').eq('id',userId).maybeSingle(),
        sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',userId).maybeSingle()
      ]);
      const protectedRole = profile?.role === 'admin' || (member?.status === 'active' && ['owner','admin','instructor'].includes(member.role));
      return {allowed:!protectedRole,protected:protectedRole,reason:protectedRole?'Cuenta de equipo protegida':'',profile:profile||{}};
    })().finally(()=>checking.delete(userId));
    checking.set(userId,promise);
    return promise;
  }

  function selectedStudentId(){
    return $('.students81-row.selected[data-students81-open]')?.dataset.students81Open || '';
  }

  function statusMessage(text,type=''){
    let node = $('[data-student-delete-global-status]');
    if(!node){
      node = document.createElement('div');
      node.dataset.studentDeleteGlobalStatus='true';
      node.className='student112-toast';
      document.body.appendChild(node);
    }
    node.className = `student112-toast ${type}`;
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(node._hideTimer);
    node._hideTimer = setTimeout(()=>node.classList.remove('show'),4200);
  }

  async function removeFromAcademy(userId,button){
    if(!confirm('¿Quitar a esta persona de Academia Yamilet?\n\nSe eliminarán sus inscripciones y accesos de esta Academia, pero su cuenta seguirá existiendo.')) return;
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'Quitando acceso…';
    try{
      const {sb,workspace} = await context();
      const {error} = await sb.rpc('remove_academy_student_from_workspace',{target_workspace:workspace.id,target_user:userId});
      if(error) throw error;
      statusMessage('La persona fue retirada de Academia Yamilet.','ok');
      $('[data-close-record]')?.click();
      await window.ACADEMIA_YAMILET_STUDENTS?.refresh?.();
      await window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111?.refresh?.(false);
    }catch(error){
      console.warn('Academia Yamilet remove student',error);
      statusMessage(String(error?.message||'').includes('protected_user')?'Esta cuenta está protegida y no puede retirarse.':'No fue posible quitar el acceso.','error');
      button.disabled = false;
      button.textContent = old;
    }
  }

  function deletionModal(userId,label,onDone){
    $('[data-student112-modal]')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'student112-overlay';
    wrap.dataset.student112Modal='true';
    wrap.innerHTML = `<section class="student112-modal" role="dialog" aria-modal="true" aria-labelledby="student112-title">
      <button type="button" class="student112-close" data-student112-close aria-label="Cerrar">×</button>
      <span>ACCIÓN IRREVERSIBLE</span>
      <h3 id="student112-title">Eliminar usuario definitivamente</h3>
      <p>Se eliminará la cuenta de <strong>${esc(label||'esta persona')}</strong>, junto con su progreso, evaluaciones, certificados y datos académicos asociados. Esta acción no se puede deshacer.</p>
      <label>Para confirmar escribe <b>ELIMINAR</b><input type="text" autocomplete="off" data-student112-confirm placeholder="ELIMINAR"></label>
      <div class="student112-modal-actions"><button type="button" data-student112-cancel>Cancelar</button><button type="button" class="danger" data-student112-delete disabled>Eliminar definitivamente</button></div>
      <small data-student112-error></small>
    </section>`;
    document.body.appendChild(wrap);
    const input = $('[data-student112-confirm]',wrap);
    const del = $('[data-student112-delete]',wrap);
    const err = $('[data-student112-error]',wrap);
    const close = () => wrap.remove();
    $('[data-student112-close]',wrap)?.addEventListener('click',close);
    $('[data-student112-cancel]',wrap)?.addEventListener('click',close);
    wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
    input?.addEventListener('input',()=>{del.disabled = input.value.trim().toUpperCase() !== 'ELIMINAR';});
    del?.addEventListener('click',async()=>{
      if(del.disabled) return;
      del.disabled=true; del.textContent='Eliminando…'; if(err) err.textContent='';
      try{
        const {sb} = await context();
        const {data,error} = await sb.functions.invoke('delete-yamilet-student',{body:{user_id:userId}});
        if(error || !data?.ok){
          const code = data?.error || '';
          if(code === 'shared_account') throw new Error('shared_account');
          if(code === 'protected_user') throw new Error('protected_user');
          throw error || new Error(code || 'delete_failed');
        }
        close();
        statusMessage('Usuario eliminado definitivamente.','ok');
        await onDone?.();
      }catch(error){
        console.warn('Academia Yamilet permanent delete',error);
        const raw = String(error?.message||error||'');
        if(err) err.textContent = raw.includes('shared_account') ? 'Esta cuenta también se usa fuera de Academia Yamilet. Solo puedes quitar su acceso a Yamilet.' : raw.includes('protected_user') ? 'Esta cuenta pertenece al equipo y está protegida.' : 'No fue posible eliminar la cuenta. Intenta nuevamente.';
        del.disabled=false; del.textContent='Eliminar definitivamente';
      }
    });
    setTimeout(()=>input?.focus(),60);
  }

  async function mountRecord(){
    if(!isStudentsRoute()) return;
    const side = $('.students81-record:not(.hidden) .students81-record-side');
    const userId = selectedStudentId();
    if(!side || !userId) return;
    if(lastRecordUser === userId && $('[data-student112-danger]',side)) return;
    lastRecordUser = userId;
    $('[data-student112-danger]',side)?.remove();
    try{
      const state = await targetState(userId);
      const panel = document.createElement('article');
      panel.className = `student112-danger ${state.allowed?'':'protected'}`;
      panel.dataset.student112Danger='true';
      if(!state.allowed){
        panel.innerHTML = `<span>SEGURIDAD</span><h4>Cuenta protegida</h4><p>${esc(state.reason||'Esta cuenta no puede eliminarse desde el panel de estudiantes.')}</p>`;
      }else{
        const label = state.profile?.full_name || state.profile?.email || 'esta alumna';
        panel.innerHTML = `<span>ZONA DE ADMINISTRACIÓN</span><h4>Eliminar o retirar alumna</h4><p>Quita solo el acceso a esta Academia o elimina por completo la cuenta de usuario.</p><button type="button" data-student112-remove>Quitar de Academia</button><button type="button" class="danger" data-student112-permanent>Eliminar cuenta definitivamente</button>`;
        $('[data-student112-remove]',panel)?.addEventListener('click',e=>removeFromAcademy(userId,e.currentTarget));
        $('[data-student112-permanent]',panel)?.addEventListener('click',()=>deletionModal(userId,label,async()=>{
          $('[data-close-record]')?.click();
          await window.ACADEMIA_YAMILET_STUDENTS?.refresh?.();
          await window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111?.refresh?.(false);
        }));
      }
      side.appendChild(panel);
    }catch(error){console.warn('Academia Yamilet deletion controls',error);}
  }

  async function mountPending(){
    if(!isStudentsRoute()) return;
    const {canManage} = await context().catch(()=>({canManage:false}));
    if(!canManage) return;
    for(const card of $$('.pending110-card[data-pending-user]')){
      if(card.dataset.studentDeleteV112==='true') continue;
      card.dataset.studentDeleteV112='true';
      const userId = card.dataset.pendingUser;
      const action = $('.pending110-action',card);
      if(!userId || !action) continue;
      const button = document.createElement('button');
      button.type='button';
      button.className='student112-pending-delete';
      button.textContent='Eliminar registro';
      button.addEventListener('click',()=>{
        const label = $('.pending110-person strong',card)?.textContent || $('.pending110-person span',card)?.textContent || 'este registro';
        deletionModal(userId,label,async()=>{
          await window.ACADEMIA_YAMILET_PENDING_REGISTRATIONS_V111?.refresh?.(false);
          await window.ACADEMIA_YAMILET_STUDENTS?.refresh?.();
        });
      });
      action.appendChild(button);
    }
  }

  function schedule(delay=80){
    clearTimeout(timer);
    timer=setTimeout(()=>{if(!isStudentsRoute())return;mountRecord();mountPending();},delay);
  }

  function start(){
    const observer = new MutationObserver(()=>schedule(60));
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('hashchange',()=>schedule(120));
    document.addEventListener('click',e=>{if(e.target.closest('[data-students81-open],[data-students81-open-button],a[href="#admin/students"],[data-admin-v79-go="students"]')) schedule(180);},true);
    schedule(200);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.ACADEMIA_YAMILET_STUDENT_DELETE_V112 = Object.freeze({version:VERSION,mount:()=>schedule(0)});
})();
