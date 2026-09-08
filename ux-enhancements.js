(function(){
  'use strict';

  const isItalian = document.documentElement.lang === 'it';
  const cfg = window.YAMILET_INTEGRATION_CONFIG || {};

  function text(el, value){ if(el && value) el.textContent = value; }

  function enhanceHero(){
    const hero = document.querySelector('.hero');
    if(!hero) return;
    text(hero.querySelector('.eyebrow'), isItalian ? 'Yamilet Pérez · autrice · educatrice · creatrice del Metodo MES®' : 'Yamilet Pérez · autora · educadora · creadora del Método MES®');
    text(hero.querySelector('.lead'), isItalian
      ? 'Mindfulness e scrittura terapeutica per ascoltarti, comprendere la tua storia e trasformare il modo in cui la vivi.'
      : 'Mindfulness y escritura terapéutica para escucharte, comprender tu historia y transformar la manera en que la vives.');
    text(hero.querySelector('.micro'), isItalian
      ? 'Un’esperienza creata per accompagnarti con il tuo ritmo, profondità e chiarezza.'
      : 'Una experiencia creada para acompañarte a tu ritmo, con profundidad y claridad.');

    if(!hero.querySelector('.hero-signals')){
      const signals = document.createElement('div');
      signals.className = 'hero-signals';
      const items = isItalian
        ? ['Mindfulness','Scrittura terapeutica','Creatività']
        : ['Mindfulness','Escritura terapéutica','Creatividad'];
      items.forEach(item=>{
        const span = document.createElement('span');
        span.textContent = item;
        signals.appendChild(span);
      });
      hero.querySelector('.micro')?.insertAdjacentElement('afterend', signals);
    }
  }

  function enhanceMethod(){
    const section = document.querySelector('#metodo');
    if(!section) return;
    const cards = section.querySelectorAll('.method-card');
    const copy = isItalian ? [
      ['Medita','Torna al presente e osserva ciò che accade dentro di te con più chiarezza.'],
      ['Scrivi','Dai parole, ordine e significato a pensieri, ricordi ed emozioni.'],
      ['Guarisci','Integra ciò che hai vissuto e apri spazio a nuove decisioni e possibilità.']
    ] : [
      ['Medita','Vuelve al presente y observa lo que ocurre dentro de ti con mayor claridad.'],
      ['Escribe','Dale palabras, orden y significado a tus pensamientos, recuerdos y emociones.'],
      ['Sana','Integra lo vivido y abre espacio para nuevas decisiones y posibilidades.']
    ];
    cards.forEach((card,index)=>{
      if(!copy[index]) return;
      text(card.querySelector('h3'), copy[index][0]);
      text(card.querySelector('p'), copy[index][1]);
    });

    if(!section.querySelector('.section-actions')){
      const actions = document.createElement('div');
      actions.className = 'section-actions';
      actions.innerHTML = isItalian
        ? '<a class="btn btn-primary" href="#clase">Provare una lezione gratuita</a><a class="text-link" href="#academia">Continuare nell’Accademia →</a>'
        : '<a class="btn btn-primary" href="#clase">Probar una clase gratuita</a><a class="text-link" href="#academia">Continuar en la Academia →</a>';
      section.querySelector('.method-grid')?.insertAdjacentElement('afterend', actions);
    }
  }

  function enhanceBooking(){
    const section = document.querySelector('#clase');
    const copy = section?.querySelector('.freeclass-copy');
    const shell = section?.querySelector('.booking-shell');
    const form = section?.querySelector('[data-free-class-form]');
    if(!section || !copy || !shell || !form) return;

    if(!copy.querySelector('.class-meta')){
      const meta = document.createElement('div');
      meta.className = 'class-meta';
      const items = isItalian ? ['30–45 min','Online','Gratuita'] : ['30–45 min','Online','Sin costo'];
      items.forEach(item=>{
        const span=document.createElement('span');
        span.textContent=item;
        meta.appendChild(span);
      });
      copy.querySelector('p')?.insertAdjacentElement('afterend', meta);
    }

    if(!shell.querySelector('.booking-context')){
      const context = document.createElement('div');
      context.className = 'booking-context';
      context.innerHTML = isItalian
        ? '<span>Sessione introduttiva</span><span>Conferma successiva</span>'
        : '<span>Sesión introductoria</span><span>Confirmación posterior</span>';
      shell.querySelector('p')?.insertAdjacentElement('afterend', context);
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    if(!form.querySelector('input[name="timezone"]')){
      const hidden = document.createElement('input');
      hidden.type='hidden';
      hidden.name='timezone';
      hidden.value=timezone;
      form.appendChild(hidden);
    }
    if(!form.querySelector('.booking-timezone')){
      const zone = document.createElement('div');
      zone.className='booking-timezone';
      zone.innerHTML = isItalian
        ? `Fuso orario rilevato: <strong>${timezone}</strong>`
        : `Zona horaria detectada: <strong>${timezone}</strong>`;
      form.querySelector('.booking-submit')?.insertAdjacentElement('beforebegin', zone);
    }

    const note = form.querySelector('.booking-note');
    if(note){
      note.innerHTML = isItalian
        ? 'La disponibilità definitiva sarà confermata dopo l’invio. Consulta la nostra <a href="privacy.html">informativa sulla privacy</a>.'
        : 'La disponibilidad definitiva se confirmará después de enviar la solicitud. Consulta nuestro <a href="privacidad.html">Aviso de Privacidad</a>.';
    }
    if(!form.querySelector('.booking-next')){
      const next = document.createElement('div');
      next.className='booking-next';
      next.textContent = isItalian
        ? 'Dopo l’invio riceverai il seguito necessario per confermare giorno e disponibilità.'
        : 'Después de enviar tu solicitud recibirás el seguimiento para confirmar día y disponibilidad.';
      note?.insertAdjacentElement('afterend', next);
    }
  }

  function enhanceAcademy(){
    const section = document.querySelector('#academia');
    if(!section) return;
    const headP = section.querySelector('.section-head p');
    text(headP, isItalian
      ? 'Corsi, laboratori e percorsi guidati per continuare a praticare il Metodo MES® con struttura e accompagnamento.'
      : 'Cursos, talleres y recorridos guiados para continuar practicando el Método MES® con estructura y acompañamiento.');

    const courseP = section.querySelector('.course-copy p');
    text(courseP, isItalian
      ? 'Un percorso guidato per integrare mindfulness, scrittura terapeutica e creatività nella vita quotidiana.'
      : 'Un recorrido guiado para integrar mindfulness, escritura terapéutica y creatividad en tu vida cotidiana.');

    const courseCopy = section.querySelector('.course-copy');
    if(courseCopy && !courseCopy.querySelector('.academy-login-link')){
      const login=document.createElement('a');
      login.className='academy-login-link';
      login.href='../academia/';
      login.setAttribute('data-academy-link','');
      login.setAttribute('data-academy-cta','academy-course-login');
      login.textContent=isItalian ? 'Hai già un account? Accedi →' : '¿Ya eres alumna? Iniciar sesión →';
      courseCopy.appendChild(login);
    }
  }

  function enhanceBooks(){
    const section=document.querySelector('#libros');
    if(!section) return;
    text(section.querySelector('.section-head p'), isItalian
      ? 'Storie, poesia e strumenti per accompagnarti in momenti diversi del tuo percorso.'
      : 'Historias, poesía y herramientas para acompañarte en distintos momentos de tu camino.');

    const track=section.querySelector('.books-track');
    if(!track || section.querySelector('.reel-dots')) return;
    const cards=[...track.querySelectorAll('.book')];
    if(cards.length<2) return;
    const dots=document.createElement('div');
    dots.className='reel-dots';
    dots.setAttribute('aria-label', isItalian ? 'Navigazione libri' : 'Navegación de libros');
    cards.forEach((card,index)=>{
      const dot=document.createElement('button');
      dot.type='button';
      dot.className='reel-dot'+(index===0?' is-active':'');
      dot.setAttribute('aria-label', (isItalian?'Vai al libro ':'Ir al libro ')+(index+1));
      dot.addEventListener('click',()=>{
        const left=card.offsetLeft-(track.clientWidth-card.clientWidth)/2;
        track.scrollTo({left:Math.max(0,left),behavior:'smooth'});
      });
      dots.appendChild(dot);
    });
    const hint=section.querySelector('.reel-hint');
    (hint||track).insertAdjacentElement('afterend',dots);

    let scheduled=false;
    const update=()=>{
      scheduled=false;
      const center=track.scrollLeft+track.clientWidth/2;
      let best=0,dist=Infinity;
      cards.forEach((card,index)=>{
        const c=card.offsetLeft+card.clientWidth/2;
        const d=Math.abs(center-c);
        if(d<dist){dist=d;best=index;}
      });
      dots.querySelectorAll('.reel-dot').forEach((dot,index)=>dot.classList.toggle('is-active',index===best));
    };
    track.addEventListener('scroll',()=>{
      if(scheduled) return;
      scheduled=true;
      requestAnimationFrame(update);
    },{passive:true});
  }

  function enhanceAbout(){
    const section=document.querySelector('#yamilet');
    if(!section) return;
    section.querySelector('.author-strip')?.remove();
    text(section.querySelector('p'), isItalian
      ? 'Yamilet Pérez è autrice, educatrice e creatrice del Metodo MES®. Unisce scrittura, mindfulness e creatività per accompagnare processi di consapevolezza e crescita personale con uno sguardo vicino, sensibile e pratico.'
      : 'Yamilet Pérez es autora, educadora y creadora del Método MES®. Une escritura, mindfulness y creatividad para acompañar procesos de autoconocimiento y crecimiento personal desde una mirada cercana, sensible y práctica.');
    if(!section.querySelector('.about-authority')){
      const authority=document.createElement('div');
      authority.className='about-authority';
      const items=isItalian ? ['Autrice pubblicata','Metodo MES®','Mindfulness','Scrittura terapeutica'] : ['Autora publicada','Método MES®','Mindfulness','Escritura terapéutica'];
      items.forEach(item=>{const span=document.createElement('span');span.textContent=item;authority.appendChild(span);});
      section.querySelector('.credentials')?.insertAdjacentElement('afterend',authority);
    }
  }

  function enhanceBlog(){
    const section=document.querySelector('#blog');
    if(!section) return;
    text(section.querySelector('.section-head p'), isItalian
      ? 'Letture brevi su mindfulness, scrittura, presenza e benessere quotidiano.'
      : 'Lecturas breves sobre mindfulness, escritura, presencia y bienestar cotidiano.');
    section.querySelectorAll('.post').forEach(post=>{
      const body=post.querySelector('.post-body');
      if(!body || body.querySelector('.post-meta')) return;
      const meta=document.createElement('div');
      meta.className='post-meta';
      meta.textContent=isItalian ? 'Lettura breve' : 'Lectura breve';
      body.insertBefore(meta,body.firstChild);
      const note=document.createElement('span');
      note.className='post-note';
      note.textContent=isItalian ? 'Ispirazione per la tua pratica' : 'Inspiración para tu práctica';
      body.appendChild(note);
    });
  }

  function enhanceNewsletter(){
    const section=document.querySelector('#contacto');
    if(!section) return;
    text(section.querySelector('.newsletter-box>div:first-child p'), isItalian
      ? 'Ricevi pratiche, letture e novità del Metodo MES® direttamente nella tua e-mail.'
      : 'Recibe prácticas, lecturas y novedades del Método MES® directamente en tu correo.');
  }

  function enhanceMenu(){
    const nav=document.querySelector('[data-nav]');
    const btn=document.querySelector('[data-menu-btn]');
    if(nav && btn){
      nav.id=nav.id||'menu-principal';
      btn.setAttribute('aria-controls',nav.id);
      btn.addEventListener('click',()=>{
        btn.setAttribute('aria-label',nav.classList.contains('open') ? (isItalian?'Chiudi menu':'Cerrar menú') : (isItalian?'Apri menu':'Abrir menú'));
      });
    }
  }

  function addBookingTimezoneToPayload(){
    const endpoint=cfg.booking?.endpoint;
    if(!endpoint || window.__yamiletTimezoneFetchWrapped) return;
    window.__yamiletTimezoneFetchWrapped=true;
    const previousFetch=window.fetch.bind(window);
    window.fetch=function(input,init={}){
      try{
        const target=typeof input==='string'?input:input?.url||'';
        if(target===endpoint && String(init.method||'GET').toUpperCase()==='POST' && typeof init.body==='string'){
          const body=JSON.parse(init.body);
          if(!body.timezone) body.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'local';
          init={...init,body:JSON.stringify(body)};
        }
      }catch(_){ }
      return previousFetch(input,init);
    };
  }

  function upsertMeta(selector, attrs){
    let el=document.head.querySelector(selector);
    if(!el){
      el=document.createElement('meta');
      document.head.appendChild(el);
    }
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,value));
    return el;
  }

  function enhanceSeoMeta(){
    const base='https://www.yamiletperez.com';
    const canonical=isItalian ? `${base}/it/` : `${base}/es/`;
    const image=`${bas../assets/curso-metodo-mes.webp`;
    upsertMeta('meta[name="robots"]',{name:'robots',content:'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
    upsertMeta('meta[name="author"]',{name:'author',content:'Yamilet Pérez'});
    upsertMeta('meta[property="og:url"]',{property:'og:url',content:canonical});
    upsertMeta('meta[property="og:site_name"]',{property:'og:site_name',content:'Yamilet Pérez'});
    upsertMeta('meta[property="og:locale"]',{property:'og:locale',content:isItalian?'it_IT':'es_MX'});
    upsertMeta('meta[property="og:image"]',{property:'og:image',content:image});
    upsertMeta('meta[property="og:image:alt"]',{property:'og:image:alt',content:isItalian?'Metodo MES di Yamilet Pérez':'Método MES de Yamilet Pérez'});
    upsertMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});
    upsertMeta('meta[name="twitter:title"]',{name:'twitter:title',content:isItalian?'Yamilet Pérez | Metodo MES®':'Yamilet Pérez | Método MES®'});
    upsertMeta('meta[name="twitter:description"]',{name:'twitter:description',content:isItalian?'Mindfulness e scrittura terapeutica per la donna contemporanea.':'Mindfulness y escritura terapéutica para la mujer actual.'});
    upsertMeta('meta[name="twitter:image"]',{name:'twitter:image',content:image});
  }

  function injectStructuredData(){
    if(document.querySelector('#yamilet-seo-schema')) return;
    const base='https://www.yamiletperez.com';
    const page=isItalian ? `${base}/it/` : `${base}/es/`;
    const personId=`${base}/#yamilet-perez`;
    const courseId=`${base}/#metodo-mes`;
    const bookData=[
      ['Método MES','https://www.amazon.com/dp/B0F38BQGPT'],
      ['Apegos','https://www.amazon.com/dp/B0CW1JNM5Z'],
      ['Expresia','https://www.amazon.com/dp/B0F5R1VX2V'],
      ['Retazos de mi alma','https://www.amazon.com/dp/B0DX6RN58F'],
      ['En la raíz del perdón','https://www.amazon.com/dp/B0G6JKFFCF'],
      ['Nel silenzio del dovere','https://www.amazon.com/dp/B0GR6XF23R']
    ];
    const graph=[
      {
        '@type':'WebSite','@id':`${base}/#website`,url:`${base}/`,name:'Yamilet Pérez',
        inLanguage:['es','it'],publisher:{'@id':personId}
      },
      {
        '@type':'Person','@id':personId,name:'Yamilet Pérez',url:page,
        image:`${bas../assets/sobre-yamilet.webp`,
        jobTitle:isItalian?'Autrice, educatrice e creatrice del Metodo MES®':'Autora, educadora y creadora del Método MES®',
        knowsAbout:isItalian
          ? ['Mindfulness','Scrittura terapeutica','Scrittura creativa','Crescita personale']
          : ['Mindfulness','Escritura terapéutica','Escritura creativa','Crecimiento personal']
      },
      {
        '@type':'WebPage','@id':`${page}#webpage`,url:page,
        name:isItalian?'Yamilet Pérez | Metodo MES®':'Yamilet Pérez | Método MES®',
        isPartOf:{'@id':`${base}/#website`},about:{'@id':personId},
        primaryImageOfPage:{'@type':'ImageObject',url:`${bas../assets/hero-yamilet.webp`},
        inLanguage:isItalian?'it-IT':'es-MX'
      },
      {
        '@type':'Course','@id':courseId,
        name:isItalian?'Metodo MES® — Medita, Scrivi, Guarisci':'Método MES® — Medita, Escribe, Sana',
        description:isItalian
          ? 'Percorso guidato che integra mindfulness, scrittura terapeutica e creatività.'
          : 'Recorrido guiado que integra mindfulness, escritura terapéutica y creatividad.',
        provider:{'@id':personId},url:`${page}#academia`,inLanguage:isItalian?'it':'es'
      },
      {
        '@type':'ItemList','@id':`${page}#libros`,name:isItalian?'Libri di Yamilet Pérez':'Libros de Yamilet Pérez',
        itemListElement:bookData.map(([name,url],index)=>({
          '@type':'ListItem',position:index+1,item:{'@type':'Book',name,url,author:{'@id':personId}}
        }))
      }
    ];
    const script=document.createElement('script');
    script.id='yamilet-seo-schema';
    script.type='application/ld+json';
    script.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph});
    document.head.appendChild(script);
  }

  function initLazyCourseMedia(){
    const media=document.querySelector('.course-media-lazy');
    if(!media || media.dataset.lazyCourseReady==='true') return;
    media.dataset.lazyCourseReady='true';
    media.classList.add('course-media');
    const img=media.querySelector('img');
    if(!img) return;
    const mq=window.matchMedia('(max-width: 620px)');
    const apply=()=>{
      const target=mq.matches?'../assets/curso-metodo-mes-vertical.webp':'../assets/curso-metodo-mes.webp';
      if(img.getAttribute('src')!==target) img.setAttribute('src',target);
      img.loading='lazy';
      img.decoding='async';
      try{ img.fetchPriority='low'; }catch(_){ }
    };
    apply();
    if(typeof mq.addEventListener==='function') mq.addEventListener('change',apply);
    else if(typeof mq.addListener==='function') mq.addListener(apply);
  }

  function optimizeImages(){
    document.querySelectorAll('img').forEach(img=>{
      img.decoding='async';
      if(img.closest('.hero-media')){
        img.loading='eager';
        try{ img.fetchPriority='high'; }catch(_){ }
      }else if(!img.closest('.brand') && !img.classList.contains('welcome-logo')){
        img.loading='lazy';
        try{ if(!img.closest('.course-media')) img.fetchPriority='low'; }catch(_){ }
      }
    });
  }

  const analyticsQueue=window.__yamiletAnalyticsQueue=window.__yamiletAnalyticsQueue||[];
  function sendAnalyticsEvent(eventName,metadata={}){
    const payload={metadata:{locale:isItalian?'it':'es',page_path:location.pathname,...metadata}};
    try{
      if(window.CompasTracking?.track){
        window.CompasTracking.track(eventName,payload);
        return true;
      }
    }catch(_){ }
    analyticsQueue.push([eventName,payload]);
    return false;
  }

  function flushAnalyticsQueue(){
    if(!window.CompasTracking?.track || !analyticsQueue.length) return;
    while(analyticsQueue.length){
      const [eventName,payload]=analyticsQueue.shift();
      try{ window.CompasTracking.track(eventName,payload); }catch(_){ break; }
    }
  }

  function initConversionTracking(){
    if(document.documentElement.dataset.yamiletTrackingReady==='true') return;
    document.documentElement.dataset.yamiletTrackingReady='true';

    document.addEventListener('click',event=>{
      const link=event.target.closest?.('a');
      if(!link) return;
      const href=link.getAttribute('href')||'';
      const label=(link.textContent||'').trim().replace(/\s+/g,' ').slice(0,100);
      const section=link.closest('section')?.id || (link.closest('header')?'header':link.closest('footer')?'footer':'page');

      if(href.includes('amazon.com') || href.includes('amzn.')){
        sendAnalyticsEvent('outbound_click',{destination:'amazon',label,section});
      }else if(link.matches('[data-academy-link]') || href.includes('/academia/')){
        sendAnalyticsEvent('academy_click',{label,section,cta:link.dataset.academyCta||''});
      }else if(href==='#clase' || link.closest('.hero .actions') || link.closest('.section-actions')){
        sendAnalyticsEvent('cta_click',{label,section,destination:href||'#clase'});
      }else if(link.matches('[data-lang-switch]')){
        sendAnalyticsEvent('language_switch',{language:link.dataset.langSwitch||'',section});
      }
    },{passive:true});

    const formDefs=[
      ['[data-free-class-form]','free_class'],
      ['[data-newsletter]','newsletter']
    ];
    formDefs.forEach(([selector,formType])=>{
      const form=document.querySelector(selector);
      if(!form) return;
      let started=false;
      const start=()=>{
        if(started) return;
        started=true;
        sendAnalyticsEvent('form_start',{form_type:formType});
      };
      form.addEventListener('focusin',start,{once:true});
      form.addEventListener('input',start,{once:true});
      form.addEventListener('submit',()=>sendAnalyticsEvent('form_submit_attempt',{form_type:formType}),{capture:true});
    });

    if('IntersectionObserver' in window){
      const seen=new Set();
      const observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(!entry.isIntersecting || entry.intersectionRatio<0.35) return;
          const id=entry.target.id;
          if(!id || seen.has(id)) return;
          seen.add(id);
          sendAnalyticsEvent('section_view',{section:id});
          observer.unobserve(entry.target);
        });
      },{threshold:[0.35]});
      ['metodo','clase','academia','libros','yamilet','blog','contacto'].forEach(id=>{
        const el=document.getElementById(id);
        if(el) observer.observe(el);
      });
    }

    window.addEventListener('load',()=>{
      flushAnalyticsQueue();
      setTimeout(flushAnalyticsQueue,1200);
      setTimeout(flushAnalyticsQueue,3500);
    },{once:true});
  }

  function run(){
    enhanceSeoMeta();
    injectStructuredData();
    initLazyCourseMedia();
    enhanceHero();
    enhanceMethod();
    enhanceBooking();
    enhanceAcademy();
    enhanceBooks();
    enhanceAbout();
    enhanceBlog();
    enhanceNewsletter();
    enhanceMenu();
    addBookingTimezoneToPayload();
    optimizeImages();
    initConversionTracking();
  }

  run();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
})();
