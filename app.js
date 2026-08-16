(function(){
  const menuBtn = document.querySelector('[data-menu-btn]');
  const nav = document.querySelector('[data-nav]');
  if(menuBtn && nav){
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true':'false');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', ()=> nav.classList.remove('open')));
  }

  document.querySelectorAll('[data-lang-switch]').forEach(link => {
    link.addEventListener('click', () => {
      try{ localStorage.setItem('yamiletLang', link.dataset.langSwitch); }catch(e){}
    });
  });

  const welcome = document.querySelector('[data-welcome]');
  const enterBtn = document.querySelector('[data-enter-site]');
  let seen = false;
  try{ seen = sessionStorage.getItem('yamiletWelcomeSeen') === 'true'; }catch(e){}
  if(welcome){
    if(seen) welcome.classList.add('is-hidden');
    else requestAnimationFrame(()=> welcome.classList.add('is-ready'));
  }
  if(enterBtn && welcome){
    enterBtn.addEventListener('click', ()=>{
      welcome.classList.add('is-leaving');
      try{ sessionStorage.setItem('yamiletWelcomeSeen','true'); }catch(e){}
      setTimeout(()=> welcome.classList.add('is-hidden'), 520);
    });
  }

  const cfg = window.YAMILET_INTEGRATION_CONFIG || {};
  document.querySelectorAll('[data-academy-link]').forEach(link=>{
    if(cfg.academy && cfg.academy.enabled && cfg.academy.url){
      link.href = cfg.academy.url;
      link.classList.remove('is-disabled');
      link.removeAttribute('aria-disabled');
    } else {
      link.href = '#academia';
      link.classList.add('is-disabled');
      link.setAttribute('aria-disabled','true');
      link.title = document.documentElement.lang === 'it'
        ? 'L’accesso all’Accademia sarà attivato al momento della consegna.'
        : 'El acceso a la Academia se activará en la entrega.';
    }
  });

  const form = document.querySelector('[data-newsletter]');
  if(form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = form.querySelector('input[type=email]')?.value?.trim();
      const lang = document.documentElement.lang;
      if(!email) return;
      if(cfg.leadCapture && cfg.leadCapture.enabled && cfg.leadCapture.endpoint){
        try{
          const res = await fetch(cfg.leadCapture.endpoint,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email,source:'yamilet-landing',locale:lang})
          });
          if(!res.ok) throw new Error('capture_failed');
          alert(lang === 'it' ? 'Grazie. Iscrizione ricevuta.' : 'Gracias. Tu registro fue recibido.');
          form.reset();
          return;
        }catch(err){}
      }
      alert(lang === 'it'
        ? 'Modulo pronto per essere collegato a Supabase al momento della consegna.'
        : 'Formulario listo para conectarse con Supabase al momento de la entrega.');
    });
  }
})();
