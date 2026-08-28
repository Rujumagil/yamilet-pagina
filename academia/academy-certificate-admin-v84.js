(() => {
  'use strict';
  const VERSION='84.0.0';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let clientPromise=null;
  let cache=null;
  let loading=null;
  let searchTerm='';
  let courseFilter='all';
  let statusFilter='all';
  let previewState=null;
  let studentState=null;

  function isRoute(){
    const parts=String(location.hash||'').replace(/^#/,'').split('/').filter(Boolean);
    return parts[0]==='admin'&&parts[1]==='certificates';
  }
  function ensureStyles(){
    if(document.querySelector('link[data-cert84-style]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='./academy-certificate-admin-v84.css?v=84';link.dataset.cert84Style='true';
    document.head.appendChild(link);
  }
  async function context(){
    if(!clientPromise){
      clientPromise=(async()=>{
        const response=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
        if(!response.ok) throw new Error('config');
        const cfg=await response.json();
        const sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
        return {sb,cfg};
      })();
    }
    const {sb,cfg}=await clientPromise;
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user) throw new Error('no_session');
    const [{data:workspace},{data:profile}]=await Promise.all([
      sb.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug||'yamilet-mes').maybeSingle(),
      sb.from('profiles').select('id,email,full_name,role,status').eq('id',session.user.id).maybeSingle()
    ]);
    if(!workspace) throw new Error('no_workspace');
    const {data:membership}=await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',session.user.id).maybeSingle();
    const role=membership?.status==='active'?membership.role:profile?.role;
    if(!['owner','admin','instructor'].includes(role)&&profile?.role!=='admin') throw new Error('forbidden');
    return {sb,cfg,user:session.user,workspace,profile:profile||{},role};
  }
  async function loadData(force=false){
    if(cache&&!force) return cache;
    if(loading&&!force) return loading;
    loading=(async()=>{
      const ctx=await context();
      const {sb,workspace}=ctx;
      const {data:courses,error:courseError}=await sb.from('courses').select('id,title,status,cover_url').eq('workspace_id',workspace.id).order('created_at');
      if(courseError) throw courseError;
      const {data:roster,error:rosterError}=await sb.rpc('admin_academy_certificate_roster',{target_workspace:workspace.id});
      if(rosterError) throw rosterError;
      const ids=(courses||[]).map(c=>c.id);
      let certs=[];
      if(ids.length){
        const result=await sb.from('certificates').select('id,user_id,course_id,recipient_name,issued_at,verification_code,requirements_snapshot,revoked_at,revoked_reason,revoked_by').in('course_id',ids).order('issued_at',{ascending:false});
        if(!result.error) certs=result.data||[];
      }
      cache={...ctx,courses:courses||[],roster:roster||[],certs};
      return cache;
    })().finally(()=>{loading=null;});
    return loading;
  }
  const fmt=value=>value?new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'Sin fecha';
  const pct=(a,b)=>b>0?Math.round((Number(a||0)/Number(b))*100):0;
  const initials=name=>String(name||'E').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'E';
  const courseName=(data,id)=>data.courses.find(c=>c.id===id)?.title||'Programa';
  const canManage=data=>['owner','admin'].includes(data.role)||data.profile?.role==='admin';
  function certHistory(data,userId,courseId=null){return data.certs.filter(c=>c.user_id===userId&&(!courseId||c.course_id===courseId));}
  function latestCert(data,row){return certHistory(data,row.user_id,row.course_id)[0]||null;}
  function rowState(data,row){
    const cert=latestCert(data,row);
    if(cert) return cert.revoked_at?'revoked':'valid';
    if(!['active','completed'].includes(row.enrollment_status)) return 'inactive';
    return row.eligible?'ready':'progress';
  }
  function overallProgress(row){
    const lessons=pct(row.completed_lessons,row.total_lessons);
    if(Number(row.required_assessments||0)<=0) return lessons;
    const assessments=pct(row.passed_assessments,row.required_assessments);
    return Math.round(lessons*.75+assessments*.25);
  }
  const stateLabel=s=>({valid:'Válido',ready:'Listo para emitir',revoked:'Revocado',progress:'En progreso',inactive:'Acceso inactivo'})[s]||s;
  function filteredRows(data){
    const q=searchTerm.trim().toLowerCase();
    return data.roster.filter(row=>{
      const state=rowState(data,row);
      if(courseFilter!=='all'&&row.course_id!==courseFilter) return false;
      if(statusFilter!=='all'&&state!==statusFilter) return false;
      if(!q) return true;
      return [row.student_name,row.student_email,courseName(data,row.course_id),row.verification_code].some(v=>String(v||'').toLowerCase().includes(q));
    });
  }
  function stat(value,label,copy=''){return `<article><strong>${esc(value)}</strong><span>${esc(label)}</span>${copy?`<small>${esc(copy)}</small>`:''}</article>`;}
  function readyCard(data,row){
    const progress=overallProgress(row);
    return `<article class="cert84-ready-card"><div class="cert84-ready-top"><div class="cert84-person"><span class="cert84-avatar">${esc(initials(row.student_name))}</span><div><strong>${esc(row.student_name||'Estudiante')}</strong><small>${esc(row.student_email||'')}</small></div></div><span class="cert84-badge">Listo</span></div><div><h4>${esc(courseName(data,row.course_id))}</h4><div class="cert84-progress-line"><i style="width:${progress}%"></i></div></div><div class="cert84-checks"><span class="done">${row.completed_lessons}/${row.total_lessons} lecciones</span><span class="done">${row.passed_assessments}/${row.required_assessments} evaluaciones</span></div><div class="cert84-ready-actions"><button type="button" data-cert84-preview-row data-user="${row.user_id}" data-course="${row.course_id}">Vista previa</button>${canManage(data)?`<button type="button" class="primary" data-cert84-issue data-user="${row.user_id}" data-course="${row.course_id}">Emitir certificado →</button>`:'<button type="button" disabled>Requiere administrador</button>'}</div></article>`;
  }
  function directoryRow(data,row){
    const state=rowState(data,row);const progress=overallProgress(row);
    return `<article class="cert84-row"><div class="cert84-person"><span class="cert84-avatar">${esc(initials(row.student_name))}</span><div><strong>${esc(row.student_name||'Estudiante')}</strong><small>${esc(row.student_email||'')}</small></div></div><div class="cert84-course"><strong>${esc(courseName(data,row.course_id))}</strong><small>${esc(row.enrollment_status||'')}</small></div><div class="cert84-progress-cell"><div><span>Avance de certificación</span><b>${progress}%</b></div><div class="cert84-progress-line"><i style="width:${progress}%"></i></div><div><span>${row.completed_lessons}/${row.total_lessons} lecciones</span><span>${row.passed_assessments}/${row.required_assessments} evaluaciones</span></div></div><span class="cert84-state ${state}">${stateLabel(state)}</span><div class="cert84-row-actions">${state!=='progress'&&state!=='inactive'?`<button type="button" data-cert84-preview-row data-user="${row.user_id}" data-course="${row.course_id}">Vista previa</button>`:''}<button type="button" data-cert84-student data-user="${row.user_id}">Expediente</button></div></article>`;
  }
  function baseMarkup(data){
    const rows=filteredRows(data);const valid=data.certs.filter(c=>!c.revoked_at);const revoked=data.certs.filter(c=>c.revoked_at);
    const ready=data.roster.filter(r=>rowState(data,r)==='ready');
    const certified=new Set(valid.map(c=>c.user_id)).size;
    return `<section class="cert84" data-cert84-root data-cert84-version="${VERSION}"><header class="cert84-head"><div><span>CERTIFICACIÓN</span><h2>Centro de certificados</h2><p>Controla elegibilidad, emisión, vista previa, PDF, verificación pública, revocación e historial por estudiante.</p></div><div class="cert84-head-actions"><button type="button" data-cert84-refresh>Actualizar</button><a class="primary" href="./verificar.html" target="_blank" rel="noopener">Abrir verificador ↗</a></div></header><section class="cert84-stats">${stat(valid.length,'Certificados válidos',`${certified} personas`)}${stat(ready.length,'Listos para emitir','cumplen requisitos')}${stat(revoked.length,'Revocados','historial protegido')}${stat(data.roster.length,'Inscripciones','con seguimiento')}</section><section class="cert84-automation"><i>✓</i><div><span>EMISIÓN AUTOMÁTICA ACTIVA</span><h3>El certificado se genera al completar todos los requisitos</h3><p>La última lección y las evaluaciones requeridas disparan la validación. Un certificado revocado no se vuelve a emitir automáticamente.</p></div><b>v84 protegida</b></section>${ready.length?`<section class="cert84-ready"><div class="cert84-section-head"><div><span>ACCIÓN PRIORITARIA</span><h3>Listos para certificar</h3><p>Personas elegibles que todavía no tienen historial de certificado.</p></div><b>${ready.length}</b></div><div class="cert84-ready-grid">${ready.map(r=>readyCard(data,r)).join('')}</div></section>`:''}<section class="cert84-directory"><div class="cert84-section-head"><div><span>DIRECTORIO</span><h3>Seguimiento de certificación</h3><p>Una fila por estudiante y programa.</p></div><b>${rows.length} resultado${rows.length===1?'':'s'}</b></div><div class="cert84-toolbar"><input type="search" data-cert84-search value="${esc(searchTerm)}" placeholder="Buscar estudiante, correo o código"><select data-cert84-course><option value="all">Todos los programas</option>${data.courses.map(c=>`<option value="${c.id}" ${courseFilter===c.id?'selected':''}>${esc(c.title)}</option>`).join('')}</select><select data-cert84-status><option value="all">Todos los estados</option>${['ready','valid','progress','revoked','inactive'].map(s=>`<option value="${s}" ${statusFilter===s?'selected':''}>${stateLabel(s)}</option>`).join('')}</select></div><div class="cert84-list">${rows.length?rows.map(r=>directoryRow(data,r)).join(''):'<div class="cert84-empty"><strong>Sin resultados</strong>Prueba con otro filtro o término de búsqueda.</div>'}</div></section>${overlayMarkup(data)}</section>`;
  }
  function certificateVisual(data,row,cert){
    const status=cert?(cert.revoked_at?'revoked':'valid'):'ready';
    const recipient=cert?.recipient_name||row.student_name||'Estudiante';
    const code=cert?.verification_code||'Se generará al emitir';
    return `<div class="cert84-certificate"><img class="cert84-cert-logo" src="../assets/logo-yamilet.png" alt="Academia Yamilet"><span>Academia Yamilet</span><p>Certificado de finalización</p><h2>${esc(recipient)}</h2><p>por haber completado satisfactoriamente</p><h3>${esc(courseName(data,row.course_id))}</h3><div class="cert84-cert-meta"><div><span>Fecha de emisión</span><strong>${cert?esc(fmt(cert.issued_at)):'Pendiente de emisión'}</strong></div><div><span>Código de verificación</span><strong>${esc(code)}</strong></div></div>${status==='revoked'?'<div class="cert84-revoked-stamp">Revocado</div>':''}</div>`;
  }
  function previewMarkup(data,row,cert){
    if(!row) return '';
    const state=cert?(cert.revoked_at?'revoked':'valid'):rowState(data,row);
    return `<div class="cert84-preview-layout">${certificateVisual(data,row,cert)}<aside class="cert84-preview-card"><span>${state==='ready'?'VISTA PREVIA ANTES DE EMITIR':'CERTIFICADO'}</span><h3>${esc(row.student_name||'Estudiante')}</h3><p>${esc(courseName(data,row.course_id))}</p><dl><div><dt>Estado</dt><dd>${stateLabel(state)}</dd></div><div><dt>Lecciones</dt><dd>${row.completed_lessons}/${row.total_lessons}</dd></div><div><dt>Evaluaciones</dt><dd>${row.passed_assessments}/${row.required_assessments}</dd></div>${cert?`<div><dt>Emitido</dt><dd>${esc(fmt(cert.issued_at))}</dd></div><div><dt>Código</dt><dd>${esc(cert.verification_code||'—')}</dd></div>`:''}</dl>${cert?.revoked_reason?`<p><strong>Motivo de revocación:</strong> ${esc(cert.revoked_reason)}</p>`:''}<div class="cert84-preview-actions">${!cert&&state==='ready'&&canManage(data)?`<button type="button" class="primary" data-cert84-issue data-user="${row.user_id}" data-course="${row.course_id}">Emitir certificado →</button>`:''}${cert&&!cert.revoked_at?`<button type="button" class="primary" data-cert84-pdf data-cert="${cert.id}">Descargar PDF</button><a href="./verificar.html?codigo=${encodeURIComponent(cert.verification_code||'')}" target="_blank" rel="noopener">Verificar públicamente ↗</a><button type="button" data-cert84-copy data-code="${esc(cert.verification_code||'')}">Copiar código</button>${canManage(data)?`<button type="button" class="cert84-danger" data-cert84-revoke data-cert="${cert.id}">Revocar certificado</button>`:''}`:''}${cert?.revoked_at?`<a href="./verificar.html?codigo=${encodeURIComponent(cert.verification_code||'')}" target="_blank" rel="noopener">Ver estado público ↗</a>${canManage(data)?`<button type="button" class="primary" data-cert84-restore data-cert="${cert.id}">Restaurar certificado</button>`:''}`:''}<button type="button" data-cert84-student data-user="${row.user_id}">Ver expediente</button></div></aside></div>`;
  }
  function studentDrawer(data,userId){
    const rows=data.roster.filter(r=>r.user_id===userId);if(!rows.length) return '';
    const name=rows[0].student_name||'Estudiante',email=rows[0].student_email||'';const history=certHistory(data,userId);
    return `<div class="cert84-drawer"><div class="cert84-drawer-head"><div><span>EXPEDIENTE DE CERTIFICACIÓN</span><h2>${esc(name)}</h2><p>${esc(email)}</p></div><b>${rows.length} programa${rows.length===1?'':'s'}</b></div><div class="cert84-drawer-grid"><section class="cert84-drawer-section"><h3>Programas y requisitos</h3><div class="cert84-program-list">${rows.map(row=>{const state=rowState(data,row),progress=overallProgress(row);return `<article class="cert84-program-item"><div><strong>${esc(courseName(data,row.course_id))}</strong><span class="cert84-state ${state}">${stateLabel(state)}</span></div><div class="cert84-progress-line"><i style="width:${progress}%"></i></div><small>${progress}% · ${row.completed_lessons}/${row.total_lessons} lecciones · ${row.passed_assessments}/${row.required_assessments} evaluaciones</small></article>`;}).join('')}</div></section><section class="cert84-drawer-section"><h3>Historial de certificados</h3><div class="cert84-history-list">${history.length?history.map(cert=>`<article class="cert84-history-item"><div><strong>${esc(courseName(data,cert.course_id))}</strong><span class="cert84-state ${cert.revoked_at?'revoked':'valid'}">${cert.revoked_at?'Revocado':'Válido'}</span></div><small>${esc(fmt(cert.issued_at))} · ${esc(cert.verification_code||'')}</small><button type="button" data-cert84-preview-cert data-cert="${cert.id}">Vista previa →</button></article>`).join(''):'<div class="cert84-empty">No hay certificados emitidos.</div>'}</div></section></div></div>`;
  }
  function overlayMarkup(data){
    if(previewState){
      let cert=null,row=null;
      if(previewState.certId){cert=data.certs.find(c=>c.id===previewState.certId)||null;if(cert) row=data.roster.find(r=>r.user_id===cert.user_id&&r.course_id===cert.course_id)||null;}
      else {row=data.roster.find(r=>r.user_id===previewState.userId&&r.course_id===previewState.courseId)||null;cert=row?latestCert(data,row):null;}
      return `<div class="cert84-overlay" data-cert84-overlay><div class="cert84-modal"><button type="button" class="cert84-modal-close" data-cert84-close>×</button>${previewMarkup(data,row,cert)}</div></div>`;
    }
    if(studentState) return `<div class="cert84-overlay" data-cert84-overlay><div class="cert84-modal"><button type="button" class="cert84-modal-close" data-cert84-close>×</button>${studentDrawer(data,studentState)}</div></div>`;
    return '';
  }
  function ensureHost(){
    const page=$('[data-shell-page="admin"]');if(!page||page.classList.contains('hidden')) return null;
    const module=$('[data-admin-v79-module]',page);if(!module) return null;
    let host=$('[data-cert84-host]',module);
    if(!host){module.innerHTML='';host=document.createElement('div');host.dataset.cert84Host='true';module.appendChild(host);}
    return host;
  }
  function paint(data){
    if(!isRoute()) return false;const host=ensureHost();if(!host) return false;
    host.innerHTML=baseMarkup(data);bind(host,data);return true;
  }
  function refocus(pos){setTimeout(()=>{const input=$('[data-cert84-search]');if(input&&isRoute()){input.focus({preventScroll:true});if(Number.isInteger(pos)&&input.setSelectionRange)input.setSelectionRange(pos,pos);}},0);}
  function bind(host,data){
    $('[data-cert84-refresh]',host)?.addEventListener('click',()=>render(true));
    $('[data-cert84-search]',host)?.addEventListener('input',event=>{searchTerm=event.target.value;const pos=event.target.selectionStart;paint(data);refocus(pos);});
    $('[data-cert84-course]',host)?.addEventListener('change',event=>{courseFilter=event.target.value;paint(data);});
    $('[data-cert84-status]',host)?.addEventListener('change',event=>{statusFilter=event.target.value;paint(data);});
    $$('[data-cert84-preview-row]',host).forEach(btn=>btn.addEventListener('click',()=>{studentState=null;previewState={userId:btn.dataset.user,courseId:btn.dataset.course};paint(data);}));
    $$('[data-cert84-preview-cert]',host).forEach(btn=>btn.addEventListener('click',()=>{studentState=null;previewState={certId:btn.dataset.cert};paint(data);}));
    $$('[data-cert84-student]',host).forEach(btn=>btn.addEventListener('click',()=>{previewState=null;studentState=btn.dataset.user;paint(data);}));
    $$('[data-cert84-close]',host).forEach(btn=>btn.addEventListener('click',()=>{previewState=null;studentState=null;paint(data);}));
    $$('[data-cert84-issue]',host).forEach(btn=>btn.addEventListener('click',()=>issueCertificate(btn,data)));
    $$('[data-cert84-revoke]',host).forEach(btn=>btn.addEventListener('click',()=>toggleRevocation(btn,data,true)));
    $$('[data-cert84-restore]',host).forEach(btn=>btn.addEventListener('click',()=>toggleRevocation(btn,data,false)));
    $$('[data-cert84-pdf]',host).forEach(btn=>btn.addEventListener('click',()=>downloadCertificate(data,btn.dataset.cert)));
    $$('[data-cert84-copy]',host).forEach(btn=>btn.addEventListener('click',()=>copyCode(btn)));
  }
  async function issueCertificate(button,data){
    const row=data.roster.find(r=>r.user_id===button.dataset.user&&r.course_id===button.dataset.course);if(!row||!row.eligible) return;
    if(!confirm(`¿Emitir el certificado de ${courseName(data,row.course_id)} para ${row.student_name||'este estudiante'}?`)) return;
    button.disabled=true;button.textContent='Emitiendo…';
    const {error}=await data.sb.rpc('admin_issue_academy_certificate',{target_user:row.user_id,target_course:row.course_id});
    if(error){button.disabled=false;button.textContent='No fue posible emitir';console.warn('Certificado v84',error);return;}
    previewState=null;studentState=null;cache=null;await render(true);
  }
  async function toggleRevocation(button,data,revoke){
    const cert=data.certs.find(c=>c.id===button.dataset.cert);if(!cert) return;let reason=null;
    if(revoke){reason=prompt('Motivo de revocación (opcional):','');if(reason===null)return;if(!confirm('¿Revocar este certificado? La verificación pública mostrará el estado Revocado.'))return;}
    else if(!confirm('¿Restaurar este certificado como válido?')) return;
    button.disabled=true;button.textContent='Guardando…';
    const {error}=await data.sb.rpc('admin_set_academy_certificate_revoked',{target_certificate:cert.id,target_revoked:revoke,target_reason:reason});
    if(error){button.disabled=false;button.textContent='Error';console.warn('Certificado v84',error);return;}
    previewState=null;studentState=null;cache=null;await render(true);
  }
  function downloadCertificate(data,certId){
    const cert=data.certs.find(c=>c.id===certId);if(!cert||cert.revoked_at)return;
    const meta={recipient_name:cert.recipient_name||data.roster.find(r=>r.user_id===cert.user_id)?.student_name||'Estudiante',course_title:courseName(data,cert.course_id),issued_at:cert.issued_at,verification_code:cert.verification_code};
    if(window.ACADEMIA_YAMILET_CERTIFICATES?.downloadPdf) window.ACADEMIA_YAMILET_CERTIFICATES.downloadPdf(meta);
  }
  async function copyCode(button){
    const code=button.dataset.code||'';if(!code)return;try{await navigator.clipboard.writeText(code);const old=button.textContent;button.textContent='Código copiado';setTimeout(()=>button.textContent=old,1300);}catch{button.textContent='Copia manualmente';}
  }
  async function render(force=false){
    if(!isRoute()) return false;ensureStyles();const host=ensureHost();if(!host)return false;
    if(force) cache=null;
    host.innerHTML='<div class="cert84-empty"><strong>Preparando certificación…</strong>Consultando requisitos, certificados y permisos.</div>';
    try{const data=await loadData(force);if(!isRoute())return false;return paint(data);}catch(error){console.error('Academia Yamilet certificate admin v84',error);host.innerHTML=`<div class="cert84-empty"><strong>${error?.message==='forbidden'?'Acceso restringido':'No fue posible cargar Certificados'}</strong>${error?.message==='forbidden'?'Esta herramienta requiere acceso académico autorizado.':'Revisa tu sesión e intenta nuevamente.'}</div>`;return false;}
  }
  function start(){
    ensureStyles();
    window.addEventListener('hashchange',()=>setTimeout(()=>render(false),110));
    window.addEventListener('pageshow',()=>setTimeout(()=>render(false),220));
    document.addEventListener('click',event=>{if(event.target.closest('[data-admin-v79-go="certificates"],a[href="#admin/certificates"]'))setTimeout(()=>render(false),180);},true);
    if(isRoute()) setTimeout(()=>render(false),140);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_CERTIFICATE_ADMIN_V84={version:VERSION,render};
})();