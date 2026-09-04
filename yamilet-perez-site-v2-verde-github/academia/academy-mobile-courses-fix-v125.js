(() => {
  'use strict';

  const VERSION = '125.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const CATALOG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-catalog';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let scheduled = false;
  let contextPromise = null;
  let renderToken = 0;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const safeUrl = value => {
    try {
      const url = new URL(String(value || ''), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  function routeName() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function isCoursesRoute() {
    const main = $('.dashboard-main');
    return routeName() === 'courses' ||
      main?.dataset.v71Route === 'courses' ||
      main?.dataset.academySection === 'courses' ||
      document.body.dataset.academyRoute === 'courses';
  }

  function injectStyles() {
    if ($('style[data-academy-courses-fix-v125]')) return;
    const style = document.createElement('style');
    style.dataset.academyCoursesFixV125 = 'true';
    style.textContent = `
      [data-v125-suppressed="true"]{display:none!important}
      .v125-courses-page{display:grid;gap:24px;padding-bottom:34px}
      .v125-courses-page .v125-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}
      .v125-courses-page .v125-heading>div{max-width:760px}
      .v125-courses-page .v125-heading h1{margin:4px 0 8px;font-size:clamp(32px,4vw,44px);line-height:1.03;letter-spacing:-.04em;color:#172825}
      .v125-courses-page .v125-heading p{margin:0;color:#697871;line-height:1.55}
      .v125-courses-page .v125-kicker{display:block;color:#a68128;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
      .v125-catalog-btn,.v125-course-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border:1px solid rgba(18,63,53,.14);border-radius:13px;background:#fff;color:#0f5a4d;font-weight:800;text-decoration:none;box-sizing:border-box}
      .v125-course-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px}
      .v125-course-card{overflow:hidden;border:1px solid rgba(18,63,53,.10);border-radius:22px;background:#fff;box-shadow:0 14px 34px rgba(18,63,53,.07)}
      .v125-course-cover{position:relative;display:block;aspect-ratio:16/9;background:#123f35;overflow:hidden}
      .v125-course-cover img{width:100%;height:100%;object-fit:cover;display:block}
      .v125-course-badge{position:absolute;left:14px;top:14px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.95);color:#0d4b43;font-size:10px;font-weight:900;letter-spacing:.08em}
      .v125-course-body{display:grid;gap:10px;padding:20px}
      .v125-course-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .v125-course-top span{color:#65766f;font-size:12px}
      .v125-course-top strong{color:#0f5a4d;font-size:12px}
      .v125-course-body h2{margin:0;font-size:25px;line-height:1.08;letter-spacing:-.035em;color:#172825}
      .v125-course-body p{margin:0;color:#68766f;font-size:14px;line-height:1.5}
      .v125-progress{height:8px;overflow:hidden;border-radius:999px;background:#eaf1ee}
      .v125-progress span{display:block;height:100%;border-radius:inherit;background:#0f5a4d}
      .v125-course-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#738079;font-size:12px}
      .v125-course-btn{width:100%;margin-top:6px;min-height:50px;background:#0f5a4d;color:#fff;border-color:#0f5a4d}
      .v125-upcoming{display:grid;gap:14px;padding-top:24px;border-top:1px solid rgba(18,63,53,.10)}
      .v125-upcoming-head h2{margin:5px 0 6px;font-size:27px;letter-spacing:-.035em;color:#172825}
      .v125-upcoming-head p{margin:0;color:#748179;font-size:13px;line-height:1.5}
      .v125-upcoming-box,.v125-empty{padding:26px;border:1px dashed rgba(18,63,53,.18);border-radius:20px;background:rgba(255,255,255,.78)}
      .v125-upcoming-box strong,.v125-empty h2{display:block;margin:0 0 7px;color:#20302b}
      .v125-upcoming-box span,.v125-empty p{color:#748179;line-height:1.5}
      .v125-upcoming-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
      .v125-upcoming-card{display:grid;grid-template-columns:120px 1fr;overflow:hidden;border:1px solid rgba(18,63,53,.09);border-radius:17px;background:#fff}
      .v125-upcoming-card img{width:120px;height:100%;min-height:118px;object-fit:cover}
      .v125-upcoming-card>div{padding:14px}
      .v125-upcoming-card small{color:#a68128;font-size:9px;font-weight:900;letter-spacing:.10em}
      .v125-upcoming-card h3{margin:5px 0 4px;font-size:16px;color:#20302b}
      .v125-upcoming-card p{margin:0;color:#748179;font-size:12px;line-height:1.4}

      @media (max-width:900px){
        body.pwa-dashboard-active .academy-topbar,
        body:has(.dashboard:not(.hidden)) .academy-topbar{position:relative!important;top:auto!important;z-index:20!important}
        body.pwa-dashboard-active .dashboard-main,
        body:has(.dashboard:not(.hidden)) .dashboard-main{padding-bottom:calc(112px + env(safe-area-inset-bottom))!important}
        .aula-v71-page-host{padding-bottom:0!important}
        .v125-courses-page{gap:20px;padding:8px 0 calc(116px + env(safe-area-inset-bottom))}
        .v125-courses-page .v125-heading{display:grid;grid-template-columns:1fr;align-items:start;gap:14px;padding:0 2px}
        .v125-courses-page .v125-heading h1{font-size:34px;margin-top:5px}
        .v125-courses-page .v125-heading p{font-size:13px}
        .v125-catalog-btn{width:100%;min-height:48px}
        .v125-course-grid{grid-template-columns:1fr}
        .v125-course-card{border-radius:22px}
        .v125-course-cover{aspect-ratio:16/9}
        .v125-course-body{padding:18px;gap:10px}
        .v125-course-body h2{font-size:24px}
        .v125-course-body p{font-size:13px}
        .v125-course-meta{font-size:11px}
        .v125-course-btn{min-height:52px}
        .v125-upcoming{padding-top:22px}
        .v125-upcoming-head h2{font-size:25px}
        .v125-upcoming-card{grid-template-columns:92px 1fr}
        .v125-upcoming-card img{width:92px;min-height:105px}
      }
    `;
    document.head.appendChild(style);
  }

  async function getContext(force = false) {
    if (force) contextPromise = null;
    if (contextPromise) return contextPromise;

    contextPromise = (async () => {
      const configResponse = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!configResponse.ok) throw new Error('academy_config_unavailable');
      const config = await configResponse.json();
      const sb = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) throw new Error('academy_session_missing');
      const user = session.user;

      const { data: workspace, error: workspaceError } = await sb
        .from('workspaces')
        .select('id,name,slug')
        .eq('slug', config.workspaceSlug || 'yamilet-mes')
        .maybeSingle();
      if (workspaceError || !workspace?.id) throw workspaceError || new Error('academy_workspace_missing');

      const [{ data: profile }, { data: membership }, { data: enrollments, error: enrollmentError }] = await Promise.all([
        sb.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        sb.from('workspace_members').select('role,status').eq('workspace_id', workspace.id).eq('user_id', user.id).maybeSingle(),
        sb.from('enrollments').select('course_id,status,completed_at,enrolled_at').eq('user_id', user.id)
      ]);
      if (enrollmentError) throw enrollmentError;

      const isStaff = profile?.role === 'admin' ||
        (membership?.status === 'active' && ['owner', 'admin', 'instructor'].includes(String(membership.role || '')));
      const validEnrollments = (enrollments || []).filter(row => ['active', 'completed'].includes(String(row.status || '')));
      const enrollmentByCourse = new Map(validEnrollments.map(row => [String(row.course_id), row]));

      const { data: allCourses, error: coursesError } = await sb
        .from('courses')
        .select('id,title,subtitle,description,status,instructor_name,duration_label,cover_url,featured,created_at')
        .eq('workspace_id', workspace.id)
        .neq('status', 'archived')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: true });
      if (coursesError) throw coursesError;

      const courses = (allCourses || []).filter(course => isStaff || enrollmentByCourse.has(String(course.id)));
      const courseIds = courses.map(course => course.id);

      let modules = [];
      if (courseIds.length) {
        const { data, error } = await sb.from('modules').select('id,course_id,title,position').in('course_id', courseIds).order('position', { ascending: true });
        if (error) throw error;
        modules = data || [];
      }

      let lessons = [];
      const moduleIds = modules.map(module => module.id);
      if (moduleIds.length) {
        const { data, error } = await sb.from('lessons').select('id,module_id,title,position').in('module_id', moduleIds).order('position', { ascending: true });
        if (error) throw error;
        lessons = data || [];
      }

      const { data: progressRows, error: progressError } = await sb
        .from('lesson_progress')
        .select('lesson_id,completed,last_position_seconds,updated_at')
        .eq('user_id', user.id);
      if (progressError) throw progressError;

      let catalog = [];
      try {
        const catalogResponse = await fetch(CATALOG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (catalogResponse.ok) catalog = (await catalogResponse.json()).courses || [];
      } catch (error) {
        console.warn('Academia Yamilet catálogo v125', error);
      }

      return {
        courses,
        modules,
        lessons,
        progress: progressRows || [],
        catalog,
        enrollmentByCourse,
        isStaff
      };
    })().catch(error => {
      contextPromise = null;
      throw error;
    });

    return contextPromise;
  }

  function lessonsFor(ctx, courseId) {
    const moduleIds = new Set(ctx.modules.filter(module => String(module.course_id) === String(courseId)).map(module => String(module.id)));
    return ctx.lessons.filter(lesson => moduleIds.has(String(lesson.module_id)));
  }

  function stateFor(ctx, course) {
    const lessons = lessonsFor(ctx, course.id);
    const progressByLesson = new Map(ctx.progress.map(row => [String(row.lesson_id), row]));
    const completed = lessons.filter(lesson => progressByLesson.get(String(lesson.id))?.completed).length;
    const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
    const next = lessons.find(lesson => !progressByLesson.get(String(lesson.id))?.completed) || lessons[0] || null;
    const enrollment = ctx.enrollmentByCourse.get(String(course.id)) || null;
    return { course, lessons, completed, percent, next, enrollment };
  }

  function courseCover(course) {
    return safeUrl(course.cover_url) || '../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp';
  }

  function courseCard(ctx, course) {
    const state = stateFor(ctx, course);
    const enrolled = !!state.enrollment;
    const complete = state.percent === 100 && state.lessons.length > 0;
    const badge = complete ? 'COMPLETADO' : enrolled ? 'EN CURSO' : 'VISTA DE STAFF';
    const actionLabel = complete ? 'Repasar curso' : 'Continuar curso';
    const action = state.next
      ? `#lesson/${encodeURIComponent(course.id)}/${encodeURIComponent(state.next.id)}`
      : `#course/${encodeURIComponent(course.id)}`;
    const meta = `${state.completed} de ${state.lessons.length} lecciones`;

    return `<article class="v125-course-card" data-v125-course="${esc(course.id)}">
      <a class="v125-course-cover" href="#course/${encodeURIComponent(course.id)}" aria-label="Abrir ${esc(course.title || 'curso')}">
        <img src="${esc(courseCover(course))}" alt="Portada de ${esc(course.title || 'curso')}" loading="lazy">
        <span class="v125-course-badge">${badge}</span>
      </a>
      <div class="v125-course-body">
        <div class="v125-course-top"><span>${esc(course.instructor_name || 'Yamilet Pérez')}</span><strong>${state.percent}%</strong></div>
        <h2>${esc(course.title || 'Método MES®')}</h2>
        <p>${esc(course.subtitle || course.description || 'Continúa tu aprendizaje en Academia Yamilet.')}</p>
        <div class="v125-progress" aria-label="Progreso ${state.percent}%"><span style="width:${state.percent}%"></span></div>
        <div class="v125-course-meta"><span>${meta}</span><span>${esc(course.duration_label || '')}</span></div>
        <a class="v125-course-btn" href="${action}">${actionLabel}</a>
      </div>
    </article>`;
  }

  function upcomingSection(ctx) {
    const activeIds = new Set(ctx.courses.map(course => String(course.id)));
    const upcoming = ctx.catalog.filter(course => course.catalog_status === 'upcoming' && !activeIds.has(String(course.id)));
    const cards = upcoming.map(course => {
      const cover = safeUrl(course.cover_url) || '../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp';
      return `<article class="v125-upcoming-card"><img src="${esc(cover)}" alt="Portada de ${esc(course.title || 'próximo curso')}" loading="lazy"><div><small>PRÓXIMAMENTE</small><h3>${esc(course.title || 'Nueva formación')}</h3><p>${esc(course.subtitle || course.description || 'Nueva formación en preparación.')}</p></div></article>`;
    }).join('');

    return `<section class="v125-upcoming">
      <div class="v125-upcoming-head"><span class="v125-kicker">Próximamente</span><h2>Lo que viene en Academia Yamilet</h2><p>Estas formaciones todavía no forman parte de tu inscripción.</p></div>
      ${cards ? `<div class="v125-upcoming-grid">${cards}</div>` : '<div class="v125-upcoming-box"><strong>Nuevas formaciones en preparación</strong><span>Cuando Yamilet publique un nuevo curso, aparecerá aquí automáticamente.</span></div>'}
    </section>`;
  }

  function suppressLegacyLayers(active) {
    const main = $('.dashboard-main');
    const host = $('[data-aula-pages-v71]', main || document);
    if (!main) return;
    Array.from(main.children).forEach(child => {
      if (child === host || child.classList.contains('academy-topbar')) return;
      if (active) child.dataset.v125Suppressed = 'true';
      else delete child.dataset.v125Suppressed;
    });
  }

  function renderLoading(host) {
    host.innerHTML = `<div class="v125-courses-page"><section class="v125-heading"><div><span class="v125-kicker">Tu aprendizaje</span><h1>Mis cursos</h1><p>Estamos preparando tus cursos y tu progreso.</p></div></section></div>`;
  }

  async function renderCoursesPage(force = false) {
    scheduled = false;
    injectStyles();

    if (!isCoursesRoute()) {
      suppressLegacyLayers(false);
      return;
    }

    const dashboard = $('[data-dashboard]');
    const host = $('[data-aula-pages-v71]');
    if (!dashboard || dashboard.classList.contains('hidden') || !host) return;

    suppressLegacyLayers(true);
    const token = ++renderToken;
    if (!host.querySelector('.v125-courses-page')) renderLoading(host);

    try {
      const ctx = await getContext(force);
      if (token !== renderToken || !isCoursesRoute() || !host.isConnected) return;

      const signature = `${ctx.courses.map(course => course.id).join(',')}|${ctx.progress.map(row => `${row.lesson_id}:${row.completed ? 1 : 0}`).join(',')}`;
      if (host.dataset.v125Signature === signature && host.querySelector('.v125-courses-page')) return;
      host.dataset.v125Signature = signature;

      const heading = `<section class="v125-heading">
        <div><span class="v125-kicker">Tu aprendizaje</span><h1>Mis cursos</h1><p>Accede a los programas que forman parte de tu cuenta y continúa exactamente donde te quedaste.</p></div>
        <a class="v125-catalog-btn" href="#catalog">Explorar catálogo</a>
      </section>`;

      if (!ctx.courses.length) {
        host.innerHTML = `<div class="v125-courses-page">${heading}<section class="v125-empty"><h2>Aún no tienes cursos asignados</h2><p>Cuando se active una inscripción, tus cursos aparecerán aquí. No mostraremos cursos que no formen parte de tu cuenta.</p><a class="v125-course-btn" href="#catalog">Explorar catálogo</a></section></div>`;
        return;
      }

      host.innerHTML = `<div class="v125-courses-page">${heading}<section class="v125-course-grid">${ctx.courses.map(course => courseCard(ctx, course)).join('')}</section>${upcomingSection(ctx)}</div>`;
    } catch (error) {
      console.error('Academia Yamilet cursos v125', error);
      if (!host.isConnected || !isCoursesRoute()) return;
      host.innerHTML = `<div class="v125-courses-page"><section class="v125-heading"><div><span class="v125-kicker">Tu aprendizaje</span><h1>Mis cursos</h1><p>No pudimos actualizar tus cursos en este momento.</p></div></section><section class="v125-empty"><h2>Vuelve a intentarlo</h2><p>Tu cuenta sigue segura. Recarga la pantalla para consultar nuevamente tus inscripciones.</p></section></div>`;
    }
  }

  function schedule(force = false, delay = 80) {
    if (scheduled && !force) return;
    scheduled = true;
    window.setTimeout(() => renderCoursesPage(force), delay);
  }

  function start() {
    injectStyles();
    const dashboard = $('[data-dashboard]') || document.body;
    const observer = new MutationObserver(mutations => {
      if (!isCoursesRoute()) return;
      const overwritten = mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => node.nodeType === 1 && !node.closest?.('.v125-courses-page')));
      schedule(false, overwritten ? 30 : 90);
    });
    observer.observe(dashboard, { childList: true, subtree: true });

    window.addEventListener('hashchange', () => schedule(true, 30));
    window.addEventListener('pageshow', () => schedule(true, 80));
    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="courses"],[data-scroll-courses],a[href="#courses"]')) schedule(true, 30);
    }, true);

    schedule(true, 250);
    window.ACADEMIA_YAMILET_COURSES_FIX_V125 = Object.freeze({ version: VERSION, refresh: () => schedule(true, 0) });
  }

  start();
})();