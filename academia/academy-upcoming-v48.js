(() => {
  'use strict';

  const RELEASE = '20260822.48';
  const panel = document.querySelector('#mis-cursos');

  const upcoming = [
    {
      title: 'Nuevo curso',
      subtitle: 'Contenido en preparación',
      image: './assets/cursos/proximamente-nuevo-curso.svg'
    },
    {
      title: 'Próximo taller',
      subtitle: 'Nueva experiencia formativa',
      image: './assets/cursos/proximamente-taller.svg'
    },
    {
      title: 'Curso en desarrollo',
      subtitle: 'Próxima incorporación a la academia',
      image: './assets/cursos/proximamente-desarrollo.svg'
    }
  ];

  function mount() {
    if (!panel || panel.querySelector('[data-academy-upcoming-v48]')) return;

    const section = document.createElement('section');
    section.className = 'academy-upcoming-v48';
    section.dataset.academyUpcomingV48 = '1';
    section.innerHTML = `
      <div class="academy-upcoming-v48-head">
        <div>
          <span>Lo que viene</span>
          <h3>Próximamente en Academia Yamilet</h3>
        </div>
        <p>Nuevos espacios formativos que se incorporarán a la academia conforme su contenido esté listo.</p>
      </div>
      <div class="academy-upcoming-v48-grid">
        ${upcoming.map(item => `
          <article class="academy-upcoming-card">
            <img src="${item.image}" alt="${item.title} · Próximamente" loading="lazy">
            <div class="academy-upcoming-card-body">
              <span class="academy-upcoming-badge">Próximamente</span>
              <h4>${item.title}</h4>
              <p>${item.subtitle}</p>
              <button type="button" disabled aria-disabled="true">Disponible próximamente</button>
            </div>
          </article>`).join('')}
      </div>`;

    panel.appendChild(section);
    document.body.dataset.academyUpcoming = 'v48';
  }

  function boot() {
    mount();
    if (panel) new MutationObserver(() => setTimeout(mount, 0)).observe(panel, { childList: true });
    window.addEventListener('hashchange', () => setTimeout(mount, 40));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.ACADEMIA_YAMILET_UPCOMING_V48 = { release: RELEASE, mount };
})();
