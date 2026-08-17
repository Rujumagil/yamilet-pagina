(function(){
  const isItalian = document.documentElement.lang === 'it';

  // Assets oficiales HD alojados directamente en GitHub Pages.
  const HD = {
    logo: '../assets/logo-yamilet.png',
    hero: '../assets/hero-yamilet.png',
    about: '../assets/sobre-yamilet.png',
    author: '../assets/sobre-yamilet.png',
    courseHorizontal: '../assets/curso-metodo-mes.png',
    courseVertical: '../assets/curso-metodo-mes-vertical.png',
    books: {
      'libro-en-la-raiz-del-perdon.webp': '../assets/libro-en-la-raiz-del-perdon.png',
      'libro-en-la-raiz-del-perdon.png': '../assets/libro-en-la-raiz-del-perdon.png',
      'libro-metodo-mes.webp': '../assets/libro-metodo-mes.png',
      'libro-metodo-mes.png': '../assets/libro-metodo-mes.png',
      'libro-expresia.webp': '../assets/libro-expresia.png',
      'libro-expresia.png': '../assets/libro-expresia.png',
      'libro-retazos-de-mi-alma.webp': '../assets/libro-retazos-de-mi-alma.png',
      'libro-retazos-de-mi-alma.png': '../assets/libro-retazos-de-mi-alma.png',
      'libro-nel-silenzio-del-dovere.webp': '../assets/libro-nel-silenzio-del-dovere.png',
      'libro-nel-silenzio-del-dovere.png': '../assets/libro-nel-silenzio-del-dovere.png',
      'libro-apegos.webp': '../assets/libro-apegos.png',
      'libro-apegos.png': '../assets/libro-apegos.png'
    },
    // Se conservan como respaldo hasta que las 4 imágenes editoriales se suban al repo.
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

  document.querySelectorAll('.brand img,.welcome-logo,.footer-logo').forEach(img => setImg(img, HD.logo, true));
  setImg(document.querySelector('.hero-media img'), HD.hero, true);
  setImg(document.querySelector('.about-media img'), HD.about);
  setImg(document.querySelector('.author-photo img'), HD.author);

  document.querySelectorAll('.book .cover img').forEach(img => {
    const name = (img.getAttribute('src') || '').split('/').pop();
    if(HD.books[name]) setImg(img, HD.books[name]);
  });

  document.querySelectorAll('#blog .thumb img').forEach((img, index) => {
    if(HD.blog[index]) setImg(img, HD.blog[index]);
  });

  const courseImg = document.querySelector('.course-media img');
  const setResponsiveCourseAsset = () => {
    if(!courseImg) return;
    const mobile = window.matchMedia('(max-width: 620px)').matches;
    setImg(courseImg, mobile ? HD.courseVertical : HD.courseHorizontal, true);
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
      link.title = isItalian
        ? 'L’accesso all’Accademia sarà attivato al momento della consegna.'
        : 'El acceso a la Academia se activará en la entrega.';
    }
  });

  function renderFreeClassBooking(){
    const section = document.querySelector('#clase');
    if(!section) return;

    section.innerHTML = isItalian ? `
      <div class="container">
        <div class="freeclass-copy">
          <div class="kicker">Il tuo primo passo</div>
          <h2>Prenota la tua lezione gratuita del Metodo MES.</h2>
          <p>Scegli il giorno che preferisci e lascia i tuoi dati. La richiesta resterà pronta per la conferma della disponibilità.</p>
          <div class="freeclass-benefits">
            <span>✓ Introduzione al Metodo MES</span><span>✓ Esercizio di presenza</span><span>✓ Scrittura guidata</span><span>✓ Prossimi passi</span>
          </div>
        </div>
        <div class="booking-shell glass-dark">
          <div class="kicker">Prenotazione</div>
          <h3>La tua lezione gratuita</h3>
          <p>Compila i dati per richiedere il giorno della tua sessione.</p>
          <form class="booking-form" data-free-class-form>
            <div class="booking-field full"><label for="booking-date">Scegli il giorno</label><input id="booking-date" name="date" type="date" required data-booking-date></div>
            <div class="booking-field"><label for="booking-name">Nome</label><input id="booking-name" name="name" type="text" autocomplete="name" required placeholder="Il tuo nome"></div>
            <div class="booking-field"><label for="booking-email">E-mail</label><input id="booking-email" name="email" type="email" autocomplete="email" required placeholder="nome@email.com"></div>
            <button class="btn btn-gold booking-submit" type="submit">Prenota la lezione gratuita</button>
            <p class="booking-status" data-booking-status aria-live="polite"></p>
            <p class="booking-note">La disponibilità definitiva sarà confermata dopo l’invio della richiesta.</p>
          </form>
        </div>
      </div>` : `
      <div class="container">
        <div class="freeclass-copy">
          <div class="kicker">Tu primer paso</div>
          <h2>Agenda tu clase gratis del Método MES.</h2>
          <p>Selecciona el día que prefieres y deja tus datos. La solicitud quedará lista para confirmar disponibilidad y darte seguimiento.</p>
          <div class="freeclass-benefits">
            <span>✓ Introducción al Método MES</span><span>✓ Ejercicio de presencia</span><span>✓ Escritura guiada</span><span>✓ Próximos pasos</span>
          </div>
        </div>
        <div class="booking-shell glass-dark">
          <div class="kicker">Reservación</div>
          <h3>Tu clase gratuita</h3>
          <p>Completa tus datos para solicitar el día de tu sesión.</p>
          <form class="booking-form" data-free-class-form>
            <div class="booking-field full"><label for="booking-date">Selecciona el día</label><input id="booking-date" name="date" type="date" required data-booking-date></div>
            <div class="booking-field"><label for="booking-name">Nombre</label><input id="booking-name" name="name" type="text" autocomplete="name" required placeholder="Tu nombre"></div>
            <div class="booking-field"><label for="booking-email">Correo</label><input id="booking-email" name="email" type="email" autocomplete="email" required placeholder="nombre@correo.com"></div>
            <button class="btn btn-gold booking-submit" type="submit">Reservar mi clase gratis</button>
            <p class="booking-status" data-booking-status aria-live="polite"></p>
            <p class="booking-note">La disponibilidad definitiva se confirmará después de enviar la solicitud.</p>
          </form>
        </div>
      </div>`;
  }

  function initBooking(){
    const form = document.querySelector('[data-free-class-form]');
    if(!form) return;
    const dateInput = form.querySelector('[data-booking-date]');
    const status = form.querySelector('[data-booking-status]');
    const submit = form.querySelector('button[type=submit]');

    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    if(dateInput) dateInput.min = localISO;

    const max = new Date(now);
    max.setDate(max.getDate()+90);
    const maxISO = new Date(max.getTime() - max.getTimezoneOffset()*60000).toISOString().slice(0,10);
    if(dateInput) dateInput.max = maxISO;

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const data = new FormData(form);
      const payload = {
        form_type:'free_class_booking',
        source:'yamilet-landing',
        locale:isItalian ? 'it' : 'es',
        date:String(data.get('date') || ''),
        name:String(data.get('name') || '').trim(),
        email:String(data.get('email') || '').trim().toLowerCase(),
        page_url:location.href,
        created_at:new Date().toISOString()
      };
      if(!payload.date || !payload.name || !payload.email) return;

      const bookingCfg = cfg.booking && cfg.booking.enabled && cfg.booking.endpoint
        ? cfg.booking
        : (cfg.leadCapture && cfg.leadCapture.enabled && cfg.leadCapture.endpoint ? cfg.leadCapture : null);

      if(!bookingCfg){
        status.textContent = isItalian
          ? 'Il modulo è pronto. L’invio automatico si attiverà quando collegheremo Supabase.'
          : 'El formulario ya está listo. El envío automático se activará al conectar Supabase.';
        return;
      }

      submit.disabled = true;
      status.textContent = isItalian ? 'Invio della richiesta…' : 'Enviando tu solicitud…';
      try{
        const res = await fetch(bookingCfg.endpoint,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        if(!res.ok) throw new Error('booking_failed');
        status.classList.add('is-success');
        status.textContent = isItalian
          ? 'Richiesta ricevuta. Ti contatteremo per confermare la disponibilità.'
          : 'Solicitud recibida. Te contactaremos para confirmar la disponibilidad.';
        form.reset();
        if(dateInput) dateInput.min = localISO;
      }catch(err){
        status.textContent = isItalian
          ? 'Non è stato possibile inviare la richiesta. Riprova tra poco.'
          : 'No fue posible enviar la solicitud. Intenta nuevamente en un momento.';
      }finally{
        submit.disabled = false;
      }
    });
  }

  function initBookReel(){
    const grid = document.querySelector('#libros .books-grid');
    if(!grid || grid.dataset.reelReady === 'true') return;
    grid.dataset.reelReady = 'true';
    grid.classList.remove('books-grid');
    grid.classList.add('books-track');
    grid.setAttribute('data-books-track','');

    const reel = document.createElement('div');
    reel.className = 'books-reel';
    reel.setAttribute('data-books-reel','');
    grid.parentNode.insertBefore(reel, grid);

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'reel-arrow prev';
    prev.setAttribute('aria-label', isItalian ? 'Libri precedenti' : 'Libros anteriores');
    prev.innerHTML = '‹';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'reel-arrow next';
    next.setAttribute('aria-label', isItalian ? 'Libri successivi' : 'Siguientes libros');
    next.innerHTML = '›';

    reel.append(prev, grid, next);
    const hint = document.createElement('div');
    hint.className = 'reel-hint';
    hint.textContent = isItalian ? 'Scorri per esplorare tutti i libri' : 'Desliza para recorrer todos los libros';
    reel.insertAdjacentElement('afterend', hint);

    const step = () => Math.min(300, Math.max(230, grid.clientWidth * .72));
    prev.addEventListener('click', ()=> grid.scrollBy({left:-step(),behavior:'smooth'}));
    next.addEventListener('click', ()=> grid.scrollBy({left:step(),behavior:'smooth'}));
  }

  renderFreeClassBooking();
  initBooking();
  initBookReel();

  const newsletter = document.querySelector('[data-newsletter]');
  if(newsletter){
    newsletter.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = newsletter.querySelector('input[type=email]')?.value?.trim();
      if(!email) return;
      if(cfg.leadCapture && cfg.leadCapture.enabled && cfg.leadCapture.endpoint){
        try{
          const res = await fetch(cfg.leadCapture.endpoint,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email,source:'yamilet-landing',locale:isItalian?'it':'es',form_type:'newsletter'})
          });
          if(!res.ok) throw new Error('capture_failed');
          alert(isItalian ? 'Grazie. Iscrizione ricevuta.' : 'Gracias. Tu registro fue recibido.');
          newsletter.reset();
          return;
        }catch(err){}
      }
      alert(isItalian
        ? 'Modulo pronto per essere collegato a Supabase al momento della consegna.'
        : 'Formulario listo para conectarse con Supabase al momento de la entrega.');
    });
  }
})();
