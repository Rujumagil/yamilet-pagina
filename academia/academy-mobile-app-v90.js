(()=>{
  'use strict';
  const VERSION='90.0.0';
  const items=[['#home','⌂','Inicio'],['#courses','▣','Cursos'],['#agenda','◷','Agenda'],['#library','◇','Biblioteca'],['#profile','○','Perfil']];
  const mount=()=>{
    if(document.querySelector('[data-mobile-app-nav]')) return;
    const dash=document.querySelector('[data-dashboard]'); if(!dash) return;
    const nav=document.createElement('nav'); nav.className='mobile-app-nav'; nav.setAttribute('data-mobile-app-nav',''); nav.setAttribute('aria-label','Navegación principal');
    nav.innerHTML=items.map(([href,icon,label])=>`<button type="button" data-mobile-app-route="${href}" aria-label="${label}"><span class="mobile-app-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('');
    document.body.appendChild(nav);
    nav.addEventListener('click',e=>{const b=e.target.closest('[data-mobile-app-route]');if(!b)return;const href=b.getAttribute('data-mobile-app-route');if(location.hash!==href)location.hash=href;window.dispatchEvent(new HashChangeEvent('hashchange'));});
    const sync=()=>{const current=(location.hash||'#home').toLowerCase();nav.querySelectorAll('[data-mobile-app-route]').forEach(b=>{const active=b.getAttribute('data-mobile-app-route')===current;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')})};
    window.addEventListener('hashchange',sync); sync();
  };
  const start=()=>{mount();new MutationObserver(()=>mount()).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_MOBILE_APP={version:VERSION,mount};
})();
