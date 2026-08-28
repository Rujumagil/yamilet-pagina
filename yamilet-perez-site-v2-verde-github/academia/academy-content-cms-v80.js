(() => {
  'use strict';

  const VERSION = '80.0.0';
  const ROOT_SELECTOR = '[data-content-admin-root]';
  const SPECIAL_NO_VIDEO = 'evaluacion y cierre de la semana 1';
  let activeTab = 'structure';
  let expandedModuleId = null;
  let scheduled = 0;
  let observer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  function isContentRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'content';
  }

  function rootReady() {
    const root = $(ROOT_SELECTOR);
    return !!root && !!$('.admin-toolbar', root) && !!$('.course-admin-summary', root);
  }

  function courseTitle(root) {
    const select = $('[data-admin-course-select]', root);
    return select?.selectedOptions?.[0]?.textContent?.trim() || 'Curso';
  }

  function selectedStatus(root) {
    return $('.course-admin-summary .admin-chip', root)?.textContent?.trim() || 'draft';
  }

  function lessonCounts(root) {
    const rows = $$('.lesson-admin-row', root);
    const noVideo = rows.filter(row => normalize($('.lesson-admin-copy strong', row)?.textContent) === SPECIAL_NO_VIDEO).length;
    const video = rows.filter(row => normalize($('.lesson-admin-copy small', row)?.textContent).startsWith('video')).length;
    return { total: rows.length, video, noVideo };
  }

  function createHero(root) {
    if ($('[data-cms80-hero]', root)) return;
    const toolbar = $('.admin-toolbar', root);
    const summary = $('.course-admin-summary', root);
    if (!toolbar || !summary) return;

    toolbar.classList.add('cms80-coursebar');
    toolbar.dataset.cms80Hero = 'true';
    const heading = toolbar.firstElementChild;
    if (heading) {
      const kicker = $('.kicker', heading);
      if (kicker) kicker.textContent = 'CMS EDUCATIVO';
      const h2 = $('h2', heading);
      if (h2) h2.textContent = 'Contenido del curso';
      if (!$('.cms80-course-copy', heading)) {
        const copy = document.createElement('p');
        copy.className = 'cms80-course-copy';
        copy.textContent = 'Organiza el programa desde el curso hasta cada semana, lección y recurso.';
        heading.appendChild(copy);
      }
    }

    const select = $('[data-admin-course-select]', toolbar);
    if (select && !select.closest('.cms80-course-select')) {
      const wrap = document.createElement('label');
      wrap.className = 'cms80-course-select';
      wrap.innerHTML = '<span>Curso seleccionado</span>';
      select.parentNode.insertBefore(wrap, select);
      wrap.appendChild(select);
    }

    summary.classList.add('cms80-summary');
    const counts = lessonCounts(root);
    const completeness = counts.total ? Math.round(((counts.video + counts.noVideo) / counts.total) * 100) : 0;
    if (!$('[data-cms80-readiness]', summary)) {
      const card = document.createElement('div');
      card.dataset.cms80Readiness = 'true';
      card.className = 'cms80-readiness';
      card.innerHTML = `<span>Preparación</span><strong>${completeness}%</strong><small>${counts.video} con video · ${counts.noVideo} sin video requerido</small>`;
      summary.appendChild(card);
    }
  }

  function buildTabs(root) {
    if ($('[data-cms80-tabs]', root)) return;
    const summary = $('.course-admin-summary', root);
    const originalGrid = $('.admin-grid', root);
    if (!summary || !originalGrid) return;

    const cards = Array.from(root.children).filter(node => node.classList?.contains('admin-card'));
    const courseCard = originalGrid.children[0] || null;
    const moduleCreateCard = originalGrid.children[1] || null;
    const structureCard = cards.find(card => $('.module-admin-list', card));
    const resourcesCard = cards.find(card => $('.resource-admin-list', card));
    if (!courseCard || !moduleCreateCard || !structureCard || !resourcesCard) return;

    const tabs = document.createElement('nav');
    tabs.className = 'cms80-tabs';
    tabs.dataset.cms80Tabs = 'true';
    tabs.setAttribute('aria-label', 'Editor del curso');
    tabs.innerHTML = `
      <button type="button" data-cms80-tab="structure"><span>01</span><b>Estructura</b><small>Semanas y lecciones</small></button>
      <button type="button" data-cms80-tab="course"><span>02</span><b>Información</b><small>Portada y publicación</small></button>
      <button type="button" data-cms80-tab="resources"><span>03</span><b>Recursos</b><small>Biblioteca del curso</small></button>`;

    const workspace = document.createElement('div');
    workspace.className = 'cms80-workspace';
    workspace.dataset.cms80Workspace = 'true';

    const structurePanel = document.createElement('section');
    structurePanel.className = 'cms80-panel cms80-structure-panel';
    structurePanel.dataset.cms80Panel = 'structure';
    const structureGrid = document.createElement('div');
    structureGrid.className = 'cms80-structure-grid';
    const structureMain = document.createElement('div');
    structureMain.className = 'cms80-structure-main';
    const structureAside = document.createElement('aside');
    structureAside.className = 'cms80-structure-aside';
    structureMain.appendChild(structureCard);
    structureAside.appendChild(moduleCreateCard);
    structureGrid.append(structureMain, structureAside);
    structurePanel.appendChild(structureGrid);

    const coursePanel = document.createElement('section');
    coursePanel.className = 'cms80-panel';
    coursePanel.dataset.cms80Panel = 'course';
    coursePanel.appendChild(courseCard);

    const resourcesPanel = document.createElement('section');
    resourcesPanel.className = 'cms80-panel';
    resourcesPanel.dataset.cms80Panel = 'resources';
    resourcesPanel.appendChild(resourcesCard);

    summary.after(tabs, workspace);
    workspace.append(structurePanel, coursePanel, resourcesPanel);
    originalGrid.remove();

    $$('[data-cms80-tab]', tabs).forEach(button => button.addEventListener('click', () => {
      activeTab = button.dataset.cms80Tab || 'structure';
      applyTab(root);
    }));
    applyTab(root);
  }

  function applyTab(root) {
    $$('[data-cms80-tab]', root).forEach(button => {
      const active = button.dataset.cms80Tab === activeTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('[data-cms80-panel]', root).forEach(panel => {
      const active = panel.dataset.cms80Panel === activeTab;
      panel.hidden = !active;
    });
  }

  function decorateCourseCard(root) {
    const card = $('[data-course-admin-form]', root)?.closest('.admin-card');
    if (!card || card.dataset.cms80Decorated === 'true') return;
    card.dataset.cms80Decorated = 'true';
    card.classList.add('cms80-course-card');
    const kicker = $('.kicker', card);
    if (kicker) kicker.textContent = 'IDENTIDAD DEL PROGRAMA';
    const instructor = $('[name="instructor_name"]', card)?.closest('label');
    if (instructor) instructor.childNodes[0].nodeValue = 'Quién imparte';
    const publish = $('.publish-line', card);
    if (publish) publish.classList.add('cms80-publish-line');
  }

  function decorateModuleCreator(root) {
    const form = $('[data-create-module-form]', root);
    const card = form?.closest('.admin-card');
    if (!card || card.dataset.cms80Decorated === 'true') return;
    card.dataset.cms80Decorated = 'true';
    card.classList.add('cms80-module-creator');
    const kicker = $('.kicker', card);
    if (kicker) kicker.textContent = 'NUEVA SEMANA / MÓDULO';
    const title = $('h3', card);
    if (title) title.textContent = 'Agregar a la estructura';
    const note = $('.upload-note', card);
    if (note) note.textContent = 'Crea únicamente contenido real. Después podrás agregar y ordenar las lecciones dentro de este módulo.';
  }

  function moduleId(module) {
    return $('[data-new-lesson]', module)?.dataset.newLesson || $('[data-move-module]', module)?.dataset.moveModule || '';
  }

  function decorateModules(root) {
    const modules = $$('.module-admin', root);
    if (!modules.length) return;
    if (!expandedModuleId || !modules.some(module => moduleId(module) === expandedModuleId)) expandedModuleId = moduleId(modules[0]);

    modules.forEach((module, index) => {
      const id = moduleId(module);
      if (!id) return;
      module.dataset.cms80Module = id;
      module.classList.add('cms80-module');
      const head = $('.module-admin-head', module);
      const lessons = $('.module-admin-lessons', module);
      const rows = $$('.lesson-admin-row', module);
      const copy = $('.module-admin-copy', module);
      const small = $('.module-admin-copy small', module);
      if (small) small.textContent = `Semana / módulo ${index + 1}`;
      if (copy && !$('.cms80-module-facts', copy)) {
        const facts = document.createElement('div');
        facts.className = 'cms80-module-facts';
        facts.innerHTML = `<span>${rows.length} ${rows.length === 1 ? 'lección' : 'lecciones'}</span>`;
        copy.appendChild(facts);
      }
      if (head && !$('.cms80-module-toggle', head)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cms80-module-toggle';
        button.dataset.cms80ModuleToggle = id;
        button.setAttribute('aria-label', 'Abrir o cerrar módulo');
        button.innerHTML = '<span>⌄</span>';
        head.appendChild(button);
        button.addEventListener('click', event => {
          event.stopPropagation();
          expandedModuleId = expandedModuleId === id ? null : id;
          applyModuleState(root);
        });
        head.addEventListener('click', event => {
          if (event.target.closest('button,input,textarea,select,a')) return;
          expandedModuleId = expandedModuleId === id ? null : id;
          applyModuleState(root);
        });
      }
      if (lessons) lessons.dataset.cms80Lessons = id;

      rows.forEach((row, lessonIndex) => {
        if (row.dataset.cms80Decorated === 'true') return;
        row.dataset.cms80Decorated = 'true';
        row.classList.add('cms80-lesson-row');
        const title = $('.lesson-admin-copy strong', row)?.textContent?.trim() || '';
        const meta = $('.lesson-admin-copy small', row);
        if (meta) {
          const type = String(meta.textContent || '').split('·')[0].trim();
          meta.textContent = `Lección ${lessonIndex + 1} · ${type}`;
        }
        const actions = $('.admin-actions', row);
        if (actions) {
          const badge = document.createElement('span');
          badge.className = 'cms80-lesson-state';
          if (normalize(title) === SPECIAL_NO_VIDEO) {
            badge.classList.add('neutral');
            badge.textContent = 'Sin video requerido';
          } else {
            badge.textContent = 'Editar contenido';
          }
          actions.prepend(badge);
        }
        row.addEventListener('click', event => {
          if (event.target.closest('button')) return;
          $('[data-edit-lesson]', row)?.click();
        });
      });
    });
    applyModuleState(root);
  }

  function applyModuleState(root) {
    $$('[data-cms80-module]', root).forEach(module => {
      const id = module.dataset.cms80Module;
      const expanded = !!expandedModuleId && id === expandedModuleId;
      module.classList.toggle('expanded', expanded);
      const list = $('[data-cms80-lessons]', module);
      if (list) list.hidden = !expanded;
      const toggle = $('.cms80-module-toggle', module);
      if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function decorateLessonEditor(root) {
    const shell = $('[data-lesson-editor]', root);
    const form = $('[data-lesson-form]', root);
    if (!shell || !form || shell.classList.contains('hidden')) return;
    shell.classList.add('cms80-lesson-editor');
    if (form.dataset.cms80Decorated === 'true') return;
    form.dataset.cms80Decorated = 'true';

    const titleInput = $('[name="title"]', form);
    const title = titleInput?.value || '';
    const noVideo = normalize(title) === SPECIAL_NO_VIDEO;
    const groups = {
      basics: ['title','lesson_type','description','duration_minutes'],
      content: ['content_html'],
      media: ['video_url','lesson_media'],
      access: ['transcript_text','captions_url','accessibility_notes','is_preview']
    };

    Object.entries(groups).forEach(([group,names]) => {
      const section = document.createElement('fieldset');
      section.className = `cms80-editor-group cms80-editor-${group}`;
      const label = {basics:'Información de la lección',content:'Contenido principal',media:'Multimedia',access:'Accesibilidad y opciones'}[group];
      section.innerHTML = `<legend>${label}</legend>`;
      names.forEach(name => {
        const input = form.elements[name];
        const holder = input?.closest('label');
        if (holder) section.appendChild(holder);
      });
      const actions = $('.admin-actions.end', form);
      form.insertBefore(section, actions || null);
    });

    if (noVideo) {
      form.classList.add('cms80-no-video-lesson');
      const video = form.elements.video_url?.closest('label');
      if (video) video.hidden = true;
      const mediaGroup = $('.cms80-editor-media', form);
      if (mediaGroup && !$('.cms80-no-video-note', mediaGroup)) {
        const note = document.createElement('div');
        note.className = 'cms80-no-video-note';
        note.innerHTML = '<strong>Esta lección no requiere video.</strong><span>Los materiales complementarios pueden administrarse desde Recursos.</span>';
        mediaGroup.prepend(note);
      }
    }

    const head = $('.editor-head', shell);
    if (head) head.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function decorateResources(root) {
    const card = $('[data-resource-form]', root)?.closest('.admin-card');
    if (!card || card.dataset.cms80Decorated === 'true') return;
    card.dataset.cms80Decorated = 'true';
    card.classList.add('cms80-resource-card');
    const kicker = $('.kicker', card);
    if (kicker) kicker.textContent = 'BIBLIOTECA DEL CURSO';
    const title = $('h3', card);
    if (title) title.textContent = 'Recursos y materiales';
    $$('.resource-admin-row', card).forEach(row => row.classList.add('cms80-resource-row'));
  }

  function addContextBar(root) {
    const workspace = $('[data-cms80-workspace]', root);
    if (!workspace || $('[data-cms80-context]', root)) return;
    const bar = document.createElement('div');
    bar.className = 'cms80-context';
    bar.dataset.cms80Context = 'true';
    bar.innerHTML = `<span><b>${courseTitle(root)}</b><small>${selectedStatus(root)}</small></span><span class="cms80-context-flow">Curso <i>›</i> Semana / módulo <i>›</i> Lección <i>›</i> Recursos</span>`;
    workspace.before(bar);
  }

  function enhance() {
    scheduled = 0;
    if (!isContentRoute() || !rootReady()) return false;
    const root = $(ROOT_SELECTOR);
    if (!root) return false;
    root.classList.add('cms80-root');
    root.dataset.cms80Version = VERSION;
    createHero(root);
    buildTabs(root);
    decorateCourseCard(root);
    decorateModuleCreator(root);
    decorateModules(root);
    decorateLessonEditor(root);
    decorateResources(root);
    addContextBar(root);
    applyTab(root);
    return true;
  }

  function schedule(delay = 80) {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(enhance, delay);
  }

  function start() {
    observer = new MutationObserver(mutations => {
      if (!isContentRoute()) return;
      const relevant = mutations.some(mutation => Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && (node.matches?.(ROOT_SELECTOR) || node.querySelector?.(ROOT_SELECTOR) || node.matches?.('.admin-toolbar,.module-admin,.editor-shell,.resource-admin-row'))));
      if (relevant || rootReady()) schedule(60);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',()=>schedule(100));
    window.addEventListener('pageshow',()=>schedule(180));
    document.addEventListener('click',event=>{
      if (event.target.closest('[data-admin-v79-go="content"],[data-content-admin-nav]')) schedule(180);
      if (event.target.closest('[data-new-lesson],[data-edit-lesson],[data-cancel-lesson]')) schedule(80);
    },true);
    [250,700,1400,2400].forEach(delay=>setTimeout(enhance,delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_CONTENT_CMS = {version:VERSION,enhance,tab(name){activeTab=name;enhance();}};
})();