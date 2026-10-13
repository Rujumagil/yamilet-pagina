(() => {
  'use strict';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const HOME='/academia/inicio/';
  const ADMIN='/admin/';
  const BUILD='143';
  const $=(s,r=document)=>r.querySelector(s);
  let sb=null;
  let recoveryIntent=false;
  let confirmationIntent=false;

  const loader=$('[data-loader]');
  const mainCard=$('[data-main-card]');
  const resetCard=$('[data-reset-card]');
  const confirmedCard=$('[data-confirmed-card]');
  const loginForm=$('[data-login-form]');
  const registerForm=null;
  const resetForm=$('[data-reset-form]');
  const loginStatus=$('[data-login-status]');
  const registerStatus=null;
  const resetStatus=$('[data-reset-status]');

  function finish(){loader?.classList.add('done');setTimeout(()=>loader?.remove(),220)}
  function setStatus(el,text,ok=false){if(!el)return;el.textContent=text||'';el.classList.toggle('ok',!!ok)}
  function mode(){
    $('[data-login-pane]')?.classList.remove('hidden');
    setStatus(loginStatus,'');
  }
  function attribution(){
    const p=new URLSearchParams(location.search), clean=v=>String(v||'').trim().slice(0,255);
    return {utm_source:clean(p.get('utm_source')),utm_medium:clean(p.get('utm_medium')),utm_campaign:clean(p.get('utm_campaign')),utm_content:clean(p.get('utm_content')),utm_term:clean(p.get('utm_term')),landing_cta:clean(p.get('cta')||p.get('utm_content'))};
  }
  function nextTarget(){
    try{
      const raw=sessionStorage.getItem('yamilet_academy_v2_next');
      if(!raw)return HOME;
      const u=new URL(raw,location.origin);
      sessionStorage.removeItem('yamilet_academy_v2_next');
      return u.origin===location.origin&&u.pathname.startsWith('/academia/')&&u.pathname!=='/academia/'?u.pathname+u.search+u.hash:HOME;
    }catch{return HOME}
  }
  function isRecoveryUrl(){
    const p=new URLSearchParams(location.search);
    return p.get('recovery')==='1'||p.get('mode')==='recovery'||/type=recovery/i.test(location.hash);
  }
  function showReset(){
    recoveryIntent=true;
    mainCard?.classList.add('hidden-by-reset');
    resetCard?.classList.add('active');
    finish();
  }
  function legacyAdminRedirect(){
    return /^#(?:admin|administracion)(?:\/|$)/i.test(location.hash)||new URLSearchParams(location.search).get('admin')==='1';
  }
  async function init(){
    if(legacyAdminRedirect()){location.replace(ADMIN);return;}
    const res=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!res.ok)throw new Error('config_unavailable');
    const cfg=await res.json();
    const params=new URLSearchParams(location.search);
    if(params.get('register')==='1'||params.get('mode')==='register'){location.replace('/academia/registro/'+location.search.replace(/^\?/,'?'));return;}
    confirmationIntent=params.get('confirmed')==='1';
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:!confirmationIntent}});

    sb.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){showReset();return;}
      if(event==='SIGNED_IN'&&session?.user&&!recoveryIntent&&!isRecoveryUrl()) location.replace(nextTarget());
    });

    if(isRecoveryUrl()){showReset();return;}

    if(confirmationIntent){
      history.replaceState({},'',new URL('/academia/?confirmed=1',location.origin).href);
      mainCard?.classList.add('hidden-by-reset');
      resetCard?.classList.remove('active');
      confirmedCard?.classList.add('active');
      finish();
      return;
    }

    const {data:{user}}=await sb.auth.getUser();
    if(user){location.replace(nextTarget());return;}

    mode();
    finish();

    if('serviceWorker'in navigator&&location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js?build='+BUILD,{scope:'./',updateViaCache:'none'}).then(r=>r.update().catch(()=>null)).catch(()=>null);
    }
  }

  loginForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget),email=String(fd.get('email')||'').trim().toLowerCase(),password=String(fd.get('password')||'');
    const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;setStatus(loginStatus,'Validando acceso…',true);
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error){setStatus(loginStatus,'Correo o contraseña incorrectos.');btn.disabled=false;}
  });

  $('[data-magic]')?.addEventListener('click',async()=>{
    const email=String(loginForm?.email?.value||'').trim().toLowerCase();
    if(!email){setStatus(loginStatus,'Escribe primero tu correo.');return;}
    setStatus(loginStatus,'Enviando enlace de acceso…',true);
    const redirectTo=new URL('/academia/',location.origin).href;
    const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});
    setStatus(loginStatus,error?'No fue posible enviar el enlace.':'Revisa tu correo. Te enviamos un enlace para entrar.',!error);
  });

  $('[data-recovery]')?.addEventListener('click',async()=>{
    const email=String(loginForm?.email?.value||'').trim().toLowerCase();
    if(!email){setStatus(loginStatus,'Escribe primero tu correo.');return;}
    setStatus(loginStatus,'Preparando recuperación segura…',true);
    const redirectTo=new URL('/academia/?recovery=1',location.origin).href;
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
    setStatus(loginStatus,error?'No fue posible iniciar la recuperación.':'Revisa tu correo para crear una nueva contraseña.',!error);
  });

  resetForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget),password=String(fd.get('password')||''),confirm=String(fd.get('confirm_password')||'');
    if(password.length<8){setStatus(resetStatus,'La contraseña debe tener al menos 8 caracteres.');return;}
    if(password!==confirm){setStatus(resetStatus,'Las contraseñas no coinciden.');return;}
    const btn=e.currentTarget.querySelector('button');btn.disabled=true;setStatus(resetStatus,'Guardando nueva contraseña…',true);
    const {error}=await sb.auth.updateUser({password});
    btn.disabled=false;
    if(error){setStatus(resetStatus,'No fue posible actualizar la contraseña. Solicita un nuevo enlace.');return;}
    setStatus(resetStatus,'Contraseña actualizada. Entrando a tu Academia…',true);
    history.replaceState({},'',new URL('/academia/',location.origin).href);
    setTimeout(()=>location.replace(HOME),650);
  });

  init().catch(error=>{console.error('Academia gateway',error);finish();setStatus(loginStatus,'No fue posible iniciar la Academia. Intenta nuevamente.');});
})();