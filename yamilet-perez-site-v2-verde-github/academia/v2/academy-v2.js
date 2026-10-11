(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const STREAM_ORIGIN = 'https://customer-l4ebvl2tw1zhwagv.cloudflarestream.com';
  const DEFAULT_COVER = '/imagenes-academia-yamilet-final/10-metodo-mes-cover.webp';
  const WORKSPACE_SLUG = 'yamilet-mes';
  const WARM_SESSION_KEY = 'yamilet_academy_v2_warm';
  const BOOK_CATALOG = [
    {
      title:'Método MES',
      description:'Medita, Escribe, Sana. Escritura terapéutica y transformación personal.',
      image:'/assets/libro-metodo-mes.png',
      url:'https://www.amazon.com/dp/B0F38BQGPT'
    },
    {
      title:'Apegos',
      description:'El Alma Despierta. Una obra vinculada a los procesos emocionales y la poesía.',
      image:'/assets/libro-apegos.png',
      url:'https://www.amazon.com/dp/B0CW1JNM5Z'
    },
    {
      title:'Expresia',
      description:'Poemario de escritura terapéutica y expresión emocional.',
      image:'/assets/libro-expresia.png',
      url:'https://www.amazon.com/dp/B0F5R1VX2V'
    },
    {
      title:'Retazos de mi alma',
      description:'Poesía, sensibilidad y fragmentos de una búsqueda interior.',
      image:'/assets/libro-retazos-de-mi-alma.png',
      url:'https://www.amazon.com/dp/B0DX6RN58F'
    },
    {
      title:'En la raíz del perdón',
      description:'Poesía que explora memoria, raíces y procesos de reconciliación.',
      image:'/assets/libro-en-la-raiz-del-perdon.png',
      url:'https://www.amazon.com/dp/B0G6JKFFCF'
    },
    {
      title:'Nel silenzio del dovere',
      description:'Edición italiana sobre dignidad, límites y espacios de cuidado auténtico.',
      image:'/assets/libro-nel-silenzio-del-dovere.png',
      url:'https://www.amazon.com/dp/B0GR6XF23R'
    }
  ];
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const qs = key => new URLSearchParams(location.search).get(key);
  const page = document.body.dataset.v2Page || 'home';

  let sb = null;
  let user = null;
  let profile = null;
  let workspace = null;
  let membership = null;
  let courses = [];
  let modules = [];
  let lessons = [];
  let progress = [];
  let enrollments = [];
  let progressMap = new Map();
  let lessonById = new Map();
  let moduleById = new Map();
  let courseById = new Map();
  let toastTimer = 0;

  function isWarmSession(){
    try{return sessionStorage.getItem(WARM_SESSION_KEY)==='1';}catch{return false;}
  }

  function markWarmSession(){
    try{sessionStorage.setItem(WARM_SESSION_KEY,'1');}catch{}
    document.documentElement.classList.add('v2-warm');
  }

  function clearWarmSession(){
    try{sessionStorage.removeItem(WARM_SESSION_KEY);}catch{}
    document.documentElement.classList.remove('v2-warm');
  }

  function finishLoading(){
    const el=$('[data-v2-loading]');
    if(!el) return;
    el.classList.add('done');
    setTimeout(()=>el.remove(),180);
  }

  function revealWarmNavigation(){
    if(!isWarmSession()) return;
    document.documentElement.classList.add('v2-warm');
    const el=$('[data-v2-loading]');
    if(el) el.remove();
  }

  function toast(message,error=false){
    const el=$('[data-v2-toast]');
    if(!el) return;
    clearTimeout(toastTimer);
    el.textContent=message;
    el.classList.toggle('error',error);
    el.classList.add('show');
    toastTimer=setTimeout(()=>el.classList.remove('show'),3600);
  }

  function initials(name=''){
    return String(name||'Y').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('');
  }

  function dateLabel(value){
    if(!value) return 'Sin actividad';
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) return 'Sin actividad';
    return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'}).format(d);
  }

  function sortModules(list){ return [...list].sort((a,b)=>(a.position||0)-(b.position||0)); }
  function sortLessons(list){ return [...list].sort((a,b)=>(a.position||0)-(b.position||0)); }

  async function initClient(){
    const response=await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error('config_unavailable');
    const cfg=await response.json();
    sb=window.supabase.createClient(cfg.url,cfg.anonKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return cfg.workspaceSlug || WORKSPACE_SLUG;
  }

  async function loadIdentity(workspaceSlug){
    const {data:{user:current},error}=await sb.auth.getUser();
    if(error || !current){
      clearWarmSession();
      try{ sessionStorage.setItem('yamilet_academy_v2_next',location.href); }catch{}
      location.replace('/academia/');
      return false;
    }
    user=current;

    const [{data:p,error:pe},{data:w,error:we}] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,avatar_url,role,status').eq('id',user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug',workspaceSlug).maybeSingle()
    ]);
    if(pe) throw pe;
    if(we || !w) throw we || new Error('workspace_not_found');
    profile=p||{};
    workspace=w;

    const {data:m}=await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',user.id).maybeSingle();
    membership=m?.status==='active'?m:null;
    markWarmSession();
    return true;
  }

  async function loadLearningData(){
    const {data:c,error:ce}=await sb.from('courses')
      .select('id,title,slug,subtitle,description,cover_url,status,featured,instructor_name,duration_label,workspace_id,price,sale_price,payment_url')
      .eq('workspace_id',workspace.id)
      .order('featured',{ascending:false})
      .order('created_at',{ascending:true});
    if(ce) throw ce;
    courses=c||[];
    courseById=new Map(courses.map(x=>[x.id,x]));

    const courseIds=courses.map(x=>x.id);
    if(!courseIds.length){ modules=[];lessons=[];progress=[];enrollments=[];return; }

    const [mRes,eRes]=await Promise.all([
      sb.from('modules').select('id,course_id,title,description,position').in('course_id',courseIds).order('position',{ascending:true}),
      sb.from('enrollments').select('id,user_id,course_id,status,enrolled_at,completed_at').eq('user_id',user.id).in('course_id',courseIds)
    ]);
    if(mRes.error) throw mRes.error;
    if(eRes.error) throw eRes.error;
    modules=mRes.data||[];
    enrollments=eRes.data||[];
    moduleById=new Map(modules.map(x=>[x.id,x]));

    const moduleIds=modules.map(x=>x.id);
    if(!moduleIds.length){lessons=[];progress=[];return;}

    const lRes=await sb.from('lessons')
      .select('id,module_id,title,description,lesson_type,content_html,duration_minutes,position,stream_video_uid,stream_require_signed_urls,video_url')
      .in('module_id',moduleIds)
      .order('position',{ascending:true});
    if(lRes.error) throw lRes.error;
    lessons=lRes.data||[];
    lessonById=new Map(lessons.map(x=>[x.id,x]));

    const lessonIds=lessons.map(x=>x.id);
    if(!lessonIds.length){progress=[];return;}
    const pRes=await sb.from('lesson_progress')
      .select('id,user_id,lesson_id,completed,progress_seconds,completed_at,updated_at')
      .eq('user_id',user.id)
      .in('lesson_id',lessonIds);
    if(pRes.error) throw pRes.error;
    progress=pRes.data||[];
    progressMap=new Map(progress.map(x=>[x.lesson_id,x]));
  }

  function courseModules(courseId){
    return sortModules(modules.filter(x=>x.course_id===courseId));
  }

  function moduleLessons(moduleId){
    return sortLessons(lessons.filter(x=>x.module_id===moduleId));
  }

  function courseLessons(courseId){
    return courseModules(courseId).flatMap(m=>moduleLessons(m.id));
  }

  function statsForLessons(list){
    const total=list.length;
    const done=list.filter(l=>progressMap.get(l.id)?.completed).length;
    const percent=total?Math.round(done/total*100):0;
    return {total,done,percent};
  }

  function courseStats(courseId){ return statsForLessons(courseLessons(courseId)); }

  function moduleStats(moduleId){ return statsForLessons(moduleLessons(moduleId)); }

  function nextLessonForCourse(courseId){
    const list=courseLessons(courseId);
    return list.find(l=>!progressMap.get(l.id)?.completed) || list[list.length-1] || null;
  }

  function lastActivity(){
    const rows=progress.filter(x=>x.updated_at||x.completed_at).sort((a,b)=>new Date(b.updated_at||b.completed_at)-new Date(a.updated_at||a.completed_at));
    return rows[0]?.updated_at||rows[0]?.completed_at||null;
  }

  function coursePath(course){
    return course?.slug==='metodo-mes' ? '/academia/cursos/metodo-mes/' : '/academia/cursos/';
  }

  function weekPath(module){
    const course=courseById.get(module?.course_id);
    if(course?.slug==='metodo-mes') return '/academia/cursos/metodo-mes/semana/?id='+encodeURIComponent(module.id);
    return '/academia/cursos/';
  }

  function lessonPath(lesson){
    const module=moduleById.get(lesson?.module_id);
    const course=courseById.get(module?.course_id);
    if(course?.slug==='metodo-mes') return '/academia/cursos/metodo-mes/leccion/?id='+encodeURIComponent(lesson.id);
    return '/academia/cursos/';
  }

  function nav(){
    const name=profile?.full_name||profile?.email||user?.email||'Yamilet';
    $('[data-v2-user-name]') && ($('[data-v2-user-name]').textContent=name);
    $('[data-v2-avatar]') && ($('[data-v2-avatar]').textContent=initials(name));
    $('[data-v2-nav]').forEach(a=>a.classList.toggle('active',a.dataset.v2Nav===page || (page==='course'||page==='week'||page==='lesson')&&a.dataset.v2Nav==='courses'));
  }

  function renderHome(){
    const host=$('[data-v2-home]');
    if(!host) return;
    const primary=courses.find(c=>c.slug==='metodo-mes')||courses[0];
    if(!primary){
      host.innerHTML='<div class="v2-empty">Todavía no tienes un curso disponible en tu cuenta.</div>';
      return;
    }
    const stats=courseStats(primary.id);
    const next=nextLessonForCourse(primary.id);
    const currentModule=next?moduleById.get(next.module_id):courseModules(primary.id)[0];
    const moduleList=courseModules(primary.id);
    const first=(profile?.full_name||'').split(/\s+/)[0]||'Hola';

    host.innerHTML=`
      <section class="home-hero">
        <div class="home-copy">
          <span class="v2-eyebrow">Tu espacio de aprendizaje</span>
          <h1>Hola, <em>${esc(first)}</em>.</h1>
          <p>Tu Academia ahora está organizada para que veas sólo lo que necesitas en cada momento. Retoma tu proceso exactamente donde lo dejaste.</p>
        </div>
        <div class="home-focus">
          <article class="focus-card">
            <small>Continúa donde te quedaste</small>
            <h2>${esc(primary.title)}</h2>
            <p>${currentModule?esc(currentModule.title):'Tu recorrido está listo'}${next?' · '+esc(next.title):''}</p>
            <div class="v2-progress-head"><span>Tu progreso</span><strong>${stats.percent}%</strong></div>
            <div class="v2-progress"><span style="width:${stats.percent}%"></span></div>
            <a class="v2-btn primary" href="${next?lessonPath(next):coursePath(primary)}">${stats.percent>=100?'Repasar programa':'Continuar lección'} →</a>
          </article>
        </div>
      </section>
      <div class="home-grid">
        <section class="v2-card journey-card">
          <div class="section-title"><div><span class="v2-eyebrow">Tu recorrido</span><h2>${esc(primary.title)}</h2></div><a href="${coursePath(primary)}">Ver curso completo →</a></div>
          <div class="journey-list">
            ${moduleList.map((m,i)=>{
              const s=moduleStats(m.id);
              const active=currentModule?.id===m.id && s.percent<100;
              return `<a class="journey-step ${s.percent>=100?'done':''} ${active?'active':''}" href="${weekPath(m)}">
                <span class="step-number">${s.percent>=100?'✓':String(i+1).padStart(2,'0')}</span>
                <span><strong>${esc(m.title)}</strong><small>${s.done} de ${s.total} lecciones completadas</small></span>
                <em>${s.percent}%</em>
              </a>`;
            }).join('')}
          </div>
        </section>
        <section class="v2-card today-card">
          <div class="section-title"><div><span class="v2-eyebrow">Resumen</span><h2>Tu proceso hoy</h2></div></div>
          <div class="today-list">
            <div class="today-item"><span class="today-icon">↗</span><div><strong>${stats.done} de ${stats.total} lecciones completadas</strong><small>Avance total de ${esc(primary.title)}</small></div></div>
            <div class="today-item"><span class="today-icon">●</span><div><strong>${currentModule?esc(currentModule.title):'Programa completado'}</strong><small>${next?'Siguiente: '+esc(next.title):'Puedes repasar cualquier lección'}</small></div></div>
            <div class="today-item"><span class="today-icon">◷</span><div><strong>Última actividad: ${dateLabel(lastActivity())}</strong><small>Tu progreso se guarda automáticamente</small></div></div>
          </div>
        </section>
      </div>
      <a class="home-discover-banner" href="/academia/descubre/">
        <div><span class="v2-eyebrow">Más de Yamilet</span><strong>Libros, nuevos cursos y próximos talleres</strong><small>Descubre nuevas experiencias para continuar tu proceso.</small></div>
        <span class="home-discover-arrow">Explorar →</span>
      </a>`;
  }

  function renderCourses(){
    const host=$('[data-v2-courses]');
    if(!host) return;
    host.innerHTML=courses.length?courses.map(c=>{
      const s=courseStats(c.id);
      const next=nextLessonForCourse(c.id);
      return `<article class="v2-card course-card">
        <div class="course-cover"><img src="${esc(c.cover_url||DEFAULT_COVER)}" alt="Portada de ${esc(c.title)}"></div>
        <div class="course-body">
          <span class="v2-eyebrow">${c.status==='published'?'Programa activo':'En preparación'}</span>
          <h2>${esc(c.title)}</h2>
          <p>${esc(c.subtitle||c.description||'Programa de Academia Yamilet.')}</p>
          <div class="course-meta"><span>${esc(c.duration_label||'Programa')}</span><span>${s.total} lecciones</span><span>${s.percent}% completado</span></div>
          <div class="v2-progress"><span style="width:${s.percent}%"></span></div>
          <div class="course-footer"><small>Última actividad · ${dateLabel(lastActivity())}</small><a class="v2-btn primary" href="${coursePath(c)}">${s.percent>0?'Continuar curso':'Comenzar curso'} →</a></div>
        </div>
      </article>`;
    }).join(''):'<div class="v2-empty">No hay cursos disponibles todavía.</div>';
  }

  function getCourseFromPage(){
    const slug=document.body.dataset.courseSlug || qs('curso') || 'metodo-mes';
    return courses.find(c=>c.slug===slug)||null;
  }

  function renderCourse(){
    const host=$('[data-v2-course]');
    if(!host) return;
    const course=getCourseFromPage();
    if(!course){host.innerHTML='<div class="v2-empty">Este curso no está disponible en tu cuenta.</div>';return;}
    const cms=courseModules(course.id);
    const s=courseStats(course.id);
    const next=nextLessonForCourse(course.id);
    const current=next?moduleById.get(next.module_id):null;

    host.innerHTML=`
      <a class="v2-back" href="/academia/cursos/">← Mis cursos</a>
      <section class="course-hero">
        <div class="course-hero-copy">
          <span class="v2-eyebrow">Tu programa</span>
          <h1>${esc(course.title)}</h1>
          <p>${esc(course.description||course.subtitle||'')}</p>
          <div class="course-hero-meta"><span>${esc(course.duration_label||'Programa')}</span><span>${s.total} lecciones</span><span>Medita · Escribe · Sana</span></div>
        </div>
        <div class="course-hero-art"><img src="${esc(course.cover_url||DEFAULT_COVER)}" alt="Portada de ${esc(course.title)}"></div>
      </section>
      <section class="v2-card course-progress-card">
        <div class="v2-progress-head"><span>Progreso general</span><strong>${s.percent}% · ${s.done} de ${s.total} lecciones</strong></div>
        <div class="v2-progress"><span style="width:${s.percent}%"></span></div>
        ${next?'<div style="margin-top:14px"><a class="v2-btn primary" href="'+lessonPath(next)+'">Continuar: '+esc(next.title)+' →</a></div>':''}
      </section>
      <div class="modules-list">
        ${cms.map((m,i)=>{
          const ms=moduleStats(m.id);
          const active=current?.id===m.id && ms.percent<100;
          return `<a class="module-card ${ms.percent>=100?'done':''} ${active?'active':''}" href="${weekPath(m)}">
            <span class="module-index">${ms.percent>=100?'✓':String(i+1).padStart(2,'0')}</span>
            <span class="module-copy"><strong>${esc(m.title)}</strong><small>${ms.done} de ${ms.total} lecciones · ${ms.percent}% completado</small></span>
            <span class="module-side"><b>${active?'Estás aquí':ms.percent>=100?'Completada':'Ver semana'}</b><span>›</span></span>
          </a>`;
        }).join('')}
      </div>`;
  }

  function renderWeek(){
    const host=$('[data-v2-week]');
    if(!host) return;
    const moduleId=qs('id');
    const m=moduleById.get(moduleId);
    if(!m){host.innerHTML='<div class="v2-empty">No encontramos esta semana dentro de tu curso.</div>';return;}
    const course=courseById.get(m.course_id);
    const list=moduleLessons(m.id);
    const s=moduleStats(m.id);
    const allModules=courseModules(m.course_id);
    const idx=allModules.findIndex(x=>x.id===m.id);
    const prev=idx>0?allModules[idx-1]:null;
    const nextModule=idx>=0&&idx<allModules.length-1?allModules[idx+1]:null;
    const nextLesson=list.find(l=>!progressMap.get(l.id)?.completed);

    host.innerHTML=`
      <a class="v2-back" href="${coursePath(course)}">← ${esc(course?.title||'Curso')}</a>
      <section class="v2-card week-summary">
        <div><span class="v2-eyebrow">Semana ${idx+1} de ${allModules.length}</span><h1>${esc(m.title)}</h1><p>${esc(m.description||'Avanza una lección a la vez y tu progreso se guardará automáticamente.')}</p></div>
        <div><div class="v2-progress-head"><span>Avance</span><strong>${s.percent}%</strong></div><div class="v2-progress" style="min-width:180px"><span style="width:${s.percent}%"></span></div></div>
      </section>
      <div class="lesson-list">
        ${list.map((l,i)=>{
          const done=!!progressMap.get(l.id)?.completed;
          const isNext=nextLesson?.id===l.id;
          return `<a class="lesson-row ${done?'done':''} ${isNext?'next':''}" href="${lessonPath(l)}">
            <span class="lesson-state">${done?'✓':i+1}</span>
            <span class="lesson-copy"><strong>${esc(l.title)}</strong><small>${l.duration_minutes?l.duration_minutes+' min · ':''}${done?'Completada':isNext?'Siguiente lección':'Pendiente'}</small></span>
            <span>›</span>
          </a>`;
        }).join('')}
      </div>
      <div class="week-nav">
        ${prev?'<a class="v2-btn secondary" href="'+weekPath(prev)+'">← Semana anterior</a>':'<span></span>'}
        ${nextModule?'<a class="v2-btn secondary" href="'+weekPath(nextModule)+'">Siguiente semana →</a>':'<a class="v2-btn secondary" href="'+coursePath(course)+'">Volver al curso</a>'}
      </div>`;
  }

  function sanitizeContent(html=''){
    const tpl=document.createElement('template');
    tpl.innerHTML=String(html||'');
    tpl.content.querySelectorAll('script,object,embed,link,meta').forEach(x=>x.remove());
    tpl.content.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(a=>{
        if(/^on/i.test(a.name)) el.removeAttribute(a.name);
        if((a.name==='href'||a.name==='src') && /^javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    return tpl.innerHTML;
  }

  async function signedStreamUrl(lessonId){
    if(/\.github\.io$/i.test(location.hostname)) throw new Error('secure_domain_required');
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token) throw new Error('session_required');
    const res=await fetch('/api/stream-token?lesson_id='+encodeURIComponent(lessonId),{
      headers:{Authorization:'Bearer '+session.access_token,Accept:'application/json'},
      cache:'no-store'
    });
    const payload=await res.json().catch(()=>({}));
    if(!res.ok || !payload.token) throw new Error(payload.error||'stream_token_failed');
    return payload.iframe_url || STREAM_ORIGIN+'/'+encodeURIComponent(payload.token)+'/iframe';
  }

  async function renderVideo(lesson){
    const host=$('[data-v2-video]');
    if(!host) return;
    const uid=String(lesson.stream_video_uid||'').trim();
    if(uid){
      try{
        const url=lesson.stream_require_signed_urls ? await signedStreamUrl(lesson.id) : STREAM_ORIGIN+'/'+encodeURIComponent(uid)+'/iframe';
        host.innerHTML='<iframe src="'+esc(url)+'" title="Video de la lección" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
        return;
      }catch(err){
        console.warn('Academia V2 stream',err);
        host.innerHTML='<div class="lesson-player-empty"><div><strong>El video no pudo cargarse.</strong><br><small>Actualiza la página o vuelve a intentarlo desde yamiletperez.com.</small></div></div>';
        return;
      }
    }
    if(lesson.video_url){
      host.innerHTML='<div class="lesson-player-empty"><div><a class="v2-btn secondary" href="'+esc(lesson.video_url)+'" target="_blank" rel="noopener">Abrir video →</a></div></div>';
      return;
    }
    host.innerHTML='<div class="lesson-player-empty"><div><strong>Esta lección no requiere video.</strong><br><small>Continúa con el contenido y los ejercicios.</small></div></div>';
  }

  async function lessonResources(lessonId,courseId){
    let query=sb.from('resources').select('id,title,description,resource_type,external_url,file_path,lesson_id,course_id').eq('workspace_id',workspace.id);
    const {data,error}=await query.or('lesson_id.eq.'+lessonId+',and(lesson_id.is.null,course_id.eq.'+courseId+')').order('position',{ascending:true});
    if(error){console.warn(error);return [];}
    return data||[];
  }

  async function markLesson(lessonId,completed){
    const row={user_id:user.id,lesson_id:lessonId,completed,updated_at:new Date().toISOString(),completed_at:completed?new Date().toISOString():null};
    const {data,error}=await sb.from('lesson_progress').upsert(row,{onConflict:'user_id,lesson_id'}).select('id,user_id,lesson_id,completed,completed_at,updated_at').single();
    if(error) throw error;
    progressMap.set(lessonId,data);
    const existing=progress.findIndex(x=>x.lesson_id===lessonId);
    if(existing>=0) progress[existing]=data; else progress.push(data);
  }

  async function renderLesson(){
    const host=$('[data-v2-lesson]');
    if(!host) return;
    const lessonId=qs('id');
    const lesson=lessonById.get(lessonId);
    if(!lesson){host.innerHTML='<div class="v2-empty">No encontramos esta lección dentro de tu acceso.</div>';return;}
    const m=moduleById.get(lesson.module_id);
    const course=courseById.get(m?.course_id);
    const list=courseLessons(course.id);
    const idx=list.findIndex(x=>x.id===lesson.id);
    const prev=idx>0?list[idx-1]:null;
    const next=idx>=0&&idx<list.length-1?list[idx+1]:null;
    const weekList=courseModules(course.id);
    const weekIndex=weekList.findIndex(x=>x.id===m.id)+1;
    const done=!!progressMap.get(lesson.id)?.completed;
    const resources=await lessonResources(lesson.id,course.id);

    host.innerHTML=`
      <div class="lesson-shell">
        <a class="v2-back" href="${weekPath(m)}">← ${esc(m.title)}</a>
        <header class="lesson-head">
          <span class="v2-eyebrow">Semana ${weekIndex} · Lección ${lesson.position||idx+1}</span>
          <h1>${esc(lesson.title)}</h1>
          <p>${esc(lesson.description||'Avanza a tu ritmo y marca la lección cuando termines.')}</p>
          <div class="lesson-meta">${lesson.duration_minutes?'<span class="v2-pill">'+lesson.duration_minutes+' min</span>':''}<span class="v2-pill">${esc(lesson.lesson_type||'Lección')}</span>${done?'<span class="v2-pill done">✓ Completada</span>':''}</div>
        </header>
        <section class="lesson-player" data-v2-video><div class="lesson-player-empty">Preparando contenido…</div></section>
        <article class="v2-card lesson-content-card">
          <span class="v2-eyebrow">Contenido de la lección</span>
          <div class="content-html">${sanitizeContent(lesson.content_html||'<p>'+esc(lesson.description||'El contenido de esta lección está listo para tu práctica.')+'</p>')}</div>
        </article>
        ${resources.length?'<section class="v2-card lesson-resources"><span class="v2-eyebrow">Material de apoyo</span><div class="resource-list">'+resources.map(r=>'<div class="resource-item"><div><strong>'+esc(r.title)+'</strong><small>'+esc(r.description||r.resource_type||'Recurso')+'</small></div>'+(r.external_url?'<a class="v2-btn secondary" href="'+esc(r.external_url)+'" target="_blank" rel="noopener">Abrir</a>':'<span class="v2-pill">En biblioteca</span>')+'</div>').join('')+'</div></section>':''}
        <nav class="lesson-actions">
          ${prev?'<a class="v2-btn secondary" href="'+lessonPath(prev)+'">← Anterior</a>':'<a class="v2-btn secondary" href="'+weekPath(m)+'">← Semana</a>'}
          <button class="v2-btn primary complete-btn ${done?'completed':''}" type="button" data-v2-complete>${done?'✓ Lección completada':'Marcar como completada'}</button>
          ${next?'<a class="v2-btn secondary" href="'+lessonPath(next)+'">Siguiente →</a>':'<a class="v2-btn secondary" href="'+coursePath(course)+'">Finalizar →</a>'}
        </nav>
      </div>`;

    renderVideo(lesson);

    $('[data-v2-complete]')?.addEventListener('click',async e=>{
      const btn=e.currentTarget;
      const nowDone=!!progressMap.get(lesson.id)?.completed;
      btn.disabled=true;
      btn.textContent=nowDone?'Actualizando…':'Guardando…';
      try{
        await markLesson(lesson.id,!nowDone);
        btn.classList.toggle('completed',!nowDone);
        btn.textContent=!nowDone?'✓ Lección completada':'Marcar como completada';
        toast(!nowDone?'Progreso guardado. ¡Muy bien!':'La lección volvió a quedar pendiente.');
      }catch(err){
        console.error(err);
        toast('No fue posible guardar el progreso.',true);
        btn.textContent=nowDone?'✓ Lección completada':'Marcar como completada';
      }finally{btn.disabled=false;}
    });
  }

  async function renderLibrary(){
    const host=$('[data-v2-library]');
    if(!host) return;
    const {data,error}=await sb.from('resources')
      .select('id,title,description,resource_type,external_url,file_path,course_id,lesson_id,position')
      .eq('workspace_id',workspace.id)
      .order('position',{ascending:true});
    if(error){host.innerHTML='<div class="v2-empty">No fue posible cargar tu biblioteca.</div>';return;}
    const resources=data||[];
    host.innerHTML=resources.length?'<div class="course-grid">'+resources.map(r=>{
      const c=courseById.get(r.course_id);
      return '<article class="v2-card course-body"><span class="v2-eyebrow">'+esc(r.resource_type||'Recurso')+'</span><h2 style="font-size:20px">'+esc(r.title)+'</h2><p>'+esc(r.description||'Material de acompañamiento de Academia Yamilet.')+'</p><div class="course-meta"><span>'+esc(c?.title||'Academia Yamilet')+'</span></div>'+(r.external_url?'<a class="v2-btn secondary" href="'+esc(r.external_url)+'" target="_blank" rel="noopener">Abrir recurso →</a>':'<span class="v2-pill">Disponible dentro del curso</span>')+'</article>';
    }).join('')+'</div>':'<div class="v2-empty">Aún no tienes recursos disponibles en tu biblioteca.</div>';
  }

  function money(value){
    if(value===null || value===undefined || value==='') return '';
    const amount=Number(value);
    if(!Number.isFinite(amount)) return '';
    return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(amount);
  }

  function renderDiscover(){
    const host=$('[data-v2-discover]');
    if(!host) return;

    const enrolledIds=new Set(enrollments.filter(e=>['active','completed'].includes(e.status)).map(e=>e.course_id));
    const purchasable=courses.filter(c=>c.payment_url && !enrolledIds.has(c.id));
    const comingCourses=courses.filter(c=>!enrolledIds.has(c.id) && !c.payment_url);

    host.innerHTML=`
      <section class="discover-hero">
        <div>
          <span class="v2-eyebrow">Continúa creciendo</span>
          <h1>Descubre lo que sigue en tu camino.</h1>
          <p>Cursos, libros y talleres de Yamilet reunidos en un solo lugar. Lo que ya compraste permanece en <strong>Mis cursos</strong>; aquí encuentras nuevas experiencias para continuar.</p>
        </div>
        <div class="discover-hero-tags"><span>Cursos</span><span>Libros</span><span>Talleres</span></div>
      </section>

      <nav class="discover-tabs" aria-label="Categorías">
        <a href="#cursos">Cursos</a><a href="#libros">Libros</a><a href="#talleres">Talleres</a>
      </nav>

      <section class="discover-section" id="cursos">
        <div class="section-title">
          <div><span class="v2-eyebrow">Formación</span><h2>Nuevos cursos</h2></div>
          <span class="discover-count">${purchasable.length+comingCourses.length}</span>
        </div>
        ${purchasable.length ? '<div class="store-grid">'+purchasable.map(c=>{
          const regular=money(c.price);
          const sale=money(c.sale_price);
          return '<article class="store-card v2-card"><div class="store-media landscape"><img src="'+esc(c.cover_url||DEFAULT_COVER)+'" alt="'+esc(c.title)+'"></div><div class="store-copy"><span class="v2-pill gold">Curso</span><h3>'+esc(c.title)+'</h3><p>'+esc(c.subtitle||c.description||'Programa de Academia Yamilet.')+'</p><div class="store-price">'+(sale?'<strong>'+sale+'</strong>'+(regular?'<del>'+regular+'</del>':''):(regular?'<strong>'+regular+'</strong>':''))+'</div><a class="v2-btn primary" href="'+esc(c.payment_url)+'" target="_blank" rel="noopener noreferrer">Comprar curso →</a></div></article>';
        }).join('')+'</div>' : '<div class="discover-empty"><span>✦</span><div><strong>Los próximos cursos aparecerán aquí.</strong><p>En cuanto Yamilet publique un nuevo programa con su enlace de pago, la alumna podrá comprarlo directamente desde esta sección.</p></div></div>'}
      </section>

      <section class="discover-section" id="libros">
        <div class="section-title">
          <div><span class="v2-eyebrow">Biblioteca de Yamilet</span><h2>Libros disponibles</h2></div>
          <span class="discover-count">${BOOK_CATALOG.length}</span>
        </div>
        <div class="book-store-grid">
          ${BOOK_CATALOG.map(book=>`
            <article class="book-store-card v2-card">
              <div class="book-store-cover"><img src="${esc(book.image)}" alt="Portada de ${esc(book.title)}" loading="lazy"></div>
              <div class="book-store-copy">
                <span class="v2-pill">Libro</span>
                <h3>${esc(book.title)}</h3>
                <p>${esc(book.description)}</p>
                <a class="v2-btn secondary" href="${esc(book.url)}" target="_blank" rel="noopener noreferrer">Comprar en Amazon →</a>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="discover-section" id="talleres">
        <div class="section-title">
          <div><span class="v2-eyebrow">Experiencias en vivo</span><h2>Próximos talleres</h2></div>
        </div>
        <div class="discover-empty">
          <span>○</span>
          <div><strong>Este espacio queda listo para los próximos talleres.</strong><p>Cuando definamos nombre, fecha, imagen, precio y enlace de compra, aparecerán aquí con reservación o pago directo.</p></div>
        </div>
      </section>`;
  }

  function renderProfile(){
    const host=$('[data-v2-profile]');
    if(!host) return;
    const name=profile?.full_name||'';
    host.innerHTML=`
      <div class="home-grid" style="grid-template-columns:.72fr 1.28fr">
        <article class="v2-card today-card" style="text-align:center">
          <span class="v2-avatar" style="width:74px;height:74px;margin:0 auto 13px;font-size:20px">${esc(initials(name||user.email))}</span>
          <h2 style="margin:0;color:var(--ay-green);font:600 24px Georgia,serif">${esc(name||'Mi perfil')}</h2>
          <p style="margin:5px 0;color:var(--ay-muted);font-size:10px">${esc(profile?.email||user.email||'')}</p>
          <div style="margin-top:13px"><span class="v2-pill gold">${esc(membership?.role||profile?.role||'student')}</span></div>
        </article>
        <article class="v2-card today-card">
          <div class="section-title"><div><span class="v2-eyebrow">Cuenta</span><h2>Información personal</h2></div></div>
          <form data-v2-profile-form style="display:grid;gap:12px">
            <label style="display:grid;gap:6px;color:#63736b;font-size:10px;font-weight:800">Nombre completo<input name="full_name" value="${esc(name)}" required maxlength="120" style="height:45px;border:1px solid var(--ay-line);border-radius:12px;padding:0 12px;background:#fbfcfa"></label>
            <label style="display:grid;gap:6px;color:#63736b;font-size:10px;font-weight:800">Correo<input value="${esc(profile?.email||user.email||'')}" disabled style="height:45px;border:1px solid var(--ay-line);border-radius:12px;padding:0 12px;background:#f2f5f2"></label>
            <div><button class="v2-btn primary" type="submit">Guardar cambios</button></div>
          </form>
        </article>
      </div>`;
    $('[data-v2-profile-form]')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const value=e.currentTarget.full_name.value.trim();
      if(!value)return;
      const btn=e.currentTarget.querySelector('button');btn.disabled=true;
      const {error}=await sb.from('profiles').update({full_name:value}).eq('id',user.id);
      btn.disabled=false;
      if(error){toast('No fue posible guardar tu perfil.',true);return;}
      profile.full_name=value;nav();toast('Perfil actualizado.');
    });
  }

  revealWarmNavigation();

  async function boot(){
    try{
      const slug=await initClient();
      if(!await loadIdentity(slug)) return;
      await loadLearningData();
      nav();
      if(page==='home') renderHome();
      if(page==='courses') renderCourses();
      if(page==='course') renderCourse();
      if(page==='week') renderWeek();
      if(page==='lesson') await renderLesson();
      if(page==='library') await renderLibrary();
      if(page==='discover') renderDiscover();
      if(page==='profile') renderProfile();
      finishLoading();
    }catch(err){
      console.error('Academia Yamilet V2',err);
      const target=$('[data-v2-error]');
      if(target) target.innerHTML='<div class="v2-empty">No pudimos cargar esta sección. Regresa a la Academia e inténtalo nuevamente.</div>';
      finishLoading();
    }
  }

  boot();
})();