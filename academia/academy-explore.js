(() => {
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const CATALOG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-catalog';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  let clientPromise;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
        return { sb, cfg };
      })();
    }
    return clientPromise;
  }

  async function loadData() {
    const [{ sb }, catalogResponse] = await Promise.all([
      getClient(),
      fetch(CATALOG_ENDPOINT, { headers: { Accept: 'application/json' } })
    ]);
    if (!catalogResponse.ok) throw new Error('catalog');
    const catalog = await catalogResponse.json();
    const { data: { session } } = await sb.auth.getSession();
    const enrollmentMap = new Map();
    if (session?.user) {
      const { data, error } = await sb.from('enrollments').select('course_id,status').eq('user_id', session.user.id);
      if (error) throw error;
      (data || []).forEach(row => enrollmentMap.set(String(row.course_id), row.status));
    }
    const courses = catalog.courses || [];
    return {
      courses,
      active: courses.filter(course => ['active','completed'].includes(enrollmentMap.get(String(course.id)))),
      available: courses.filter(course => course.catalog_status === 'available' && !['active','completed'].includes(enrollmentMap.get(String(course.id)))),
      upcoming: courses.filter(course => course.catalog_status === 'upcoming'),
      enrollmentMap
    };
  }

  function safeImage(url) {
    try {
      const parsed = new URL(String(url || ''), location.href);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch { return ''; }
  }

  function card(course, state) {
    const cover = safeImage(course.cover_url);
    const label = state === 'active' ? 'EN TU ACADEMIA' : state === 'upcoming' ? 'PRÓXIMAMENTE' : 'DISPONIBLE';
    const action = state === 'active'
      ? `<button class="primary" type="button" data-catalog-open-course="${esc(course.id)}">Abrir curso</button>`
      : state === 'upcoming'
        ? '<button type="button" disabled>Disponible próximamente</button>'
        : `<a class="primary" href="./catalogo.html?curso=${encodeURIComponent(course.id)}">Ver programa</a>`;
    return `<article class="academy-explore-card" data-explore-card data-explore-state="${state}" data-course-title="${esc(course.title)}">
      <div class="academy-explore-card-media">${cover ? `<img src="${esc(cover)}" alt="Portada de ${esc(course.title)}" loading="lazy">` : '<div class="academy-explore-card-fallback">YP</div>'}<span>${label}</span></div>
      <div class="academy-explore-card-body">
        <div class="academy-explore-card-meta"><span>${esc(course.category || 'Academia Yamilet')}</span>${course.duration_label ? `<span>${esc(course.duration_label)}</span>` : ''}</div>
        <h3>${esc(course.title)}</h3>
        <p>${esc(course.subtitle || course.description || 'Programa de Academia Yamilet.')}</p>
        <div class="academy-explore-card-actions">${action}<span class="academy-explore-access">${state === 'active' ? 'Acceso activo' : state === 'upcoming' ? 'En preparación' : 'Inscripción requerida'}</span></div>
      </div>
    </article>`;
  }

  function section(title, kicker, copy, courses, state, emptyCopy) {
    return `<section class="academy-explore-section" data-explore-group="${state}">
      <div class="academy-explore-section-head"><div><span>${kicker}</span><h3>${title}</h3></div><p>${copy}</p></div>
      <div class="academy-explore-grid">${courses.length ? courses.map(course => card(course, state)).join('') : `<div class="academy-explore-empty"><div>○</div><section><h4>${emptyCopy}</h4><p>Cuando exista una nueva opción aparecerá aquí automáticamente.</p></section></div>`}</div>
    </section>`;
  }

  function renderMarkup(data) {
    return `<div class="academy-explore-hero">
      <div><span class="academy-explore-kicker">CATÁLOGO DE CURSOS</span><h2>Descubre la formación de Academia Yamilet</h2><p>Este catálogo está separado de “Mis cursos”. Aquí puedes conocer programas disponibles y próximos lanzamientos; el contenido privado sólo se abre cuando tu inscripción está activa.</p></div>
      <div class="academy-explore-stats"><article><strong>${data.active.length}</strong><span>en tu cuenta</span></article><article><strong>${data.available.length}</strong><span>disponibles</span></article><article><strong>${data.upcoming.length}</strong><span>próximamente</span></article></div>
    </div>
    <div class="academy-explore-toolbar"><div class="academy-explore-search"><span>⌕</span><input type="search" data-explore-search placeholder="Buscar cursos" aria-label="Buscar cursos"></div><div class="academy-explore-filters"><button class="active" type="button" data-explore-filter="all">Todos</button><button type="button" data-explore-filter="active">Ya los tengo</button><button type="button" data-explore-filter="available">Disponibles</button><button type="button" data-explore-filter="upcoming">Próximamente</button></div></div>
    ${section('Ya están en tu Academia','TU FORMACIÓN','Programas con acceso activo en tu cuenta.',data.active,'active','No tienes otros cursos activos')}
    ${section('Cursos disponibles','DESCUBRIR','Programas que puedes conocer antes de inscribirte.',data.available,'available','No hay otros cursos disponibles por ahora')}
    ${section('Próximamente','LO QUE VIENE','Cursos reales de Yamilet que se encuentran en preparación.',data.upcoming,'upcoming','No hay lanzamientos anunciados todavía')}`;
  }

  function applyFilters(page) {
    const query = ($('[data-explore-search]', page)?.value || '').trim().toLocaleLowerCase('es');
    const active = $('[data-explore-filter].active', page)?.dataset.exploreFilter || 'all';
    $$('[data-explore-card]', page).forEach(item => {
      const matchesState = active === 'all' || item.dataset.exploreState === active;
      const matchesText = !query || item.textContent.toLocaleLowerCase('es').includes(query);
      item.hidden = !(matchesState && matchesText);
    });
    $$('[data-explore-group]', page).forEach(group => {
      if (active !== 'all' && group.dataset.exploreGroup !== active) group.hidden = true;
      else group.hidden = false;
    });
  }

  function bind(page) {
    $('[data-explore-search]', page)?.addEventListener('input', () => applyFilters(page));
    $$('[data-explore-filter]', page).forEach(button => button.addEventListener('click', () => {
      $$('[data-explore-filter]', page).forEach(item => item.classList.toggle('active', item === button));
      applyFilters(page);
    }));
    $$('[data-catalog-open-course]', page).forEach(button => button.addEventListener('click', () => {
      const courseId = button.dataset.catalogOpenCourse;
      $('[data-shell-route="courses"]')?.click();
      window.setTimeout(() => {
        const target = $(`[data-open-course="${CSS.escape(courseId)}"]`, document);
        target?.click();
      }, 220);
    }));
  }

  async function render() {
    const page = $('[data-shell-page="explore"]');
    if (!page || page.classList.contains('hidden')) return false;
    page.classList.add('academy-explore-page');
    page.innerHTML = '<div class="academy-explore-loading"><strong>Cargando catálogo…</strong><span>Consultando los programas de Academia Yamilet.</span></div>';
    try {
      const data = await loadData();
      if (page.classList.contains('hidden')) return false;
      page.innerHTML = renderMarkup(data);
      bind(page);
    } catch (error) {
      console.error('Academia Yamilet catálogo', error);
      page.innerHTML = '<div class="academy-explore-loading error"><strong>No fue posible cargar el catálogo</strong><span>Vuelve a abrir Catálogo de cursos o recarga la Academia.</span></div>';
    }
    return true;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="explore"]')) setTimeout(render, 120);
  });
  window.addEventListener('pageshow', () => setTimeout(render, 300));
  window.ACADEMIA_YAMILET_EXPLORE = { render };
})();