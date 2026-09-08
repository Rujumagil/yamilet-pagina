(() => {
  'use strict';

  const VERSION = '140';
  const mq = window.matchMedia('(max-width:760px)');
  const METHOD_COVER = '../imagenes-academia-yamilet-final/10-metodo-mes-cover.webp';
  let timer = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

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
    img.setAttribute('alt', 'Portada oficial del Método MES®');
    img.setAttribute('loading', 'eager');
    img.setAttribute('decoding', 'async');
  }

  function compactMeta(card) {
    const meta = $('.course-meta,.v125-course-meta', card);
    if (!meta) return;
    const text = meta.textContent.replace(/\s+/g, ' ').trim();
    const weeks = text.match(/(\d+)\s*semanas?/i)?.[1];
    const lessons = text.match(/(\d+)\s*(?:de\s*\d+\s*)?lecciones?/i)?.[1];
    let label = '';
    if (isMethodMes(card)) label = '4 semanas · 22 lecciones';
    else if (weeks && lessons) label = `${weeks} semanas · ${lessons} lecciones`;
    else label = text;
    if (label) meta.innerHTML = `<span>${label}</span>`;
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
    $('strong', head).textContent = `${percent}%`;
    track.setAttribute('aria-label', `Progreso del curso ${percent}%`);
  }

  function intelligentAction(card, percent) {
    const action = $('[data-open-course],.v125-course-btn', card);
    if (!action) return;
    action.textContent = percent >= 100 ? 'Repasar curso' : percent > 0 ? 'Continuar curso' : 'Comenzar curso';
    action.setAttribute('aria-label', `${action.textContent}: ${$('h2,h3', card)?.textContent?.trim() || 'curso'}`);
  }

  function polishStatus(card, percent) {
    const tag = $('.tag,.v125-course-badge', card);
    if (!tag) return;
    const current = tag.textContent.trim().toLocaleLowerCase('es');
    const staff = current.includes('staff');
    if (staff) {
      tag.textContent = 'VISTA DE STAFF';
      tag.dataset.v140Staff = 'true';
      return;
    }
    tag.textContent = percent >= 100 ? 'COMPLETADO' : 'ACTIVO';
    delete tag.dataset.v140Staff;
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
    if (oldPercent) oldPercent.setAttribute('aria-hidden', 'true');
  }

  function polishLegacyHeading() {
    const panel = $('#mis-cursos');
    if (!panel) return;
    panel.classList.add('v140-courses-hub');
    const head = $('.panel-head', panel);
    const copy = $('p', head || panel);
    if (copy) copy.textContent = 'Continúa tus programas y retoma tu avance donde lo dejaste.';
    const catalog = $('[data-open-course-catalog]', panel);
    if (catalog) catalog.textContent = 'Catálogo de cursos →';
    const activeHead = $('.academy-v68-active-head', panel);
    const activeCount = $$('.learning-course-card:not([hidden])', panel).length;
    const activeCopy = $('p', activeHead || panel);
    if (activeCopy && activeHead) activeCopy.textContent = activeCount === 1 ? '1 programa activo en tu cuenta.' : `${activeCount} programas activos en tu cuenta.`;
  }

  function polishV125Heading() {
    const page = $('.v125-courses-page');
    if (!page) return;
    page.classList.add('v140-courses-hub');
    const copy = $('.v125-heading p', page);
    if (copy) copy.textContent = 'Continúa tus programas y retoma tu avance donde lo dejaste.';
    const catalog = $('.v125-catalog-btn', page);
    if (catalog) catalog.textContent = 'Catálogo de cursos →';
  }

  function polishUpcoming() {
    $$('.academy-v68-upcoming,.v125-upcoming').forEach(section => {
      const hasRealCards = !!$('.academy-v68-upcoming-card,.v125-upcoming-card', section);
      const loading = !!$('.academy-v68-upcoming-loading', section);
      section.classList.toggle('v140-upcoming-empty', !hasRealCards && !loading);
    });
  }

  function enhance() {
    window.clearTimeout(timer);
    timer = 0;
    if (!mq.matches) return;

    const cards = $$('.learning-course-card,.v125-course-card');
    if (!cards.length) return;

    document.body.dataset.academyCoursesExperience = VERSION;
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
    if (!mq.matches) return;
    const relevant = mutations.some(m => m.type === 'childList' || (m.type === 'attributes' && m.attributeName === 'src'));
    if (relevant) schedule(80);
  }).observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['src'] });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-shell-route="courses"],[data-scroll-courses],a[href="#courses"],[data-back-courses]')) schedule(120);
  }, true);
  window.addEventListener('hashchange', () => schedule(90));
  window.addEventListener('pageshow', () => schedule(160));
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', () => schedule(20));
  else if (typeof mq.addListener === 'function') mq.addListener(() => schedule(20));

  [120, 400, 900, 1800, 3200].forEach(delay => window.setTimeout(() => schedule(20), delay));
  window.ACADEMIA_YAMILET_MOBILE_COURSES_V140 = Object.freeze({ version:VERSION, refresh:enhance });
})();