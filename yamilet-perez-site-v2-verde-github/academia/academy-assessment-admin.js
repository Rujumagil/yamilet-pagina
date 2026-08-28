(() => {
  'use strict';

  const VERSION = '82.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  let clientPromise = null;
  let busy = false;
  let selectedAssessmentId = null;
  let activeTab = 'questions';
  let courseFilter = 'all';
  let searchTerm = '';
  let createOpen = false;

  function isRoute() {
    const parts = String(location.hash || '').replace(/^#/, '').split('/').filter(Boolean);
    return parts[0] === 'admin' && parts[1] === 'evaluations';
  }

  async function context() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, {headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error('config');
        const cfg = await response.json();
        const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
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
    return {sb,workspace,user:session.user,profile:profile || {},role};
  }

  async function safe(query) {
    const result = await query;
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function load() {
    const ctx = await context();
    const {sb,workspace} = ctx;
    const courses = await safe(sb.from('courses').select('id,title,status').eq('workspace_id',workspace.id).order('created_at'));
    const courseIds = courses.map(item => item.id);
    let modules = [], assessments = [], questions = [], options = [], attempts = [];
    if (courseIds.length) {
      [modules,assessments] = await Promise.all([
        safe(sb.from('modules').select('id,course_id,title,position').in('course_id',courseIds).order('position')),
        safe(sb.from('assessments').select('id,course_id,module_id,title,description,assessment_type,passing_score,max_attempts,time_limit_minutes,status,position,updated_at').in('course_id',courseIds).order('position'))
      ]);
    }
    const assessmentIds = assessments.map(item => item.id);
    if (assessmentIds.length) {
      [questions,attempts] = await Promise.all([
        safe(sb.from('assessment_questions').select('id,assessment_id,prompt,question_type,explanation,points,position').in('assessment_id',assessmentIds).order('position')),
        safe(sb.from('assessment_attempts').select('id,assessment_id,status,score,passed,attempt_number,submitted_at').in('assessment_id',assessmentIds).order('submitted_at',{ascending:false}))
      ]);
      for (const assessment of assessments) {
        const {data,error} = await sb.rpc('get_assessment_manager_options',{target_assessment:assessment.id});
        if (!error) options.push(...(data || []).map(option => ({...option,assessment_id:assessment.id})));
      }
    }
    return {...ctx,courses,modules,assessments,questions,options,attempts};
  }

  function courseName(data, id) { return data.courses.find(course => course.id === id)?.title || 'Curso'; }
  function moduleName(data, id) { return !id ? 'Curso completo' : data.modules.find(module => module.id === id)?.title || 'Módulo'; }
  function qTypeLabel(type) { return ({single_choice:'Opción única',multiple_choice:'Opción múltiple',true_false:'Verdadero / falso',short_text:'Respuesta abierta'})[type] || type; }
  function assessmentTypeLabel(type) { return ({quiz:'Quiz',module_exam:'Examen de módulo',final_exam:'Examen final'})[type] || type; }
  function statusLabel(status) { return status === 'published' ? 'Publicada' : status === 'archived' ? 'Archivada' : 'Borrador'; }
  function questionsFor(data, assessmentId) { return data.questions.filter(question => question.assessment_id === assessmentId).sort((a,b) => Number(a.position || 0) - Number(b.position || 0)); }
  function optionsFor(data, questionId) { return data.options.filter(option => option.question_id === questionId).sort((a,b) => Number(a.position || 0) - Number(b.position || 0)); }
  function attemptsFor(data, assessmentId) { return data.attempts.filter(attempt => attempt.assessment_id === assessmentId); }

  function readiness(data, assessment) {
    const questions = questionsFor(data, assessment.id);
    const issues = [];
    let totalPoints = 0;
    if (!questions.length) issues.push('Agrega al menos una pregunta.');
    questions.forEach((question, index) => {
      totalPoints += Number(question.points || 0);
      if (!String(question.prompt || '').trim()) issues.push(`La pregunta ${index + 1} no tiene enunciado.`);
      if (!(Number(question.points) > 0)) issues.push(`La pregunta ${index + 1} necesita un puntaje mayor a cero.`);
      if (question.question_type === 'short_text') return;
      const options = optionsFor(data, question.id);
      const correct = options.filter(option => option.is_correct);
      if (options.length < 2) issues.push(`La pregunta ${index + 1} necesita al menos dos opciones.`);
      if (!correct.length) issues.push(`La pregunta ${index + 1} necesita una respuesta correcta.`);
      if (['single_choice','true_false'].includes(question.question_type) && correct.length !== 1) issues.push(`La pregunta ${index + 1} debe tener una sola respuesta correcta.`);
    });
    return {ready:issues.length === 0,issues,totalPoints,questionCount:questions.length};
  }

  function moduleOptions(data, courseId, selected = '') {
    return `<option value="">Curso completo</option>` + data.modules.filter(module => module.course_id === courseId).map(module => `<option value="${module.id}" ${module.id === selected ? 'selected' : ''}>${esc(module.title)}</option>`).join('');
  }

  function filteredAssessments(data) {
    const query = searchTerm.trim().toLowerCase();
    return data.assessments.filter(assessment => {
      if (courseFilter !== 'all' && assessment.course_id !== courseFilter) return false;
      if (!query) return true;
      return [assessment.title,assessment.description,courseName(data,assessment.course_id),moduleName(data,assessment.module_id)].some(value => String(value || '').toLowerCase().includes(query));
    });
  }

  function stat(value, label, copy = '') { return `<article><strong>${esc(value)}</strong><span>${esc(label)}</span>${copy ? `<small>${esc(copy)}</small>` : ''}</article>`; }

  function assessmentListItem(data, assessment) {
    const questions = questionsFor(data, assessment.id);
    const attempts = attemptsFor(data, assessment.id);
    const ready = readiness(data,assessment);
    return `<button type="button" class="assess82-list-item ${assessment.id === selectedAssessmentId ? 'active' : ''}" data-assess82-select="${assessment.id}"><span class="assess82-list-status ${esc(assessment.status)}">${statusLabel(assessment.status)}</span><strong>${esc(assessment.title)}</strong><small>${esc(courseName(data,assessment.course_id))}${assessment.module_id ? ` · ${esc(moduleName(data,assessment.module_id))}` : ''}</small><div><span>${questions.length} pregunta${questions.length === 1 ? '' : 's'}</span><span>${attempts.length} intento${attempts.length === 1 ? '' : 's'}</span><span>${ready.ready ? 'Lista' : 'Incompleta'}</span></div></button>`;
  }

  function createPanel(data) {
    const firstCourse = data.courses[0]?.id || '';
    return `<section class="assess82-create-panel ${createOpen || !data.assessments.length ? 'open' : ''}" data-assess82-create-panel><div class="assess82-create-head"><div><span>NUEVA EVALUACIÓN</span><h2>Crea primero la estructura básica</h2><p>La evaluación nace como borrador. Después podrás agregar preguntas, revisar la vista previa y publicarla.</p></div>${data.assessments.length ? '<button type="button" data-assess82-close-create>×</button>' : ''}</div><form class="assess82-create-form" data-assess82-create><label>Curso<select name="course_id" required data-assess82-create-course>${data.courses.map(course => `<option value="${course.id}">${esc(course.title)}${course.status === 'draft' ? ' · borrador' : ''}</option>`).join('')}</select></label><label>Ubicación<select name="module_id" data-assess82-create-module>${moduleOptions(data,firstCourse)}</select></label><label class="wide">Título<input name="title" required maxlength="180" placeholder="Ej. Evaluación de cierre · Semana 1"></label><label>Tipo<select name="assessment_type"><option value="quiz">Quiz</option><option value="module_exam">Examen de módulo</option><option value="final_exam">Examen final</option></select></label><label>Puntaje para aprobar<input name="passing_score" type="number" min="0" max="100" value="70" required></label><label>Intentos máximos<input name="max_attempts" type="number" min="1" value="3"></label><label>Tiempo límite<input name="time_limit_minutes" type="number" min="1" placeholder="Sin límite"></label><label class="wide">Descripción<textarea name="description" rows="3" maxlength="1400" placeholder="Explica qué evalúa esta actividad."></textarea></label><div class="wide assess82-form-action"><span data-assess82-create-status></span><button type="submit">Crear borrador →</button></div></form></section>`;
  }

  function settingsTab(data, assessment) {
    return `<form class="assess82-settings" data-assess82-settings="${assessment.id}"><div class="assess82-section-title"><span>01 · CONFIGURACIÓN</span><h3>Datos y reglas de la evaluación</h3><p>Define dónde aparece, cómo se aprueba y cuántos intentos tendrá cada estudiante.</p></div><div class="assess82-settings-grid"><label class="wide">Título<input name="title" required maxlength="180" value="${esc(assessment.title)}"></label><label>Tipo<select name="assessment_type"><option value="quiz" ${assessment.assessment_type === 'quiz' ? 'selected' : ''}>Quiz</option><option value="module_exam" ${assessment.assessment_type === 'module_exam' ? 'selected' : ''}>Examen de módulo</option><option value="final_exam" ${assessment.assessment_type === 'final_exam' ? 'selected' : ''}>Examen final</option></select></label><label>Ubicación<select name="module_id">${moduleOptions(data,assessment.course_id,assessment.module_id || '')}</select></label><label>Puntaje para aprobar<input name="passing_score" type="number" min="0" max="100" value="${assessment.passing_score ?? 70}" required></label><label>Intentos máximos<input name="max_attempts" type="number" min="1" value="${assessment.max_attempts ?? 3}"></label><label>Tiempo límite (min)<input name="time_limit_minutes" type="number" min="1" value="${assessment.time_limit_minutes ?? ''}" placeholder="Sin límite"></label><label>Estado<select name="status"><option value="draft" ${assessment.status === 'draft' ? 'selected' : ''}>Borrador</option><option value="published" ${assessment.status === 'published' ? 'selected' : ''}>Publicada</option><option value="archived" ${assessment.status === 'archived' ? 'selected' : ''}>Archivada</option></select></label><label class="wide">Descripción<textarea name="description" rows="4" maxlength="1400">${esc(assessment.description || '')}</textarea></label></div><div class="assess82-form-action"><span data-assess82-settings-status></span><button type="submit">Guardar configuración</button></div></form>`;
  }

  function optionEditor(question, option) {
    const single = ['single_choice','true_false'].includes(question.question_type);
    return `<label class="assess82-option-row ${option.is_correct ? 'correct' : ''}"><input type="${single ? 'radio' : 'checkbox'}" ${single ? `name="correct-${question.id}"` : ''} data-assess82-correct-option="${option.id}" ${option.is_correct ? 'checked' : ''} aria-label="Marcar como respuesta correcta"><input type="text" data-assess82-option-label="${option.id}" value="${esc(option.label)}" maxlength="500"><span>${option.is_correct ? 'Correcta' : 'Opción'}</span></label>`;
  }

  function questionCard(data, question, index, total) {
    const options = optionsFor(data,question.id);
    return `<article class="assess82-question-card" data-assess82-question="${question.id}"><header><div class="assess82-q-number">${String(index + 1).padStart(2,'0')}</div><div><span>${esc(qTypeLabel(question.question_type))}</span><strong>${esc(question.prompt)}</strong><small>${Number(question.points || 0)} punto${Number(question.points) === 1 ? '' : 's'}</small></div><div class="assess82-q-order"><button type="button" data-assess82-move-question="${question.id}" data-delta="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-assess82-move-question="${question.id}" data-delta="1" ${index === total - 1 ? 'disabled' : ''}>↓</button></div></header><form class="assess82-question-edit" data-assess82-question-edit="${question.id}"><label class="wide">Pregunta<textarea name="prompt" rows="2" required maxlength="1800">${esc(question.prompt)}</textarea></label><label>Puntos<input name="points" type="number" min="0.1" step="0.1" value="${Number(question.points || 1)}" required></label><label class="wide">Explicación para retroalimentación<textarea name="explanation" rows="2" maxlength="1800">${esc(question.explanation || '')}</textarea></label>${question.question_type === 'short_text' ? '<div class="wide assess82-open-note"><strong>Respuesta abierta</strong><span>El intento puede quedar pendiente de revisión. No requiere opciones ni respuesta correcta predefinida.</span></div>' : `<div class="wide assess82-options-edit"><div class="assess82-mini-head"><strong>Opciones y respuesta correcta</strong><span>Marca la opción correcta antes de guardar.</span></div>${options.map(option => optionEditor(question,option)).join('')}</div>`}<div class="wide assess82-question-actions"><span data-assess82-question-status></span><button type="button" class="danger" data-assess82-delete-question="${question.id}">Eliminar</button><button type="submit">Guardar pregunta</button></div></form></article>`;
  }

  function newOptionRows(type) {
    if (type === 'short_text') return '<div class="assess82-open-note"><strong>Respuesta abierta</strong><span>El estudiante escribirá su respuesta. El resultado puede requerir revisión.</span></div>';
    const labels = type === 'true_false' ? ['Verdadero','Falso'] : ['Opción 1','Opción 2','Opción 3'];
    const single = ['single_choice','true_false'].includes(type);
    return labels.map((label,index) => `<div class="assess82-new-option"><input type="${single ? 'radio' : 'checkbox'}" ${single ? 'name="new-correct"' : ''} data-assess82-new-correct ${index === 0 ? 'checked' : ''}><input type="text" data-assess82-new-option value="${esc(label)}" ${type === 'true_false' ? 'readonly' : ''} maxlength="500">${type === 'true_false' ? '' : '<button type="button" data-assess82-remove-option aria-label="Eliminar opción">×</button>'}</div>`).join('');
  }

  function newQuestionForm(assessmentId) {
    return `<section class="assess82-new-question"><div class="assess82-section-title"><span>NUEVA PREGUNTA</span><h3>Agrega una pregunta</h3><p>Elige el formato y marca la respuesta correcta visualmente.</p></div><form data-assess82-new-question="${assessmentId}"><label class="wide">Pregunta<textarea name="prompt" rows="3" required maxlength="1800" placeholder="Escribe el enunciado completo"></textarea></label><label>Tipo<select name="question_type" data-assess82-new-type><option value="single_choice">Opción única</option><option value="multiple_choice">Opción múltiple</option><option value="true_false">Verdadero / falso</option><option value="short_text">Respuesta abierta</option></select></label><label>Puntos<input name="points" type="number" min="0.1" step="0.1" value="1" required></label><label class="wide">Explicación opcional<textarea name="explanation" rows="2" maxlength="1800" placeholder="Retroalimentación que puede utilizar el equipo académico."></textarea></label><div class="wide assess82-option-builder"><div class="assess82-mini-head"><strong>Opciones</strong><button type="button" data-assess82-add-option>+ Agregar opción</button></div><div data-assess82-new-options>${newOptionRows('single_choice')}</div></div><div class="wide assess82-form-action"><span data-assess82-newq-status></span><button type="submit">Agregar pregunta →</button></div></form></section>`;
  }

  function questionsTab(data, assessment) {
    const questions = questionsFor(data,assessment.id);
    const ready = readiness(data,assessment);
    return `<section class="assess82-questions-tab"><div class="assess82-readiness ${ready.ready ? 'ready' : ''}"><div><span>${ready.ready ? 'LISTA PARA PUBLICAR' : 'PREPARACIÓN'}</span><h3>${ready.questionCount} pregunta${ready.questionCount === 1 ? '' : 's'} · ${ready.totalPoints} punto${ready.totalPoints === 1 ? '' : 's'}</h3><p>${ready.ready ? 'Todas las preguntas tienen la configuración mínima necesaria.' : ready.issues[0] || 'Completa la evaluación.'}</p></div><button type="button" data-assess82-open-preview>Vista previa →</button></div><div class="assess82-question-list">${questions.length ? questions.map((question,index) => questionCard(data,question,index,questions.length)).join('') : '<div class="assess82-empty-questions"><span>02</span><div><h3>Aún no hay preguntas</h3><p>Agrega la primera pregunta. Puedes usar opción única, múltiple, verdadero/falso o respuesta abierta.</p></div></div>'}</div>${newQuestionForm(assessment.id)}</section>`;
  }

  function previewQuestion(data, question, index) {
    const options = optionsFor(data,question.id);
    const body = question.question_type === 'short_text' ? '<textarea rows="4" disabled placeholder="Aquí escribiría su respuesta el estudiante"></textarea>' : `<div class="assess82-preview-options">${options.map(option => `<label class="${option.is_correct ? 'correct' : ''}"><input type="${question.question_type === 'multiple_choice' ? 'checkbox' : 'radio'}" disabled><span>${esc(option.label)}</span>${option.is_correct ? '<b>Respuesta correcta</b>' : ''}</label>`).join('')}</div>`;
    return `<article class="assess82-preview-question"><header><span>Pregunta ${index + 1}</span><strong>${Number(question.points || 0)} punto${Number(question.points) === 1 ? '' : 's'}</strong></header><h3>${esc(question.prompt)}</h3>${body}${question.explanation ? `<small>Nota académica: ${esc(question.explanation)}</small>` : ''}</article>`;
  }

  function previewTab(data, assessment) {
    const questions = questionsFor(data,assessment.id);
    const ready = readiness(data,assessment);
    return `<section class="assess82-preview-tab"><div class="assess82-preview-shell"><header><span>${esc(courseName(data,assessment.course_id))}</span><h2>${esc(assessment.title)}</h2><p>${esc(assessment.description || 'Evaluación académica del programa.')}</p><div><b>${assessment.passing_score ?? 70}% <small>mínimo</small></b><b>${assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : 'Libre'} <small>tiempo</small></b><b>${assessment.max_attempts ?? 'Sin límite'} <small>intentos</small></b></div></header><div class="assess82-preview-list">${questions.length ? questions.map((question,index) => previewQuestion(data,question,index)).join('') : '<div class="assess82-preview-empty">Agrega preguntas para generar la vista previa.</div>'}</div></div><aside class="assess82-publish-card ${ready.ready ? 'ready' : ''}"><span>${ready.ready ? 'LISTA' : 'FALTAN DATOS'}</span><h3>${ready.ready ? 'La evaluación está lista para publicar' : 'Completa la evaluación antes de publicarla'}</h3>${ready.ready ? `<p>La vista previa tiene preguntas, opciones y respuestas correctas válidas.</p><button type="button" data-assess82-publish="${assessment.id}" ${assessment.status === 'published' ? 'disabled' : ''}>${assessment.status === 'published' ? 'Ya está publicada' : 'Publicar evaluación →'}</button>` : `<ul>${ready.issues.slice(0,6).map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>`}</aside></section>`;
  }

  function editor(data, assessment) {
    if (!assessment) return `<section class="assess82-select-empty"><span>✓</span><h2>Selecciona una evaluación</h2><p>Elige una evaluación del panel izquierdo o crea la primera para comenzar.</p></section>`;
    const questions = questionsFor(data,assessment.id);
    const attempts = attemptsFor(data,assessment.id);
    const ready = readiness(data,assessment);
    return `<section class="assess82-editor"><header class="assess82-editor-head"><div><span>${esc(courseName(data,assessment.course_id))}${assessment.module_id ? ` · ${esc(moduleName(data,assessment.module_id))}` : ''}</span><h2>${esc(assessment.title)}</h2><p>${esc(assessmentTypeLabel(assessment.assessment_type))} · ${assessment.passing_score ?? 70}% para aprobar · ${attempts.length} intento${attempts.length === 1 ? '' : 's'} registrado${attempts.length === 1 ? '' : 's'}</p></div><div><span class="assess82-status ${assessment.status}">${statusLabel(assessment.status)}</span><span class="assess82-ready ${ready.ready ? 'ready' : ''}">${ready.ready ? 'Lista' : `${ready.issues.length} pendiente${ready.issues.length === 1 ? '' : 's'}`}</span></div></header><nav class="assess82-tabs" aria-label="Editor de evaluación"><button type="button" class="${activeTab === 'settings' ? 'active' : ''}" data-assess82-tab="settings"><b>01</b><span>Configuración</span></button><button type="button" class="${activeTab === 'questions' ? 'active' : ''}" data-assess82-tab="questions"><b>02</b><span>Preguntas <em>${questions.length}</em></span></button><button type="button" class="${activeTab === 'preview' ? 'active' : ''}" data-assess82-tab="preview"><b>03</b><span>Vista previa</span></button></nav><div class="assess82-tab-body">${activeTab === 'settings' ? settingsTab(data,assessment) : activeTab === 'preview' ? previewTab(data,assessment) : questionsTab(data,assessment)}</div></section>`;
  }

  function markup(data) {
    const published = data.assessments.filter(item => item.status === 'published').length;
    const filtered = filteredAssessments(data);
    const selected = data.assessments.find(item => item.id === selectedAssessmentId) || null;
    return `<section class="assess82" data-assessment-admin data-assess82-version="${VERSION}"><header class="assess82-heading"><div><span>EVALUACIONES</span><h1>Constructor académico</h1><p>Diseña evaluaciones paso a paso, revisa exactamente lo que verá el estudiante y publica sólo cuando todo esté completo.</p></div><div class="assess82-heading-actions"><button type="button" data-assessment-refresh>Actualizar</button><button type="button" class="primary" data-assess82-open-create>+ Nueva evaluación</button></div></header><section class="assess82-stats">${stat(data.assessments.length,'Evaluaciones',`${published} publicadas`)}${stat(data.questions.length,'Preguntas','configuradas')}${stat(data.attempts.length,'Intentos','registrados')}${stat(data.courses.length,'Programas','del workspace')}</section>${createPanel(data)}<section class="assess82-workspace"><aside class="assess82-sidebar"><div class="assess82-sidebar-head"><div><span>BANCO DE EVALUACIONES</span><strong>${filtered.length} resultado${filtered.length === 1 ? '' : 's'}</strong></div></div><div class="assess82-filters"><input type="search" data-assess82-search placeholder="Buscar evaluación" value="${esc(searchTerm)}"><select data-assess82-course-filter><option value="all">Todos los cursos</option>${data.courses.map(course => `<option value="${course.id}" ${courseFilter === course.id ? 'selected' : ''}>${esc(course.title)}</option>`).join('')}</select></div><div class="assess82-list">${filtered.length ? filtered.map(item => assessmentListItem(data,item)).join('') : '<div class="assess82-list-empty">No hay evaluaciones que coincidan con los filtros.</div>'}</div></aside><main class="assess82-main">${editor(data,selected)}</main></section></section>`;
  }

  function setInline(selector, text, error = false, root = document) { const el = $(selector,root); if (!el) return; el.textContent = text || ''; el.classList.toggle('error',!!error); }

  async function createAssessment(form, data) {
    const button = $('button[type="submit"]',form); const values = Object.fromEntries(new FormData(form).entries()); button.disabled = true; setInline('[data-assess82-create-status]','Creando borrador…',false,form);
    const payload = {course_id:values.course_id,module_id:values.module_id || null,title:String(values.title || '').trim(),description:String(values.description || '').trim() || null,assessment_type:values.assessment_type,passing_score:Number(values.passing_score || 70),max_attempts:values.max_attempts ? Number(values.max_attempts) : null,time_limit_minutes:values.time_limit_minutes ? Number(values.time_limit_minutes) : null,status:'draft',position:data.assessments.filter(item => item.course_id === values.course_id).length + 1,created_by:data.user.id};
    const {data:created,error} = await data.sb.from('assessments').insert(payload).select('id').single(); if (error) { setInline('[data-assess82-create-status]',error.message,true,form); button.disabled = false; return; }
    selectedAssessmentId = created.id; activeTab = 'questions'; createOpen = false; await render(true);
  }

  async function saveSettings(form, data, assessment) {
    const button = $('button[type="submit"]',form); const values = Object.fromEntries(new FormData(form).entries());
    if (values.status === 'published') { const ready = readiness(data,assessment); if (!ready.ready) { setInline('[data-assess82-settings-status]',ready.issues[0] || 'Completa la evaluación antes de publicarla.',true,form); return; } }
    button.disabled = true; setInline('[data-assess82-settings-status]','Guardando…',false,form);
    const payload = {title:String(values.title || '').trim(),description:String(values.description || '').trim() || null,assessment_type:values.assessment_type,module_id:values.module_id || null,passing_score:Number(values.passing_score || 70),max_attempts:values.max_attempts ? Number(values.max_attempts) : null,time_limit_minutes:values.time_limit_minutes ? Number(values.time_limit_minutes) : null,status:values.status,updated_at:new Date().toISOString()};
    const {error} = await data.sb.from('assessments').update(payload).eq('id',assessment.id); if (error) { setInline('[data-assess82-settings-status]',error.message,true,form); button.disabled = false; return; } await render(true);
  }

  function readNewOptions(form, type) {
    if (type === 'short_text') return {rows:[],error:''};
    const rows = $$('[data-assess82-new-option]',form).map((input,index) => ({label:String(input.value || '').trim(),correct:input.closest('.assess82-new-option')?.querySelector('[data-assess82-new-correct]')?.checked || false,position:index + 1})).filter(row => row.label);
    const correctCount = rows.filter(row => row.correct).length;
    if (rows.length < 2) return {rows,error:'Agrega al menos dos opciones.'}; if (!correctCount) return {rows,error:'Marca al menos una respuesta correcta.'}; if (['single_choice','true_false'].includes(type) && correctCount !== 1) return {rows,error:'Este tipo de pregunta requiere una sola respuesta correcta.'}; return {rows,error:''};
  }

  async function addQuestion(form, data, assessmentId) {
    const button = $('button[type="submit"]',form); const values = Object.fromEntries(new FormData(form).entries()); const type = values.question_type; const optionState = readNewOptions(form,type); if (optionState.error) { setInline('[data-assess82-newq-status]',optionState.error,true,form); return; }
    button.disabled = true; setInline('[data-assess82-newq-status]','Agregando pregunta…',false,form); const existing = questionsFor(data,assessmentId);
    const {data:question,error} = await data.sb.from('assessment_questions').insert({assessment_id:assessmentId,prompt:String(values.prompt || '').trim(),question_type:type,explanation:String(values.explanation || '').trim() || null,points:Number(values.points || 1),position:existing.length + 1}).select('id').single();
    if (error) { setInline('[data-assess82-newq-status]',error.message,true,form); button.disabled = false; return; }
    if (optionState.rows.length) { const {error:optionError} = await data.sb.from('assessment_options').insert(optionState.rows.map(row => ({question_id:question.id,label:row.label,is_correct:row.correct,position:row.position}))); if (optionError) { await data.sb.from('assessment_questions').delete().eq('id',question.id); setInline('[data-assess82-newq-status]',optionError.message,true,form); button.disabled = false; return; } }
    await render(true);
  }

  async function saveQuestion(form, data, question) {
    const button = $('button[type="submit"]',form);
    if (question.question_type !== 'short_text') { const optionInputs = $$('[data-assess82-option-label]',form); const correctCount = $$('[data-assess82-correct-option]',form).filter(input => input.checked).length; if (optionInputs.length < 2) { setInline('[data-assess82-question-status]','La pregunta necesita al menos dos opciones.',true,form); return; } if (!correctCount) { setInline('[data-assess82-question-status]','Marca una respuesta correcta.',true,form); return; } if (['single_choice','true_false'].includes(question.question_type) && correctCount !== 1) { setInline('[data-assess82-question-status]','Debe existir una sola respuesta correcta.',true,form); return; } }
    button.disabled = true; setInline('[data-assess82-question-status]','Guardando…',false,form); const values = Object.fromEntries(new FormData(form).entries()); const {error} = await data.sb.from('assessment_questions').update({prompt:String(values.prompt || '').trim(),explanation:String(values.explanation || '').trim() || null,points:Number(values.points || 1)}).eq('id',question.id); if (error) { setInline('[data-assess82-question-status]',error.message,true,form); button.disabled = false; return; }
    if (question.question_type !== 'short_text') { for (const input of $$('[data-assess82-option-label]',form)) { const optionId = input.dataset.assess82OptionLabel; const correct = $(`[data-assess82-correct-option="${optionId}"]`,form)?.checked || false; const {error:optionError} = await data.sb.from('assessment_options').update({label:String(input.value || '').trim(),is_correct:correct}).eq('id',optionId); if (optionError) { setInline('[data-assess82-question-status]',optionError.message,true,form); button.disabled = false; return; } } }
    await render(true);
  }

  async function moveQuestion(data, questionId, delta) {
    const question = data.questions.find(item => item.id === questionId); if (!question) return; const ordered = questionsFor(data,question.assessment_id); const index = ordered.findIndex(item => item.id === questionId); const target = ordered[index + delta]; if (!target) return; const firstPosition = Number(question.position || index + 1); const secondPosition = Number(target.position || index + delta + 1); const first = await data.sb.from('assessment_questions').update({position:secondPosition}).eq('id',question.id); if (first.error) return; const second = await data.sb.from('assessment_questions').update({position:firstPosition}).eq('id',target.id); if (!second.error) await render(true);
  }

  async function deleteQuestion(data, questionId) { if (!confirm('¿Eliminar esta pregunta y sus opciones?')) return; const {error} = await data.sb.from('assessment_questions').delete().eq('id',questionId); if (!error) await render(true); }
  async function publishAssessment(data, assessment) { const ready = readiness(data,assessment); if (!ready.ready) return; const {error} = await data.sb.from('assessments').update({status:'published',updated_at:new Date().toISOString()}).eq('id',assessment.id); if (!error) await render(true); }

  function rebuildNewOptions(form) { const type = $('[data-assess82-new-type]',form)?.value || 'single_choice'; const host = $('[data-assess82-new-options]',form); const add = $('[data-assess82-add-option]',form); if (!host) return; host.innerHTML = newOptionRows(type); if (add) add.hidden = ['true_false','short_text'].includes(type); }
  function addOptionRow(form) { const type = $('[data-assess82-new-type]',form)?.value || 'single_choice'; if (['true_false','short_text'].includes(type)) return; const host = $('[data-assess82-new-options]',form); if (!host) return; const single = type === 'single_choice'; const row = document.createElement('div'); row.className = 'assess82-new-option'; row.innerHTML = `<input type="${single ? 'radio' : 'checkbox'}" ${single ? 'name="new-correct"' : ''} data-assess82-new-correct><input type="text" data-assess82-new-option value="" placeholder="Nueva opción" maxlength="500"><button type="button" data-assess82-remove-option aria-label="Eliminar opción">×</button>`; host.appendChild(row); }

  function bind(host, data) {
    $('[data-assessment-refresh]',host)?.addEventListener('click',() => render(true)); $('[data-assess82-open-create]',host)?.addEventListener('click',() => { createOpen = true; paint(data); }); $('[data-assess82-close-create]',host)?.addEventListener('click',() => { createOpen = false; paint(data); }); $('[data-assess82-search]',host)?.addEventListener('input',event => { searchTerm = event.target.value; paint(data); }); $('[data-assess82-course-filter]',host)?.addEventListener('change',event => { courseFilter = event.target.value; paint(data); }); $$('[data-assess82-select]',host).forEach(button => button.addEventListener('click',() => { selectedAssessmentId = button.dataset.assess82Select; activeTab = 'questions'; paint(data); })); $$('[data-assess82-tab]',host).forEach(button => button.addEventListener('click',() => { activeTab = button.dataset.assess82Tab; paint(data); })); $('[data-assess82-open-preview]',host)?.addEventListener('click',() => { activeTab = 'preview'; paint(data); });
    const createForm = $('[data-assess82-create]',host); createForm?.addEventListener('submit',event => { event.preventDefault(); createAssessment(createForm,data); }); $('[data-assess82-create-course]',host)?.addEventListener('change',event => { const moduleSelect = $('[data-assess82-create-module]',host); if (moduleSelect) moduleSelect.innerHTML = moduleOptions(data,event.target.value); });
    const assessment = data.assessments.find(item => item.id === selectedAssessmentId); if (!assessment) return;
    const settings = $(`[data-assess82-settings="${assessment.id}"]`,host); settings?.addEventListener('submit',event => { event.preventDefault(); saveSettings(settings,data,assessment); });
    const newQuestion = $(`[data-assess82-new-question="${assessment.id}"]`,host); newQuestion?.addEventListener('submit',event => { event.preventDefault(); addQuestion(newQuestion,data,assessment.id); }); $('[data-assess82-new-type]',newQuestion || host)?.addEventListener('change',() => rebuildNewOptions(newQuestion)); $('[data-assess82-add-option]',newQuestion || host)?.addEventListener('click',() => addOptionRow(newQuestion)); newQuestion?.addEventListener('click',event => { const remove = event.target.closest('[data-assess82-remove-option]'); if (!remove) return; const rows = $$('.assess82-new-option',newQuestion); if (rows.length <= 2) return; remove.closest('.assess82-new-option')?.remove(); });
    $$('[data-assess82-question-edit]',host).forEach(form => { const question = data.questions.find(item => item.id === form.dataset.assess82QuestionEdit); if (!question) return; form.addEventListener('submit',event => { event.preventDefault(); saveQuestion(form,data,question); }); form.addEventListener('change',event => { if (!event.target.matches('[data-assess82-correct-option]')) return; $$('.assess82-option-row',form).forEach(row => row.classList.toggle('correct',!!$('[data-assess82-correct-option]',row)?.checked)); $$('.assess82-option-row span',form).forEach(span => { const row = span.closest('.assess82-option-row'); span.textContent = $('[data-assess82-correct-option]',row)?.checked ? 'Correcta' : 'Opción'; }); }); });
    $$('[data-assess82-move-question]',host).forEach(button => button.addEventListener('click',() => moveQuestion(data,button.dataset.assess82MoveQuestion,Number(button.dataset.delta || 0)))); $$('[data-assess82-delete-question]',host).forEach(button => button.addEventListener('click',() => deleteQuestion(data,button.dataset.assess82DeleteQuestion))); $('[data-assess82-publish]',host)?.addEventListener('click',() => publishAssessment(data,assessment));
  }

  function ensureHost() { const page = $('[data-shell-page="admin"]'); if (!page || page.classList.contains('hidden')) return null; let host = $('[data-assessment-admin-host]',page); if (!host) { host = document.createElement('div'); host.dataset.assessmentAdminHost = 'true'; page.appendChild(host); } return host; }
  function paint(data) { const host = ensureHost(); if (!host) return false; if (!data.assessments.some(item => item.id === selectedAssessmentId)) selectedAssessmentId = data.assessments[0]?.id || null; host.innerHTML = markup(data); bind(host,data); return true; }
  async function render() { if (!isRoute() || busy) return false; const host = ensureHost(); if (!host) return false; busy = true; host.innerHTML = '<section class="assess82 assess82-loading"><span></span><strong>Preparando constructor de evaluaciones…</strong><small>Consultando cursos, preguntas e intentos.</small></section>'; try { const data = await load(); if (!isRoute()) return false; return paint(data); } catch (error) { console.error('Academia Yamilet assessment admin v82',error); host.innerHTML = `<section class="assess82 assess82-error"><strong>${error?.message === 'forbidden' ? 'Acceso restringido' : 'No fue posible cargar Evaluaciones'}</strong><span>${error?.message === 'forbidden' ? 'Esta herramienta está disponible para el equipo académico autorizado.' : 'Revisa tu sesión e inténtalo nuevamente.'}</span><button type="button" data-assess82-retry>Reintentar</button></section>`; $('[data-assess82-retry]',host)?.addEventListener('click',render); return false; } finally { busy = false; } }
  function start() { window.addEventListener('hashchange',() => setTimeout(render,100)); window.addEventListener('pageshow',() => setTimeout(render,180)); document.addEventListener('click',event => { if (event.target.closest('[data-admin-v79-go="evaluations"],a[href="#admin/evaluations"]')) setTimeout(render,160); },true); if (isRoute()) setTimeout(render,120); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.ACADEMIA_YAMILET_ASSESSMENT_ADMIN = {version:VERSION,render};
})();