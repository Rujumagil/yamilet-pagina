(() => {
  'use strict';
  const CONFIG_ENDPOINT='https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const CONFIRM_REDIRECT=new URL('/academia/?confirmed=1',location.origin).href;
  const COUNTRIES=[
    ['MX','México','52'],['US','Estados Unidos','1'],['CA','Canadá','1'],['ES','España','34'],['IT','Italia','39'],
    ['AR','Argentina','54'],['BO','Bolivia','591'],['BR','Brasil','55'],['CL','Chile','56'],['CO','Colombia','57'],
    ['CR','Costa Rica','506'],['CU','Cuba','53'],['DO','República Dominicana','1'],['EC','Ecuador','593'],
    ['SV','El Salvador','503'],['GT','Guatemala','502'],['HN','Honduras','504'],['NI','Nicaragua','505'],
    ['PA','Panamá','507'],['PY','Paraguay','595'],['PE','Perú','51'],['PR','Puerto Rico','1'],['UY','Uruguay','598'],
    ['VE','Venezuela','58'],['BZ','Belice','501'],['GB','Reino Unido','44'],['FR','Francia','33'],['DE','Alemania','49'],
    ['PT','Portugal','351'],['CH','Suiza','41'],['NL','Países Bajos','31'],['BE','Bélgica','32'],['IE','Irlanda','353'],
    ['AU','Australia','61'],['NZ','Nueva Zelanda','64'],['JP','Japón','81'],['KR','Corea del Sur','82'],
    ['IN','India','91'],['PH','Filipinas','63'],['ZA','Sudáfrica','27']
  ].map(([code,name,dial])=>({code,name,dial}));
  const $=(s,r=document)=>r.querySelector(s);
  let sb=null;
  const loader=$('[data-loader]'),formCard=$('[data-form-card]'),successCard=$('[data-success-card]'),form=$('[data-register-form]'),status=$('[data-register-status]');
  const countrySelect=$('[data-country]'),dialDisplay=$('[data-dial-code]'),whatsappInput=$('[data-whatsapp]');

  function finish(){loader?.classList.add('done');setTimeout(()=>loader?.remove(),220)}
  function setStatus(text,ok=false){if(!status)return;status.textContent=text||'';status.classList.toggle('ok',!!ok)}
  const clean=v=>String(v||'').trim().slice(0,255);
  function attribution(){const p=new URLSearchParams(location.search);return{utm_source:clean(p.get('utm_source')),utm_medium:clean(p.get('utm_medium')),utm_campaign:clean(p.get('utm_campaign')),utm_content:clean(p.get('utm_content')),utm_term:clean(p.get('utm_term')),landing_cta:clean(p.get('cta')||p.get('utm_content'))}}
  function showSuccess(email){formCard?.classList.add('hidden');successCard?.classList.remove('hidden');const target=$('[data-success-email]');if(target)target.textContent=email;scrollTo({top:0,behavior:'smooth'})}

  function selectedCountry(){
    return COUNTRIES.find(c=>c.code===countrySelect?.value)||COUNTRIES[0];
  }

  function populateCountries(){
    if(!countrySelect)return;
    countrySelect.innerHTML=COUNTRIES.map(c=>'<option value="'+c.code+'" data-dial="'+c.dial+'">'+c.name+' (+'+c.dial+')</option>').join('');
    countrySelect.value='MX';
    updateDial();
  }

  function updateDial(){
    const country=selectedCountry();
    if(dialDisplay)dialDisplay.textContent='+'+country.dial;
    if(whatsappInput){
      whatsappInput.placeholder=country.code==='MX'?'10 dígitos':'Número de WhatsApp';
      whatsappInput.setAttribute('aria-label','WhatsApp de '+country.name+', código +'+country.dial);
    }
  }

  function whatsappData(raw){
    const country=selectedCountry();
    let local=String(raw||'').replace(/[^0-9]/g,'');
    const trimmed=String(raw||'').trim();
    if(trimmed.startsWith('+')&&local.startsWith(country.dial))local=local.slice(country.dial.length);
    const e164='+'+country.dial+local;
    if(local.length<6||!/^+[1-9][0-9]{6,14}$/.test(e164))return null;
    return {country,local,e164};
  }

  async function init(){
    populateCountries();
    const res=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!res.ok)throw new Error('config_unavailable');
    const cfg=await res.json();
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    finish();
  }

  countrySelect?.addEventListener('change',updateDial);

  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(form),fullName=String(fd.get('full_name')||'').trim().replace(/s+/g,' '),email=String(fd.get('email')||'').trim().toLowerCase(),password=String(fd.get('password')||''),confirm=String(fd.get('confirm_password')||''),understood=fd.get('activation_understood')==='on';
    const phone=whatsappData(fd.get('whatsapp'));
    if(!fullName||!email||!password||!confirm){setStatus('Completa todos los campos.');return}
    if(!phone){setStatus('Revisa tu país y escribe un número de WhatsApp válido.');return}
    if(password.length<8){setStatus('La contraseña debe tener al menos 8 caracteres.');return}
    if(password!==confirm){setStatus('Las contraseñas no coinciden.');return}
    if(!understood){setStatus('Confirma que entiendes el proceso de activación.');return}
    const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Creando tu cuenta…';setStatus('Guardando tu registro…',true);
    let captured=false;
    try{
      const a=attribution(),pageUrl=String(location.href).slice(0,1000);
      const {error:captureError}=await sb.rpc('capture_academy_registration_request',{
        target_email:email,target_full_name:fullName,target_locale:'es',target_page_url:pageUrl,
        target_utm_source:a.utm_source,target_utm_medium:a.utm_medium,target_utm_campaign:a.utm_campaign,
        target_utm_content:a.utm_content,target_utm_term:a.utm_term,target_landing_cta:a.landing_cta,
        target_country_code:phone.country.code,target_country_name:phone.country.name,
        target_dial_code:'+'+phone.country.dial,target_whatsapp_local:phone.local,target_whatsapp_e164:phone.e164
      });
      if(captureError)throw captureError;
      captured=true;
      const {data,error}=await sb.auth.signUp({
        email,password,
        options:{
          emailRedirectTo:CONFIRM_REDIRECT,
          data:{
            full_name:fullName,academy:'yamilet',registration_source:'academy-registration-page',
            course_interest:'metodo-mes',locale:'es',page_url:pageUrl,
            country_code:phone.country.code,country_name:phone.country.name,
            whatsapp:phone.e164,...a
          }
        }
      });
      if(error)throw error;

      const identities=Array.isArray(data?.user?.identities)?data.user.identities:null;
      if(identities&&identities.length===0){setStatus('Este correo ya tiene una cuenta. Ve a la pantalla de ingreso o recupera tu contraseña.');return}
      form.reset();populateCountries();
      if(data?.session){
        await sb.auth.signOut().catch(()=>null);
        setStatus('La cuenta se creó, pero este proyecto no solicitó confirmación por correo.',true);
      }
      showSuccess(email);
    }catch(error){
      console.warn('Academia registro dedicado',error);
      setStatus(captured?'Tu solicitud quedó registrada, pero no pudimos crear la cuenta en este momento. Escríbenos para darle seguimiento.':'No fue posible completar el registro. Intenta nuevamente.');
    }finally{button.disabled=false;button.textContent='Crear mi cuenta'}
  });

  $('[data-back-register]')?.addEventListener('click',()=>{successCard?.classList.add('hidden');formCard?.classList.remove('hidden');setStatus('')});
  init().catch(error=>{console.error(error);finish();setStatus('No fue posible preparar el registro. Intenta nuevamente.')});
})();