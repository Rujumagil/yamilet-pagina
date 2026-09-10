(() => {
  'use strict';

  let filter = 'all';
  let query = '';
  let scheduled = false;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function rows() {
    return $$('.booking-row', $('[data-booking-list]') || document);
  }

  function state(row) {
    return $('[data-booking-status]', row)?.value || 'requested';
  }

  function counts() {
    const all = rows();
    return {
      requested: all.filter(r => state(r) === 'requested').length,
      confirmed: all.filter(r => state(r) === 'confirmed').length,
      completed: all.filter(r => state(r) === 'completed').length,
      cancelled: all.filter(r => state(r) === 'cancelled').length
    };
  }

  function applyFilter() {
    const term = query.trim().toLowerCase();
    let visible = 0;
    rows().forEach(row => {
      const matchesState = filter === 'all' || state(row) === filter;
      const matchesText = !term || row.textContent.toLowerCase().includes(term);
      const show = matchesState && matchesText;
      row.classList.toggle('booking142-hidden', !show);
      if (show) visible += 1;
    });
    const count = $('[data-booking142-visible]');
    if (count) count.textContent = `${visible} ${visible === 1 ? 'solicitud visible' : 'solicitudes visibles'}`;
  }

  function updateStats() {
    const c = counts();
    $('[data-booking142-new]').textContent = c.requested;
    $('[data-booking142-confirmed]').textContent = c.confirmed;
    $('[data-booking142-completed]').textContent = c.completed;
    $('[data-booking142-cancelled]').textContent = c.cancelled;
    const globalCount = $('[data-booking-count]');
    if (globalCount) globalCount.textContent = c.requested;
    const label = globalCount?.closest('article')?.querySelector('span');
    if (label) label.textContent = 'Citas por atender';
  }

  function decorateRows() {
    rows().forEach(row => {
      const select = $('[data-booking-status]', row);
      if (!select) return;
      row.dataset.booking142Status = select.value;
      if (!select.dataset.booking142Bound) {
        select.dataset.booking142Bound = 'true';
        select.addEventListener('change', () => {
          row.dataset.booking142Status = select.value;
          window.setTimeout(() => {
            enhance();
            applyFilter();
          }, 80);
        });
      }
      const spans = $$(':scope > span', row);
      const email = spans[1];
      if (email && !email.querySelector('a')) {
        const value = email.textContent.trim();
        if (value.includes('@')) email.innerHTML = `<a href="mailto:${value}">${value}</a>`;
      }
    });
  }

  function ensureShell(panel, list) {
    if ($('[data-booking142-shell]', panel)) return;
    panel.classList.add('booking142-panel');
    const shell = document.createElement('div');
    shell.className = 'booking142-shell';
    shell.dataset.booking142Shell = 'true';
    shell.innerHTML = `
      <header class="booking142-head">
        <div><span>GESTIÓN DE SOLICITUDES</span><h2>Citas y sesiones</h2><p>Las personas que solicitan una sesión desde yamiletperez.com quedan registradas aquí para que Yamilet pueda darles seguimiento.</p></div>
        <button type="button" data-booking142-top>Ir arriba</button>
      </header>
      <section class="booking142-stats">
        <article><strong data-booking142-new>0</strong><span>Nuevas</span><small>por atender</small></article>
        <article><strong data-booking142-confirmed>0</strong><span>Confirmadas</span><small>con seguimiento</small></article>
        <article><strong data-booking142-completed>0</strong><span>Realizadas</span><small>histórico</small></article>
        <article><strong data-booking142-cancelled>0</strong><span>Canceladas</span><small>sin seguimiento</small></article>
      </section>
      <div class="booking142-tools">
        <label class="booking142-search"><span>Buscar persona</span><input type="search" data-booking142-search placeholder="Nombre, correo o fecha"></label>
        <div class="booking142-filters">
          <button type="button" class="active" data-booking142-filter="all">Todas</button>
          <button type="button" data-booking142-filter="requested">Nuevas</button>
          <button type="button" data-booking142-filter="confirmed">Confirmadas</button>
          <button type="button" data-booking142-filter="completed">Realizadas</button>
          <button type="button" data-booking142-filter="cancelled">Canceladas</button>
        </div>
      </div>
      <div class="booking142-count" data-booking142-visible></div>`;
    panel.insertBefore(shell, list);
    list.classList.add('booking142-list');

    $('[data-booking142-search]', shell)?.addEventListener('input', e => {
      query = e.target.value;
      applyFilter();
    });
    $$('[data-booking142-filter]', shell).forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.booking142Filter || 'all';
      $$('[data-booking142-filter]', shell).forEach(item => item.classList.toggle('active', item === button));
      applyFilter();
    }));
    $('[data-booking142-top]', shell)?.addEventListener('click', () => $('.dashboard-main')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }

  function mountNav() {
    const panel = $('#reservas');
    const legacy = $('[data-scroll-bookings]');
    const adminItems = $('.academy-nav-group-admin .academy-nav-group-items');
    if (!panel || !legacy || !adminItems) return;
    if (panel.classList.contains('hidden')) return;
    if (legacy.dataset.booking142Mounted === 'true') return;
    legacy.dataset.booking142Mounted = 'true';
    legacy.textContent = 'Citas / Solicitudes';
    legacy.classList.remove('hidden');
    legacy.removeAttribute('aria-hidden');
    legacy.tabIndex = 0;
    adminItems.appendChild(legacy);
    legacy.addEventListener('click', () => {
      panel.classList.remove('hidden');
      panel.style.setProperty('display','block','important');
      enhance();
      requestAnimationFrame(() => panel.scrollIntoView({behavior:'smooth',block:'start'}));
    });
  }

  function enhance() {
    scheduled = false;
    const panel = $('#reservas');
    const list = $('[data-booking-list]');
    if (!panel || !list) return;
    if (!panel.classList.contains('hidden')) {
      ensureShell(panel, list);
      decorateRows();
      updateStats();
      applyFilter();
      mountNav();
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  function boot() {
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click', e => {
      if (e.target.closest('[data-admin-target="bookings"],[data-scroll-bookings]')) window.setTimeout(enhance, 40);
    }, true);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
