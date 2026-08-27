(() => {
  'use strict';

  const EXCLUDED_TITLES = new Set([
    'evaluación y cierre de la semana 1',
    'evaluacion y cierre de la semana 1'
  ]);
  let scheduled = false;

  const normalize = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');

  function isExcludedTitle(value) {
    return EXCLUDED_TITLES.has(normalize(value));
  }

  function removeAdminVideoRow(row) {
    const title = row.querySelector('.academy-video-row-main strong')?.textContent || '';
    if (!isExcludedTitle(title)) return false;
    row.remove();
    return true;
  }

  function refreshAdminCounts() {
    document.querySelectorAll('.academy-video-module').forEach(module => {
      const rows = [...module.querySelectorAll('[data-video-row]')];
      const ready = rows.filter(row => row.querySelector('[data-video-state]')?.classList.contains('ready')).length;
      const counter = module.querySelector('.academy-video-module-head span');
      if (counter) counter.textContent = `${ready}/${rows.length} listos`;
    });

    const manager = document.querySelector('[data-video-manager-v62]');
    if (!manager) return;
    const rows = [...manager.querySelectorAll('[data-video-row]')];
    const ready = rows.filter(row => row.querySelector('[data-video-state]')?.classList.contains('ready')).length;
    const summary = manager.querySelector('.academy-video-manager-summary strong');
    if (summary) summary.textContent = `${ready}/${rows.length}`;
    const intro = manager.querySelector('.academy-admin-section-head p');
    if (intro) intro.textContent = `${ready} de ${rows.length} lecciones requieren y tienen video. Las evaluaciones sin video no se incluyen en este control.`;
  }

  function cleanAdminManager() {
    let changed = false;
    document.querySelectorAll('[data-video-row]').forEach(row => {
      if (removeAdminVideoRow(row)) changed = true;
    });
    if (changed) refreshAdminCounts();
  }

  function cleanNativeLessonEditor() {
    const form = document.querySelector('[data-lesson-form]');
    if (!form) return;
    const title = form.elements?.title?.value || form.querySelector('input[name="title"]')?.value || '';
    if (!isExcludedTitle(title)) return;
    form.querySelector('.academy-video-uploader-v62')?.remove();
  }

  function cleanStudentLesson() {
    const view = document.querySelector('[data-lesson-view]:not(.hidden)');
    if (!view) return;
    const title = view.querySelector('.lesson-title h2')?.textContent || '';
    if (!isExcludedTitle(title)) return;
    view.querySelectorAll('.video-shell, .lesson-video, [data-mes-video-pending], [data-cloudflare-stream-player], [data-cloudflare-stream-error]').forEach(el => el.remove());
  }

  function apply() {
    scheduled = false;
    cleanAdminManager();
    cleanNativeLessonEditor();
    cleanStudentLesson();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function boot() {
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', () => setTimeout(schedule, 50), true);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
