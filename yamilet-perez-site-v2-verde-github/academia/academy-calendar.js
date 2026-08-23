(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let sb = null;
  let cache = null;
  let activeFilter = 'all';

  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dayKey = value => {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const fmtDay = date => new Intl.DateTimeFormat('es-MX',{weekday:'short'}).format(date).replace('.','');
  const fmtMonth = date => new Intl.DateTimeFormat('es-MX',{month:'short'}).format(date).replace('.','');
  const fmtLong = value => new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(value));
  const fmtTime = value => new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));

  async function client(){
    if(sb) return sb;
    const response = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error('calendar_config');
    const config = await response.json();
    sb = window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return sb;
  }

  function category(event){
    const text = `${event.event_type||''} ${event.delivery_mode||''} ${event.title||''}`.toLowerCase();
    if(/taller|workshop/.test(text)) return 'workshop';
    if(/live|en vivo|zoom|online|virtual/.test(text)) return 'live';
    if(/sesion|sesión|session|clase|class/.test(text)) return 'session';
    return 'other';
  }

  async function loadData(force = false){
    if(cache && !force) return cache;
    const supabase = await client();
    const {data:{session}} = await supabase.auth.getSession();
    if(!session?.user) return {events:[],courses:new Map()};

    const {data:workspace,error:workspaceError} = await supabase.from('workspaces').select('id').eq('slug','yamilet-mes').maybeSingle();
    if(workspaceError || !workspace?.id) throw workspaceError || new Error('calendar_workspace');

    const start = new Date();
    start.setHours(0,0,0,0);
    const {data:events,error:eventError} = await supabase.from('academy_events')
      .select('id,course_id,title,description,event_type,starts_at,ends_at,timezone,delivery_mode,location_text,meeting_url,status,is_featured')
      .eq('workspace_id',workspace.id)
      .gte('starts_at',start.toISOString())
      .order('starts_at',{ascending:true})
      .limit(100);
    if(eventError) throw eventError;

    const visibleEvents = (events || []).filter(event => !/draft|cancel|archiv/i.test(String(event.status||'')));
    const courseIds = [...new Set(visibleEvents.map(event => event.course_id).filter(Boolean))];
    const courses = new Map();
    if(courseIds.length){
      const {data:courseRows} = await supabase.from('courses').select('id,title').in('id',courseIds);
      (courseRows || []).forEach(course => courses.set(course.id,course.title));
    }
    cache = {events:visibleEvents,courses};
    return cache;
  }

  function dayStrip(events){
    const today = new Date();
    today.setHours(0,0,0,0);
    const eventDays = new Set(events.map(event => dayKey(event.starts_at)));
    const days = Array.from({length:14},(_,index) => {
      const d = new Date(today);
      d.setDate(today.getDate()+index);
      return d;
    });
    return `<section class="academy-calendar-strip-wrap"><div class="academy-calendar-strip-head"><div><span>PRÓXIMOS DÍAS</span><h3>Tu agenda de aprendizaje</h3></div><p>Las fechas se actualizan automáticamente.</p></div><div class="academy-calendar-days">${days.map((date,index)=>`<article class="academy-calendar-day ${index===0?'today':''} ${eventDays.has(dayKey(date))?'has-event':''}">${eventDays.has(dayKey(date))?'<i class="academy-calendar-dot" aria-hidden="true"></i>':''}<span class="weekday">${esc(fmtDay(date))}</span><strong>${date.getDate()}</strong><span class="month">${esc(fmtMonth(date))}</span></article>`).join('')}</div></section>`;
  }

  function eventCard(event,courses){
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : null;
    const type = category(event);
    const course = event.course_id ? courses.get(event.course_id) : '';
    const mode = event.delivery_mode || event.location_text || '';
    const time = `${fmtTime(start)}${end && !Number.isNaN(end.getTime()) ? ` – ${fmtTime(end)}` : ''}`;
    const status = event.status || 'programado';
    return `<article class="academy-calendar-event" data-calendar-category="${esc(type)}">
      <div class="academy-calendar-date"><span>${esc(fmtDay(start))}</span><strong>${start.getDate()}</strong><small>${esc(fmtMonth(start))}</small></div>
      <div class="academy-calendar-event-copy"><span class="academy-calendar-type">${esc((event.event_type||'Evento académico').replace(/_/g,' '))}</span><h4>${esc(event.title||'Evento académico')}</h4><p>${esc(event.description||'Actividad programada dentro de Academia Yamilet.')}</p><div class="academy-calendar-event-meta"><span>${esc(fmtLong(start))}</span><span>${esc(time)}</span>${course?`<span>${esc(course)}</span>`:''}${mode?`<span>${esc(mode)}</span>`:''}</div></div>
      <div class="academy-calendar-event-actions"><span class="status">${esc(status)}</span>${event.meeting_url?`<a href="${esc(event.meeting_url)}" target="_blank" rel="noopener noreferrer">Entrar a sesión</a>`:''}</div>
    </article>`;
  }

  function emptyMarkup(){
    return `<div class="academy-calendar-empty"><div class="academy-calendar-empty-icon">▦</div><div><span>AGENDA ACADÉMICA</span><h3>No hay eventos próximos programados</h3><p>Cuando se publique una clase, sesión, encuentro o taller de Método MES®, aparecerá automáticamente aquí con su fecha, horario y acceso correspondiente.</p></div></div>`;
  }

  function applyFilter(page){
    $$('.academy-calendar-event',page).forEach(card => {
      card.hidden = activeFilter !== 'all' && card.dataset.calendarCategory !== activeFilter;
    });
  }

  function toolbar(events){
    if(!events.length) return '';
    return `<div class="academy-calendar-toolbar"><div><span class="academy-calendar-kicker">PRÓXIMAS ACTIVIDADES</span><h3>Eventos programados</h3></div><div class="academy-calendar-filters" role="group" aria-label="Filtrar eventos"><button class="active" type="button" data-calendar-filter="all">Todos</button><button type="button" data-calendar-filter="live">En vivo</button><button type="button" data-calendar-filter="workshop">Talleres</button><button type="button" data-calendar-filter="session">Sesiones</button></div></div>`;
  }

  async function renderCalendar(force = false){
    const page = $('[data-shell-page="calendar"]');
    if(!page || page.classList.contains('hidden')) return false;
    page.classList.add('academy-calendar-page');
    page.innerHTML = '<div class="academy-calendar-empty"><div class="academy-calendar-empty-icon">…</div><div><span>CALENDARIO</span><h3>Cargando tu agenda</h3><p>Estamos consultando las actividades programadas.</p></div></div>';
    try{
      const {events,courses} = await loadData(force);
      const currentMonth = new Date().getMonth();
      const thisMonth = events.filter(event => new Date(event.starts_at).getMonth() === currentMonth).length;
      const online = events.filter(event => /online|virtual|zoom|live|en vivo/i.test(`${event.delivery_mode||''} ${event.event_type||''}`)).length;
      page.innerHTML = `<section class="academy-calendar-hero"><div><span class="academy-calendar-kicker">CALENDARIO ACADÉMICO</span><h2>Organiza tu aprendizaje y tus encuentros</h2><p>Consulta en un solo lugar tus próximas clases, sesiones y eventos de Academia Yamilet.</p></div><div class="academy-calendar-stats"><article><strong>${events.length}</strong><span>próximos</span></article><article><strong>${thisMonth}</strong><span>este mes</span></article><article><strong>${online}</strong><span>en línea</span></article></div></section>${dayStrip(events)}${toolbar(events)}${events.length?`<div class="academy-calendar-events">${events.map(event=>eventCard(event,courses)).join('')}</div>`:emptyMarkup()}`;
      $$('[data-calendar-filter]',page).forEach(button=>button.addEventListener('click',()=>{
        activeFilter = button.dataset.calendarFilter || 'all';
        $$('[data-calendar-filter]',page).forEach(item=>item.classList.toggle('active',item===button));
        applyFilter(page);
      }));
      return true;
    }catch(error){
      console.warn('Academia Yamilet calendario',error);
      page.innerHTML = `<section class="academy-calendar-hero"><div><span class="academy-calendar-kicker">CALENDARIO ACADÉMICO</span><h2>Tu agenda de aprendizaje</h2><p>Clases, sesiones y eventos aparecerán aquí cuando estén disponibles.</p></div></section><div class="academy-calendar-error">No fue posible consultar la agenda en este momento. Puedes seguir usando el resto de la Academia con normalidad.</div>`;
      return false;
    }
  }

  function schedule(){
    window.setTimeout(()=>renderCalendar(false),180);
    window.setTimeout(()=>renderCalendar(false),600);
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-shell-route="calendar"]')) schedule();
  });
  window.addEventListener('pageshow',()=>window.setTimeout(()=>renderCalendar(false),300));
  window.ACADEMIA_YAMILET_CALENDAR = {render:renderCalendar,refresh:()=>renderCalendar(true)};
})();
