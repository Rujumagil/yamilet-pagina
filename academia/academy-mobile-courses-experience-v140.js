(() => {
  'use strict';

  if (window.__ACADEMIA_YAMILET_MOBILE_COURSES_V140_INIT__) return;
  window.__ACADEMIA_YAMILET_MOBILE_COURSES_V140_INIT__ = true;

  const VERSION = '140.1';
  const mq = window.matchMedia('(max-width:760px)');
  const METHOD_COVER = '../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp';
  let timer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();

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

  function setText(node, value) {
    if (!node) return false;
    const next = String(value ?? '');
    if (node.textContent === next) return false;
    node.textContent = next;
    return true;
  }

  function setAttr(node, name, value) {
    if (!node) return false;
    const next = String(value ?? '');
    if (node.getAttribute(name) === next) return false;
    node.setAttribute(name, next);
    return true;
  }

  function percentFrom(card) {
    const direct = $('.course-percent', card)?.textContent || $('.v125-course-top strong', card)?.textContent || '';
    const aria = $('.progress-track,[aria-label*="Progreso"],.v125-progress', card)?.getAttribute('aria-label') || '';
    const match = `${direct} ${aria}`.match(/(\d{1,3})\s*%/);
    return Math.max(0, Math.min(100, Number(match?.[1] || 0)));
  }

  function isMethodMes(card) {
    const title = $('h2,h3', card)?.textContent || '';
    return /m[eé]todo\s+mes/i.test(title);
  }

  function fixedCover(card) {
    if (!isMethodMes(card)) return;
    const img = $('.course-cover,.v125-course-cover img,img.course-cover', card);
    if (!img) return;
    const current = img.getAttribute('src') || '';
    if (!current.includes('10-metodo-mes-cover.webp')) img.setAttribute('src', METHOD_COVER);
    setAttr(img, 'alt', 'Portada oficial del Método MES®');
    setAttr(img, 'loading', 'eager');
    setAttr(img, 'decoding', 'async');
  }

  function compactMeta(card) {
    const meta = $('.course-meta,.v125-course-meta', card);
    if (!meta) return;
    const text = normalize(meta.textContent);
    const weeks = text.match(/(\d+)\s*semanas?/i)?.[1];
    const lessons = text.match(/(\d+)\s*(?:de\s*\d+\s*)?lecciones?/i)?.[1];
    let label = '';
    if (isMethodMes(card)) label = '4 semanas · 22 lecciones';
    else if (weeks && lessons) label = `${weeks} semanas · ${lessons} lecciones`;
    else label = text;
    if (!label) return;

    const singleSpan = meta.children.length === 1 && meta.firstElementChild?.tagName === 'SPAN';
    if (singleSpan && normalize(meta.firstElementChild.textContent) === label) return;

    const span = document.createElement('span');
    span.textContent = label;
    meta.replaceChildren(span);
  }

  function ensureProgressLabel(card, percent) {
    const track = $('.progress-track,.v125-progress', card);
    if (!track) return;
    let head = $('.v140-progress-head', card);
    if (!head) {
      head = document.createElement('div');
      head.className = 'v140-progress-head';
      head.innerHTML = '<span>Tu progreso</span><strong>0%</strong>';
      track.insertAdjacentElement('beforebegin', head);
    }
    setText($('strong', head), `${percent}%`);
    setAttr(track, 'aria-label', `Progreso del curso ${percent}%`);
  }

  function intelligentAction(card, percent) {
    const action = $('[data-open-course],.v125-course-btn', card);
    if (!action) return;
    const label = percent >= 100 ? 'Repasar curso' : percent > 0 ? 'Continuar curso' : 'Comenzar curso';
    setText(action, label);
    setAttr(action, 'aria-label', `${label}: ${$('h2,h3', card)?.textContent?.trim() || 'curso'}`);
  }

  function polishStatus(card, percent) {
    const tag = $('.tag,.v125-course-badge', card);
    if (!tag) return;
    const current = tag.textContent.trim().toLocaleLowerCase('es');
    const staff = current.includes('staff') || tag.dataset.v140Staff === 'true';
    if (staff) {
      setText(tag, 'VISTA DE STAFF');
      if (tag.dataset.v140Staff !== 'true') tag.dataset.v140Staff = 'true';
      return;
    }
    setText(tag, percent >= 100 ? 'COMPLETADO' : 'ACTIVO');
    if (tag.dataset.v140Staff) delete tag.dataset.v140Staff;
  }

  function polishCard(card) {
    const percent = percentFrom(card);
    card.classList.add('v140-course-card');
    fixedCover(card);
    compactMeta(card);
    ensureProgressLabel(card, percent);
    intelligentAction(card, percent);
    polishStatus(card, percent);
    const oldPercent = $('.course-percent', card);
    if (oldPercent && oldPercent.getAttribute('aria-hidden') !== 'true') oldPercent.setAttribute('aria-hidden', 'true');
  }

  function polishLegacyHeading() {
    const panel = $('#mis-cursos');
    if (!panel) return;
    panel.classList.add('v140-courses-hub');
    const head = $('.panel-head', panel);
    const copy = $('p', head || panel);
    setText(copy, 'Continúa tus programas y retoma tu avance donde lo dejaste.');
    const catalog = $('[data-open-course-catalog]', panel);
    setText(catalog, 'Catálogo de cursos →');
    const activeHead = $('.academy-v68-active-head', panel);
    const activeCount = $$('.learning-course-card:not([hidden])', panel).length;
    const activeCopy = $('p', activeHead || panel);
    if (activeCopy && activeHead) setText(activeCopy, activeCount === 1 ? '1 programa activo en tu cuenta.' : `${activeCount} programas activos en tu cuenta.`);
  }

  function polishV125Heading() {
    const page = $('.v125-courses-page');
    if (!page) return;
    page.classList.add('v140-courses-hub');
    setText($('.v125-heading p', page), 'Continúa tus programas y retoma tu avance donde lo dejaste.');
    setText($('.v125-catalog-btn', page), 'Catálogo de cursos →');
  }

  function polishUpcoming() {
    $$('.academy-v68-upcoming,.v125-upcoming').forEach(section => {
      const hasRealCards = !!$('.academy-v68-upcoming-card,.v125-upcoming-card', section);
      const loading = !!$('.academy-v68-upcoming-loading', section);
      const shouldBeEmpty = !hasRealCards && !loading;
      if (section.classList.contains('v140-upcoming-empty') !== shouldBeEmpty) {
        section.classList.toggle('v140-upcoming-empty', shouldBeEmpty);
      }
    });
  }

  function enhance() {
    window.clearTimeout(timer);
    timer = 0;
    if (!mq.matches || !isCoursesRoute()) return;

    const cards = $$('.learning-course-card,.v125-course-card');
    if (!cards.length) return;

    if (document.body.dataset.academyCoursesExperience !== VERSION) {
      document.body.dataset.academyCoursesExperience = VERSION;
    }
    polishLegacyHeading();
    polishV125Heading();
    cards.forEach(polishCard);
    polishUpcoming();
  }

  function schedule(delay = 60) {
    window.clearTimeout(timer);
    timer = window.setTimeout(enhance, delay);
  }

  const root = $('[data-dashboard]') || document.body;
  new MutationObserver(mutations => {
    if (!mq.matches || !isCoursesRoute()) return;
    const relevant = mutations.some(m => {
      if (m.type === 'attributes') return m.attributeName === 'src';
      if (m.type !== 'childList') return false;
      return m.addedNodes.length > 0 || m.removedNodes.length > 0;
    });
    if (relevant) schedule(90);
  }).observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['src'] });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="courses"],[data-scroll-courses],a[href="#courses"],[data-back-courses]')) schedule(120);
  }, true);
  window.addEventListener('hashchange', () => schedule(90));
  window.addEventListener('pageshow', () => schedule(160));
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', () => schedule(20));
  else if (typeof mq.addListener === 'function') mq.addListener(() => schedule(20));

  [120, 500, 1400].forEach(delay => window.setTimeout(() => schedule(20), delay));
  window.ACADEMIA_YAMILET_MOBILE_COURSES_V140 = Object.freeze({ version:VERSION, refresh:enhance });
})();