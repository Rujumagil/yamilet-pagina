(function(){
  // Assets oficiales de Yamilet en alta resolución.
  // Se sirven desde el Media Manager de Yamilet para evitar la fuerte compresión
  // de los placeholders anteriores de GitHub Pages.
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

  const setImg = (img, src, eager=false) => {
    if(!img || !src) return;
    img.src = src;
    img.removeAttribute('srcset');
    img.decoding = 'async';
    if(eager){
      img.loading = 'eager';
      img.fetchPriority = 'high';
    } else {
      img.loading = 'lazy';
    }
  };

  // Logo transparente oficial: header, puerta de bienvenida y footer.
  document.querySelectorAll('.brand img,.welcome-logo,.footer-logo').forEach(img => setImg(img, HD.logo, true));

  // Fotografías principales.
  setImg(document.querySelector('.hero-media img'), HD.hero, true);
  setImg(document.querySelector('.about-media img'), HD.about);
  setImg(document.querySelector('.author-photo img'), HD.author);

  // Biblioteca: conserva cada título pero sustituye la miniatura comprimida por el original HD.
  document.querySelectorAll('.book .cover img').forEach(img => {
    const name = (img.getAttribute('src') || '').split('/').pop();
    if(HD.books[name]) setImg(img, HD.books[name]);
  });

  // Imágenes editoriales independientes del blog.
  document.querySelectorAll('#blog .thumb img').forEach((img, index) => {
    if(HD.blog[index]) setImg(img, HD.blog[index]);
  });

  // Curso MES horizontal en desktop/tablet y vertical en móvil.
  const courseImg = document.querySelector('.course-media img');
  const setResponsiveCourseAsset = () => {
    if(!courseImg) return;
    const mobile = window.matchMedia('(max-width: 620px)').matches;
    const wanted = mobile ? HD.courseVertical : HD.courseHorizontal;
    if(courseImg.src !== wanted) setImg(courseImg, wanted, true);
  };
  setResponsiveCourseAsset();
  window.addEventListener('resize', setResponsiveCourseAsset, {passive:true});

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
