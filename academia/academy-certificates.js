(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let clientPromise;
  let rendering = false;
  let adminRendering = false;

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
      sb.from('profiles').select('id,email,full_name,role').eq('id',session.user.id).maybeSingle()
    ]);
    if(!workspace) throw new Error('no_workspace');
    const {data:membership}=await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',session.user.id).maybeSingle();
    const role=membership?.status==='active'?membership.role:profile?.role;
    const {data:courses,error:courseError}=await sb.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at',{ascending:true});
    if(courseError) throw courseError;
    return {sb,cfg,user:session.user,workspace,profile:profile||{},membership,role,courses:courses||[]};
  }

  const fmtDate = value => value ? new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value)) : 'Sin fecha';
  const pct = (a,b) => b>0 ? Math.round((a/b)*100) : 0;

  async function loadStudent(){
    const ctx=await context();
    const {sb,user,courses}=ctx;
    const {data:certs,error:certError}=await sb.from('certificates').select('id,course_id,issued_at,verification_code,recipient_name,requirements_snapshot,revoked_at,revoked_reason').eq('user_id',user.id).order('issued_at',{ascending:false});
    if(certError) throw certError;
    const eligibility=[];
    for(const course of courses){
      const {data,error}=await sb.rpc('get_certificate_eligibility',{target_course:course.id});
      eligibility.push({course_id:course.id,...((!error&&data?.[0])||{total_lessons:0,completed_lessons:0,required_assessments:0,passed_assessments:0,eligible:false})});
    }
    return {...ctx,certs:certs||[],eligibility};
  }

  async function ensureEligibleCertificates(data){
    let issued=false;
    for(const course of data.courses){
      const eligible=data.eligibility.find(e=>e.course_id===course.id)?.eligible;
      const hasHistory=data.certs.some(c=>c.course_id===course.id);
      if(eligible&&!hasHistory){
        const result=await data.sb.rpc('issue_academy_certificate',{target_course:course.id});
        if(!result.error) issued=true;
      }
    }
    return issued;
  }

  function latin1(value=''){
    return String(value).normalize('NFC').replace(/[\u0100-\uFFFF]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  }
  function byteLengthLatin1(value=''){return [...String(value)].length;}
  function centerX(text,size){return Math.max(60,421-(String(text).length*size*.26));}
  function pdfBytes(meta){
    const recipient=latin1(meta.recipient_name||'Alumna');
    const course=latin1(meta.course_title||'Programa académico');
    const date=latin1(fmtDate(meta.issued_at));
    const code=latin1(meta.verification_code||'');
    const verify=latin1(`${location.origin}${location.pathname.replace(/\/[^/]*$/,'/') }verificar.html?codigo=${encodeURIComponent(meta.verification_code||'')}`);
    const content=[
      '0.071 0.247 0.208 rg 0 0 842 595 re f',
      '0.96 0.94 0.87 rg 28 28 786 539 re f',
      '0.071 0.247 0.208 RG 3 w 42 42 758 511 re S',
      '0.72 0.55 0.18 rg 72 500 120 3 re f',
      `BT /F2 16 Tf 0.071 0.247 0.208 rg ${centerX('ACADEMIA YAMILET',16)} 505 Td (ACADEMIA YAMILET) Tj ET`,
      `BT /F1 11 Tf 0.45 0.43 0.37 rg ${centerX('CERTIFICADO DE FINALIZACION',11)} 474 Td (CERTIFICADO DE FINALIZACION) Tj ET`,
      `BT /F1 12 Tf 0.35 0.36 0.33 rg ${centerX('Se otorga el presente certificado a',12)} 420 Td (Se otorga el presente certificado a) Tj ET`,
      `BT /F2 30 Tf 0.071 0.247 0.208 rg ${centerX(recipient,30)} 370 Td (${recipient}) Tj ET`,
      `BT /F1 12 Tf 0.35 0.36 0.33 rg ${centerX('por haber completado satisfactoriamente',12)} 326 Td (por haber completado satisfactoriamente) Tj ET`,
      `BT /F2 23 Tf 0.071 0.247 0.208 rg ${centerX(course,23)} 286 Td (${course}) Tj ET`,
      `BT /F1 11 Tf 0.4 0.4 0.36 rg 120 220 Td (Fecha de emision: ${date}) Tj ET`,
      `BT /F1 11 Tf 0.4 0.4 0.36 rg 120 196 Td (Codigo de verificacion: ${code}) Tj ET`,
      '0.72 0.55 0.18 RG 1 w 120 170 602 0 re S',
      `BT /F1 8 Tf 0.42 0.42 0.39 rg 120 145 Td (Verifica la autenticidad en:) Tj ET`,
      `BT /F1 7 Tf 0.071 0.247 0.208 rg 120 128 Td (${verify}) Tj ET`,
      `BT /F2 10 Tf 0.071 0.247 0.208 rg ${centerX('Yamilet Perez · Metodo MES',10)} 80 Td (Yamilet Perez - Metodo MES) Tj ET`
    ].join('\n');
    const objects=[];
    objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
    objects[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objects[3]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
    objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[5]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objects[6]=`<< /Length ${byteLengthLatin1(content)} >>\nstream\n${content}\nendstream`;
    let body='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets=[0];
    for(let i=1;i<=6;i++){
      offsets[i]=byteLengthLatin1(body);
      body+=`${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xref=byteLengthLatin1(body);
    body+='xref\n0 7\n0000000000 65535 f \n';
    for(let i=1;i<=6;i++) body+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
    body+=`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes=new Uint8Array(body.length);
    for(let i=0;i<body.length;i++) bytes[i]=body.charCodeAt(i)&255;
    return bytes;
  }

  function downloadPdf(meta){
    if(!meta?.verification_code) return;
    const blob=new Blob([pdfBytes(meta)],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Certificado-${String(meta.course_title||'Academia-Yamilet').replace(/[^a-z0-9áéíóúüñ]+/gi,'-').replace(/^-|-$/g,'')}.pdf`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function courseName(data,id){return data.courses.find(c=>c.id===id)?.title||'Academia Yamilet';}

  function certCard(data,cert){
    const title=courseName(data,cert.course_id);
    const revoked=!!cert.revoked_at;
    const meta={recipient_name:cert.recipient_name||data.profile.full_name||'Alumna',course_title:title,issued_at:cert.issued_at,verification_code:cert.verification_code};
    return `<article class="academy-cert-pro-card ${revoked?'revoked':''}" data-cert-id="${esc(cert.id)}">
      <div class="academy-cert-pro-top"><span>${revoked?'CERTIFICADO REVOCADO':'CERTIFICADO OFICIAL'}</span><b>${revoked?'!':'✓'}</b></div>
      <h3>${esc(title)}</h3><p>Emitido a <strong>${esc(meta.recipient_name)}</strong> el ${esc(fmtDate(cert.issued_at))}.</p>
      <div class="academy-cert-pro-code"><span>Código único</span><strong>${esc(cert.verification_code||'')}</strong></div>
      ${revoked?`<div class="academy-cert-revoked-note">Este certificado fue revocado${cert.revoked_reason?`: ${esc(cert.revoked_reason)}`:'.'} La página pública mostrará su estado como revocado.</div>`:''}
      <div class="academy-cert-pro-actions">
        ${!revoked?`<button type="button" data-cert-pdf>Descargar PDF</button>`:''}
        <a href="./verificar.html?codigo=${encodeURIComponent(cert.verification_code||'')}" target="_blank" rel="noopener noreferrer">Verificar</a>
        <button type="button" data-cert-copy>Copiar código</button>
      </div>
    </article>`;
  }

  function eligibilityCard(data,course){
    const e=data.eligibility.find(x=>x.course_id===course.id)||{};
    const lessonPct=pct(e.completed_lessons||0,e.total_lessons||0);
    const passed=(e.required_assessments||0)===0 || (e.passed_assessments||0)>=(e.required_assessments||0);
    const certs=data.certs.filter(c=>c.course_id===course.id);
    const active=certs.find(c=>!c.revoked_at);
    const revoked=certs.find(c=>c.revoked_at);
    return `<article class="academy-cert-eligibility ${e.eligible?'eligible':''}">
      <div><span>${esc(course.title)}</span><h4>${e.eligible?'Requisitos completados':'Camino hacia tu certificado'}</h4></div>
      <div class="academy-cert-meter"><i style="width:${lessonPct}%"></i></div>
      <div class="academy-cert-checks"><span class="${lessonPct>=100?'done':''}">${e.completed_lessons||0}/${e.total_lessons||0} lecciones</span><span class="${passed?'done':''}">${e.passed_assessments||0}/${e.required_assessments||0} evaluaciones</span></div>
      ${e.eligible&&!active&&!revoked?'<button type="button" data-cert-issue>Emitir certificado</button>':''}
      ${revoked&&!active?'<small class="academy-cert-blocked">La reactivación requiere autorización administrativa.</small>':''}
    </article>`;
  }

  function studentMarkup(data){
    const active=data.certs.filter(c=>!c.revoked_at);
    const revoked=data.certs.filter(c=>c.revoked_at);
    const totalLessons=data.eligibility.reduce((s,e)=>s+(e.total_lessons||0),0);
    const completed=data.eligibility.reduce((s,e)=>s+(e.completed_lessons||0),0);
    const progress=pct(completed,totalLessons);
    return `<div class="shell-page-heading"><div><div class="kicker">Reconocimiento de tu proceso</div><h2>Certificados</h2><p>Certificados oficiales emitidos por Academia Yamilet, con PDF y verificación pública.</p></div></div>
      <section class="academy-cert-hero"><div class="academy-cert-hero-copy"><span class="academy-cert-kicker">CERTIFICACIÓN VERIFICABLE</span><h3>Tu logro, respaldado por un código único</h3><p>Cada certificado válido puede descargarse como PDF y verificarse públicamente sin exponer información privada de tu cuenta.</p></div><div class="academy-cert-progress"><div class="academy-cert-ring" style="--cert-progress:${progress*3.6}deg"><div><strong>${progress}%</strong><span>recorrido</span></div></div></div><div class="academy-cert-summary"><article><span>Certificados válidos</span><strong>${active.length}</strong></article><article><span>Programas</span><strong>${data.courses.length}</strong></article></div></section>
      <section class="academy-cert-requirements">${data.courses.map(c=>eligibilityCard(data,c)).join('')}</section>
      ${active.length?`<section class="academy-cert-pro-grid">${active.map(c=>certCard(data,c)).join('')}</section>`:`<div class="academy-cert-empty"><div class="academy-cert-empty-icon">♛</div><div><span class="academy-cert-kicker">ACADEMIA YAMILET</span><h3>Aún no tienes certificados válidos emitidos</h3><p>Cuando completes todas las lecciones y evaluaciones publicadas del programa, el sistema emitirá el certificado automáticamente.</p></div></div>`}
      ${revoked.length?`<section class="academy-cert-history"><div><span class="academy-cert-kicker">HISTORIAL</span><h3>Certificados revocados</h3></div><div class="academy-cert-pro-grid">${revoked.map(c=>certCard(data,c)).join('')}</div></section>`:''}`;
  }

  function bindStudent(page,data){
    $$('[data-cert-pdf]',page).forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.closest('[data-cert-id]')?.dataset.certId;const cert=data.certs.find(c=>c.id===id);if(cert)downloadPdf({recipient_name:cert.recipient_name||data.profile.full_name||'Alumna',course_title:courseName(data,cert.course_id),issued_at:cert.issued_at,verification_code:cert.verification_code});
    }));
    $$('[data-cert-copy]',page).forEach(btn=>btn.addEventListener('click',async()=>{
      const id=btn.closest('[data-cert-id]')?.dataset.certId;const code=data.certs.find(c=>c.id===id)?.verification_code||'';try{await navigator.clipboard.writeText(code);btn.textContent='Código copiado';setTimeout(()=>btn.textContent='Copiar código',1400);}catch{btn.textContent='Copia manualmente';}
    }));
    $$('[data-cert-issue]',page).forEach((btn,index)=>btn.addEventListener('click',async()=>{
      const eligibleCourses=data.courses.filter(c=>data.eligibility.find(e=>e.course_id===c.id)?.eligible&&!data.certs.some(cert=>cert.course_id===c.id));
      const course=eligibleCourses[index];if(!course)return;btn.disabled=true;btn.textContent='Emitiendo…';const {error}=await data.sb.rpc('issue_academy_certificate',{target_course:course.id});if(error){btn.textContent='No fue posible emitir';return;}setTimeout(()=>renderStudent(true),180);
    }));
  }

  async function renderStudent(force=false){
    if(rendering)return false;
    const page=$('[data-shell-page="certificates"]');if(!page||page.classList.contains('hidden'))return false;
    rendering=true;page.classList.add('academy-certificates-page');
    page.innerHTML='<div class="academy-cert-loading"><strong>Cargando certificados…</strong><span>Validando avance, evaluaciones y códigos.</span></div>';
    try{
      let data=await loadStudent();
      if(force===false&&await ensureEligibleCertificates(data)) data=await loadStudent();
      page.innerHTML=studentMarkup(data);bindStudent(page,data);return true;
    }catch(error){console.warn('Academia Yamilet certificados',error);page.innerHTML='<div class="academy-cert-error"><strong>No fue posible consultar certificados</strong><span>El resto de la Academia sigue disponible. Recarga esta sección para volver a intentar.</span></div>';return false;}
    finally{rendering=false;}
  }

  async function loadAdmin(){
    const ctx=await context();
    if(!(['owner','admin'].includes(ctx.role)||ctx.profile.role==='admin')) return {...ctx,allowed:false,certs:[],profiles:[]};
    const ids=ctx.courses.map(c=>c.id);if(!ids.length)return {...ctx,allowed:true,certs:[],profiles:[]};
    const {data:certs,error}=await ctx.sb.from('certificates').select('id,user_id,course_id,issued_at,verification_code,recipient_name,revoked_at,revoked_reason,revoked_by').in('course_id',ids).order('issued_at',{ascending:false});
    if(error)throw error;
    const userIds=[...new Set((certs||[]).map(c=>c.user_id))];
    let profiles=[];if(userIds.length){const result=await ctx.sb.from('profiles').select('id,full_name,email').in('id',userIds);profiles=result.data||[];}
    return {...ctx,allowed:true,certs:certs||[],profiles};
  }
  function adminProfile(data,id){const p=data.profiles.find(x=>x.id===id);return p?.full_name||p?.email||'Alumna';}
  function adminMarkup(data){
    const active=data.certs.filter(c=>!c.revoked_at).length;const revoked=data.certs.length-active;
    return `<section class="cert-admin"><div class="cert-admin-head"><div><span>CONTROL DE CERTIFICADOS</span><h3>Verificación y revocación</h3><p>Administra únicamente certificados reales emitidos. Revocar cambia inmediatamente el estado de la verificación pública.</p></div><div class="cert-admin-stats"><b>${active}<small>válidos</small></b><b>${revoked}<small>revocados</small></b></div></div>
      ${data.certs.length?`<div class="cert-admin-list">${data.certs.map(c=>`<article data-cert-admin-id="${esc(c.id)}" class="${c.revoked_at?'revoked':''}"><div><span>${esc(courseName(data,c.course_id))}</span><strong>${esc(c.recipient_name||adminProfile(data,c.user_id))}</strong><small>${esc(fmtDate(c.issued_at))} · ${esc(c.verification_code||'')}</small>${c.revoked_reason?`<em>${esc(c.revoked_reason)}</em>`:''}</div><div><i>${c.revoked_at?'Revocado':'Válido'}</i><button type="button" data-cert-admin-toggle="${c.revoked_at?'restore':'revoke'}">${c.revoked_at?'Restaurar':'Revocar'}</button></div></article>`).join('')}</div>`:'<div class="cert-admin-empty">Aún no hay certificados emitidos en este workspace.</div>'}</section>`;
  }
  function bindAdmin(host,data){
    $$('[data-cert-admin-toggle]',host).forEach(btn=>btn.addEventListener('click',async()=>{
      const id=btn.closest('[data-cert-admin-id]')?.dataset.certAdminId;const cert=data.certs.find(c=>c.id===id);if(!cert)return;
      const revoke=btn.dataset.certAdminToggle==='revoke';let reason=null;
      if(revoke){reason=window.prompt('Motivo de revocación (opcional):','');if(reason===null)return;if(!window.confirm('¿Revocar este certificado? La verificación pública cambiará a Revocado.'))return;}
      else if(!window.confirm('¿Restaurar este certificado como válido?'))return;
      btn.disabled=true;btn.textContent='Guardando…';
      const {error}=await data.sb.rpc('admin_set_academy_certificate_revoked',{target_certificate:id,target_revoked:revoke,target_reason:reason});
      if(error){btn.disabled=false;btn.textContent='Error';console.warn('Certificado admin',error);return;}
      setTimeout(()=>renderAdmin(true),160);
    }));
  }
  async function renderAdmin(force=false){
    if(adminRendering)return false;const page=$('[data-shell-page="admin"]');if(!page||page.classList.contains('hidden'))return false;
    adminRendering=true;
    try{
      const data=await loadAdmin();if(!data.allowed)return false;
      let host=$('[data-cert-admin-host]',page);if(!host){host=document.createElement('div');host.dataset.certAdminHost='true';page.appendChild(host);}host.innerHTML=adminMarkup(data);bindAdmin(host,data);return true;
    }catch(error){console.warn('Academia Yamilet certificados admin',error);return false;}finally{adminRendering=false;}
  }

  function scheduleStudent(){[180,480,900].forEach(ms=>setTimeout(()=>renderStudent(false),ms));}
  function scheduleAdmin(){[650,1300,2200].forEach(ms=>setTimeout(()=>renderAdmin(false),ms));}
  document.addEventListener('click',e=>{if(e.target.closest('[data-shell-route="certificates"]'))scheduleStudent();if(e.target.closest('[data-shell-route="admin"]'))scheduleAdmin();});
  window.addEventListener('pageshow',()=>{setTimeout(()=>renderStudent(false),500);setTimeout(()=>renderAdmin(false),1800);});
  window.ACADEMIA_YAMILET_CERTIFICATES={render:()=>renderStudent(true),renderAdmin:()=>renderAdmin(true),downloadPdf};
})();