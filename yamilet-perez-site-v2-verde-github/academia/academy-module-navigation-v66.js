(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  let activeModuleIndex = null;
  let rebuilding = false;

  function host() {
    return $('[data-course-detail]');
  }

  function courseView() {
    return $('[data-course-view]');
  }

  function moduleRows(root) {
    return $$('.syllabus > .module-block', root);
  }

  function readModule(module, index) {
    const title = $('.module-head h3', module)?.textContent.trim() || `Semana ${index + 1}`;
    const description = $('.module-head p', module)?.textContent.trim() || 'Continúa tu recorrido dentro de Método MES®.';
    const label = $('.module-label', module)?.textContent.trim() || `Módulo ${index + 1}`;
    const rawCount = $('.module-head > span', module)?.textContent.trim() || '0/0';
    const match = rawCount.match(/(\d+)\s*\/\s*(\d+)/);
    const lessons = $$('.lesson-row', module);
    const done = Number(match?.[1] || lessons.filter(item => item.classList.contains('is-complete')).length || 0);
    const total = Number(match?.[2] || lessons.length || 0);
    const percent = total ? Math.round((done / total) * 100) : 0;
    const lessonNames = lessons.map(item => $('.lesson-copy strong', item)?.textContent.trim()).filter(Boolean);
    return { title, description, label, done, total, percent, lessonNames };
  }

  function setMode(root, mode) {
    root.dataset.moduleMode = mode;
    const view = courseView();
    if (view) view.dataset.autonomousCourseView = mode;
  }

  function ensureIndex(root) {
    const modules = moduleRows(root);
    if (!modules.length) return null;

    modules.forEach((module, index) => {
      module.dataset.autonomousModuleIndex = String(index);
      module.classList.toggle('is-autonomous-active', index === activeModuleIndex);
    });

    const signature = modules.map((module, index) => `${index}:${$('.module-head h3', module)?.textContent.trim() || ''}:${$('.module-head > span', module)?.textContent.trim() || ''}`).join('|');
    let index = $('.academy-module-index-v66', root);
    if (!index) {
      index = document.createElement('section');
      index.className = 'academy-module-index-v66';
      $('.syllabus', root)?.insertAdjacentElement('beforebegin', index);
    }

    if (index.dataset.signature !== signature) {
      index.dataset.signature = signature;
      index.innerHTML = modules.map((module, idx) => {
        const data = readModule(module, idx);
        const preview = data.lessonNames.slice(0, 3).map(name => `<li>${esc(name)}</li>`).join('');
        return `<button class="academy-module-card-v66" type="button" data-open-module-v66="${idx}">
          <div class="academy-module-card-v66-top"><span class="academy-module-number-v66">${String(idx + 1).padStart(2, '0')}</span><span class="academy-module-count-v66">${data.done}/${data.total}</span></div>
          <div class="academy-module-copy-v66"><span>${esc(data.label)}</span><h3>${esc(data.title)}</h3><p>${esc(data.description)}</p></div>
          ${preview ? `<ul>${preview}</ul>` : ''}
          <div class="academy-module-footer-v66"><div><i style="width:${data.percent}%"></i></div><strong>${data.percent}%</strong><span>Abrir semana →</span></div>
        </button>`;
      }).join('');
    }
    return { modules, index };
  }

  function buildModuleHeader(root, module, index) {
    const data = readModule(module, index);
    let header = $('.academy-module-view-v66', root);
    if (!header) {
      header = document.createElement('section');
      header.className = 'academy-module-view-v66';
      $('.syllabus', root)?.insertAdjacentElement('beforebegin', header);
    }
    header.innerHTML = `<button type="button" data-back-modules-v66>← Volver a las semanas</button>
      <div class="academy-module-hero-v66">
        <span class="academy-module-hero-number-v66">${String(index + 1).padStart(2, '0')}</span>
        <div><small>${esc(data.label)} · Método MES®</small><h1>${esc(data.title)}</h1><p>${esc(data.description)}</p></div>
        <aside><strong>${data.percent}%</strong><span>${data.done} de ${data.total} completadas</span><div><i style="width:${data.percent}%"></i></div></aside>
      </div>
      <div class="academy-module-lessons-title-v66"><div><small>Contenido de esta semana</small><h2>${data.total} ${data.total === 1 ? 'clase' : 'clases'}</h2></div><p>Selecciona una clase para abrir su contenido.</p></div>`;
  }

  function showIndex({ scroll = false } = {}) {
    const root = host();
    if (!root) return;
    const built = ensureIndex(root);
    if (!built) return;
    activeModuleIndex = null;
    built.modules.forEach(module => module.classList.remove('is-autonomous-active'));
    $('.academy-module-view-v66', root)?.remove();
    setMode(root, 'index');
    if (scroll) courseView()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showModule(index, { scroll = true } = {}) {
    const root = host();
    if (!root) return;
    const built = ensureIndex(root);
    if (!built) return;
    const idx = Number(index);
    const module = built.modules[idx];
    if (!module) return;
    activeModuleIndex = idx;
    built.modules.forEach((item, itemIndex) => item.classList.toggle('is-autonomous-active', itemIndex === idx));
    buildModuleHeader(root, module, idx);
    setMode(root, 'detail');
    if (scroll) courseView()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function rebuild() {
    if (rebuilding) return;
    const root = host();
    if (!root || !$('.syllabus > .module-block', root)) return;
    rebuilding = true;
    try {
      ensureIndex(root);
      if (activeModuleIndex !== null && moduleRows(root)[activeModuleIndex]) showModule(activeModuleIndex, { scroll: false });
      else showIndex({ scroll: false });
    } finally {
      rebuilding = false;
    }
  }

  document.documentElement.classList.add('academy-module-v66');

  document.addEventListener('click', event => {
    const openModule = event.target.closest('[data-open-module-v66]');
    if (openModule) {
      event.preventDefault();
      event.stopPropagation();
      showModule(openModule.dataset.openModuleV66);
      return;
    }

    if (event.target.closest('[data-back-modules-v66]')) {
      event.preventDefault();
      event.stopPropagation();
      showIndex({ scroll: true });
      return;
    }

    const lesson = event.target.closest('[data-open-lesson]');
    if (lesson) {
      const parent = lesson.closest('.module-block[data-autonomous-module-index]');
      if (parent) activeModuleIndex = Number(parent.dataset.autonomousModuleIndex);
      return;
    }

    if (event.target.closest('[data-open-course]')) {
      activeModuleIndex = null;
      setTimeout(rebuild, 0);
      setTimeout(rebuild, 80);
      setTimeout(rebuild, 300);
      return;
    }

    if (event.target.closest('[data-back-course]')) {
      setTimeout(() => activeModuleIndex !== null ? showModule(activeModuleIndex, { scroll: false }) : rebuild(), 60);
      return;
    }

    if (event.target.closest('[data-back-courses], [data-scroll-courses], [data-shell-route="courses"], [data-dashboard-open-courses]')) {
      activeModuleIndex = null;
    }
  }, true);

  const root = host();
  if (root) {
    new MutationObserver(() => {
      if (!rebuilding) {
        clearTimeout(root._academyV66Timer);
        root._academyV66Timer = setTimeout(rebuild, 25);
      }
    }).observe(root, { childList: true, subtree: true });
  }

  window.addEventListener('pageshow', () => setTimeout(rebuild, 50));
  setTimeout(rebuild, 80);
  setTimeout(rebuild, 400);
})();