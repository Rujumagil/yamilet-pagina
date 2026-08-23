(() => {
  'use strict';

  const GROUPS = [
    { label: 'APRENDIZAJE', routes: ['home', 'courses', 'evaluations', 'calendar', 'certificates'] },
    { label: 'RECURSOS', routes: ['library', 'help'] },
    { label: 'CUENTA', routes: ['profile'] },
    { label: 'DESCUBRIR', routes: ['explore'] },
    { label: 'ADMINISTRACIÓN', routes: ['admin'], admin: true }
  ];

  const LABELS = {
    home: 'Inicio',
    courses: 'Mis cursos',
    evaluations: 'Evaluaciones',
    calendar: 'Calendario',
    certificates: 'Certificados',
    library: 'Mi biblioteca',
    help: 'Ayuda y soporte',
    profile: 'Mi perfil',
    explore: 'Explorar cursos',
    admin: 'Panel administrativo'
  };

  let attempts = 0;

  function relabel(button, route) {
    const spans = button.querySelectorAll('span');
    const text = spans[spans.length - 1];
    if (text && LABELS[route]) text.textContent = LABELS[route];
  }

  function organizeNavigation() {
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return retry();
    if (nav.dataset.professionalAcademyNav === 'true') return;

    const buttons = [...nav.querySelectorAll('.shell-nav-item[data-shell-route]')];
    if (!buttons.length || !buttons.some(button => button.dataset.shellRoute === 'home')) return retry();

    const byRoute = new Map(buttons.map(button => [button.dataset.shellRoute, button]));
    const fragment = document.createDocumentFragment();

    GROUPS.forEach(group => {
      const groupButtons = group.routes.map(route => byRoute.get(route)).filter(Boolean);
      if (!groupButtons.length) return;

      const section = document.createElement('section');
      section.className = `academy-nav-group${group.admin ? ' academy-nav-group-admin' : ''}`;

      const label = document.createElement('div');
      label.className = 'academy-nav-group-label';
      label.textContent = group.label;
      section.appendChild(label);

      const items = document.createElement('div');
      items.className = 'academy-nav-group-items';
      groupButtons.forEach(button => {
        const route = button.dataset.shellRoute;
        relabel(button, route);
        items.appendChild(button);
      });
      section.appendChild(items);
      fragment.appendChild(section);
    });

    nav.replaceChildren(fragment);
    nav.dataset.professionalAcademyNav = 'true';
  }

  function retry() {
    attempts += 1;
    if (attempts <= 40) window.setTimeout(organizeNavigation, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', organizeNavigation, { once: true });
  } else {
    organizeNavigation();
  }

  window.addEventListener('pageshow', () => {
    attempts = 0;
    organizeNavigation();
  });
})();
