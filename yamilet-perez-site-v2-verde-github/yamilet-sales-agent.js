/* Yamilet Pérez · Agente de Ventas Compás Fly
   Conecta la página pública con el Web Chat de Compás One.
   Mantiene atribución, contexto de producto y ruta de ventas.
*/
(() => {
  'use strict';

  const CHAT_SCRIPT_URL='https://app.proyectocompas.app/compas-chat.js?v=58.9';
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
    if(title)title.textContent='Andy';
    if(subtitle)subtitle.textContent=isItalian?'Assistente di Yamilet · Metodo MES®':'Asistente de Yamilet · Método MES®';
    if(launcher)launcher.setAttribute('aria-label',isItalian?'Parla con Andy':'Hablar con Andy');

    const patchConversation=()=>{
      let note=root.querySelector('.conversation-note');
      const noteHost=root.querySelector('.messages');
      if(!note&&noteHost&&root.querySelector('form.composer')){
        note=document.createElement('div');
        note.className='conversation-note';
        note.style.cssText='justify-self:stretch;color:#718096;font-size:10px;line-height:1.45;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.72);border:1px solid #e3ece9';
        note.innerHTML=isItalian
          ? 'Scrivendo accetti l’<a href="https://www.yamiletperez.com/es/privacidad.html" target="_blank" rel="noopener noreferrer" style="color:#0f594f;font-weight:800;text-decoration:none">informativa sulla privacy</a> e l’uso della conversazione per orientarti e darti seguito.'
          : 'Al escribir aceptas el <a href="https://www.yamiletperez.com/es/privacidad.html" target="_blank" rel="noopener noreferrer" style="color:#0f594f;font-weight:800;text-decoration:none">aviso de privacidad</a> y el uso de la conversación para orientarte y darte seguimiento.';
        noteHost.appendChild(note);
      }
      if(note&&!note.dataset.yamiletBranded)note.dataset.yamiletBranded='1';

      const composer=root.querySelector('form.composer');
      const textarea=composer?.querySelector('textarea');
      if(textarea){
        textarea.placeholder=isItalian
          ? 'Scrivi ad Andy…'
          : 'Platícale a Andy…';
      }

      const messages=root.querySelector('.messages');
      const footer=root.querySelector('.footer');
      if(!composer||!footer||messages?.querySelector('.bubble.user')||footer.querySelector('.yamilet-quick-actions'))return;

      const quick=document.createElement('div');
      quick.className='yamilet-quick-actions';
      quick.style.cssText='display:flex;gap:6px;overflow-x:auto;padding:8px 12px 0;background:#fff;scrollbar-width:none';
      const options=isItalian
        ? [['Metodo MES®','Ciao Andy, vorrei capire meglio come funziona il Metodo MES®'],['Lezione gratuita','Andy, mi racconti come funziona la lezione gratuita?'],['Accademia','Vorrei sapere com’è l’Accademia Yamilet'],['Libri','Mi consigli un libro di Yamilet da cui iniziare?']]
        : [['Método MES®','Hola Andy, quiero entender mejor cómo funciona el Método MES®'],['Clase gratuita','Andy, ¿me cuentas cómo funciona la clase gratuita?'],['Academia','Quiero saber cómo es la Academia Yamilet'],['Libros','¿Qué libro de Yamilet me recomiendas para empezar?']];
      options.forEach(([label,value])=>{
        const button=document.createElement('button');
        button.type='button';
        button.textContent=label;
        button.style.cssText='flex:0 0 auto;border:1px solid #dce7e5;border-radius:999px;background:#fff;color:#334e68;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer';
        button.addEventListener('click',()=>{
          if(!textarea)return;
          textarea.value=value;
          composer.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        });
        quick.appendChild(button);
      });
      footer.insertBefore(quick,composer);
      composer.addEventListener('submit',()=>quick.remove(),{once:true});
    };

    const bypassLegacyForm=()=>{
      const form=root.querySelector('.form');
      if(!form||form.dataset.yamiletConversationStarted==='1')return;
      form.dataset.yamiletConversationStarted='1';
      form.style.display='none';

      const name=form.querySelector('input[name="name"]');
      const email=form.querySelector('input[name="email"]');
      const phone=form.querySelector('input[name="phone"]');
      const company=form.querySelector('input[name="company"]');
      const consent=form.querySelector('input[name="consent"]');

      if(name)name.value='Visitante web';
      if(email){email.required=false;email.value='';}
      if(phone){phone.required=false;phone.value='';}
      if(company)company.value='';
      if(consent)consent.checked=true;

      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    };

    bypassLegacyForm();
    patchConversation();
    const observer=new MutationObserver(()=>{
      bypassLegacyForm();
      patchConversation();
    });
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
    const warm=()=>{ensureAttribution().catch(()=>{});ensureChat().then(()=>{
      window.dispatchEvent(new CustomEvent('compas:chat-route',{detail:{route:ROUTE}}));
      customizeChat();
    }).catch(()=>{});};
    if(document.readyState==='complete')setTimeout(warm,1800);
    else addEventListener('load',()=>setTimeout(warm,1800),{once:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();