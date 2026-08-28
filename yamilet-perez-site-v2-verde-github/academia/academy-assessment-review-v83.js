(() => {
  'use strict';

  const VERSION = '83.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = value => value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : 'Sin fecha';

  let clientPromise = null;
  let dataPromise = null;
  let cache = null;
  let reviewOpen = false;
  let scheduleTimer = null;
  let adminObserver = null;

  function isRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'evaluations';
  }

  function ensureStyles() {
    if (document.querySelector('link[data-assess-review-v83]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './academy-assessment-review-v83.css?v=83';
    link.dataset.assessReviewV83 = 'true';
    document.head.appendChild(link);
  }

  async function context() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
        return {sb,cfg};
      })();
    }
    const {sb,cfg} = await clientPromise;
    const {data:{session}} = await sb.auth.getSession();
    if (!session?.user) throw new Error('no_session');
    const [{data:profile},{data:workspace}] = await Promise.all([
      sb.from('profiles').select('id,role,full_name').eq('id',session.user.id).maybeSingle(),
      sb.from('workspaces').select('id,name,slug').eq('slug',cfg.workspaceSlug || 'yamilet-mes').maybeSingle()
    ]);
    if (!workspace) throw new Error('no_workspace');
    const {data:member} = await sb.from('workspace_members').select('role,status').eq('workspace_id',workspace.id).eq('user_id',session.user.id).maybeSingle();
    const role = member?.status === 'active' ? member.role : profile?.role;
    if (!['owner','admin','instructor'].includes(role) && profile?.role !== 'admin') throw new Error('forbidden');
    return {sb,workspace,user:session.user,role};
  }

  async function safe(query) {
    const result = await query;
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function loadData(force = false) {
    if (cache && !force) return cache;
    if (dataPromise && !force) return dataPromise;
    dataPromise = (async () => {
      const ctx = await context();
      const {sb,workspace} = ctx;
      const courses = await safe(sb.from('courses').select('id,title').eq('workspace_id',workspace.id));
      const courseIds = courses.map(item => item.id);
      let assessments = [], questions = [], attempts = [], answers = [], profiles = [];
      if (courseIds.length) assessments = await safe(sb.from('assessments').select('id,course_id,title,passing_score,status').in('course_id',courseIds));
      const assessmentIds = assessments.map(item => item.id);
      if (assessmentIds.length) {
        questions = await safe(sb.from('assessment_questions').select('id,assessment_id,prompt,question_type,points,position').in('assessment_id',assessmentIds).eq('question_type','short_text').order('position'));
        const reviewableIds = [...new Set(questions.map(item => item.assessment_id))];
        if (reviewableIds.length) attempts = await safe(sb.from('assessment_attempts').select('id,assessment_id,user_id,attempt_number,status,score,submitted_at').in('assessment_id',reviewableIds).eq('status','submitted').order('submitted_at',{ascending:true}));
      }
      if (attempts.length) {
        const attemptIds = attempts.map(item => item.id);
        const userIds = [...new Set(attempts.map(item => item.user_id))];
        [answers,profiles] = await Promise.all([
          safe(sb.from('assessment_answers').select('attempt_id,question_id,text_answer,points_awarded,is_correct').in('attempt_id',attemptIds)),
          userIds.length ? safe(sb.from('profiles').select('id,full_name,email').in('id',userIds)) : Promise.resolve([])
        ]);
      }
      cache = {...ctx,courses,assessments,questions,attempts,answers,profiles,loadedAt:Date.now()};
      return cache;
    })().finally(() => { dataPromise = null; });
    return dataPromise;
  }

  function selectedAssessmentId() {
    return $('.assess82-list-item.active')?.dataset.assess82Select || null;
  }

  function assessmentFor(data,id) { return data.assessments.find(item => item.id === id) || null; }
  function courseFor(data,id) { return data.courses.find(item => item.id === id) || null; }
  function profileFor(data,id) { return data.profiles.find(item => item.id === id) || null; }
  function questionsFor(data,assessmentId) { return data.questions.filter(item => item.assessment_id === assessmentId).sort((a,b) => Number(a.position || 0) - Number(b.position || 0)); }
  function attemptsFor(data,assessmentId) { return data.attempts.filter(item => item.assessment_id === assessmentId); }
  function answerFor(data,attemptId,questionId) { return data.answers.find(item => item.attempt_id === attemptId && item.question_id === questionId) || null; }

  function reviewCount(data,assessmentId = null) {
    return assessmentId ? attemptsFor(data,assessmentId).length : data.attempts.length;
  }

  function topBadge(data) {
    const actions = $('.assess82-heading-actions');
    if (!actions) return;
    let button = $('[data-assess83-global-review]',actions);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.assess83GlobalReview = 'true';
      actions.prepend(button);
      button.addEventListener('click',() => {
        const pending = cache?.attempts?.[0];
        if (!pending) return;
        reviewOpen = true;
        const select = $(`[data-assess82-select="${pending.assessment_id}"]`);
        if (select && !select.classList.contains('active')) select.click();
        else schedule(0);
      });
    }
    const count = reviewCount(data);
    button.textContent = `Revisión · ${count}`;
    button.classList.toggle('has-pending',count > 0);
    button.disabled = count === 0;
    button.title = count ? `${count} intento${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'} de revisión` : 'No hay respuestas abiertas pendientes';
  }

  function reviewTabButton(data,assessmentId) {
    const tabs = $('.assess82-tabs');
    if (!tabs || !assessmentId) return null;
    let button = $('[data-assess83-tab]',tabs);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.assess83Tab = 'review';
      button.innerHTML = '<b>04</b><span>Revisión <em data-assess83-tab-count>0</em></span>';
      tabs.appendChild(button);
      button.addEventListener('click',() => { reviewOpen = true; renderIntegrated(); });
    }
    const count = reviewCount(data,assessmentId);
    const badge = $('[data-assess83-tab-count]',button);
    if (badge) badge.textContent = String(count);
    button.classList.toggle('has-pending',count > 0);
    return button;
  }

  function questionReview(data,attempt,question) {
    const answer = answerFor(data,attempt.id,question.id);
    const currentPoints = answer?.points_awarded == null ? 0 : Number(answer.points_awarded);
    return `<article class="assess83-answer" data-assess83-answer="${question.id}"><header><div><span>RESPUESTA ABIERTA</span><strong>${esc(question.prompt)}</strong></div><b>${Number(question.points || 0)} punto${Number(question.points) === 1 ? '' : 's'} máx.</b></header><blockquote>${esc(answer?.text_answer || 'Sin respuesta escrita')}</blockquote><div class="assess83-grade-row"><label>Puntos asignados<input type="number" name="points-${question.id}" min="0" max="${Number(question.points || 0)}" step="0.1" value="${currentPoints}" required></label><label class="assess83-correct"><input type="checkbox" name="correct-${question.id}" ${answer?.is_correct ? 'checked' : ''}><span>Marcar como correcta</span></label><button type="button" data-assess83-full-question="${question.id}" data-max="${Number(question.points || 0)}">Puntaje completo</button></div></article>`;
  }

  function attemptCard(data,attempt) {
    const assessment = assessmentFor(data,attempt.assessment_id);
    const course = courseFor(data,assessment?.course_id);
    const profile = profileFor(data,attempt.user_id);
    const questions = questionsFor(data,attempt.assessment_id);
    const name = profile?.full_name || profile?.email || 'Estudiante';
    return `<article class="assess83-attempt" data-assess83-attempt-card="${attempt.id}"><header class="assess83-attempt-head"><div class="assess83-person"><span>${esc(String(name).trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() || '').join('') || 'E')}</span><div><strong>${esc(name)}</strong><small>${esc(profile?.email || '')}</small></div></div><div class="assess83-attempt-meta"><span>Intento ${attempt.attempt_number}</span><small>${fmt(attempt.submitted_at)}</small></div></header><div class="assess83-attempt-context"><span>${esc(course?.title || 'Curso')}</span><strong>${esc(assessment?.title || 'Evaluación')}</strong><small>${questions.length} respuesta${questions.length === 1 ? '' : 's'} abierta${questions.length === 1 ? '' : 's'} por revisar</small></div><form data-assess83-grade-attempt="${attempt.id}">${questions.map(question => questionReview(data,attempt,question)).join('')}<footer class="assess83-grade-actions"><span data-assess83-grade-status></span><button type="button" class="secondary" data-assess83-full-attempt>Asignar puntaje completo</button><button type="submit">Calificar y cerrar intento →</button></footer></form></article>`;
  }

  function reviewPanel(data,assessmentId) {
    const assessment = assessmentFor(data,assessmentId);
    const attempts = attemptsFor(data,assessmentId);
    return `<section class="assess83-panel" data-assess83-panel><header class="assess83-panel-head"><div><span>04 · REVISIÓN Y CALIFICACIÓN</span><h3>${attempts.length ? `${attempts.length} intento${attempts.length === 1 ? '' : 's'} pendiente${attempts.length === 1 ? '' : 's'}` : 'Sin revisiones pendientes'}</h3><p>${attempts.length ? 'Revisa las respuestas abiertas, asigna puntos y cierra cada intento desde aquí.' : `No hay respuestas abiertas por revisar en ${esc(assessment?.title || 'esta evaluación')}.`}</p></div><button type="button" data-assess83-refresh>Actualizar</button></header>${attempts.length ? `<div class="assess83-queue">${attempts.map(attempt => attemptCard(data,attempt)).join('')}</div>` : '<div class="assess83-empty"><span>✓</span><strong>Todo al día</strong><p>Cuando un estudiante envíe una respuesta abierta que requiera revisión, aparecerá en esta pestaña.</p></div>'}</section>`;
  }

  function bindPanel(panel,data) {
    $('[data-assess83-refresh]',panel)?.addEventListener('click',async () => { cache = null; await refreshData(true); });
    $$('[data-assess83-full-question]',panel).forEach(button => button.addEventListener('click',() => {
      const answer = button.closest('[data-assess83-answer]');
      const points = $('input[type="number"]',answer);
      const correct = $('input[type="checkbox"]',answer);
      if (points) points.value = button.dataset.max || '0';
      if (correct) correct.checked = true;
    }));
    $$('[data-assess83-full-attempt]',panel).forEach(button => button.addEventListener('click',() => {
      const form = button.closest('form');
      $$('[data-assess83-answer]',form).forEach(answer => {
        const full = $('[data-assess83-full-question]',answer);
        const points = $('input[type="number"]',answer);
        const correct = $('input[type="checkbox"]',answer);
        if (points) points.value = full?.dataset.max || points.max || '0';
        if (correct) correct.checked = true;
      });
    }));
    $$('[data-assess83-grade-attempt]',panel).forEach(form => form.addEventListener('submit',event => {
      event.preventDefault();
      gradeAttempt(form,data,form.dataset.assess83GradeAttempt);
    }));
  }

  async function gradeAttempt(form,data,attemptId) {
    const attempt = data.attempts.find(item => item.id === attemptId);
    if (!attempt) return;
    const questions = questionsFor(data,attempt.assessment_id);
    const button = $('button[type="submit"]',form);
    const status = $('[data-assess83-grade-status]',form);
    const grades = questions.map(question => {
      const points = Number(form.elements[`points-${question.id}`]?.value || 0);
      return {question_id:question.id,points,correct:Boolean(form.elements[`correct-${question.id}`]?.checked)};
    });
    const invalid = grades.some((grade,index) => grade.points < 0 || grade.points > Number(questions[index]?.points || 0));
    if (invalid) { if (status) { status.textContent = 'Revisa los puntos asignados.'; status.classList.add('error'); } return; }
    button.disabled = true;
    if (status) { status.textContent = 'Guardando calificación…'; status.classList.remove('error'); }
    const {error} = await data.sb.rpc('grade_assessment_attempt',{target_attempt:attemptId,manual_grades:grades});
    if (error) {
      if (status) { status.textContent = error.message; status.classList.add('error'); }
      button.disabled = false;
      return;
    }
    if (status) status.textContent = 'Intento calificado y cerrado.';
    cache = null;
    await refreshData(true);
    window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN?.render?.();
    schedule(220);
  }

  function renderIntegrated() {
    if (!isRoute() || !cache) return;
    const editor = $('.assess82-editor');
    if (!editor) return;
    const assessmentId = selectedAssessmentId();
    if (!assessmentId) return;
    const tab = reviewTabButton(cache,assessmentId);
    topBadge(cache);
    let panel = $('[data-assess83-panel]',editor);
    const nativeBody = $('.assess82-tab-body',editor);
    if (!reviewOpen) {
      if (panel) panel.remove();
      if (nativeBody) nativeBody.hidden = false;
      tab?.classList.remove('active');
      return;
    }
    $$('.assess82-tabs [data-assess82-tab]',editor).forEach(button => button.classList.remove('active'));
    tab?.classList.add('active');
    if (nativeBody) nativeBody.hidden = true;
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.innerHTML = reviewPanel(cache,assessmentId);
    const actual = panel.firstElementChild;
    editor.appendChild(actual);
    bindPanel(actual,cache);
  }

  async function refreshData(force = false) {
    try {
      const data = await loadData(force);
      if (!isRoute()) return;
      topBadge(data);
      renderIntegrated();
    } catch (error) {
      console.warn('Academia Yamilet assessment review v83',error);
    }
  }

  function enhance() {
    if (!isRoute()) return;
    ensureStyles();
    if (cache) {
      topBadge(cache);
      renderIntegrated();
    }
    if (!cache && !dataPromise) refreshData(false);
  }

  function schedule(delay = 80) {
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(enhance,delay);
  }

  function watchAdmin() {
    adminObserver?.disconnect();
    const page = $('[data-shell-page="admin"]');
    if (!page) { setTimeout(watchAdmin,250); return; }
    adminObserver = new MutationObserver(() => { if (isRoute()) schedule(60); });
    adminObserver.observe(page,{subtree:true,childList:true});
    schedule(0);
  }

  function start() {
    ensureStyles();
    document.addEventListener('click',event => {
      if (event.target.closest('[data-assess82-tab]')) reviewOpen = false;
      if (event.target.closest('[data-assess82-select]')) reviewOpen = false;
      if (event.target.closest('[data-admin-v79-go="evaluations"],a[href="#admin/evaluations"]')) setTimeout(() => refreshData(false),160);
    },true);
    window.addEventListener('hashchange',() => {
      if (!isRoute()) reviewOpen = false;
      setTimeout(() => { if (isRoute()) refreshData(false); },120);
    });
    window.addEventListener('pageshow',() => setTimeout(() => { if (isRoute()) refreshData(false); },220));
    watchAdmin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  window.ACADEMIA_YAMILET_ASSESSMENT_REVIEW_V83 = {version:VERSION,refresh:() => refreshData(true),open:() => { reviewOpen = true; schedule(0); }};
})();