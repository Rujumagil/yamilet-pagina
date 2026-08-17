(function(){
  const configPath = '../integration-config.js';

  // Imágenes oficiales HD. Evita utilizar los placeholders WebP de pocos KB.
  const HD = {
    logo: 'https://static.wixstatic.com/media/11f124_8a25a6adf8df4c0e8ed46721653823ac~mv2.png',
    hero: 'https://static.wixstatic.com/media/11f124_600a609d012c4ad2b7a6bef2371e8c26~mv2.png',
    about: 'https://static.wixstatic.com/media/11f124_4271693799174def8a6e0089d2e02052~mv2.png',
    author: 'https://static.wixstatic.com/media/11f124_ebdb2226121141e18f590f7d85fb2486~mv2.png',
    courseHorizontal: 'https://static.wixstatic.com/media/11f124_17cc98344378498c935e8a9836c21ba0~mv2.png',
    courseVertical: 'https://static.wixstatic.com/media/11f124_dc9b29fd41344e9cab93eba80afb31e9~mv2.png',
    books: {
      'libro-en-la-raiz-del-perdon.webp': 'https://static.wixstatic.com/media/11f124_112e859067dd4c36a174baba543d03ae~mv2.png',
      'libro-metodo-mes.webp': 'https://static.wixstatic.com/media/11f124_3f243be340964d7dae225bd7aeb5d9ab~mv2.png',
      'libro-expresia.webp': 'https://static.wixstatic.com/media/11f124_a5e6c8fde9f14024b526be96a81518f9~mv2.png',
      'libro-retazos-de-mi-alma.webp': 'https://static.wixstatic.com/media/11f124_523f5e91b89a49f3ac4539cfbd09be35~mv2.png',
      'libro-nel-silenzio-del-dovere.webp': 'https://static.wixstatic.com/media/11f124_c5073a3664784188a05d5a5efc5a81d1~mv2.png',
      'libro-apegos.webp': 'https://static.wixstatic.com/media/11f124_4f8659b614d64b42a21edd506c287532~mv2.png'
    },
    blog: [
      'https://static.wixstatic.com/media/11f124_9237013c48f246cb80016b4ebdb49290~mv2.png',
      'https://static.wixstatic.com/media/11f124_5f7280533b85457286193f1c110b7780~mv2.png',
      'https://static.wixstatic.com/media/11f124_b81fa46b8fa34dc888cd7f7044f853ff~mv2.png',
      'https://static.wixstatic.com/media/11f124_f410011c8dc846a5837d3e267deaae1c~mv2.png'
    ]
  };

  function setImg(img, src, eager=false){
    if(!img || !src) return;
    img.src = src;
    img.removeAttribute('srcset');
    img.decoding = 'async';
    img.loading = eager ? 'eager' : 'lazy';
    if(eager) img.fetchPriority = 'high';
  }

  function applyOfficialImages(){
    document.querySelectorAll('.brand img,.welcome-logo,.footer-logo').forEach(img => setImg(img, HD.logo, true));
    setImg(document.querySelector('.hero-media img'), HD.hero, true);
    setImg(document.querySelector('.about-media img'), HD.about);
    setImg(document.querySelector('.author-photo img'), HD.author);

    document.querySelectorAll('.book .cover img').forEach(img => {
      const name = (img.getAttribute('src') || '').split('/').pop();
      if(HD.books[name]) setImg(img, HD.books[name]);
    });

    document.querySelectorAll('#blog .thumb img').forEach((img,index)=>{
      if(HD.blog[index]) setImg(img, HD.blog[index]);
    });

    const courseImg = document.querySelector('.course-media img');
    if(courseImg){
      const refreshCourse = () => setImg(
        courseImg,
        window.matchMedia('(max-width:620px)').matches ? HD.courseVertical : HD.courseHorizontal,
        true
      );
      refreshCourse();
      window.addEventListener('resize', refreshCourse, {passive:true});
    }
  }

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
      alert(lang === 'it' ? 'Modulo pronto per essere collegato ad Academia MES.' : 'Formulario listo para conectarse con Academia MES.');
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    if(button) button.disabled = true;
    try{
      const response = await fetch(cfg.leadCapture.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({email,locale:lang,source:'yamilet-landing',form_type:'newsletter',page_url:location.href,consent:true,...utmPayload()})
      });
      if(!response.ok) throw new Error('lead_capture_failed');
      form.reset();
      alert(lang === 'it' ? 'Grazie. La tua registrazione è stata ricevuta.' : 'Gracias. Tu registro fue recibido correctamente.');
    }catch(error){
      console.error('Yamilet lead capture', error);
      alert(lang === 'it' ? 'Non è stato possibile completare la registrazione. Riprova tra poco.' : 'No fue posible completar el registro. Intenta nuevamente en un momento.');
    }finally{
      if(button) button.disabled = false;
    }
  }

  async function init(){
    applyOfficialImages();
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
