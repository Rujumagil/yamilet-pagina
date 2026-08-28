(() => {
  'use strict';

  const ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-catalog';
  const grid = document.querySelector('[data-public-catalog-grid]');
  const search = document.querySelector('[data-public-catalog-search]');
  const dialog = document.querySelector('[data-course-dialog]');
  const dialogContent = document.querySelector('[data-course-dialog-content]');
  let courses = [];
  let filter = 'all';

  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  const safeImage = value => {
    try {
      const url = new URL(String(value || ''), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };

  const money = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(number);
  };

  function card(course) {
    const state = course.catalog_status === 'upcoming' ? 'upcoming' : 'available';
    const cover = safeImage(course.cover_url);
    const price = money(course.sale_price || course.price);
    return `<article class="catalog-card" data-state="${state}" data-course-id="${esc(course.id)}">
      <div class="catalog-card-media">${cover ? `<img src="${esc(cover)}" alt="Portada de ${esc(course.title)}" loading="lazy">` : '<div class="catalog-card-fallback">YP</div>'}<span class="catalog-status">${state === 'upcoming' ? 'PRÓXIMAMENTE' : 'DISPONIBLE'}</span></div>
      <div class="catalog-card-body">
        <div class="catalog-card-meta"><span>${esc(course.category || 'Academia Yamilet')}</span><span>${esc(course.instructor_name || 'Yamilet Pérez')}</span></div>
        <h3>${esc(course.title)}</h3>
        <p>${esc(course.subtitle || course.description || 'Programa de Academia Yamilet.')}</p>
        <div class="catalog-card-facts">${course.duration_label ? `<span>${esc(course.duration_label)}</span>` : ''}${price ? `<span>${esc(price)}</span>` : ''}</div>
        <div class="catalog-card-actions">${state === 'upcoming' ? '<button type="button" disabled>Disponible próximamente</button>' : `<button class="primary" type="button" data-open-public-course="${esc(course.id)}">Ver programa</button><a class="secondary" href="./">Ya estoy inscrita</a>`}</div>
      </div>
    </article>`;
  }

  function filteredCourses() {
    const query = (search?.value || '').trim().toLocaleLowerCase('es');
    return courses.filter(course => {
      const state = course.catalog_status === 'upcoming' ? 'upcoming' : 'available';
      const matchesFilter = filter === 'all' || filter === state;
      const haystack = `${course.title || ''} ${course.subtitle || ''} ${course.description || ''} ${course.category || ''}`.toLocaleLowerCase('es');
      return matchesFilter && (!query || haystack.includes(query));
    });
  }

  function render() {
    if (!grid) return;
    const list = filteredCourses();
    grid.innerHTML = list.length ? list.map(card).join('') : '<div class="catalog-empty">No encontramos cursos con este filtro.</div>';
    grid.querySelectorAll('[data-open-public-course]').forEach(button => button.addEventListener('click', () => openCourse(button.dataset.openPublicCourse)));
  }

  function openCourse(id) {
    const course = courses.find(item => String(item.id) === String(id));
    if (!course || !dialog || !dialogContent) return;
    const cover = safeImage(course.cover_url);
    const price = money(course.sale_price || course.price);
    const paymentUrl = (() => {
      try {
        const url = new URL(String(course.payment_url || ''));
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
      } catch { return ''; }
    })();
    dialogContent.innerHTML = `${cover ? `<div class="catalog-dialog-media"><img src="${esc(cover)}" alt="Portada de ${esc(course.title)}"></div>` : ''}<div class="catalog-dialog-copy"><span>${esc(course.category || 'Academia Yamilet')}</span><h2>${esc(course.title)}</h2><p>${esc(course.description || course.subtitle || 'Programa de Academia Yamilet.')}</p><div class="catalog-dialog-details">${course.instructor_name ? `<span>Imparte: ${esc(course.instructor_name)}</span>` : ''}${course.duration_label ? `<span>${esc(course.duration_label)}</span>` : ''}${price ? `<span>${esc(price)}</span>` : ''}</div><div class="catalog-dialog-actions">${paymentUrl ? `<a class="primary" href="${esc(paymentUrl)}" target="_blank" rel="noopener">Inscribirme</a>` : '<a class="primary" href="../es/">Solicitar información</a>'}<a class="secondary" href="./">Ya estoy inscrita</a></div></div>`;
    dialog.showModal();
  }

  async function load() {
    if (!grid) return;
    try {
      const response = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('catalog_unavailable');
      const data = await response.json();
      courses = data.courses || [];
      render();
      const selected = new URLSearchParams(location.search).get('curso');
      if (selected && courses.some(item => String(item.id) === selected)) window.setTimeout(() => openCourse(selected), 100);
    } catch (error) {
      console.error('Catálogo Academia Yamilet', error);
      grid.innerHTML = '<div class="catalog-empty">No fue posible cargar el catálogo en este momento. Puedes volver a la página principal o intentarlo más tarde.</div>';
    }
  }

  search?.addEventListener('input', render);
  document.querySelectorAll('[data-public-catalog-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.publicCatalogFilter || 'all';
    document.querySelectorAll('[data-public-catalog-filter]').forEach(item => item.classList.toggle('active', item === button));
    render();
  }));
  document.querySelector('[data-course-dialog-close]')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  load();
})();