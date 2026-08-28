(() => {
  'use strict';

  const VERSION = '71';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const CATALOG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-catalog';
  const TOP_LEVEL = new Set(['home', 'courses', 'resources', 'agenda', 'certificates']);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  let contextPromise = null;
  let renderToken = 0;
  let scheduled = 0;

  function currentRoute() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function isVisibleDashboard() {
    const dashboard = $('[data-dashboard]');
    return !!dashboard && !dashboard.classList.contains('hidden') && !!$('.dashboard-main');
  }

  function safeUrl(value = '') {
    try {
      const url = new URL(String(value || ''), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function displayName(ctx) {
    return String(ctx.profile?.full_name || ctx.user?.user_metadata?.full_name || ctx.user?.email || 'Alumna').trim();
  }

  function firstName(ctx) {
    return displayName(ctx).split(/\s+/).filter(Boolean)[0] || 'Alumna';
  }

  function cover(course) {
    return safeUrl(course?.cover_url) || '../assets/logo-yamilet.png';
  }

  function modulesFor(ctx, courseId) {
    return ctx.modules.filter(module => String(module.course_id) === String(courseId));
  }

  function lessonsFor(ctx, courseId) {
    const moduleIds = new Set(modulesFor(ctx, courseId).map(module => String(module.id)));
    return ctx.lessons.filter(lesson => moduleIds.has(String(lesson.module_id)));
  }

  function completedSet(ctx) {
    return new Set(ctx.progress.filter(row => row.completed).map(row => String(row.lesson_id)));
  }

  function courseProgress(ctx, course) {
    const lessons = lessonsFor(ctx, course.id);
    if (!lessons.length) return 0;
    const done = completedSet(ctx);
    return Math.round((lessons.filter(lesson => done.has(String(lesson.id))).length / lessons.length) * 100);
  }

  function firstIncomplete(ctx, course) {
    const done = completedSet(ctx);
    return lessonsFor(ctx, course.id).find(lesson => !done.has(String(lesson.id))) || lessonsFor(ctx, course.id)[0] || null;
  }

  function activeCourses(ctx) {
    return ctx.courses.filter(course => !/draft|archiv/i.test(String(course.status || '')));
  }

  async function getContext(force = false) {
    if (force) contextPromise = null;
    if (contextPromise) return contextPromise;
    contextPromise = (async () => {
      const configResponse = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!configResponse.ok) throw new Error('v71_config');
      const config = await configResponse.json();
      const sb = window.supabase.createClient(config.url, config.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) throw new Error('v71_session');
      const user = session.user;

      const [workspaceResult, profileResult] = await Promise.all([
        sb.from('workspaces').select('*').eq('slug', config.workspaceSlug || 'yamilet-mes').maybeSingle(),
        sb.from('profiles').select('*').eq('id', user.id).maybeSingle()
      ]);
      const workspace = workspaceResult.data;
      if (!workspace?.id) throw workspaceResult.error || new Error('v71_workspace');

      const [courseResult, progressResult, resourceResult, eventResult] = await Promise.all([
        sb.from('courses').select('*').eq('workspace_id', workspace.id).neq('status', 'archived').order('featured', { ascending: false }).order('created_at', { ascending: true }),
        sb.from('lesson_progress').select('*').eq('user_id', user.id),
        sb.from('resources').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        sb.from('academy_events').select('*').eq('workspace_id', workspace.id).gte('starts_at', new Date(Date.now() - 86400000).toISOString()).order('starts_at', { ascending: true }).limit(100)
      ]);

      const courses = courseResult.data || [];
      const courseIds = courses.map(course => course.id);
      let modules = [];
      if (courseIds.length) {
        const result = await sb.from('modules').select('*').in('course_id', courseIds).order('position', { ascending: true });
        modules = result.data || [];
      }
      const moduleIds = modules.map(module => module.id);
      let lessons = [];
      if (moduleIds.length) {
        const result = await sb.from('lessons').select('*').in('module_id', moduleIds).order('position', { ascending: true });
        lessons = result.data || [];
      }

      let catalog = [];
      try {
        const response = await fetch(CATALOG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (response.ok) catalog = (await response.json()).courses || [];
      } catch (error) {
        console.warn('Academia Yamilet v71 catalog', error);
      }

      return {sb,config,user,workspace,profile:profileResult.data||{},courses,modules,lessons,progress:progressResult.data||[],resources:resourceResult.data||[],events:(eventResult.data||[]).filter(event=>!/draft|cancel|archiv/i.test(String(event.status||''))),catalog};
    })().catch(error => { contextPromise = null; throw error; });
    return contextPromise;
  }

  function host() {
    const main = $('.dashboard-main');
    if (!main) return null;
    let page = $('[data-aula-pages-v71]', main);
    if (!page) {
      page = document.createElement('section');
      page.className = 'aula-v71-page-host';
      page.dataset.aulaPagesV71 = 'true';
      main.appendChild(page);
    }
    return page;
  }

  function setRouteMode(route) {
    const main = $('.dashboard-main');
    const page = host();
    if (!main || !page) return;
    if (TOP_LEVEL.has(route)) { main.dataset.v71Route = route; page.hidden = false; }
    else { delete main.dataset.v71Route; page.hidden = true; }
  }

  function flash(message) {
    let node = $('[data-v71-flash]');
    if (!node) {
      node = document.createElement('div');
      node.className = 'v71-flash';
      node.dataset.v71Flash = 'true';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => node.classList.remove('show'), 3000);
  }

  function summaryCard(icon, value, label) {
    return `<article class="v71-summary-card"><span class="v71-summary-icon">${icon}</span><div><strong>${esc(value)}</strong><small>${esc(label)}</small></div></article>`;
  }

  function courseCard(ctx, course) {
    const progress = courseProgress(ctx, course);
    const lessons = lessonsFor(ctx, course.id);
    const done = completedSet(ctx);
    const completed = lessons.filter(lesson => done.has(String(lesson.id))).length;
    const next = firstIncomplete(ctx, course);
    const status = progress === 100 ? 'Finalizado' : progress > 0 ? 'En progreso' : 'No iniciado';
    const action = next ? `#lesson/${encodeURIComponent(course.id)}/${encodeURIComponent(next.id)}` : `#course/${encodeURIComponent(course.id)}`;
    return `<article class="v71-course-card" data-v71-course-card><a class="v71-course-cover" href="#course/${encodeURIComponent(course.id)}"><img src="${esc(cover(course))}" alt="${esc(course.title||'Curso')}" loading="lazy"><span>${esc(status)}</span></a><div class="v71-course-body"><div class="v71-course-top"><span>${esc(course.instructor_name||'Yamilet Pérez')}</span><strong>${progress}%</strong></div><h3><a href="#course/${encodeURIComponent(course.id)}">${esc(course.title||'Curso')}</a></h3><p>${esc(course.subtitle||course.description||'Continúa tu formación a tu propio ritmo.')}</p><div class="v71-progress"><span style="width:${progress}%"></span></div><div class="v71-course-meta"><span>${completed}/${lessons.length} lecciones</span>${course.duration_label?`<span>${esc(course.duration_label)}</span>`:''}</div><div class="v71-course-actions"><a class="v71-btn primary" href="${action}">${progress>0?'Continuar':'Comenzar curso'}</a><a class="v71-btn ghost" href="#course/${encodeURIComponent(course.id)}">Ver contenido</a></div></div></article>`;
  }

  function upcomingCard(course) {
    return `<article class="v71-upcoming-card"><div class="v71-upcoming-cover">${safeUrl(course.cover_url)?`<img src="${esc(safeUrl(course.cover_url))}" alt="${esc(course.title||'Próximo curso')}" loading="lazy">`:'<span>YP</span>'}<b>PRÓXIMAMENTE</b></div><div><small>${esc(course.category||'Academia Yamilet')}</small><h3>${esc(course.title||'Nueva formación')}</h3><p>${esc(course.subtitle||course.description||'Nueva experiencia en preparación.')}</p>${course.duration_label?`<span class="v71-pill">${esc(course.duration_label)}</span>`:''}</div></article>`;
  }

  function nextEvent(ctx) {
    const now = Date.now();
    return ctx.events.find(event => new Date(event.starts_at).getTime() >= now) || null;
  }

  function fmtEventDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return {day:'--',month:'---',long:'Fecha por confirmar',time:''};
    return {day:new Intl.DateTimeFormat('es-MX',{day:'2-digit'}).format(date),month:new Intl.DateTimeFormat('es-MX',{month:'short'}).format(date).replace('.','').toUpperCase(),long:new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date),time:new Intl.DateTimeFormat('es-MX',{hour:'numeric',minute:'2-digit'}).format(date)};
  }

  function renderHome(ctx) {
    const courses = activeCourses(ctx);
    const featured = courses.find(course => course.featured) || courses[0];
    const page = host();
    if (!featured) { page.innerHTML = `<section class="v71-empty"><span>ACADEMIA YAMILET</span><h1>Aún no tienes cursos activos</h1><p>Cuando tu inscripción esté disponible aparecerá aquí automáticamente.</p><a class="v71-btn primary" href="#catalog">Explorar catálogo</a></section>`; return; }
    const lessons = courses.flatMap(course => lessonsFor(ctx, course.id));
    const done = completedSet(ctx);
    const completed = lessons.filter(lesson => done.has(String(lesson.id))).length;
    const progress = courseProgress(ctx, featured);
    const nextLesson = firstIncomplete(ctx, featured);
    const books = ctx.resources.filter(resource => String(resource.resource_type||'').toLowerCase()==='book').length;
    const event = nextEvent(ctx);
    const eventDate = event ? fmtEventDate(event.starts_at) : null;
    const today = new Date();
    const day = new Intl.DateTimeFormat('es-MX',{day:'2-digit'}).format(today);
    const month = new Intl.DateTimeFormat('es-MX',{month:'short',year:'numeric'}).format(today).toUpperCase();

    page.innerHTML = `<div class="v71-page v71-home-page"><section class="v71-welcome"><div><span class="v71-eyebrow">Tu espacio de aprendizaje</span><h1>Hola, ${esc(firstName(ctx))}</h1><p>Continúa avanzando en Método MES® con claridad y a tu propio ritmo.</p></div><div class="v71-date"><strong>${esc(day)}</strong><span>${esc(month)}</span></div></section><section class="v71-summary-grid">${summaryCard('▤',courses.length,'Cursos disponibles')}${summaryCard('✓',`${completed}/${lessons.length}`,'Lecciones completadas')}${summaryCard('▧',books,'Libros en tu biblioteca')}${summaryCard('◷',event?eventDate.long.split(',')[0]:'Sin fecha','Próximo encuentro')}</section><section class="v71-home-grid"><article class="v71-featured-course"><img src="${esc(cover(featured))}" alt="${esc(featured.title||'Curso')}"><div><span class="v71-badge">Continúa aprendiendo</span><h2>${esc(featured.title||'Método MES®')}</h2><p>${esc(featured.subtitle||featured.description||'')}</p><div class="v71-featured-actions">${nextLesson?`<a class="v71-btn primary" href="#lesson/${encodeURIComponent(featured.id)}/${encodeURIComponent(nextLesson.id)}">▶ Continuar curso</a>`:`<a class="v71-btn primary" href="#course/${encodeURIComponent(featured.id)}">Abrir curso</a>`}<a class="v71-btn ghost" href="#course/${encodeURIComponent(featured.id)}">Ver programa</a></div><div class="v71-progress-label"><span>Tu avance</span><strong>${progress}%</strong></div><div class="v71-progress large"><span style="width:${progress}%"></span></div></div></article><aside class="v71-event-card">${event?`<span class="v71-eyebrow">Próximo evento</span><div class="v71-event-date"><strong>${esc(eventDate.day)}</strong><span>${esc(eventDate.month)}</span></div><h2>${esc(event.title||'Encuentro Academia Yamilet')}</h2><p>${esc(event.description||'Actividad programada dentro de Academia Yamilet.')}</p><div class="v71-event-meta"><span>◷ ${esc(eventDate.time)}</span><span>${esc(event.delivery_mode||event.location_text||'En línea')}</span></div><a class="v71-btn ghost" href="#agenda">Ver agenda</a>`:`<span class="v71-eyebrow">Agenda</span><h2>Tu próximo encuentro aparecerá aquí</h2><p>Cuando Yamilet programe una sesión, taller o clase en vivo podrás verla desde esta tarjeta.</p><a class="v71-btn ghost" href="#agenda">Abrir calendario</a>`}</aside></section><div class="v71-section-heading"><div><span class="v71-eyebrow">Tu formación</span><h2>Continúa aprendiendo</h2></div><a href="#courses">Ver todos →</a></div><section class="v71-card-row">${courses.slice(0,4).map(course=>courseCard(ctx,course)).join('')}</section><section class="v71-lower-grid"><article class="v71-news"><div class="v71-section-heading"><h2>Novedades de la academia</h2></div><a href="#resources"><span>Biblioteca</span><strong>Consulta tus recursos, ejercicios y materiales.</strong><small>Ir a Mi biblioteca →</small></a><a href="#agenda"><span>Agenda</span><strong>Revisa próximas sesiones y encuentros.</strong><small>Ver calendario →</small></a></article><article class="v71-support"><span class="v71-eyebrow">¿Necesitas ayuda?</span><h2>Estamos para acompañarte.</h2><p>Encuentra respuestas sobre acceso, cursos, recursos y certificados.</p><a class="v71-btn primary" href="#help">Abrir centro de ayuda</a></article></section></div>`;
  }

  function renderCourses(ctx) {
    const page = host();
    const courses = activeCourses(ctx);
    const completed = courses.filter(course=>courseProgress(ctx,course)===100).length;
    const inProgress = courses.filter(course=>{const p=courseProgress(ctx,course);return p>0&&p<100;}).length;
    const current = courses.filter(course=>courseProgress(ctx,course)<100).sort((a,b)=>courseProgress(ctx,b)-courseProgress(ctx,a))[0]||courses[0];
    const upcoming = ctx.catalog.filter(course=>course.catalog_status==='upcoming'&&!courses.some(active=>String(active.id)===String(course.id)));
    if (!courses.length) { page.innerHTML = `<div class="v71-page"><section class="v71-page-heading"><div><span class="v71-eyebrow">Tu formación</span><h1>Mis cursos</h1><p>Los cursos activos de tu cuenta aparecerán aquí.</p></div><a class="v71-btn ghost" href="#catalog">Explorar catálogo</a></section><section class="v71-empty"><h2>Aún no tienes cursos asignados</h2><p>Cuando se active una inscripción podrás entrar directamente al contenido desde esta pantalla.</p></section></div>`; return; }
    const currentProgress = current ? courseProgress(ctx,current) : 0;
    const currentNext = current ? firstIncomplete(ctx,current) : null;
    page.innerHTML = `<div class="v71-page v71-courses-page"><section class="v71-page-heading"><div><span class="v71-eyebrow">Tu formación</span><h1>Mis cursos</h1><p>Retoma tu aprendizaje, revisa tu avance y entra directamente a los programas asignados a tu cuenta.</p></div><a class="v71-btn ghost" href="#catalog">Explorar nuevos cursos</a></section><section class="v71-overview">${summaryCard('▤',courses.length,'Cursos disponibles')}${summaryCard('◔',inProgress,'En progreso')}${summaryCard('✓',completed,'Finalizados')}</section>${current?`<section class="v71-continue-panel"><img src="${esc(cover(current))}" alt="${esc(current.title||'Curso')}"><div><span class="v71-eyebrow">Continuar aprendiendo</span><h2>${esc(current.title||'Curso')}</h2><p>${esc(current.subtitle||current.description||'')}</p><div class="v71-progress-label"><span>Avance del curso</span><strong>${currentProgress}%</strong></div><div class="v71-progress"><span style="width:${currentProgress}%"></span></div><div class="v71-course-actions">${currentNext?`<a class="v71-btn primary" href="#lesson/${encodeURIComponent(current.id)}/${encodeURIComponent(currentNext.id)}">Continuar</a>`:`<a class="v71-btn primary" href="#course/${encodeURIComponent(current.id)}">Abrir curso</a>`}<a class="v71-btn ghost" href="#course/${encodeURIComponent(current.id)}">Ver contenido</a></div></div></section>`:''}<section class="v71-toolbar"><label><span>⌕</span><input type="search" data-v71-course-search placeholder="Buscar en mis cursos"></label><div><button class="active" data-v71-course-filter="all">Todos</button><button data-v71-course-filter="progress">En progreso</button><button data-v71-course-filter="complete">Finalizados</button></div></section><section class="v71-course-grid">${courses.map(course=>courseCard(ctx,course)).join('')}</section><section class="v71-upcoming-section"><div class="v71-section-heading"><div><span class="v71-eyebrow">Próximamente</span><h2>Lo que viene en Academia Yamilet</h2></div><a href="#catalog">Ver catálogo →</a></div>${upcoming.length?`<div class="v71-upcoming-grid">${upcoming.map(upcomingCard).join('')}</div>`:`<div class="v71-empty compact"><strong>Nuevas formaciones en preparación</strong><p>Cuando Yamilet anuncie un nuevo programa aparecerá aquí automáticamente.</p></div>`}</section></div>`;
    const search=$('[data-v71-course-search]',page);const buttons=$$('[data-v71-course-filter]',page);const apply=()=>{const query=String(search?.value||'').trim().toLowerCase();const filter=buttons.find(button=>button.classList.contains('active'))?.dataset.v71CourseFilter||'all';$$('[data-v71-course-card]',page).forEach((card,index)=>{const course=courses[index];const progress=courseProgress(ctx,course);const matchesFilter=filter==='all'||(filter==='progress'&&progress>0&&progress<100)||(filter==='complete'&&progress===100);const matchesQuery=!query||card.textContent.toLowerCase().includes(query);card.hidden=!(matchesFilter&&matchesQuery);});};search?.addEventListener('input',apply);buttons.forEach(button=>button.addEventListener('click',()=>{buttons.forEach(item=>item.classList.toggle('active',item===button));apply();}));
  }

  function resourceGroup(resource){return String(resource.resource_type||'').toLowerCase()==='book'?'book':'material';}
  function resourceType(resource){const type=String(resource.resource_type||'Recurso').replace(/_/g,' ');return type.charAt(0).toUpperCase()+type.slice(1);}
  function resourceThumb(resource){return safeUrl(resource.thumbnail_url||resource.cover_url||resource.image_url)||'../assets/logo-yamilet.png';}

  async function openResource(ctx,resource){const nativeCards=$$('[data-shell-page="library"] .library-card');const native=nativeCards.find(card=>card.textContent.toLowerCase().includes(String(resource.title||'').toLowerCase()));const nativeAction=native?.querySelector('a[href],button');if(nativeAction){nativeAction.click();return;}const external=safeUrl(resource.external_url||resource.url);if(external){window.open(external,'_blank','noopener');return;}const path=resource.file_path||resource.media_path||resource.storage_path;const bucket=resource.bucket||resource.storage_bucket||resource.media_bucket||resource.file_bucket;if(path&&bucket){const{data,error}=await ctx.sb.storage.from(bucket).createSignedUrl(path,600);if(!error&&data?.signedUrl){window.open(data.signedUrl,'_blank','noopener');return;}}flash('Este recurso todavía no tiene un archivo disponible.');}

  function renderResources(ctx){const page=host();const books=ctx.resources.filter(resource=>resourceGroup(resource)==='book');const materials=ctx.resources.filter(resource=>resourceGroup(resource)==='material');const featured=books[0]||null;const card=resource=>`<article class="v71-resource-card" data-v71-resource-card data-resource-group="${resourceGroup(resource)}"><img src="${esc(resourceThumb(resource))}" alt="${esc(resource.title||'Recurso')}" loading="lazy"><div><span class="v71-eyebrow">${esc(resourceType(resource))}</span><h3>${esc(resource.title||'Recurso')}</h3><p>${esc(resource.description||'Material disponible dentro de tu Academia.')}</p><button class="v71-text-action" type="button" data-v71-resource="${esc(resource.id)}">Abrir recurso →</button></div></article>`;page.innerHTML=`<div class="v71-page v71-library-page"><section class="v71-page-heading"><div><span class="v71-eyebrow">Colección personal</span><h1>Mi biblioteca</h1><p>Encuentra tus libros, manuales, ejercicios y materiales vinculados a los programas de Academia Yamilet.</p></div><div class="v71-library-summary"><article><strong>${books.length}</strong><span>Libros</span></article><article><strong>${materials.length}</strong><span>Materiales</span></article></div></section><section class="v71-toolbar"><label><span>⌕</span><input type="search" data-v71-resource-search placeholder="Buscar en mi biblioteca"></label><div><button class="active" data-v71-resource-filter="all">Todo</button><button data-v71-resource-filter="book">Libros</button><button data-v71-resource-filter="material">Materiales</button></div></section>${featured?`<section class="v71-featured-resource"><img src="${esc(resourceThumb(featured))}" alt="${esc(featured.title||'Libro')}"><div><span class="v71-eyebrow">Lectura destacada</span><h2>${esc(featured.title||'Libro digital')}</h2><p>${esc(featured.description||'Este material forma parte de tu colección privada de Academia Yamilet.')}</p><button class="v71-btn primary" type="button" data-v71-resource="${esc(featured.id)}">Leer ahora</button></div></section>`:''}<section class="v71-library-content">${ctx.resources.length?`${books.length?`<div class="v71-library-section"><div class="v71-section-heading"><div><span class="v71-eyebrow">Tu estantería</span><h2>Libros digitales</h2></div><span>${books.length} títulos</span></div><div class="v71-resource-grid books">${books.map(card).join('')}</div></div>`:''}${materials.length?`<div class="v71-library-section"><div class="v71-section-heading"><div><span class="v71-eyebrow">Para seguir aprendiendo</span><h2>Materiales de apoyo</h2></div><span>${materials.length} recursos</span></div><div class="v71-resource-grid">${materials.map(card).join('')}</div></div>`:''}`:`<div class="v71-empty"><span>Tu colección está lista para crecer</span><h2>Tu biblioteca aún está vacía</h2><p>Los libros, manuales y recursos aparecerán aquí cuando sean asignados a tu cuenta.</p></div>`}</section><section class="v71-security-note"><span>⌾</span><div><strong>Biblioteca protegida</strong><p>Los materiales privados sólo se abren para cuentas autorizadas.</p></div></section></div>`;$$('[data-v71-resource]',page).forEach(button=>button.addEventListener('click',()=>{const resource=ctx.resources.find(item=>String(item.id)===String(button.dataset.v71Resource));if(resource)openResource(ctx,resource);}));const search=$('[data-v71-resource-search]',page);const filters=$$('[data-v71-resource-filter]',page);const apply=()=>{const query=String(search?.value||'').trim().toLowerCase();const filter=filters.find(button=>button.classList.contains('active'))?.dataset.v71ResourceFilter||'all';$$('[data-v71-resource-card]',page).forEach(cardNode=>{const matches=(filter==='all'||cardNode.dataset.resourceGroup===filter)&&(!query||cardNode.textContent.toLowerCase().includes(query));cardNode.hidden=!matches;});};search?.addEventListener('input',apply);filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(item=>item.classList.toggle('active',item===button));apply();}));}

  function icsDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
  function icsEscape(value=''){return String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
  function downloadEvent(event){const start=icsDate(event.starts_at);const end=icsDate(event.ends_at||new Date(new Date(event.starts_at).getTime()+3600000));if(!start||!end)return;const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Academia Yamilet//MES//ES','BEGIN:VEVENT',`UID:${event.id}@academia-yamilet`,`DTSTAMP:${icsDate(new Date())}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${icsEscape(event.title||'Academia Yamilet')}`,`DESCRIPTION:${icsEscape(event.description||'')}`,`LOCATION:${icsEscape(event.location_text||event.meeting_url||'')}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');const blob=new Blob([body],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${String(event.title||'academia-yamilet').toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'academia-yamilet'}.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}

  function monthCalendar(events,base){const year=base.getFullYear();const month=base.getMonth();const first=(new Date(year,month,1).getDay()+6)%7;const count=new Date(year,month+1,0).getDate();const eventDays=new Set(events.filter(event=>{const d=new Date(event.starts_at);return d.getFullYear()===year&&d.getMonth()===month;}).map(event=>new Date(event.starts_at).getDate()));const cells=[];for(let i=0;i<first;i+=1)cells.push('<span></span>');for(let day=1;day<=count;day+=1)cells.push(`<span class="${eventDays.has(day)?'has-event':''}">${day}${eventDays.has(day)?'<i></i>':''}</span>`);return `<article class="v71-month-card"><div class="v71-month-head"><strong>${esc(new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(base))}</strong><span>Agenda Yamilet</span></div><div class="v71-weekdays"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="v71-month-grid">${cells.join('')}</div></article>`;}

  function renderAgenda(ctx){const page=host();const now=new Date();const events=ctx.events.filter(event=>new Date(event.starts_at).getTime()>=now.getTime()).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));const next=events[0]||null;const base=next?new Date(next.starts_at):now;const online=events.filter(event=>/online|virtual|zoom|live|en vivo/i.test(`${event.delivery_mode||''} ${event.event_type||''}`)).length;const thisMonth=events.filter(event=>{const d=new Date(event.starts_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;page.innerHTML=`<div class="v71-page v71-agenda-page"><section class="v71-page-heading"><div><span class="v71-eyebrow">Calendario académico</span><h1>Calendario</h1><p>Organiza tus clases, sesiones y encuentros de Academia Yamilet en una pantalla independiente.</p></div><div class="v71-agenda-summary"><article><strong>${events.length}</strong><span>Próximos</span></article><article><strong>${thisMonth}</strong><span>Este mes</span></article><article><strong>${online}</strong><span>En línea</span></article></div></section><section class="v71-agenda-grid">${monthCalendar(events,base)}<aside class="v71-next-event">${next?(()=>{const d=fmtEventDate(next.starts_at);return `<span class="v71-eyebrow">Próximo evento</span><div class="v71-event-date"><strong>${esc(d.day)}</strong><span>${esc(d.month)}</span></div><h2>${esc(next.title||'Evento académico')}</h2><p>${esc(next.description||'Actividad programada dentro de Academia Yamilet.')}</p><div class="v71-event-meta"><span>${esc(d.long)}</span><span>◷ ${esc(d.time)}</span><span>${esc(next.delivery_mode||next.location_text||'En línea')}</span></div><div class="v71-event-actions">${safeUrl(next.meeting_url)?`<a class="v71-btn primary" href="${esc(safeUrl(next.meeting_url))}" target="_blank" rel="noopener">Entrar a sesión</a>`:''}<button class="v71-btn ghost" type="button" data-v71-ics="${esc(next.id)}">Agregar a calendario</button></div>`;})():`<span class="v71-eyebrow">Agenda</span><h2>No hay eventos próximos programados</h2><p>Cuando se publique una sesión o taller aparecerá aquí automáticamente.</p>`}</aside></section><div class="v71-section-heading"><div><span class="v71-eyebrow">Próximas actividades</span><h2>Eventos programados</h2></div></div><section class="v71-event-list">${events.length?events.map(event=>{const d=fmtEventDate(event.starts_at);return `<article class="v71-event-row"><div class="v71-event-row-date"><strong>${esc(d.day)}</strong><span>${esc(d.month)}</span></div><div><small>${esc(String(event.event_type||'Evento académico').replace(/_/g,' '))}</small><h3>${esc(event.title||'Evento académico')}</h3><p>${esc(event.description||'')}</p><div class="v71-event-meta"><span>${esc(d.long)}</span><span>${esc(d.time)}</span></div></div><div class="v71-event-row-actions">${safeUrl(event.meeting_url)?`<a href="${esc(safeUrl(event.meeting_url))}" target="_blank" rel="noopener">Entrar</a>`:''}<button type="button" data-v71-ics="${esc(event.id)}">Agregar</button></div></article>`;}).join(''):`<div class="v71-empty compact"><strong>No hay eventos próximos</strong><p>Tu agenda se actualizará automáticamente cuando haya nuevas fechas.</p></div>`}</section></div>`;$$('[data-v71-ics]',page).forEach(button=>button.addEventListener('click',()=>{const event=events.find(item=>String(item.id)===String(button.dataset.v71Ics));if(event)downloadEvent(event);}));}

  async function certificateData(ctx){const certResult=await ctx.sb.from('certificates').select('*').eq('user_id',ctx.user.id).order('issued_at',{ascending:false});const certs=certResult.data||[];const eligibility=[];for(const course of activeCourses(ctx)){try{const{data,error}=await ctx.sb.rpc('get_certificate_eligibility',{target_course:course.id});const row=!error&&data?.[0]?data[0]:null;eligibility.push({course_id:course.id,...(row||{})});}catch{eligibility.push({course_id:course.id});}}return{certs,eligibility};}
  function eligibilityProgress(ctx,course,eligibility){const row=eligibility.find(item=>String(item.course_id)===String(course.id));if(row&&Number(row.total_lessons)>0)return Math.round((Number(row.completed_lessons||0)/Number(row.total_lessons))*100);return courseProgress(ctx,course);}

  function renderCertificates(ctx){const page=host();page.innerHTML=`<div class="v71-page"><section class="v71-loading"><span></span><p>Cargando tus certificados…</p></section></div>`;certificateData(ctx).then(({certs,eligibility})=>{if(currentRoute()!=='certificates')return;const active=certs.filter(cert=>!cert.revoked_at);const courses=activeCourses(ctx);const pending=courses.filter(course=>!active.some(cert=>String(cert.course_id)===String(course.id))).sort((a,b)=>eligibilityProgress(ctx,b,eligibility)-eligibilityProgress(ctx,a,eligibility));const next=pending[0]||null;const mostRecent=active[0]||null;page.innerHTML=`<div class="v71-page v71-certificates-page"><section class="v71-page-heading"><div><span class="v71-eyebrow">Reconoce tu constancia</span><h1>Mis certificados</h1><p>Consulta tus reconocimientos y revisa cuánto te falta para desbloquear el siguiente.</p></div><div class="v71-library-summary"><article><strong>${active.length}</strong><span>Disponibles</span></article><article><strong>${pending.length}</strong><span>En proceso</span></article></div></section>${mostRecent?(()=>{const course=courses.find(item=>String(item.id)===String(mostRecent.course_id));return `<section class="v71-certificate-feature"><div><span class="v71-eyebrow">Logro más reciente</span><h2>${esc(course?.title||'Certificado Academia Yamilet')}</h2><p>Tu certificado ya está disponible con código de verificación público.</p><div class="v71-course-actions"><button class="v71-btn primary" type="button" data-v71-cert-pdf="${esc(mostRecent.id)}">Descargar PDF</button><a class="v71-btn ghost" href="./verificar.html?codigo=${encodeURIComponent(mostRecent.verification_code||'')}" target="_blank" rel="noopener">Verificar</a></div></div><div class="v71-certificate-preview"><span>ACADEMIA YAMILET</span><strong>${esc(displayName(ctx))}</strong><small>${esc(course?.title||'')}</small><i>YP</i></div></section>`;})():next?`<section class="v71-certificate-progress"><span class="v71-cert-icon">◇</span><div><span class="v71-eyebrow">Tu siguiente reconocimiento</span><h2>${esc(next.title||'Curso')}</h2><p>Continúa hasta completar el programa para habilitar tu certificado.</p><div class="v71-progress"><span style="width:${eligibilityProgress(ctx,next,eligibility)}%"></span></div><small>${eligibilityProgress(ctx,next,eligibility)}% completado</small></div><a class="v71-btn primary" href="#course/${encodeURIComponent(next.id)}">Continuar curso</a></section>`:`<section class="v71-empty"><h2>Aún no tienes cursos con certificado</h2><p>Los reconocimientos aparecerán aquí conforme completes tus programas.</p></section>`}${active.length?`<section class="v71-cert-section"><div class="v71-section-heading"><div><span class="v71-eyebrow">Reconocimientos obtenidos</span><h2>Certificados disponibles</h2></div></div><div class="v71-cert-grid">${active.map(cert=>{const course=courses.find(item=>String(item.id)===String(cert.course_id));return `<article class="v71-cert-card"><span>Certificado oficial</span><h3>${esc(course?.title||'Academia Yamilet')}</h3><p>Emitido a ${esc(cert.recipient_name||displayName(ctx))}.</p><code>${esc(cert.verification_code||'')}</code><div><button type="button" data-v71-cert-pdf="${esc(cert.id)}">Descargar PDF</button><a href="./verificar.html?codigo=${encodeURIComponent(cert.verification_code||'')}" target="_blank" rel="noopener">Verificar →</a></div></article>`;}).join('')}</div></section>`:''}${pending.length?`<section class="v71-cert-section"><div class="v71-section-heading"><div><span class="v71-eyebrow">Sigue avanzando</span><h2>Certificados en proceso</h2></div></div><div class="v71-pending-list">${pending.map(course=>{const p=eligibilityProgress(ctx,course,eligibility);return `<article><img src="${esc(cover(course))}" alt="${esc(course.title||'Curso')}"><div><span>${p?'En progreso':'No iniciado'} <strong>${p}%</strong></span><h3>${esc(course.title||'Curso')}</h3><div class="v71-progress"><span style="width:${p}%"></span></div></div><a class="v71-btn ghost" href="#course/${encodeURIComponent(course.id)}">${p?'Continuar':'Comenzar'}</a></article>`;}).join('')}</div></section>`:''}<section class="v71-info-note"><span>i</span><div><strong>¿Cómo se habilita un certificado?</strong><p>Academia Yamilet valida automáticamente los requisitos del programa y emite certificados verificables cuando corresponda.</p></div><a href="#help">Ver ayuda</a></section></div>`;$$('[data-v71-cert-pdf]',page).forEach(button=>button.addEventListener('click',()=>{const native=$(`[data-cert-id="${CSS.escape(button.dataset.v71CertPdf)}"] [data-cert-pdf]`);if(native)native.click();else flash('El certificado está disponible; abre nuevamente esta sección si la descarga no inicia.');}));}).catch(error=>{console.warn('Academia Yamilet v71 certificates',error);page.innerHTML=`<div class="v71-page"><section class="v71-empty"><h2>No fue posible cargar los certificados</h2><p>El resto de la Academia sigue disponible con normalidad.</p></section></div>`;});}

  async function renderRoute(force=false){if(!isVisibleDashboard())return false;const route=currentRoute();setRouteMode(route);if(!TOP_LEVEL.has(route))return true;const page=host();const token=++renderToken;page.innerHTML=`<section class="v71-loading"><span></span><p>Preparando ${route==='home'?'tu inicio':route==='courses'?'tus cursos':route==='resources'?'tu biblioteca':route==='agenda'?'tu calendario':'tus certificados'}…</p></section>`;try{const ctx=await getContext(force);if(token!==renderToken||currentRoute()!==route)return true;if(route==='home')renderHome(ctx);else if(route==='courses')renderCourses(ctx);else if(route==='resources')renderResources(ctx);else if(route==='agenda')renderAgenda(ctx);else if(route==='certificates')renderCertificates(ctx);window.scrollTo({top:0,behavior:'auto'});return true;}catch(error){console.warn('Academia Yamilet v71',error);if(token===renderToken)page.innerHTML=`<section class="v71-empty"><h2>No pudimos preparar esta pantalla</h2><p>Recarga la Academia o vuelve a intentarlo desde el menú.</p></section>`;return false;}}

  function schedule(delay=90,force=false){clearTimeout(scheduled);scheduled=setTimeout(()=>renderRoute(force),delay);}
  document.addEventListener('click',event=>{if(event.target.closest('[data-shell-route],a[href^="#"]'))schedule(120);},true);
  window.addEventListener('hashchange',()=>schedule(120));
  window.addEventListener('popstate',()=>schedule(120));
  window.addEventListener('pageshow',()=>schedule(180));

  let dashboardObserver=null;
  let dashboardProbe=null;
  function watchDashboard(){const dashboard=$('[data-dashboard]');if(!dashboard){dashboardProbe=window.setTimeout(watchDashboard,200);return;}dashboardObserver?.disconnect();dashboardObserver=new MutationObserver(()=>{if(!dashboard.classList.contains('hidden'))schedule(80);});dashboardObserver.observe(dashboard,{attributes:true,attributeFilter:['class']});if(!dashboard.classList.contains('hidden'))schedule(80);}
  function start(){watchDashboard();schedule(250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.ACADEMIA_YAMILET_AULA_PAGES_V71={render:()=>renderRoute(true),version:VERSION};
})();
