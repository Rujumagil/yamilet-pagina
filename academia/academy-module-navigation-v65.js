(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let activeModuleIndex = null;
  let scheduled = false;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function moduleData(module, index) {
    const title = $('h3', module)?.textContent.trim() || `Módulo ${index + 1}`;
    const description = $('.module-head p', module)?.textContent.trim() || 'Continúa tu recorrido dentro de Método MES®.';
    const label = $('.module-label', module)?.textContent.trim() || `Módulo ${index + 1}`;
    const countText = $('.academy-module-count', module)?.textContent.trim() || $('.module-head > span', module)?.textContent.trim() || '0/0';
    const match = countText.match(/(\d+)\s*\/\s*(\d+)/);
    const done = Number(match?.[1] || 0);
    const total = Number(match?.[2] || $$('.lesson-row', module).length || 0);
    const percent = total ? Math.round((done / total) * 100) : 0;
    const lessons = $$('.lesson-row .lesson-copy strong', module).map(item => item.textContent.trim()).filter(Boolean);
    return { title, description, label, done, total, percent, lessons };
  }

  function currentHost() {
    const view = $('[data-course-view]');
    const host = $('[data-course-detail]');
    if (!view || view.classList.contains('hidden') || !host) return null;
    return { view, host };
  }

  function buildIndex(host) {
    const syllabus = $('.syllabus', host);
    if (!syllabus) return null;
    const modules = $$('.module-block', syllabus);
    if (!modules.length) return null;

    let index = $('.academy-module-index', host);
    if (!index) {
      index = document.createElement('section');
      index.className = 'academy-module-index';
      syllabus.insertAdjacentElement('beforebegin', index);
    }

    const fingerprint = modules.map(module => $('h3', module)?.textContent.trim() || '').join('|');
    if (index.dataset.fingerprint !== fingerprint) {
      index.dataset.fingerprint = fingerprint;
      index.innerHTML = modules.map((module, moduleIndex) => {
        const data = moduleData(module, moduleIndex);
        const preview = data.lessons.slice(0, 2).map(title => `<li>${esc(title)}</li>`).join('');
        return `<button class="academy-module-card" type="button" data-open-autonomous-module="${moduleIndex}">
          <div class="academy-module-card-top"><span class="academy-module-card-number">${String(moduleIndex + 1).padStart(2, '0')}</span><span class="academy-module-card-progress">${data.done}/${data.total}</span></div>
          <div class="academy-module-card-copy"><span>${esc(data.label)}</span><h3>${esc(data.title)}</h3><p>${esc(data.description)}</p></div>
          ${preview ? `<ul class="academy-module-card-preview">${preview}</ul>` : ''}
          <div class="academy-module-card-footer"><div class="academy-module-card-track"><span style="width:${data.percent}%"></span></div><strong>${data.percent}%</strong><span class="academy-module-card-action">Abrir semana →</span></div>
        </button>`;
      }).join('');
    }

    modules.forEach((module, indexNumber) => {
      module.dataset.autonomousModuleIndex = String(indexNumber);
      module.classList.toggle('is-autonomous-active', String(indexNumber) === String(activeModuleIndex));
    });

    host.classList.add('academy-autonomous-course');
    return { syllabus, modules, index };
  }

  function moduleHeader(host) {
    let header = $('.academy-module-view-head', host);
    if (!header) {
      header = document.createElement('section');
      header.className = 'academy-module-view-head';
      $('.syllabus', host)?.insertAdjacentElement('beforebegin', header);
    }
    return header;
  }

  function setLearningMode(mode) {
    document.body.dataset.academyLearningView = mode;
    const main = $('.dashboard-main');
    if (main) main.dataset.academySection = mode;
  }

  function showModule(moduleIndex, options = {}) {
    const context = currentHost();
    if (!context) return false;
    const built = buildIndex(context.host);
    if (!built) return false;

    const indexNumber = Number(moduleIndex);
    const module = built.modules[indexNumber];
    if (!module) return false;

    activeModuleIndex = indexNumber;
    built.modules.forEach((item, idx) => item.classList.toggle('is-autonomous-active', idx === indexNumber));
    context.host.dataset.moduleMode = 'detail';
    context.host.dataset.activeModule = String(indexNumber);
    setLearningMode('module');

    const data = moduleData(module, indexNumber);
    const header = moduleHeader(context.host);
    header.innerHTML = `<button class="academy-module-back" type="button" data-back-module-index>← Volver a las semanas</button>
      <div class="academy-module-hero">
        <div class="academy-module-hero-number">${String(indexNumber + 1).padStart(2, '0')}</div>
        <div class="academy-module-hero-copy"><span>${esc(data.label)} · Método MES®</span><h1>${esc(data.title)}</h1><p>${esc(data.description)}</p></div>
        <div class="academy-module-hero-progress"><strong>${data.percent}%</strong><span>${data.done} de ${data.total} completadas</span><div><i style="width:${data.percent}%"></i></div></div>
      </div>
      <div class="academy-module-lessons-head"><div><span>Contenido de esta semana</span><h2>${data.total} ${data.total === 1 ? 'clase' : 'clases'}</h2></div><p>Abre una clase para entrar a su contenido. Al regresar volverás a esta semana.</p></div>`;

    if (options.scroll !== false) context.view.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function showIndex(options = {}) {
    const context = currentHost();
    if (!context) return false;
    const built = buildIndex(context.host);
    if (!built) return false;

    activeModuleIndex = null;
    built.modules.forEach(module => module.classList.remove('is-autonomous-active'));
    context.host.dataset.moduleMode = 'index';
    delete context.host.dataset.activeModule;
    $('.academy-module-view-head', context.host)?.remove();
    setLearningMode('course');
    if (options.scroll !== false) context.view.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function enhanceCourse() {
    scheduled = false;
    const context = currentHost();
    if (!context) return false;
    const built = buildIndex(context.host);
    if (!built) return false;

    if (activeModuleIndex !== null && built.modules[activeModuleIndex]) {
      showModule(activeModuleIndex, { scroll: false });
    } else {
      context.host.dataset.moduleMode = 'index';
      $('.academy-module-view-head', context.host)?.remove();
      setLearningMode('course');
    }
    return true;
  }

  function scheduleEnhance(delay = 80) {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(enhanceCourse, delay);
  }

  document.addEventListener('click', event => {
    const moduleButton = event.target.closest('[data-open-autonomous-module]');
    if (moduleButton) {
      event.preventDefault();
      showModule(moduleButton.dataset.openAutonomousModule);
      return;
    }

    if (event.target.closest('[data-back-module-index]')) {
      event.preventDefault();
      showIndex();
      return;
    }

    const lessonButton = event.target.closest('[data-open-lesson]');
    if (lessonButton) {
      const parentModule = lessonButton.closest('.module-block[data-autonomous-module-index]');
      if (parentModule) activeModuleIndex = Number(parentModule.dataset.autonomousModuleIndex);
      return;
    }

    if (event.target.closest('[data-open-course]')) {
      activeModuleIndex = null;
      window.setTimeout(enhanceCourse, 20);
      window.setTimeout(enhanceCourse, 180);
      return;
    }

    if (event.target.closest('[data-back-course]')) {
      window.setTimeout(() => {
        if (activeModuleIndex !== null) showModule(activeModuleIndex, { scroll: false });
        else enhanceCourse();
      }, 30);
      window.setTimeout(() => {
        if (activeModuleIndex !== null) showModule(activeModuleIndex, { scroll: false });
      }, 220);
      return;
    }

    if (event.target.closest('[data-back-courses], [data-scroll-courses], [data-shell-route="courses"], [data-dashboard-open-courses]')) {
      activeModuleIndex = null;
    }
  });

  const host = $('[data-course-detail]');
  if (host) {
    const observer = new MutationObserver(() => scheduleEnhance(60));
    observer.observe(host, { childList: true, subtree: true });
  }

  window.addEventListener('yamilet:lesson-video-updated', () => scheduleEnhance(80));
  window.setTimeout(enhanceCourse, 350);
})();