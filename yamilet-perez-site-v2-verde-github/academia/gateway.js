(() => {
  'use strict';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const HOME='/academia/inicio/';
  const ADMIN='/admin/';
  const BUILD='142';
  const $=(s,r=document)=>r.querySelector(s);
  let sb=null;
  let recoveryIntent=false;

  const loader=$('[data-loader]');
  const mainCard=$('[data-main-card]');
  const resetCard=$('[data-reset-card]');
  const loginForm=$('[data-login-form]');
  const registerForm=$('[data-register-form]');
  const resetForm=$('[data-reset-form]');
  const loginStatus=$('[data-login-status]');
  const registerStatus=$('[data-register-status]');
  const resetStatus=$('[data-reset-status]');

  function finish(){loader?.classList.add('done');setTimeout(()=>loader?.remove(),220)}
  function setStatus(el,text,ok=false){if(!el)return;el.textContent=text||'';el.classList.toggle('ok',!!ok)}
  function mode(name){
    $('[data-login-pane]')?.classList.toggle('hidden',name!=='login');
    $('[data-register-pane]')?.classList.toggle('hidden',name!=='register');
    setStatus(loginStatus,'');setStatus(registerStatus,'');
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
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

    sb.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){showReset();return;}
      if(event==='SIGNED_IN'&&session?.user&&!recoveryIntent&&!isRecoveryUrl()) location.replace(nextTarget());
    });

    if(isRecoveryUrl()){showReset();return;}

    const {data:{user}}=await sb.auth.getUser();
    if(user){location.replace(nextTarget());return;}

    const p=new URLSearchParams(location.search);
    mode(p.get('register')==='1'||p.get('mode')==='register'?'register':'login');
    finish();

    if('serviceWorker'in navigator&&location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js?build='+BUILD,{scope:'./',updateViaCache:'none'}).then(r=>r.update().catch(()=>null)).catch(()=>null);
    }
  }

  $('[data-show-login]')?.addEventListener('click',()=>mode('login'));
  $('[data-show-register]')?.addEventListener('click',()=>mode('register'));

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

  registerForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,fd=new FormData(form);
    const fullName=String(fd.get('full_name')||'').trim().replace(/\s+/g,' '),email=String(fd.get('email')||'').trim().toLowerCase(),password=String(fd.get('password')||''),confirm=String(fd.get('confirm_password')||''),understood=fd.get('activation_understood')==='on';
    if(!fullName||!email||!password||!confirm){setStatus(registerStatus,'Completa todos los campos.');return;}
    if(password.length<8){setStatus(registerStatus,'La contraseña debe tener al menos 8 caracteres.');return;}
    if(password!==confirm){setStatus(registerStatus,'Las contraseñas no coinciden.');return;}
    if(!understood){setStatus(registerStatus,'Confirma que entiendes cómo se activa el acceso.');return;}
    const btn=form.querySelector('button[type="submit"]');btn.disabled=true;setStatus(registerStatus,'Registrando tu solicitud…',true);
    let captured=false;
    try{
      const a=attribution(),pageUrl=String(location.href).slice(0,1000);
      const {error:captureError}=await sb.rpc('capture_academy_registration_request',{
        target_email:email,target_full_name:fullName,target_locale:'es',target_page_url:pageUrl,
        target_utm_source:a.utm_source,target_utm_medium:a.utm_medium,target_utm_campaign:a.utm_campaign,
        target_utm_content:a.utm_content,target_utm_term:a.utm_term,target_landing_cta:a.landing_cta
      });
      if(captureError)throw captureError;
      captured=true;
      const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:new URL('/academia/',location.origin).href,data:{full_name:fullName,academy:'yamilet',registration_source:'academy-public',course_interest:'metodo-mes',locale:'es',page_url:pageUrl,...a}}});
      if(error)throw error;
      form.reset();
      const identities=Array.isArray(data?.user?.identities)?data.user.identities:null;
      if(identities&&identities.length===0){setStatus(registerStatus,'Este correo ya está registrado. Puedes iniciar sesión o recuperar tu contraseña.',true);return;}
      if(data?.session){setStatus(registerStatus,'Cuenta creada. Entrando a tu Academia…',true);setTimeout(()=>location.replace(HOME),500);}
      else setStatus(registerStatus,'Registro recibido. Revisa tu correo para confirmar tu dirección.',true);
    }catch(error){
      console.warn('Academia gateway registration',error);
      setStatus(registerStatus,captured?'Tu solicitud quedó registrada. El equipo podrá darle seguimiento.':'No fue posible completar el registro. Intenta nuevamente.',captured);
    }finally{btn.disabled=false}
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