(() => {
  'use strict';
  const KEY='yamilet-academy-locale';
  const originals=new WeakMap();
  const attrs=new WeakMap();
  let applying=false;
  const it=new Map(Object.entries({
    'Academia Yamilet':'Accademia Yamilet','Formación y Método MES®':'Formazione e Método MES®','Página principal':'Pagina principale','Entrar a mi academia':'Entra nella mia accademia',
    'CATÁLOGO DE CURSOS':'CATALOGO CORSI','Encuentra tu siguiente experiencia de aprendizaje.':'Trova la tua prossima esperienza di apprendimento.','Conoce los programas disponibles de Academia Yamilet y descubre las formaciones que están por llegar. El contenido de cada curso se habilita dentro de la Academia únicamente después de activar tu inscripción.':'Scopri i programmi disponibili di Accademia Yamilet e i percorsi in arrivo. I contenuti di ogni corso vengono abilitati nell’Accademia soltanto dopo l’attivazione dell’iscrizione.','Aprende a tu ritmo':'Impara al tuo ritmo','Programas guiados · acceso privado':'Programmi guidati · accesso privato','FORMACIÓN':'FORMAZIONE','Cursos de Academia Yamilet':'Corsi di Accademia Yamilet','Selecciona un programa para conocer sus detalles. Los cursos marcados como “Próximamente” todavía no admiten inscripción.':'Seleziona un programma per conoscerne i dettagli. I corsi contrassegnati come “Prossimamente” non accettano ancora iscrizioni.','Buscar cursos':'Cerca corsi','Todos':'Tutti','Disponibles':'Disponibili','Próximamente':'Prossimamente','Cargando cursos…':'Caricamento corsi…','PRÓXIMAMENTE':'PROSSIMAMENTE','DISPONIBLE':'DISPONIBILE','Disponible próximamente':'Disponibile prossimamente','Ver programa':'Vedi programma','Ya tengo acceso':'Ho già accesso','Programa de Academia Yamilet.':'Programma di Accademia Yamilet.','No encontramos cursos con este filtro.':'Non abbiamo trovato corsi con questo filtro.','Imparte:':'Docente:','Inscribirme':'Iscriviti','Solicitar información':'Richiedi informazioni','No fue posible cargar el catálogo en este momento. Puedes volver a la página principal o intentarlo más tarde.':'Non è stato possibile caricare il catalogo in questo momento. Puoi tornare alla pagina principale o riprovare più tardi.','Tu formación privada vive dentro de la Academia. Este espacio es únicamente el catálogo público.':'La tua formazione privata vive dentro l’Accademia. Questo spazio è soltanto il catalogo pubblico.','Ya tengo acceso →':'Ho già accesso →',
    'Escritura terapéutica y mindfulness para la mujer actual':'Scrittura terapeutica e mindfulness per la donna di oggi','Un espacio seguro para habitar tu cuerpo, vaciar tu mente y reescribir tu historia.':'Uno spazio sicuro per abitare il tuo corpo, svuotare la mente e riscrivere la tua storia.','Mindfulness y escritura terapéutica':'Mindfulness e scrittura terapeutica','4 semanas · 24 días':'4 settimane · 24 giorni',
    'VERIFICACIÓN OFICIAL':'VERIFICA UFFICIALE','Verifica un certificado':'Verifica un certificato','Ingresa el código único impreso en el certificado. Solo se muestran los datos necesarios para confirmar su autenticidad.':'Inserisci il codice univoco stampato sul certificato. Vengono mostrati soltanto i dati necessari a confermarne l’autenticità.','Código de verificación':'Codice di verifica','Verificar certificado':'Verifica certificato','Esperando código':'In attesa del codice','El resultado mostrará nombre, programa, fecha y estado.':'Il risultato mostrerà nome, programma, data e stato.','Verificación pública de Academia Yamilet':'Verifica pubblica di Accademia Yamilet','Verificando…':'Verifica in corso…','Consultando el registro oficial.':'Consultazione del registro ufficiale.','Código no encontrado':'Codice non trovato','Revisa que el código esté escrito exactamente como aparece en el certificado.':'Controlla che il codice sia scritto esattamente come appare sul certificato.','✓ Certificado válido':'✓ Certificato valido','! Certificado revocado':'! Certificato revocato','El código existe en el registro oficial de Academia Yamilet.':'Il codice esiste nel registro ufficiale di Accademia Yamilet.','El certificado existe, pero actualmente no tiene estado válido.':'Il certificato esiste, ma attualmente non ha uno stato valido.','Nombre':'Nome','Programa':'Programma','Fecha de emisión':'Data di emissione','Código':'Codice','No fue posible verificar ahora':'Non è stato possibile verificare ora','Intenta nuevamente en unos minutos.':'Riprova tra qualche minuto.'
  }));
  const placeholders=new Map([['Buscar cursos','Cerca corsi']]);
  const locale=()=>localStorage.getItem(KEY)==='it'?'it':'es';
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
  function translate(v){
    const n=norm(v); if(!n) return v;
    if(it.has(n)) return String(v).replace(n,it.get(n));
    if(n.startsWith('Imparte: ')) return String(v).replace('Imparte: ','Docente: ');
    if(n.startsWith('Portada de ')) return String(v).replace('Portada de ','Copertina di ');
    return v;
  }
  function text(node){
    if(!node||node.nodeType!==3||!node.parentElement||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(node.parentElement.tagName)) return;
    if(locale()==='it'){
      const next=translate(node.data); if(next!==node.data){if(!originals.has(node)) originals.set(node,node.data); node.data=next;}
    }else if(originals.has(node)){node.data=originals.get(node);}
  }
  function attr(el){
    if(!el?.getAttribute) return;
    ['placeholder','aria-label','title','alt'].forEach(name=>{
      if(!el.hasAttribute(name)) return;
      if(!attrs.has(el)) attrs.set(el,{}); const store=attrs.get(el); if(!(name in store)) store[name]=el.getAttribute(name);
      const base=store[name]; el.setAttribute(name,locale()==='it'?(placeholders.get(base)||translate(base)):base);
    });
  }
  function walk(root=document.body){
    if(!root||applying)return; applying=true;
    try{
      if(root.nodeType===3) text(root); else { if(root.nodeType===1) attr(root); const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))text(n);root.querySelectorAll?.('[placeholder],[aria-label],[title],[alt]').forEach(attr); }
      document.documentElement.lang=locale();
      document.querySelectorAll('a[href="../es/"]').forEach(a=>a.href=locale()==='it'?'../it/':'../es/');
      document.querySelectorAll('[data-public-lang]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.publicLang===locale()?'true':'false'));
      if(document.title.includes('Catálogo')||document.title.includes('Catalogo')) document.title=locale()==='it'?'Catalogo corsi | Accademia Yamilet':'Catálogo de cursos | Academia Yamilet';
      if(document.title.includes('Verificar')||document.title.includes('Verifica')) document.title=locale()==='it'?'Verifica certificato | Accademia Yamilet':'Verificar certificado | Academia Yamilet';
    }finally{applying=false;}
  }
  function controls(){
    if(document.querySelector('[data-public-language-switch]'))return;
    const box=document.createElement('div');box.dataset.publicLanguageSwitch='true';box.style.cssText='position:fixed;right:14px;top:12px;z-index:9999;display:flex;gap:3px;padding:4px;border:1px solid rgba(18,63,53,.14);border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 7px 20px rgba(18,63,53,.09);backdrop-filter:blur(8px)';
    box.innerHTML='<button type="button" data-public-lang="es" style="border:0;border-radius:999px;padding:7px 9px;background:transparent;font:700 11px system-ui;color:#123f35">ES</button><button type="button" data-public-lang="it" style="border:0;border-radius:999px;padding:7px 9px;background:transparent;font:700 11px system-ui;color:#123f35">IT</button>';
    document.body.appendChild(box);
    box.querySelectorAll('[data-public-lang]').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem(KEY,b.dataset.publicLang);walk(document.body);window.dispatchEvent(new CustomEvent('yamilet:language-change',{detail:{locale:b.dataset.publicLang}}));}));
  }
  function start(){controls();walk(document.body);new MutationObserver(ms=>{if(applying)return;ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1||n.nodeType===3)walk(n);}));}).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
