(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const STORAGE_KEY = 'yamilet-academy-locale';
  const ALLOWED = new Set(['es', 'it']);
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();
  const originalHtml = new WeakMap();
  let locale = ALLOWED.has(localStorage.getItem(STORAGE_KEY)) ? localStorage.getItem(STORAGE_KEY) : 'es';
  let client = null;
  let workspace = null;
  let translationRows = [];
  let contentTextMap = new Map();
  let observer = null;
  let applying = false;

  const it = {
    'Academia Yamilet': 'Accademia Yamilet',
    '← Volver a la página': '← Torna al sito',
    'Volver a Yamilet Pérez': 'Torna a Yamilet Pérez',
    'Tu espacio privado': 'Il tuo spazio privato',
    'Medita.': 'Medita.',
    'Escribe. Sana.': 'Scrivi. Guarisci.',
    'Accede a tus cursos, recursos, progreso y comunidad de Academia Yamilet.': 'Accedi ai tuoi corsi, alle risorse, ai progressi e alla community dell’Accademia Yamilet.',
    '✓ Progreso personal': '✓ Progresso personale',
    '✓ Recursos y ejercicios': '✓ Risorse ed esercizi',
    '✓ Comunidad': '✓ Community',
    'Acceso a la academia': 'Accesso all’accademia',
    'Bienvenido': 'Benvenuta',
    'Ingresa con el correo registrado en la academia.': 'Accedi con l’indirizzo email registrato nell’accademia.',
    'Correo': 'Email',
    'Contraseña': 'Password',
    'Entrar a mi Academia': 'Entra nella mia Accademia',
    'Entrar sin contraseña': 'Accedi senza password',
    'Cambiar mi contraseña': 'Cambia la mia password',
    '“Entrar sin contraseña” solo inicia sesión. “Cambiar mi contraseña” envía un correo distinto para crear una nueva contraseña.': '“Accedi senza password” avvia solo la sessione. “Cambia la mia password” invia un’email separata per crearne una nuova.',
    'Seguridad de tu cuenta': 'Sicurezza del tuo account',
    'Crea una nueva contraseña': 'Crea una nuova password',
    'Usa al menos 8 caracteres. Esta pantalla solo aparece desde un enlace válido de recuperación.': 'Usa almeno 8 caratteri. Questa schermata appare solo da un link di recupero valido.',
    'Nueva contraseña': 'Nuova password',
    'Confirmar contraseña': 'Conferma password',
    'Guardar nueva contraseña': 'Salva nuova password',
    'Acceso pendiente': 'Accesso in attesa',
    'Tu cuenta está activa': 'Il tuo account è attivo',
    'Este correo todavía no tiene un curso de Academia Yamilet asignado. Cuando tu inscripción esté activa, tus contenidos aparecerán aquí automáticamente.': 'Questo indirizzo email non ha ancora un corso dell’Accademia Yamilet assegnato. Quando l’iscrizione sarà attiva, i contenuti appariranno qui automaticamente.',
    'Entrar con otra cuenta': 'Accedi con un altro account',
    'Inicio': 'Home',
    'Continuar': 'Continua',
    'Mis cursos': 'I miei corsi',
    'Contenido': 'Contenuti',
    'Alumnas': 'Allieve',
    'Clase gratis': 'Lezione gratuita',
    'Cerrar sesión': 'Esci',
    'Panel de Academia': 'Pannello Accademia',
    'Hola,': 'Ciao,',
    'Ver landing': 'Vedi il sito',
    'Cursos disponibles': 'Corsi disponibili',
    'Progreso general': 'Progresso generale',
    'Reservas por atender': 'Prenotazioni da gestire',
    'Tu siguiente paso': 'Il tuo prossimo passo',
    'Continuar aprendiendo': 'Continua a imparare',
    'Cargando tu progreso…': 'Caricamento dei tuoi progressi…',
    'Formación': 'Formazione',
    'Cargando cursos…': 'Caricamento corsi…',
    '← Volver a mis cursos': '← Torna ai miei corsi',
    '← Volver al temario': '← Torna al programma',
    'Preparando administrador de contenido…': 'Preparazione della gestione contenuti…',
    'Preparando administración de alumnas…': 'Preparazione della gestione allieve…',
    'Seguimiento': 'Monitoraggio',
    'Reservas de clase gratis': 'Prenotazioni della lezione gratuita',
    'Cargando reservaciones…': 'Caricamento prenotazioni…',
    'Sin fecha': 'Senza data',
    'Completado': 'Completato',
    'En preparación': 'In preparazione',
    'Disponible': 'Disponibile',
    'Vista de staff': 'Vista staff',
    'Los cursos aparecerán aquí cuando se publiquen o se active tu inscripción.': 'I corsi appariranno qui quando saranno pubblicati o quando la tua iscrizione sarà attivata.',
    'Continuar curso': 'Continua il corso',
    'Ver contenido': 'Vedi contenuti',
    'Ver curso': 'Vedi corso',
    'Contenido de Academia Yamilet.': 'Contenuto dell’Accademia Yamilet.',
    'Todo al día': 'Tutto aggiornato',
    'No tienes una lección pendiente': 'Non hai lezioni in sospeso',
    'Cuando exista una nueva lección disponible aparecerá aquí automáticamente.': 'Quando sarà disponibile una nuova lezione, apparirà qui automaticamente.',
    'Próximamente': 'Prossimamente',
    'El espacio de aprendizaje ya está listo': 'Lo spazio di apprendimento è pronto',
    'Método MES todavía no tiene módulos ni lecciones cargados. No agregamos contenido ficticio.': 'Método MES non ha ancora moduli o lezioni caricati. Non aggiungiamo contenuti fittizi.',
    'Siguiente lección': 'Lezione successiva',
    'progreso': 'progresso',
    'Este módulo todavía no tiene lecciones.': 'Questo modulo non ha ancora lezioni.',
    'Este curso todavía no tiene módulos. Cuando carguemos el contenido real aparecerá aquí automáticamente.': 'Questo corso non ha ancora moduli. Quando verrà caricato il contenuto reale, apparirà qui automaticamente.',
    'Curso de Academia Yamilet.': 'Corso dell’Accademia Yamilet.',
    'Video de la lección': 'Video della lezione',
    'Abrir contenido multimedia': 'Apri contenuto multimediale',
    'Esta lección aún no tiene contenido de texto cargado.': 'Questa lezione non ha ancora contenuto testuale.',
    '✓ Lección completada · marcar pendiente': '✓ Lezione completata · segna come da completare',
    'Marcar lección como completada': 'Segna lezione come completata',
    'Vista previa de staff · el progreso solo se registra para alumnos inscritos.': 'Anteprima staff · il progresso viene registrato solo per le allieve iscritte.',
    'Módulo': 'Modulo',
    'Lección': 'Lezione',
    'A tu ritmo': 'Al tuo ritmo',
    'Completada': 'Completata',
    'Pendiente': 'Da completare',
    'Ver transcripción': 'Vedi trascrizione',
    'No fue posible actualizar tu progreso. Verifica que tu inscripción siga activa.': 'Non è stato possibile aggiornare i progressi. Verifica che la tua iscrizione sia ancora attiva.',
    'No fue posible cargar las reservaciones.': 'Non è stato possibile caricare le prenotazioni.',
    'Todavía no hay solicitudes de clase gratuita.': 'Non ci sono ancora richieste per la lezione gratuita.',
    'Solicitada': 'Richiesta',
    'Confirmada': 'Confermata',
    'Cancelada': 'Annullata',
    'No fue posible actualizar la reservación.': 'Non è stato possibile aggiornare la prenotazione.',
    'No se encontró la configuración de Academia Yamilet.': 'Configurazione dell’Accademia Yamilet non trovata.',
    'No fue posible cargar tu Academia. Intenta nuevamente.': 'Non è stato possibile caricare la tua Accademia. Riprova.',
    'Alumno': 'Allieva',
    'alumno': 'allieva',
    'Validando acceso…': 'Verifica dell’accesso…',
    'No se pudo iniciar sesión. Revisa tus datos o recupera tu contraseña.': 'Accesso non riuscito. Controlla i dati o recupera la password.',
    'Acceso correcto.': 'Accesso riuscito.',
    'Escribe primero tu correo.': 'Inserisci prima la tua email.',
    'Enviando enlace seguro…': 'Invio del link sicuro…',
    'No fue posible enviar el enlace. Verifica que el correo esté registrado.': 'Non è stato possibile inviare il link. Verifica che l’email sia registrata.',
    'Revisa tu correo. Te enviamos un enlace de acceso.': 'Controlla la tua email. Ti abbiamo inviato un link di accesso.',
    'Escribe primero tu correo para recuperar la contraseña.': 'Inserisci prima la tua email per recuperare la password.',
    'Preparando recuperación segura…': 'Preparazione del recupero sicuro…',
    'No fue posible iniciar la recuperación. Intenta nuevamente.': 'Non è stato possibile avviare il recupero. Riprova.',
    'Revisa tu correo. Te enviamos el enlace para crear una nueva contraseña.': 'Controlla la tua email. Ti abbiamo inviato il link per creare una nuova password.',
    'La contraseña debe tener al menos 8 caracteres.': 'La password deve contenere almeno 8 caratteri.',
    'Las contraseñas no coinciden.': 'Le password non coincidono.',
    'Guardando nueva contraseña…': 'Salvataggio della nuova password…',
    'No fue posible actualizar la contraseña. Solicita un nuevo enlace.': 'Non è stato possibile aggiornare la password. Richiedi un nuovo link.',
    'Contraseña actualizada correctamente.': 'Password aggiornata correttamente.',
    'No fue posible conectar con Academia Yamilet. Intenta nuevamente en unos minutos.': 'Non è stato possibile connettersi all’Accademia Yamilet. Riprova tra qualche minuto.',
    'Gestión académica': 'Gestione accademica',
    'Administrador de contenido': 'Gestione contenuti',
    'Seleccionar curso': 'Seleziona corso',
    'Estado': 'Stato',
    'Módulos': 'Moduli',
    'Lecciones': 'Lezioni',
    'Recursos': 'Risorse',
    'Curso': 'Corso',
    'Título': 'Titolo',
    'Instructora': 'Docente',
    'Subtítulo': 'Sottotitolo',
    'Descripción': 'Descrizione',
    'Duración visible': 'Durata visibile',
    'Curso destacado': 'Corso in evidenza',
    'Sin portada': 'Senza copertina',
    'Guardar curso': 'Salva corso',
    'Curso publicado': 'Corso pubblicato',
    'Curso no publicado': 'Corso non pubblicato',
    'Para publicar debe existir al menos un módulo y una lección.': 'Per pubblicare deve esistere almeno un modulo e una lezione.',
    'Volver a borrador': 'Torna a bozza',
    'Publicar curso': 'Pubblica corso',
    'Estructura': 'Struttura',
    'Crear módulo': 'Crea modulo',
    'Título del módulo': 'Titolo del modulo',
    'Agregar módulo': 'Aggiungi modulo',
    'No se genera contenido automáticamente. Los módulos y lecciones se crean únicamente con la información que cargue el equipo.': 'I contenuti non vengono generati automaticamente. Moduli e lezioni vengono creati solo con le informazioni caricate dal team.',
    'Temario': 'Programma',
    'Módulos y lecciones': 'Moduli e lezioni',
    'Biblioteca del curso': 'Biblioteca del corso',
    'Recursos descargables': 'Risorse scaricabili',
    'Tipo': 'Tipo',
    'Vincular a lección': 'Collega a lezione',
    'Recurso general del curso': 'Risorsa generale del corso',
    'Enlace externo': 'Link esterno',
    'Archivo': 'File',
    'Agregar recurso': 'Aggiungi risorsa',
    'No hay cursos en Academia Yamilet.': 'Non ci sono corsi nell’Accademia Yamilet.',
    'Todavía no hay módulos. Crea el primero con el nombre real del contenido.': 'Non ci sono ancora moduli. Crea il primo con il nome reale del contenuto.',
    'Sin descripción.': 'Senza descrizione.',
    'Editar': 'Modifica',
    '+ Lección': '+ Lezione',
    'Guardar módulo': 'Salva modulo',
    'Comunidad': 'Community',
    'Soporte': 'Supporto',
    'Certificados': 'Certificati',
    'Notificaciones': 'Notifiche',
    'Calendario': 'Calendario',
    'Biblioteca': 'Biblioteca',
    'Perfil': 'Profilo',
    'Ayuda': 'Aiuto',
    'Explorar': 'Esplora',
    'Actividad': 'Attività',
    'Nueva conversación': 'Nuova conversazione',
    'Enviar': 'Invia',
    'Responder': 'Rispondi',
    'Abrir ticket': 'Apri ticket',
    'Mis certificados': 'I miei certificati',
    'Mis notificaciones': 'Le mie notifiche'
  };

  const placeholderIt = {
    'nombre@correo.com': 'nome@email.com',
    'Mínimo 8 caracteres': 'Minimo 8 caratteri',
    'Repite tu contraseña': 'Ripeti la password',
    'Ej. 8 semanas': 'Es. 8 settimane',
    'Nombre real del módulo': 'Nome reale del modulo',
    'Objetivo o descripción del módulo': 'Obiettivo o descrizione del modulo',
    'Nombre del recurso': 'Nome della risorsa'
  };

  const monthMap = { ene: 'gen', feb: 'feb', mar: 'mar', abr: 'apr', may: 'mag', jun: 'giu', jul: 'lug', ago: 'ago', sept: 'set', sep: 'set', oct: 'ott', nov: 'nov', dic: 'dic' };

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function translatedDynamic(value) {
    let match = value.match(/^(\d+) de (\d+) lecciones completadas$/);
    if (match) return `${match[1]} di ${match[2]} lezioni completate`;
    match = value.match(/^(\d+) lección$/);
    if (match) return `${match[1]} lezione`;
    match = value.match(/^(\d+) lecciones$/);
    if (match) return `${match[1]} lezioni`;
    match = value.match(/^Módulo\s+(.+)$/);
    if (match) return `Modulo ${match[1]}`;
    match = value.match(/^(\d+) minutos$/);
    if (match) return `${match[1]} minuti`;
    match = value.match(/^(.+) · (\d+)% completado$/);
    if (match) return `${match[1]} · ${match[2]}% completato`;
    match = value.match(/^Progreso (\d+)%$/);
    if (match) return `Progresso ${match[1]}%`;
    match = value.match(/^(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)\s+(\d{4})$/i);
    if (match) return `${match[1]} ${monthMap[match[2].toLowerCase()] || match[2]} ${match[3]}`;
    return null;
  }

  function translateCore(value) {
    const normalized = normalize(value);
    if (!normalized) return value;
    const content = contentTextMap.get(normalized);
    const direct = content || it[normalized] || translatedDynamic(normalized);
    if (!direct) return value;
    const start = String(value).match(/^\s*/)?.[0] || '';
    const end = String(value).match(/\s*$/)?.[0] || '';
    return `${start}${direct}${end}`;
  }

  function rememberAttributes(el) {
    if (originalAttrs.has(el)) return;
    const attrs = {};
    ['placeholder', 'aria-label', 'title'].forEach(name => {
      if (el.hasAttribute?.(name)) attrs[name] = el.getAttribute(name);
    });
    originalAttrs.set(el, attrs);
  }

  function applyElementAttributes(el) {
    if (!el?.getAttribute) return;
    rememberAttributes(el);
    const attrs = originalAttrs.get(el) || {};
    Object.entries(attrs).forEach(([name, original]) => {
      if (locale === 'es') {
        el.setAttribute(name, original);
        return;
      }
      if (name === 'placeholder' && placeholderIt[original]) el.setAttribute(name, placeholderIt[original]);
      else el.setAttribute(name, translateCore(original));
    });
  }

  function applyTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.parentElement) return;
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION'].includes(node.parentElement.tagName) && node.parentElement.tagName !== 'OPTION') return;
    if (!normalize(node.data)) return;
    if (!originalText.has(node)) originalText.set(node, node.data);
    const original = originalText.get(node);
    const next = locale === 'it' ? translateCore(original) : original;
    if (node.data !== next) node.data = next;
  }

  function sanitizeTrustedTranslation(html = '') {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,input,button').forEach(el => el.remove());
    doc.body.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || ((name === 'href' || name === 'src') && val.startsWith('javascript:'))) el.removeAttribute(attr.name);
      });
    });
    return doc.body.innerHTML;
  }

  function applyRichLessonTranslation(root = document) {
    const host = root.querySelector?.('[data-lesson-detail]') || document.querySelector('[data-lesson-detail]');
    if (!host) return;
    const body = host.querySelector('.lesson-content');
    if (!body) return;
    if (!originalHtml.has(body)) originalHtml.set(body, body.innerHTML);
    if (locale === 'es') {
      if (body.innerHTML !== originalHtml.get(body)) body.innerHTML = originalHtml.get(body);
      return;
    }
    const title = normalize(host.querySelector('.lesson-title h2')?.textContent || '');
    if (!title) return;
    const titleRow = translationRows.find(row => row.entity_type === 'lesson' && row.field_name === 'title' && [normalize(row.source_text), normalize(row.translated_text)].includes(title));
    if (!titleRow) return;
    const htmlRow = translationRows.find(row => row.entity_type === 'lesson' && row.entity_id === titleRow.entity_id && row.field_name === 'content_html' && row.translated_html);
    if (htmlRow?.translated_html) body.innerHTML = sanitizeTrustedTranslation(htmlRow.translated_html);
  }

  function walk(root = document.body) {
    if (!root) return;
    applying = true;
    try {
      if (root.nodeType === Node.TEXT_NODE) applyTextNode(root);
      else {
        if (root.nodeType === Node.ELEMENT_NODE) applyElementAttributes(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) applyTextNode(node);
        root.querySelectorAll?.('[placeholder],[aria-label],[title]').forEach(applyElementAttributes);
      }
      applyRichLessonTranslation(root.nodeType === Node.ELEMENT_NODE ? root : document);
    } finally {
      applying = false;
    }
  }

  function updateLanguageControls() {
    document.documentElement.lang = locale;
    document.body?.setAttribute('data-academy-locale', locale);
    document.querySelectorAll('[data-academy-lang]').forEach(btn => {
      const active = btn.dataset.academyLang === locale;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-landing-link]').forEach(link => {
      link.href = locale === 'it' ? '../it/' : '../es/';
    });
    document.title = locale === 'it' ? 'Accademia Yamilet | Método MES' : 'Academia Yamilet | Método MES';
  }

  async function ensureClient() {
    if (client || !window.supabase) return client;
    try {
      const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const cfg = await response.json();
      client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      const { data: ws } = await client.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle();
      workspace = ws || null;
      return client;
    } catch (error) {
      console.warn('Yamilet i18n client', error);
      return null;
    }
  }

  function rebuildContentMap(rows = []) {
    translationRows = rows || [];
    contentTextMap = new Map();
    translationRows.forEach(row => {
      const source = normalize(row.source_text);
      const target = normalize(row.translated_text);
      if (source && target) contentTextMap.set(source, row.translated_text);
    });
  }

  async function refreshContentTranslations() {
    if (locale !== 'it') {
      rebuildContentMap([]);
      walk(document.body);
      return;
    }
    const sb = await ensureClient();
    if (!sb) return;
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session?.user) return;
    const { data, error } = await sb.from('academy_content_translations')
      .select('course_id,entity_type,entity_id,field_name,source_text,translated_text,translated_html,status')
      .eq('locale', 'it')
      .eq('status', 'published');
    if (error) {
      console.warn('Yamilet content translations', error);
      return;
    }
    rebuildContentMap(data || []);
    walk(document.body);
  }

  async function savePreference() {
    const sb = await ensureClient();
    if (!sb || !workspace) return;
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    const { error } = await sb.from('academy_user_preferences').upsert({
      user_id: user.id,
      workspace_id: workspace.id,
      locale,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,workspace_id' });
    if (error) console.warn('Yamilet locale preference', error);
  }

  async function loadServerPreference() {
    const sb = await ensureClient();
    if (!sb || !workspace) return;
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    const { data } = await sb.from('academy_user_preferences')
      .select('locale').eq('user_id', user.id).eq('workspace_id', workspace.id).maybeSingle();
    if (ALLOWED.has(data?.locale) && data.locale !== locale) {
      locale = data.locale;
      localStorage.setItem(STORAGE_KEY, locale);
      updateLanguageControls();
      await refreshContentTranslations();
      walk(document.body);
    } else if (!data) {
      await savePreference();
    }
  }

  async function setLocale(next, options = {}) {
    if (!ALLOWED.has(next)) return;
    locale = next;
    localStorage.setItem(STORAGE_KEY, locale);
    updateLanguageControls();
    if (locale === 'it') await refreshContentTranslations();
    else rebuildContentMap([]);
    walk(document.body);
    if (options.persist !== false) await savePreference();
    window.dispatchEvent(new CustomEvent('yamilet:language-change', { detail: { locale } }));
  }

  function bindControls() {
    document.querySelectorAll('[data-academy-lang]').forEach(btn => {
      if (btn.dataset.i18nBound === '1') return;
      btn.dataset.i18nBound = '1';
      btn.addEventListener('click', () => setLocale(btn.dataset.academyLang));
    });
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(mutations => {
      if (applying) return;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) walk(node);
        });
        if (mutation.type === 'characterData') applyTextNode(mutation.target);
      });
      bindControls();
      applyRichLessonTranslation(document);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  async function boot() {
    updateLanguageControls();
    bindControls();
    walk(document.body);
    startObserver();
    const sb = await ensureClient();
    if (sb) {
      sb.auth.onAuthStateChange((_event, session) => {
        if (session?.user) setTimeout(async () => {
          await loadServerPreference();
          await refreshContentTranslations();
        }, 0);
      });
      await loadServerPreference();
      await refreshContentTranslations();
    }
  }

  window.addEventListener('yamilet:i18n-updated', refreshContentTranslations);
  window.YamiletI18n = {
    getLocale: () => locale,
    setLocale,
    t: value => locale === 'it' ? translateCore(value) : value,
    refreshContentTranslations
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
