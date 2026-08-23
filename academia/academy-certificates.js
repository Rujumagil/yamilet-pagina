(() => {
  'use strict';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];

  function overallProgress(){
    const raw = ($('[data-overall-progress]')?.textContent || '0').replace('%','').trim();
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  }

  function courseName(){
    return $('.learning-course-list h3, .learning-course-list h2, [data-course-list] h3')?.textContent?.trim() || 'Método MES®';
  }

  function summaryValues(page){
    const values = $$('.shell-summary article strong',page).map(n=>Number(n.textContent.trim())||0);
    return { obtained: values[0]||0, programs: values[1]||0 };
  }

  function ensureHero(page){
    if($('.academy-cert-hero',page)) return;
    const heading=$('.shell-page-heading',page); if(!heading) return;
    const progress=overallProgress();
    const {obtained,programs}=summaryValues(page);
    const hero=document.createElement('section');
    hero.className='academy-cert-hero';
    hero.innerHTML=`<div class="academy-cert-hero-copy"><span class="academy-cert-kicker">RECONOCIMIENTO ACADÉMICO</span><h3>Tu camino hacia la certificación</h3><p>Consulta tu avance y conserva aquí los certificados oficiales emitidos por Academia Yamilet. La emisión depende de los requisitos configurados para cada programa.</p></div><div class="academy-cert-progress"><div class="academy-cert-ring" style="--cert-progress:${progress*3.6}deg"><div><strong>${progress}%</strong><span>avance general</span></div></div></div><div class="academy-cert-summary"><article><span>Certificados obtenidos</span><strong>${obtained}</strong></article><article><span>Programas activos</span><strong>${programs}</strong></article></div>`;
    heading.insertAdjacentElement('afterend',hero);
  }

  function ensureRequirements(page){
    if($('.academy-cert-requirements',page)) return;
    const hero=$('.academy-cert-hero',page); if(!hero) return;
    const progress=overallProgress();
    const block=document.createElement('section');
    block.className='academy-cert-requirements';
    block.innerHTML=`<article class="academy-cert-requirement ${progress>=100?'complete':'pending'}"><b>01</b><strong>Completar el recorrido académico</strong><small>${progress>=100?'Tu progreso general aparece completo.':'Continúa avanzando en las lecciones asignadas a tu programa.'}</small></article><article class="academy-cert-requirement pending"><b>02</b><strong>Cumplir requisitos del programa</strong><small>Los requisitos específicos se validan según la configuración académica del curso.</small></article><article class="academy-cert-requirement pending"><b>03</b><strong>Emisión y verificación</strong><small>Cuando el certificado sea emitido, aparecerá aquí con su código de verificación.</small></article>`;
    hero.insertAdjacentElement('afterend',block);
  }

  function enhanceEmpty(page){
    const empty=$('.shell-empty',page); const grid=$('.shell-grid',page);
    if(!empty || grid || empty.dataset.certEnhanced==='1') return;
    empty.dataset.certEnhanced='1'; empty.classList.add('academy-cert-empty');
    empty.innerHTML=`<div class="academy-cert-empty-icon">♛</div><div><span class="academy-cert-kicker">${courseName()}</span><h3>Aún no tienes certificados emitidos</h3><p>Este espacio ya está preparado para conservar tus certificados oficiales. Cuando completes los requisitos de un programa con certificación activa, el documento emitido aparecerá aquí.</p></div><div class="academy-cert-empty-note">No se muestra ningún diploma de ejemplo: esta sección utiliza únicamente certificados reales registrados en Academia Yamilet.</div>`;
  }

  function decorateCards(page){
    $$('.shell-grid.two .shell-card',page).forEach(card=>{
      if(card.dataset.certDecorated==='1') return;
      card.dataset.certDecorated='1'; card.classList.add('academy-cert-card');
      const code=$('.library-meta',card)?.textContent?.trim()||'';
      const footer=$('.shell-card-footer',card);
      if(code){
        const codeBox=document.createElement('div');
        codeBox.className='academy-cert-code';
        codeBox.innerHTML=`<span>Código de verificación</span><strong>${code.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong>`;
        footer?.insertAdjacentElement('beforebegin',codeBox);
        const actions=document.createElement('div');
        actions.className='academy-cert-actions';
        actions.innerHTML='<button type="button" data-copy-cert>Copiar código</button>';
        codeBox.insertAdjacentElement('afterend',actions);
        $('[data-copy-cert]',actions)?.addEventListener('click',async e=>{
          try{await navigator.clipboard.writeText(code);e.currentTarget.textContent='Código copiado';setTimeout(()=>e.currentTarget.textContent='Copiar código',1600);}catch{e.currentTarget.textContent='Copia manualmente';}
        });
      }
    });
  }

  function enhanceCertificates(){
    const page=$('[data-shell-page="certificates"]');
    if(!page || page.classList.contains('hidden')) return false;
    if(!$('.shell-page-heading',page)) return false;
    page.classList.add('academy-certificates-page');
    ensureHero(page); ensureRequirements(page); enhanceEmpty(page); decorateCards(page);
    return true;
  }

  function schedule(){[90,260,650,1200].forEach(ms=>setTimeout(enhanceCertificates,ms));}
  document.addEventListener('click',e=>{if(e.target.closest('[data-shell-route="certificates"]')) schedule();});
  window.addEventListener('pageshow',schedule);
  window.ACADEMIA_YAMILET_CERTIFICATES={enhance:enhanceCertificates};
})();