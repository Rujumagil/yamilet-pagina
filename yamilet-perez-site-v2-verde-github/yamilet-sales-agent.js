/* Yamilet Pérez · Agente de Ventas Compás Fly
   Conecta la página pública con el Web Chat de Compás One.
   Mantiene atribución, contexto de producto y ruta de ventas.
*/
(() => {
  'use strict';

  const CHAT_SCRIPT_URL='https://app.proyectocompas.app/compas-chat.js?v=58.8';
  const ATTRIBUTION_SCRIPT_URL='https://app.proyectocompas.app/compas-attribution.js?v=1.1';
  const PUBLIC_KEY='wc_94eeb529d09ab712b4961646af31d03e4d1b';
  const ROUTE='sales';
  const CONTEXT_KEY='yamilet-sales-agent-context-v1';
  const ATTRIBUTION_KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid','msclkid'];

  function normalize(value){
    return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  }

  function contextText(el){
    const box=el?.closest?.('article,.card,.course-copy,section')||el?.parentElement;
    return normalize((box?.textContent||'')+' '+(el?.textContent||''));
  }

  function inferProduct(el){
    const explicit=el?.getAttribute?.('data-yamilet-product')||el?.closest?.('[data-yamilet-product]')?.getAttribute('data-yamilet-product');
    if(explicit)return explicit.trim();
    const text=contextText(el);
    if(text.includes('clase')||text.includes('lezione'))return 'clase-gratuita-metodo-mes';
    if(text.includes('metodo mes')||text.includes('método mes'))return 'metodo-mes';
    if(text.includes('academia')||text.includes('accademia'))return 'academia-yamilet';
    if(text.includes('libro')||text.includes('book'))return 'libros-yamilet';
    if(text.includes('taller')||text.includes('workshop'))return 'talleres-yamilet';
    return 'orientacion-yamilet';
  }

  function ensureAttribution(){
    if(window.CompasTracking?.__initialized)return Promise.resolve();
    const existing=document.querySelector('script[src*="compas-attribution.js"]');
    if(existing){
      return new Promise(resolve=>{
        if(window.CompasTracking?.__initialized)return resolve();
        existing.addEventListener('load',resolve,{once:true});
        setTimeout(resolve,1600);
      });
    }
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=ATTRIBUTION_SCRIPT_URL;
      script.async=true;
      script.dataset.key=PUBLIC_KEY;
      script.dataset.product='yamilet-metodo-mes';
      script.dataset.funnel='yamilet-site';
      script.dataset.yamiletSalesAttribution='true';
      script.addEventListener('load',resolve,{once:true});
      script.addEventListener('error',reject,{once:true});
      document.head.appendChild(script);
    });
  }

  function ensureChat(){
    if(document.querySelector('compas-one-web-chat'))return Promise.resolve();
    const existing=document.querySelector('script[src*="compas-chat.js"]');
    if(existing){
      return new Promise(resolve=>{
        if(document.querySelector('compas-one-web-chat'))return resolve();
        existing.addEventListener('load',resolve,{once:true});
        setTimeout(resolve,1800);
      });
    }
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.id='yamilet-compas-fly-sales';
      script.src=CHAT_SCRIPT_URL;
      script.dataset.key=PUBLIC_KEY;
      script.async=true;
      script.addEventListener('load',resolve,{once:true});
      script.addEventListener('error',reject,{once:true});
      document.body.appendChild(script);
    });
  }

  function buildContext(product,sourceLabel){
    const url=new URL(location.href);
    url.searchParams.set('compas_agent',ROUTE);
    url.searchParams.set('compas_product',product);
    const tracker=window.CompasTracking?.getAttribution?.();
    const touch=tracker?.lastTouch||{};
    const payload={
      product,
      sourceLabel:sourceLabel||'',
      pageUrl:window.CompasTracking?.getPageUrl?.()||url.toString(),
      capturedAt:new Date().toISOString(),
      visitorId:tracker?.visitorId||''
    };
    ATTRIBUTION_KEYS.forEach(key=>payload[key]=url.searchParams.get(key)||touch[key]||'');
    try{localStorage.setItem(CONTEXT_KEY,JSON.stringify(payload));}catch{}
    history.replaceState(history.state,'',url.toString());
    window.dispatchEvent(new CustomEvent('compas:chat-route',{detail:{route:ROUTE}}));
    window.dispatchEvent(new CustomEvent('yamilet:sales-context',{detail:payload}));
    return payload;
  }

  function customizeChat(attempt=0){
    const host=document.querySelector('compas-one-web-chat');
    const root=host?.shadowRoot;
    if(!root){
      if(attempt<50)setTimeout(()=>customizeChat(attempt+1),120);
      return;
    }
    const isItalian=document.documentElement.lang==='it';
    const title=root.querySelector('.header strong');
    const subtitle=root.querySelector('.header small');
    const launcher=root.querySelector('.launcher');
    if(title)title.textContent=isItalian?'Assistente di Yamilet':'Asistente de Yamilet';
    if(subtitle)subtitle.textContent=isItalian?'Metodo MES® · orientamento personale':'Método MES® · orientación personal';
    if(launcher)launcher.setAttribute('aria-label',isItalian?'Apri l’assistente di Yamilet':'Abrir asistente de Yamilet');

    const patchForm=()=>{
      const form=root.querySelector('.form');
      if(!form)return;
      const intro=form.querySelector('p');
      if(intro)intro.textContent=isItalian
        ? 'Useremo il tuo nome e i tuoi dati di contatto per rispondere alla tua richiesta e permettere a Yamilet di darti seguito. Evita di condividere dati sensibili non necessari.'
        : 'Usaremos tu nombre y tus datos de contacto para atender tu solicitud y permitir que Yamilet pueda darte seguimiento. Evita compartir datos sensibles que no sean necesarios.';
      const phone=form.querySelector('input[name="phone"]');
      if(phone){
        const label=phone.closest('label');
        const span=label?.querySelector('span');
        if(span)span.textContent='WhatsApp';
        phone.placeholder=isItalian?'+39 ...':'+52 ...';
        phone.setAttribute('inputmode','tel');
      }
      const company=form.querySelector('input[name="company"]')?.closest('label');
      if(company)company.style.display='none';
      const consent=form.querySelector('.consent span');
      if(consent){
        const link=consent.querySelector('a');
        consent.childNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE)node.textContent='';});
        const prefix=document.createTextNode(isItalian?'Accetto l’':'Acepto el ');
        const suffix=document.createTextNode(isItalian?' e il trattamento dei dati per ricevere orientamento e seguito da Yamilet.':' y el tratamiento de estos datos para recibir orientación y seguimiento de Yamilet.');
        consent.prepend(prefix);
        if(link){
          link.textContent=isItalian?'informativa sulla privacy':'aviso de privacidad';
          consent.append(suffix);
        }
      }
      const start=form.querySelector('.start');
      if(start)start.textContent=isItalian?'Parlare con l’assistente':'Hablar con el asistente';
      const branding=form.querySelector('.branding');
      if(branding)branding.textContent=isItalian?'Assistente di Yamilet Pérez':'Asistente de Yamilet Pérez';
    };

    patchForm();
    const observer=new MutationObserver(patchForm);
    observer.observe(root,{childList:true,subtree:true});
  }

  function findLauncher(){
    const host=document.querySelector('compas-one-web-chat');
    return host?.shadowRoot?.querySelector('.launcher')||null;
  }

  function openChat(attempt=0){
    const launcher=findLauncher();
    if(launcher){launcher.click();return;}
    if(attempt<40)setTimeout(()=>openChat(attempt+1),125);
  }

  async function routeToSalesAgent(el){
    const product=inferProduct(el);
    const label=(el?.textContent||'').trim();
    try{await ensureAttribution();}catch{}
    buildContext(product,label);
    window.CompasTracking?.track?.('agent_open',{metadata:{source:'yamilet_sales_agent',product_key:product}});
    try{
      await ensureChat();
      buildContext(product,label);
      customizeChat();
      openChat();
    }catch(error){
      console.error('YAMILET_SALES_AGENT_LOAD_ERROR',error);
    }
  }

  function bind(){
    document.querySelectorAll('[data-yamilet-sales-agent]').forEach(el=>{
      if(el.dataset.yamiletAgentBound==='1')return;
      el.dataset.yamiletAgentBound='1';
      el.addEventListener('click',event=>{
        event.preventDefault();
        routeToSalesAgent(el);
      });
    });
  }

  function install(){
    bind();
    new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
    const warm=()=>{ensureAttribution().catch(()=>{});ensureChat().then(()=>customizeChat()).catch(()=>{});};
    if(document.readyState==='complete')setTimeout(warm,1800);
    else addEventListener('load',()=>setTimeout(warm,1800),{once:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();