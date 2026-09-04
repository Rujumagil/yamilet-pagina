(() => {
  'use strict';

  const VERSION = '135.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  let clientPromise = null;
  let gatePromise = null;
  let scheduled = false;
  let lastPassSignature = '';

  function routeName() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  async function client() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('academy_config_unavailable');
      const cfg = await response.json();
      const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) throw new Error('academy_session_missing');
      const { data: workspace } = await sb.from('workspaces').select('id,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle();
      if (!workspace?.id) throw new Error('academy_workspace_missing');
      return { sb, user: session.user, workspace };
    })();
    return clientPromise;
  }

  async function gateData(force = false) {
    if (force) gatePromise = null;
    if (gatePromise) return gatePromise;
    gatePromise = (async () => {
      const { sb, user, workspace } = await client();
      const { data: enrollments } = await sb.from('enrollments')
        .select('course_id,status')
        .eq('user_id', user.id)
        .in('status', ['active', 'completed']);
      const courseIds = [...new Set((enrollments || []).map(row => row.course_id).filter(Boolean))];
      if (!courseIds.length) return { sb, user, workspace, assessments: [], byId: new Map(), byQuizLesson: new Map() };

      const { data: assessments } = await sb.from('assessments')
        .select('id,course_id,module_id,title,status,position')
        .in('course_id', courseIds)
        .eq('status', 'published')
        .order('position', { ascending: true });
      const assessmentRows = assessments || [];
      const moduleIds = [...new Set(assessmentRows.map(row => row.module_id).filter(Boolean))];

      let lessons = [];
      if (moduleIds.length) {
        const { data } = await sb.from('lessons')
          .select('id,module_id,title,lesson_type,position')
          .in('module_id', moduleIds)
          .order('position', { ascending: true });
        lessons = data || [];
      }

      let progress = [];
      if (lessons.length) {
        const { data } = await sb.from('lesson_progress')
          .select('lesson_id,completed,completed_at,updated_at')
          .eq('user_id', user.id)
          .in('lesson_id', lessons.map(row => row.id));
        progress = data || [];
      }

      let attempts = [];
      if (assessmentRows.length) {
        const { data } = await sb.from('assessment_attempts')
          .select('assessment_id,attempt_number,status,score,passed,started_at,submitted_at,graded_at')
          .eq('user_id', user.id)
          .in('assessment_id', assessmentRows.map(row => row.id));
        attempts = data || [];
      }

      const progressByLesson = new Map(progress.map(row => [String(row.lesson_id), row]));
      const attemptsByAssessment = new Map();
      attempts.forEach(row => {
        const key = String(row.assessment_id);
        const current = attemptsByAssessment.get(key);
        if (!current || Number(row.attempt_number || 0) > Number(current.attempt_number || 0)) attemptsByAssessment.set(key, row);
      });

      const byId = new Map();
      const byQuizLesson = new Map();
      assessmentRows.forEach(assessment => {
        const moduleLessons = lessons.filter(lesson => String(lesson.module_id) === String(assessment.module_id));
        const studyLessons = moduleLessons.filter(lesson => String(lesson.lesson_type || 'video') !== 'quiz');
        const quizLesson = moduleLessons.find(lesson => String(lesson.lesson_type || '') === 'quiz') || null;
        const allStudyComplete = studyLessons.length > 0 && studyLessons.every(lesson => progressByLesson.get(String(lesson.id))?.completed === true);
        const latestAttempt = attemptsByAssessment.get(String(assessment.id)) || null;
        const unlocked = allStudyComplete || !!latestAttempt;
        const item = { assessment, moduleLessons, studyLessons, quizLesson, latestAttempt, unlocked, progressByLesson };
        byId.set(String(assessment.id), item);
        if (quizLesson?.id) byQuizLesson.set(String(quizLesson.id), item);
      });

      return { sb, user, workspace, assessments: assessmentRows, byId, byQuizLesson, attempts };
    })().catch(error => {
      console.warn('Academia Yamilet assessment gate v135', error);
      return { assessments: [], byId: new Map(), byQuizLesson: new Map(), attempts: [] };
    });
    return gatePromise;
  }

  function setButtonText(button, text) {
    if (!button || button.textContent === text) return;
    button.textContent = text;
  }

  async function enhanceQuizLesson() {
    const view = $('[data-lesson-view]:not(.hidden)');
    const button = view?.querySelector('[data-toggle-complete][data-course-id]');
    if (!view || !button) return;
    const lessonId = button.dataset.toggleComplete;
    const data = await gateData(false);
    const gate = data.byQuizLesson.get(String(lessonId));
    if (!gate) return;

    button.dataset.v135AssessmentGate = gate.assessment.id;
    button.dataset.v135QuizLesson = lessonId;
    button.dataset.v135CourseId = button.dataset.courseId || gate.assessment.course_id;

    const quizDone = gate.progressByLesson.get(String(lessonId))?.completed === true;
    if (quizDone || gate.latestAttempt?.passed === true) {
      setButtonText(button, 'Evaluación aprobada');
      button.disabled = true;
      return;
    }

    if (!gate.unlocked) {
      setButtonText(button, 'Completa las clases anteriores');
      button.disabled = true;
      return;
    }

    button.disabled = false;
    setButtonText(button, gate.latestAttempt?.status === 'in_progress' ? 'Continuar evaluación' : 'Realizar evaluación');
  }

  async function openAssessment(assessmentId) {
    const data = await gateData(true);
    const gate = data.byId.get(String(assessmentId));
    if (!gate?.unlocked) return false;

    const routeButton = $('[data-shell-route="evaluations"]');
    if (routeButton) routeButton.click();
    else location.hash = '#evaluations';

    for (let attempt = 0; attempt < 16; attempt += 1) {
      await sleep(attempt < 5 ? 120 : 180);
      const source = $('[data-shell-page="evaluations"]');
      const cards = source ? $$('.shell-grid .shell-card', source) : [];
      const card = cards.find(node => $('h3', node)?.textContent?.trim() === gate.assessment.title);
      const action = card?.querySelector(`[data-open-assessment="${CSS.escape(String(assessmentId))}"]`) || card?.querySelector('.assessment-open-btn,button:not([disabled])');
      if (action) {
        action.click();
        return true;
      }
    }
    return false;
  }

  function nativeEvaluationPage() {
    return $('[data-shell-page="evaluations"]');
  }

  function rewriteEmptyCopy() {
    const root = $('[data-aula-pages-v71]') || document;
    const title = $('.v77-eval-empty h2', root);
    const copy = $('.v77-eval-empty p', root);
    if (title) title.textContent = 'Aún no tienes evaluaciones disponibles';
    if (copy) copy.textContent = 'Completa las clases de esta semana para desbloquear tu evaluación.';
  }

  async function pruneLockedEvaluations() {
    if (routeName() !== 'evaluations') return;
    const source = nativeEvaluationPage();
    if (!source || source.classList.contains('hidden')) return;
    const data = await gateData(true);
    const cards = $$('.shell-grid .shell-card', source);
    if (!cards.length) {
      rewriteEmptyCopy();
      return;
    }

    const available = [];
    cards.forEach(card => {
      const title = $('h3', card)?.textContent?.trim() || '';
      const gate = [...data.byId.values()].find(item => item.assessment.title === title);
      if (!gate || !gate.unlocked) card.remove();
      else available.push(gate);
    });

    const summary = $$('.shell-summary article strong', source);
    if (summary[0]) summary[0].textContent = String(available.length);
    if (summary[1]) summary[1].textContent = String(available.filter(item => item.latestAttempt?.passed === true).length);
    if (summary[2]) summary[2].textContent = String(available.filter(item => !!item.latestAttempt).length);

    window.ACADEMIA_YAMILET_EVALUATIONS_V77?.refresh?.();
    setTimeout(rewriteEmptyCopy, 80);
  }

  async function completeQuizFromPassedResult(result) {
    if (!result || result.dataset.v135Synced === 'true') return;
    const title = $('.assessment-kicker', result)?.textContent?.trim();
    if (!title) return;
    const signature = `${title}:${$('.assessment-result h2', result)?.textContent?.trim() || ''}`;
    if (signature === lastPassSignature) return;

    const data = await gateData(true);
    const gate = [...data.byId.values()].find(item => item.assessment.title === title);
    if (!gate?.quizLesson?.id) return;
    result.dataset.v135Synced = 'true';
    lastPassSignature = signature;

    const quizId = String(gate.quizLesson.id);
    const alreadyDone = gate.progressByLesson.get(quizId)?.completed === true;
    if (!alreadyDone) {
      const nativeButton = $(`[data-toggle-complete="${CSS.escape(quizId)}"][data-course-id="${CSS.escape(String(gate.assessment.course_id))}"]`);
      if (nativeButton && typeof nativeButton.onclick === 'function') {
        try {
          await Promise.resolve(nativeButton.onclick());
        } catch (error) {
          console.warn('Academia Yamilet quiz completion via native action', error);
        }
      } else if (data.sb && data.user) {
        const now = new Date().toISOString();
        const { error } = await data.sb.from('lesson_progress').upsert({
          user_id: data.user.id,
          lesson_id: quizId,
          completed: true,
          progress_seconds: 0,
          completed_at: now,
          updated_at: now
        }, { onConflict: 'user_id,lesson_id' });
        if (error) console.warn('Academia Yamilet quiz completion fallback', error);
      }
    }

    gatePromise = null;
    window.ACADEMIA_YAMILET_PROGRESS_V58?.refresh?.(gate.assessment.course_id);
    window.ACADEMIA_YAMILET_COURSES_FIX_V125?.refresh?.();
    window.ACADEMIA_YAMILET_COURSES_V73?.refresh?.();
  }

  function inspectAssessmentResult() {
    const passed = $('.assessment-result.passed');
    if (passed) void completeQuizFromPassedResult(passed);
  }

  function schedule(delay = 100) {
    if (scheduled) return;
    scheduled = true;
    setTimeout(async () => {
      scheduled = false;
      await enhanceQuizLesson();
      await pruneLockedEvaluations();
      inspectAssessmentResult();
    }, delay);
  }

  document.addEventListener('click', event => {
    const gated = event.target.closest?.('[data-v135-assessment-gate]');
    if (gated) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!gated.disabled) void openAssessment(gated.dataset.v135AssessmentGate);
      return;
    }

    if (event.target.closest?.('[data-shell-route="evaluations"],a[href="#evaluations"],[data-open-lesson],[data-mes-open-lesson]')) {
      gatePromise = null;
      schedule(180);
    }
  }, true);

  const observer = new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.type === 'attributes')) schedule(100);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });

  window.addEventListener('hashchange', () => { gatePromise = null; schedule(160); });
  window.addEventListener('pageshow', () => { gatePromise = null; schedule(260); });

  schedule(500);
  window.ACADEMIA_YAMILET_ASSESSMENT_GATE_V135 = Object.freeze({
    version: VERSION,
    refresh: () => { gatePromise = null; schedule(0); },
    open: openAssessment
  });
})();
