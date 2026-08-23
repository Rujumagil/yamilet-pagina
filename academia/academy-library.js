(() => {
  'use strict';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  let activeFilter = 'all';

  function typeOf(card){
    const text = ($('.library-meta',card)?.textContent || '').trim().toLowerCase();
    if(/pdf|manual|gu[ií]a|document/.test(text)) return 'document';
    if(/audio|mp3|m4a|wav/.test(text)) return 'audio';
    if(/ejercicio|actividad|worksheet/.test(text)) return 'exercise';
    if(/link|enlace|url/.test(text)) return 'link';
    return 'other';
  }

  function applyFilters(page){
    const q = ($('[data-library-search]',page)?.value || '').trim().toLowerCase();
    $$('.library-card',page).forEach(card => {
      const haystack = card.textContent.toLowerCase();
      const type = card.dataset.libraryType || 'other';
      card.hidden = !((activeFilter === 'all' || activeFilter === type) && (!q || haystack.includes(q)));
    });
    const visible = $$('.library-card',page).filter(c => !c.hidden).length;
    const count = $('[data-library-visible-count]',page);
    if(count) count.textContent = String(visible);
  }

  function emptyMarkup(){
    return `<div class="academy-library-hero"><div><span>BIBLIOTECA ACADÉMICA</span><h2>Tu material de aprendizaje, en un solo lugar</h2><p>Aquí aparecerán los manuales, audios, ejercicios y recursos vinculados a tus cursos cuando sean publicados.</p></div><div class="academy-library-stat"><strong>0</strong><span>recursos disponibles</span></div></div>
    <div class="academy-library-empty"><div class="academy-library-empty-icon">▤</div><div><span>Biblioteca preparada</span><h3>Aún no hay materiales publicados</h3><p>Cuando se agreguen recursos a Método MES®, se organizarán automáticamente aquí por tipo y curso.</p></div></div>`;
  }

  function enhanceLibrary(){
    const page = $('[data-shell-page="library"]');
    if(!page || page.classList.contains('hidden')) return;
    const cards = $$('.library-card',page);
    if(!cards.length){
      page.classList.add('academy-library-page');
      page.innerHTML = emptyMarkup();
      return;
    }
    if(page.dataset.libraryEnhanced === '1') return;
    page.dataset.libraryEnhanced = '1';
    page.classList.add('academy-library-page');
    cards.forEach(card => { card.dataset.libraryType = typeOf(card); });
    const heading = $('.shell-page-heading',page);
    const toolbar = document.createElement('div');
    toolbar.className = 'academy-library-toolbar';
    toolbar.innerHTML = `<div class="academy-library-search"><span>⌕</span><input type="search" data-library-search placeholder="Buscar en mi biblioteca" aria-label="Buscar recursos"></div><div class="academy-library-filters"><button class="active" data-library-filter="all">Todos</button><button data-library-filter="document">Documentos</button><button data-library-filter="audio">Audio</button><button data-library-filter="exercise">Ejercicios</button><button data-library-filter="link">Enlaces</button></div><div class="academy-library-visible"><strong data-library-visible-count>${cards.length}</strong><span>visibles</span></div>`;
    heading?.insertAdjacentElement('afterend',toolbar);
    $('[data-library-search]',toolbar)?.addEventListener('input',()=>applyFilters(page));
    $$('[data-library-filter]',toolbar).forEach(btn=>btn.addEventListener('click',()=>{
      activeFilter = btn.dataset.libraryFilter;
      $$('[data-library-filter]',toolbar).forEach(b=>b.classList.toggle('active',b===btn));
      applyFilters(page);
    }));
    applyFilters(page);
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-shell-route="library"]')){
      setTimeout(enhanceLibrary,140);
      setTimeout(enhanceLibrary,520);
    }
  });
  window.addEventListener('pageshow',()=>setTimeout(enhanceLibrary,250));
  window.ACADEMIA_YAMILET_LIBRARY = { enhance: enhanceLibrary };
})();