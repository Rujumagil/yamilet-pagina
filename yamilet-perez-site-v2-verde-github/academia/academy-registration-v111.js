(() => {
  'use strict';

  const VERSION = '115.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);

  const COPY = {
    es: {
      eyebrow:'NUEVA EN LA ACADEMIA', title:'¿Aún no tienes cuenta?', text:'Crea tu perfil de alumna para formar parte de Academia Yamilet. Tus cursos aparecerán cuando tu inscripción sea activada.', open:'Crear mi cuenta',
      formEyebrow:'REGISTRO A LA ACADEMIA', formTitle:'Crea tu cuenta', formText:'Regístrate con tus datos. Crear tu cuenta no activa automáticamente un curso de pago.',
      name:'Nombre completo', email:'Correo', password:'Contraseña', confirm:'Confirmar contraseña', understand:'Entiendo que los cursos se activan cuando mi inscripción sea confirmada.', submit:'Registrarme en la Academia', back:'Ya tengo cuenta · volver al acceso',
      working:'Registrando tu solicitud…', mismatch:'Las contraseñas no coinciden.', short:'La contraseña debe tener al menos 8 caracteres.', required:'Completa todos los campos para continuar.', consent:'Confirma que entiendes cómo se activa el acceso a los cursos.',
      successConfirm:'Registro recibido y cuenta creada. Revisa tu correo para confirmar tu dirección; tu solicitud ya es visible para Academia Yamilet.',
      successReady:'Registro recibido y cuenta creada correctamente. Ya puedes iniciar sesión; tu solicitud ya es visible para Academia Yamilet.',
      capturedPending:'Tu solicitud quedó registrada y ya es visible para Academia Yamilet. Si la cuenta no pudo crearse automáticamente, el equipo podrá darle seguimiento desde administración.',
      exists:'Este correo ya está registrado. Tu solicitud quedó guardada para seguimiento; puedes iniciar sesión o usar “Cambiar mi contraseña”.',
      error:'No fue posible guardar tu registro. Intenta nuevamente en unos minutos.'
    },
    it: {
      eyebrow:'NUOVA NELL’ACCADEMIA', title:'Non hai ancora un account?', text:'Crea il tuo profilo di studentessa per entrare in Academia Yamilet. I corsi appariranno quando la tua iscrizione sarà attivata.', open:'Crea il mio account',
      formEyebrow:'REGISTRAZIONE ALL’ACCADEMIA', formTitle:'Crea il tuo account', formText:'Registrati con i tuoi dati. La creazione dell’account non attiva automaticamente un corso a pagamento.',
      name:'Nome e cognome', email:'Email', password:'Password', confirm:'Conferma password', understand:'Ho capito che i corsi si attivano quando la mia iscrizione viene confermata.', submit:'Registrami all’Accademia', back:'Ho già un account · torna all’accesso',
      working:'Registrazione della richiesta…', mismatch:'Le password non coincidono.', short:'La password deve contenere almeno 8 caratteri.', required:'Completa tutti i campi per continuare.', consent:'Conferma di aver compreso come viene attivato l’accesso ai corsi.',
      successConfirm:'Registrazione ricevuta e account creato. Controlla la tua email per confermare l’indirizzo; la richiesta è già visibile ad Academia Yamilet.',
      successReady:'Registrazione ricevuta e account creato correttamente. Ora puoi accedere; la richiesta è già visibile ad Academia Yamilet.',
      capturedPending:'La tua richiesta è stata registrata ed è già visibile ad Academia Yamilet. Se l’account non è stato creato automaticamente, il team potrà gestirlo dall’amministrazione.',
      exists:'Questa email è già registrata. La richiesta è stata salvata per il follow-up; puoi accedere o usare il recupero password.',
      error:'Non è stato possibile salvare la registrazione. Riprova tra qualche minuto.'
    }
  };

  let clientPromise = null;
  let activeLang = 'es';

  const clean = value => String(value || '').trim().slice(0,255);

  function attribution() {
    const params = new URLSearchParams(location.search);
    return {
      utm_source: clean(params.get('utm_source')),
      utm_medium: clean(params.get('utm_medium')),
      utm_campaign: clean(params.get('utm_campaign')),
      utm_content: clean(params.get('utm_content')),
      utm_term: clean(params.get('utm_term')),
      landing_cta: clean(params.get('cta') || params.get('utm_content'))
    };
  }

  function shouldAutoOpen() {
    const params = new URLSearchParams(location.search);
    return params.get('register') === '1' || params.get('mode') === 'register';
  }

  function getLang() {
    const selected = $('[data-academy-lang][aria-pressed="true"]');
    return selected?.dataset.academyLang === 'it' ? 'it' : 'es';
  }

  async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const response = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
      if (!response.ok) throw new Error('config_unavailable');
      const cfg = await response.json();
      return window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    })();
    return clientPromise;
  }

  function markup() {
    return `<section class="academy-register-entry" data-academy-register-entry><div class="academy-register-entry-copy"><span data-reg-copy="eyebrow"></span><strong data-reg-copy="title"></strong><p data-reg-copy="text"></p></div><button class="academy-register-open" type="button" data-register-open></button></section>
    <section class="academy-register-panel" data-register-panel hidden><div class="academy-register-head"><span data-reg-copy="formEyebrow"></span><h3 data-reg-copy="formTitle"></h3><p data-reg-copy="formText"></p></div>
    <form class="academy-register-form" data-register-form novalidate>
      <label><span data-reg-copy="name"></span><input type="text" name="full_name" autocomplete="name" minlength="2" maxlength="120" required></label>
      <label><span data-reg-copy="email"></span><input type="email" name="email" autocomplete="email" required></label>
      <div class="academy-register-passwords"><label><span data-reg-copy="password"></span><input type="password" name="password" autocomplete="new-password" minlength="8" required></label><label><span data-reg-copy="confirm"></span><input type="password" name="confirm_password" autocomplete="new-password" minlength="8" required></label></div>
      <label class="academy-register-check"><input type="checkbox" name="activation_understood" required><span data-reg-copy="understand"></span></label>
      <button class="academy-register-submit" type="submit" data-register-submit></button><p class="academy-register-status" data-register-status aria-live="polite"></p><button class="academy-register-back" type="button" data-register-close></button>
    </form></section>`;
  }

  function applyCopy(root) {
    activeLang = getLang();
    const t = COPY[activeLang];
    root.querySelectorAll('[data-reg-copy]').forEach(node => { const key=node.dataset.regCopy; if(t[key]) node.textContent=t[key]; });
    const open=$('[data-register-open]',root), submit=$('[data-register-submit]',root), back=$('[data-register-close]',root);
    if(open) open.textContent=t.open;
    if(submit && !submit.disabled) submit.textContent=t.submit;
    if(back) back.textContent=t.back;
  }

  function setStatus(root,text,ok=false){ const status=$('[data-register-status]',root); if(!status)return; status.textContent=text||''; status.classList.toggle('ok',!!ok); }
  function openRegistration(root){ const entry=$('[data-academy-register-entry]',root),panel=$('[data-register-panel]',root); if(entry)entry.hidden=true;if(panel)panel.hidden=false;root.classList.add('academy-registration-open');setStatus(root,'');setTimeout(()=>$('[name="full_name"]',root)?.focus(),80); }
  function closeRegistration(root){ const entry=$('[data-academy-register-entry]',root),panel=$('[data-register-panel]',root);if(entry)entry.hidden=false;if(panel)panel.hidden=true;root.classList.remove('academy-registration-open');setStatus(root,''); }
  function friendlyError(error,t){const raw=String(error?.message||error||'').toLowerCase();return /already registered|already been registered|user already exists/.test(raw)?t.exists:t.error;}

  async function submitRegistration(root,form){
    const t=COPY[activeLang=getLang()],fd=new FormData(form);
    const fullName=String(fd.get('full_name')||'').trim().replace(/\s+/g,' '),email=String(fd.get('email')||'').trim().toLowerCase(),password=String(fd.get('password')||''),confirm=String(fd.get('confirm_password')||''),understood=fd.get('activation_understood')==='on';
    const submit=$('[data-register-submit]',root);
    if(!fullName||!email||!password||!confirm)return setStatus(root,t.required);
    if(password.length<8)return setStatus(root,t.short);
    if(password!==confirm)return setStatus(root,t.mismatch);
    if(!understood)return setStatus(root,t.consent);

    submit.disabled=true;submit.textContent=t.working;setStatus(root,'');
    let captured=false;
    try{
      const client=await getClient(),a=attribution();
      const pageUrl=String(location.href||'').slice(0,1000);
      const {error:captureError}=await client.rpc('capture_academy_registration_request',{
        target_email:email,
        target_full_name:fullName,
        target_locale:activeLang,
        target_page_url:pageUrl,
        target_utm_source:a.utm_source,
        target_utm_medium:a.utm_medium,
        target_utm_campaign:a.utm_campaign,
        target_utm_content:a.utm_content,
        target_utm_term:a.utm_term,
        target_landing_cta:a.landing_cta
      });
      if(captureError)throw captureError;
      captured=true;

      const redirectTo=`${location.origin}${location.pathname}`;
      const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,data:{full_name:fullName,academy:'yamilet',registration_source:'academy-public',course_interest:'metodo-mes',locale:activeLang,page_url:pageUrl,...a}}});
      if(error)throw error;

      form.reset();
      const identities=Array.isArray(data?.user?.identities)?data.user.identities:null;
      if(identities && identities.length===0){setStatus(root,t.exists,true);return;}
      if(data?.session){await client.auth.signOut().catch(()=>null);setStatus(root,t.successReady,true);}
      else if(data?.user)setStatus(root,t.successConfirm,true);
      else setStatus(root,t.capturedPending,true);
    }catch(error){
      console.warn('Academia Yamilet registration v115',error);
      setStatus(root,captured?t.capturedPending:friendlyError(error,t),captured);
    }
    finally{submit.disabled=false;submit.textContent=t.submit;}
  }

  function mount(){
    const card=$('.auth-shell[data-auth-view] .login-card');
    if(!card||card.dataset.registrationV111==='true')return false;
    card.dataset.registrationV111='true';card.insertAdjacentHTML('beforeend',markup());applyCopy(card);
    $('[data-register-open]',card)?.addEventListener('click',()=>openRegistration(card));
    $('[data-register-close]',card)?.addEventListener('click',()=>closeRegistration(card));
    $('[data-register-form]',card)?.addEventListener('submit',event=>{event.preventDefault();submitRegistration(card,event.currentTarget);});
    document.querySelectorAll('[data-academy-lang]').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>applyCopy(card),20)));
    if(shouldAutoOpen()) setTimeout(()=>openRegistration(card),90);
    return true;
  }

  function start(){if(mount())return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_REGISTRATION_V111=Object.freeze({version:VERSION,mount});
})();