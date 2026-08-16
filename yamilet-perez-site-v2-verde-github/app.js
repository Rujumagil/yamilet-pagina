(function(){
  const configPath = '../integration-config.js';

  function loadIntegrationConfig(){
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = configPath;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  function currentLang(){
    return document.documentElement.lang === 'it' ? 'it' : 'es';
  }

  function utmPayload(){
    const p = new URLSearchParams(location.search);
    return {
      utm_source: p.get('utm_source') || '',
      utm_medium: p.get('utm_medium') || '',
      utm_campaign: p.get('utm_campaign') || '',
      utm_content: p.get('utm_content') || '',
      utm_term: p.get('utm_term') || ''
    };
  }

  function academyAnchor(){
    return currentLang() === 'it' ? '#accademia' : '#academia';
  }

  function addAcademyAccess(cfg){
    const nav = document.querySelector('[data-nav]');
    if(!nav || nav.querySelector('[data-academy-access]')) return;

    const a = document.createElement('a');
    a.dataset.academyAccess = 'true';
    a.className = 'btn btn-secondary';
    a.textContent = currentLang() === 'it' ? 'Entra in Accademia' : 'Entrar a mi Academia';

    if(cfg?.academy?.enabled && cfg.academy.url){
      a.href = cfg.academy.url;
      a.rel = 'noopener';
    } else {
      a.href = academyAnchor();
      a.title = currentLang() === 'it' ? 'Accademia MES in preparazione' : 'Academia MES en preparación';
    }

    const langSwitch = nav.querySelector('.lang');
    nav.insertBefore(a, langSwitch || null);
  }

  async function submitLead(form, cfg){
    const emailInput = form.querySelector('input[type="email"]');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const lang = currentLang();

    if(!cfg?.leadCapture?.enabled || !cfg.leadCapture.endpoint){
      alert(lang === 'it'
        ? 'Modulo pronto per essere collegato ad Academia MES.'
        : 'Formulario listo para conectarse con Academia MES.');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if(button) button.disabled = true;

    try{
      const response = await fetch(cfg.leadCapture.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          locale: lang,
          source: 'yamilet-landing',
          form_type: 'newsletter',
          page_url: location.href,
          consent: true,
          ...utmPayload()
        })
      });

      if(!response.ok) throw new Error('lead_capture_failed');
      form.reset();
      alert(lang === 'it'
        ? 'Grazie. La tua registrazione è stata ricevuta.'
        : 'Gracias. Tu registro fue recibido correctamente.');
    }catch(error){
      console.error('Yamilet lead capture', error);
      alert(lang === 'it'
        ? 'Non è stato possibile completare la registrazione. Riprova tra poco.'
        : 'No fue posible completar el registro. Intenta nuevamente en un momento.');
    }finally{
      if(button) button.disabled = false;
    }
  }

  async function init(){
    await loadIntegrationConfig();
    const cfg = window.YAMILET_INTEGRATION || {};

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

    addAcademyAccess(cfg);

    const form = document.querySelector('[data-newsletter]');
    if(form){
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        await submitLead(form, cfg);
      });
    }
  }

  init();
})();
