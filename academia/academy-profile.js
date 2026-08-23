(() => {
  'use strict';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  let clientPromise = null;

  async function getClient(){
    if(!clientPromise){
      clientPromise=(async()=>{
        const response=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
        if(!response.ok) throw new Error('config');
        const cfg=await response.json();
        return window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      })();
    }
    return clientPromise;
  }

  function readMetric(selector,fallback='0'){
    return ($(selector)?.textContent || fallback).trim() || fallback;
  }

  function currentLanguage(){
    return $('[data-academy-lang][aria-pressed="true"]')?.dataset.academyLang || 'es';
  }

  function languageLabel(lang){ return lang === 'it' ? 'Italiano' : 'Español'; }

  async function profileContext(){
    try{
      const sb=await getClient();
      const {data:{session}}=await sb.auth.getSession();
      if(!session?.user) return null;
      const {data:profile}=await sb.from('profiles').select('email,full_name,avatar_url,role,status,created_at').eq('id',session.user.id).maybeSingle();
      return {sb,user:session.user,profile:profile||{}};
    }catch(error){
      console.warn('Academia Yamilet profile context',error);
      return null;
    }
  }

  function buildHero(page,ctx){
    if($('.academy-profile-hero',page)) return;
    const shell=$('.profile-shell',page);
    if(!shell) return;
    const profile=ctx?.profile||{};
    const name=profile.full_name || $('.profile-identity h3',page)?.textContent.trim() || 'Alumna';
    const status=(profile.status||'active').toLowerCase();
    const courses=readMetric('[data-course-count]','0');
    const progress=readMetric('[data-overall-progress]','0%');
    const lang=languageLabel(currentLanguage());
    const hero=document.createElement('section');
    hero.className='academy-profile-hero';
    hero.innerHTML=`<div class="academy-profile-welcome"><span class="academy-profile-kicker">PERFIL ACADÉMICO</span><h3>${escapeHtml(name)}</h3><p>Administra tu identidad dentro de Academia Yamilet, revisa tu estado académico y configura las opciones básicas de tu cuenta.</p><div class="academy-profile-account"><span class="${status==='active'?'good':''}">${status==='active'?'Cuenta activa':escapeHtml(status)}</span><span>${escapeHtml(lang)}</span></div></div><div class="academy-profile-summary"><article><span>Programas</span><strong>${escapeHtml(courses)}</strong><small>disponibles en tu cuenta</small></article><article><span>Progreso</span><strong>${escapeHtml(progress)}</strong><small>avance general guardado</small></article><article><span>Idioma</span><strong>${lang==='Italiano'?'IT':'ES'}</strong><small>${escapeHtml(lang)}</small></article><article><span>Estado</span><strong>${status==='active'?'✓':'—'}</strong><small>${status==='active'?'acceso activo':'revisar cuenta'}</small></article></div>`;
    shell.insertAdjacentElement('beforebegin',hero);
  }

  function buildSettings(page,ctx){
    if($('.academy-profile-settings',page)) return;
    const shell=$('.profile-shell',page);
    if(!shell) return;
    const email=ctx?.profile?.email || ctx?.user?.email || $('.profile-form input[disabled]',page)?.value || '';
    const lang=currentLanguage();
    const settings=document.createElement('section');
    settings.className='academy-profile-settings';
    settings.innerHTML=`<article class="academy-profile-setting"><div class="academy-profile-setting-head"><div class="academy-profile-setting-icon">文</div><div><span class="academy-profile-kicker">PREFERENCIAS</span><h3>Idioma de la Academia</h3><p>Selecciona el idioma de navegación. El cambio usa el sistema ES/IT que ya tiene Academia Yamilet.</p></div></div><div class="academy-profile-setting-actions" data-profile-languages><button type="button" data-profile-lang="es" class="${lang==='es'?'active':''}">Español</button><button type="button" data-profile-lang="it" class="${lang==='it'?'active':''}">Italiano</button></div></article><article class="academy-profile-setting"><div class="academy-profile-setting-head"><div class="academy-profile-setting-icon">⌁</div><div><span class="academy-profile-kicker">SEGURIDAD</span><h3>Acceso y contraseña</h3><p>Tu correo de acceso es <strong>${escapeHtml(email)}</strong>. Puedes solicitar un enlace seguro para cambiar tu contraseña.</p></div></div><div class="academy-profile-setting-actions"><button class="primary" type="button" data-profile-password>Cambiar contraseña</button></div><div class="academy-profile-security-status" data-profile-security-status aria-live="polite"></div></article>`;
    shell.insertAdjacentElement('afterend',settings);
    $$('[data-profile-lang]',settings).forEach(btn=>btn.addEventListener('click',()=>{
      const target=$(`[data-academy-lang="${btn.dataset.profileLang}"]`);
      target?.click();
      $$('[data-profile-lang]',settings).forEach(item=>item.classList.toggle('active',item===btn));
    }));
    $('[data-profile-password]',settings)?.addEventListener('click',()=>requestPasswordReset(settings,email));
  }

  async function requestPasswordReset(root,email){
    const button=$('[data-profile-password]',root);
    const status=$('[data-profile-security-status]',root);
    if(!email){ if(status){status.textContent='No encontramos un correo válido en tu cuenta.';status.className='academy-profile-security-status error';} return; }
    if(button) button.disabled=true;
    if(status){status.textContent='Enviando correo seguro…';status.className='academy-profile-security-status';}
    try{
      const sb=await getClient();
      const url=new URL(window.location.href); url.hash=''; url.search='?recovery=1';
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:url.href});
      if(error) throw error;
      if(status){status.textContent='Correo enviado. Revisa tu bandeja y abre el enlace para crear una nueva contraseña.';status.className='academy-profile-security-status ok';}
    }catch(error){
      console.error('Academia Yamilet profile recovery',error);
      if(status){status.textContent='No fue posible enviar el correo. Intenta nuevamente.';status.className='academy-profile-security-status error';}
    }finally{ if(button) button.disabled=false; }
  }

  function escapeHtml(value=''){
    return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function enhanceProfile(){
    const page=$('[data-shell-page="profile"]');
    if(!page || page.classList.contains('hidden') || !$('.profile-shell',page)) return false;
    if(page.dataset.profileEnhanced==='1') return true;
    page.dataset.profileEnhanced='1';
    page.classList.add('academy-profile-page');
    const ctx=await profileContext();
    buildHero(page,ctx);
    buildSettings(page,ctx);
    return true;
  }

  function schedule(){[80,240,520].forEach(delay=>setTimeout(enhanceProfile,delay));}
  document.addEventListener('click',event=>{if(event.target.closest('[data-shell-route="profile"]') || event.target.closest('[data-avatar-button]')) schedule();});
  window.addEventListener('pageshow',()=>setTimeout(enhanceProfile,260));
  window.ACADEMIA_YAMILET_PROFILE={enhance:enhanceProfile};
})();
