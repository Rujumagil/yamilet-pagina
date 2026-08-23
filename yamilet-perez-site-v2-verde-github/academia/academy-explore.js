(() => {
  'use strict';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const UPCOMING = [
    { title: 'Nuevo curso', copy: 'Una nueva experiencia de aprendizaje se encuentra en preparación.', image: './assets/cursos/proximamente-nuevo-curso.svg' },
    { title: 'Próximo taller', copy: 'Un próximo espacio práctico se incorporará al catálogo de Academia Yamilet.', image: './assets/cursos/proximamente-taller.svg' },
    { title: 'Curso en desarrollo', copy: 'Nueva formación en desarrollo para ampliar tu recorrido dentro de la Academia.', image: './assets/cursos/proximamente-desarrollo.svg' }
  ];
  let clientPromise;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        return { sb, cfg };
      })();
    }
    return clientPromise;
  }

  async function loadData() {
    const { sb, cfg } = await getClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('no_session');
    const { data: workspace } = await sb.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle();
    if (!workspace) throw new Error('no_workspace');
    const [{ data: courses, error: courseError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
      sb.from('courses').select('id,title,subtitle,description,status,cover_url,featured,instructor_name,duration_label').eq('workspace_id', workspace.id).order('featured', { ascending: false }).order('created_at', { ascending: true }),
      sb.from('enrollments').select('course_id,status,enrolled_at,completed_at').eq('user_id', session.user.id)
    ]);
    if (courseError) throw courseError;
    if (enrollmentError) throw enrollmentError;
    const enrollmentMap = new Map((enrollments || []).map(item => [item.course_id, item]));
    const published = (courses || []).filter(course => course.status === 'published');
    const included = published.filter(course => ['active', 'completed'].includes(enrollmentMap.get(course.id)?.status));
    const available = published.filter(course => !included.some(item => item.id === course.id));
    return { published, included, available, enrollmentMap };
  }

  function safeImage(url) {
    try {
      const parsed = new URL(String(url || ''), location.href);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch { return ''; }
  }

  function courseCard(course, included) {
    const cover = safeImage(course.cover_url);
    return `<article class="academy-explore-card${included ? ' is-included' : ''}" data-explore-card data-explore-state="${included ? 'included' : 'available'}" data-course-title="${esc(course.title)}">
      <div class="academy-explore-card-media">${cover ? `<img src="${esc(cover)}" alt="Portada de ${esc(course.title)}" loading="lazy">` : '<div class="academy-explore-card-fallback">YP</div>'}<span>${included ? 'INCLUIDO EN TU ACADEMIA' : 'PROGRAMA PUBLICADO'}</span></div>
      <div class="academy-explore-card-body">
        <div class="academy-explore-card-meta"><span>${esc(course.instructor_name || 'Academia Yamilet')}</span>${course.duration_label ? `<span>${esc(course.duration_label)}</span>` : ''}</div>
        <h3>${esc(course.title)}</h3>
        <p>${esc(course.subtitle || course.description || 'Programa de Academia Yamilet.')}</p>
        <div class="academy-explore-card-actions">
          ${included ? '<button type="button" class="primary" data-explore-open-courses>Ir a Mis cursos</button><span class="academy-explore-access">Acceso activo</span>' : `<button type="button" class="primary" data-explore-request data-course-id="${esc(course.id)}" data-course-name="${esc(course.title)}">Solicitar información</button><span class="academy-explore-access">Sin inscripción activa</span>`}
        </div>
      </div>
    </article>`;
  }

  function upcomingMarkup() {
    return `<section class="academy-explore-upcoming">
      <div class="academy-explore-section-head"><div><span>PRÓXIMOS LANZAMIENTOS</span><h3>Lo que viene después</h3></div><p>Estos espacios todavía no son cursos publicados ni forman parte de tu inscripción actual.</p></div>
      <div class="academy-explore-upcoming-grid">${UPCOMING.map(item => `<article data-explore-upcoming><img src="${item.image}" alt="${esc(item.title)}" loading="lazy"><div><span>PRÓXIMAMENTE</span><h4>${esc(item.title)}</h4><p>${esc(item.copy)}</p><button type="button" disabled>Disponible próximamente</button></div></article>`).join('')}</div>
    </section>`;
  }

  function emptyAvailable() {
    return `<div class="academy-explore-empty"><div>◇</div><section><span>CATÁLOGO ACTUAL</span><h4>No hay nuevos programas publicados por ahora</h4><p>Tu curso activo sigue disponible en la sección superior. Cuando Academia Yamilet publique otra formación, aparecerá aquí automáticamente.</p></section></div>`;
  }

  function renderMarkup(data) {
    return `<div class="academy-explore-hero">
      <div><span class="academy-explore-kicker">CATÁLOGO ACADÉMICO</span><h2>Explora tu siguiente paso</h2><p>Consulta los programas publicados, distingue lo que ya forma parte de tu cuenta y descubre las próximas experiencias de Academia Yamilet.</p></div>
      <div class="academy-explore-stats"><article><strong>${data.published.length}</strong><span>publicados</span></article><article><strong>${data.included.length}</strong><span>en tu Academia</span></article><article><strong>${data.available.length}</strong><span>por explorar</span></article><article><strong>${UPCOMING.length}</strong><span>próximamente</span></article></div>
    </div>
    <div class="academy-explore-toolbar"><div class="academy-explore-search"><span>⌕</span><input type="search" data-explore-search placeholder="Buscar programas" aria-label="Buscar programas"></div><div class="academy-explore-filters"><button class="active" type="button" data-explore-filter="all">Todos</button><button type="button" data-explore-filter="included">Ya los tengo</button><button type="button" data-explore-filter="available">Por explorar</button></div></div>
    <section class="academy-explore-section" data-explore-group="included"><div class="academy-explore-section-head"><div><span>TU FORMACIÓN</span><h3>Ya está en tu Academia</h3></div><p>Accede directamente a los programas que forman parte de tu cuenta.</p></div><div class="academy-explore-grid">${data.included.length ? data.included.map(course => courseCard(course, true)).join('') : '<div class="academy-explore-empty"><div>○</div><section><h4>No tienes cursos activos</h4><p>Cuando se active una inscripción aparecerá aquí.</p></section></div>'}</div></section>
    <section class="academy-explore-section" data-explore-group="available"><div class="academy-explore-section-head"><div><span>DESCUBRIR</span><h3>Otros programas publicados</h3></div><p>Formaciones publicadas que todavía no forman parte de tu acceso.</p></div><div class="academy-explore-grid">${data.available.length ? data.available.map(course => courseCard(course, false)).join('') : emptyAvailable()}</div></section>
    ${upcomingMarkup()}`;
  }

  function applyFilters(page) {
    const query = ($('[data-explore-search]', page)?.value || '').trim().toLowerCase();
    const active = $('[data-explore-filter].active', page)?.dataset.exploreFilter || 'all';
    $$('[data-explore-card]', page).forEach(card => {
      const text = card.textContent.toLowerCase();
      const state = card.dataset.exploreState;
      card.hidden = !((active === 'all' || active === state) && (!query || text.includes(query)));
    });
    $$('[data-explore-group]', page).forEach(group => {
      const cards = $$('[data-explore-card]', group);
      const visible = cards.filter(card => !card.hidden).length;
      group.hidden = active !== 'all' && group.dataset.exploreGroup !== active ? true : (cards.length > 0 && visible === 0);
    });
  }

  function bind(page) {
    $('[data-explore-search]', page)?.addEventListener('input', () => applyFilters(page));
    $$('[data-explore-filter]', page).forEach(button => button.addEventListener('click', () => {
      $$('[data-explore-filter]', page).forEach(item => item.classList.toggle('active', item === button));
      applyFilters(page);
    }));
    $$('[data-explore-open-courses]', page).forEach(button => button.addEventListener('click', () => $('[data-shell-route="courses"]')?.click()));
    $$('[data-explore-request]', page).forEach(button => button.addEventListener('click', () => {
      const courseId = button.dataset.courseId || '';
      const courseName = button.dataset.courseName || 'programa';
      $('[data-shell-route="help"]')?.click();
      setTimeout(() => {
        const form = $('[data-support-form]');
        if (!form) return;
        if (form.category) form.category.value = 'academic';
        if (form.course_id && courseId) form.course_id.value = courseId;
        if (form.subject) form.subject.value = `Información sobre ${courseName}`;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.subject?.focus();
      }, 500);
    }));
  }

  async function render() {
    const page = $('[data-shell-page="explore"]');
    if (!page || page.classList.contains('hidden')) return false;
    page.classList.add('academy-explore-page');
    page.innerHTML = '<div class="academy-explore-loading"><strong>Cargando catálogo…</strong><span>Consultando los programas disponibles para tu cuenta.</span></div>';
    try {
      const data = await loadData();
      if (page.classList.contains('hidden')) return false;
      page.innerHTML = renderMarkup(data);
      bind(page);
    } catch (error) {
      console.error('Academia Yamilet explorar', error);
      page.innerHTML = '<div class="academy-explore-loading error"><strong>No fue posible cargar el catálogo</strong><span>Vuelve a abrir Explorar cursos o recarga la Academia.</span></div>';
    }
    return true;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="explore"]')) setTimeout(render, 120);
  });
  window.addEventListener('pageshow', () => setTimeout(render, 300));
  window.ACADEMIA_YAMILET_EXPLORE = { render };
})();