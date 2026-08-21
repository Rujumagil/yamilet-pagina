(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const root = document.querySelector('[data-content-admin-root]');
  if (!root) return;

  let sb;
  let workspace;
  let user;
  let courses = [];
  let selectedCourseId = null;
  let entityType = 'course';
  let entities = [];
  let selectedEntityId = null;
  let sourceRow = null;
  let translations = [];

  const fieldsByType = {
    course: [
      { name: 'title', label: 'Titolo', kind: 'text' },
      { name: 'subtitle', label: 'Sottotitolo', kind: 'text' },
      { name: 'description', label: 'Descrizione', kind: 'text' },
      { name: 'duration_label', label: 'Durata visibile', kind: 'text' }
    ],
    module: [
      { name: 'title', label: 'Titolo', kind: 'text' },
      { name: 'description', label: 'Descrizione', kind: 'text' }
    ],
    lesson: [
      { name: 'title', label: 'Titolo', kind: 'text' },
      { name: 'description', label: 'Descrizione', kind: 'text' },
      { name: 'content_html', label: 'Contenuto della lezione', kind: 'html' },
      { name: 'transcript_text', label: 'Trascrizione', kind: 'text' }
    ]
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  async function initClient() {
    const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('config_unavailable');
    const cfg = await response.json();
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    const { data: ws } = await sb.from('workspaces').select('id,name,slug').eq('slug', cfg.workspaceSlug || 'yamilet-mes').maybeSingle();
    workspace = ws || null;
  }

  async function isStaff() {
    const { data: sessionData } = await sb.auth.getSession();
    user = sessionData.session?.user || null;
    if (!user || !workspace) return false;
    const [{ data: profile }, { data: member }] = await Promise.all([
      sb.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      sb.from('workspace_members').select('role,status').eq('workspace_id', workspace.id).eq('user_id', user.id).maybeSingle()
    ]);
    return profile?.role === 'admin' || (member?.status === 'active' && ['owner','admin','instructor'].includes(member.role));
  }

  async function loadCourses() {
    const { data, error } = await sb.from('courses')
      .select('id,title,subtitle,description,duration_label,status')
      .eq('workspace_id', workspace.id)
      .order('created_at');
    if (error) throw error;
    courses = data || [];
    if (!selectedCourseId || !courses.some(c => c.id === selectedCourseId)) selectedCourseId = courses[0]?.id || null;
    await loadEntities();
  }

  async function loadEntities() {
    entities = [];
    sourceRow = null;
    if (!selectedCourseId) return renderPanel();

    if (entityType === 'course') {
      const course = courses.find(c => c.id === selectedCourseId);
      entities = course ? [{ id: course.id, label: course.title }] : [];
    } else if (entityType === 'module') {
      const { data, error } = await sb.from('modules')
        .select('id,title,description,position').eq('course_id', selectedCourseId).order('position');
      if (error) throw error;
      entities = (data || []).map(row => ({ ...row, label: row.title }));
    } else if (entityType === 'lesson') {
      const { data: moduleRows, error: moduleError } = await sb.from('modules')
        .select('id,title,position').eq('course_id', selectedCourseId).order('position');
      if (moduleError) throw moduleError;
      const moduleIds = (moduleRows || []).map(m => m.id);
      if (moduleIds.length) {
        const { data, error } = await sb.from('lessons')
          .select('id,module_id,title,description,content_html,transcript_text,position').in('module_id', moduleIds);
        if (error) throw error;
        const moduleMap = new Map((moduleRows || []).map(m => [m.id, m]));
        entities = (data || []).sort((a,b) => {
          const ma = moduleMap.get(a.module_id)?.position || 0;
          const mb = moduleMap.get(b.module_id)?.position || 0;
          return ma - mb || (a.position || 0) - (b.position || 0);
        }).map(row => ({ ...row, label: `${moduleMap.get(row.module_id)?.title || 'Modulo'} · ${row.title}` }));
      }
    }

    if (!selectedEntityId || !entities.some(e => e.id === selectedEntityId)) selectedEntityId = entities[0]?.id || null;
    await loadSelectedEntity();
  }

  async function loadSelectedEntity() {
    if (!selectedEntityId) {
      sourceRow = null;
      translations = [];
      return renderPanel();
    }

    if (entityType === 'course') {
      sourceRow = courses.find(c => c.id === selectedEntityId) || null;
    } else if (entityType === 'module') {
      sourceRow = entities.find(e => e.id === selectedEntityId) || null;
    } else {
      sourceRow = entities.find(e => e.id === selectedEntityId) || null;
    }

    const { data, error } = await sb.from('academy_content_translations')
      .select('id,field_name,source_text,translated_text,translated_html,status,updated_at')
      .eq('course_id', selectedCourseId)
      .eq('entity_type', entityType)
      .eq('entity_id', selectedEntityId)
      .eq('locale', 'it');
    if (error) throw error;
    translations = data || [];
    renderPanel();
  }

  function translationFor(field) {
    return translations.find(row => row.field_name === field) || null;
  }

  function currentTarget(fieldDef) {
    const row = translationFor(fieldDef.name);
    return fieldDef.kind === 'html' ? (row?.translated_html || '') : (row?.translated_text || '');
  }

  function translationStatus() {
    if (!translations.length) return 'Traduzione non iniziata';
    return translations.some(row => row.status !== 'published') ? 'Bozza italiana' : 'Italiano pubblicato';
  }

  function renderPanel() {
    let panel = root.querySelector('[data-translation-admin-v27]');
    if (!panel) {
      panel = document.createElement('article');
      panel.className = 'admin-card academy-translation-admin';
      panel.dataset.translationAdminV27 = '1';
      root.prepend(panel);
    }

    const courseOptions = courses.map(c => `<option value="${c.id}" ${c.id === selectedCourseId ? 'selected' : ''}>${escapeHtml(c.title)}</option>`).join('');
    const entityOptions = entities.map(e => `<option value="${e.id}" ${e.id === selectedEntityId ? 'selected' : ''}>${escapeHtml(e.label || e.title || e.id)}</option>`).join('');
    const fields = sourceRow ? fieldsByType[entityType] || [] : [];

    panel.innerHTML = `
      <div class="translation-head">
        <div>
          <div class="kicker">ES / IT</div>
          <h3>Traduzioni dell’Accademia</h3>
          <p class="upload-note">Un solo corso e un solo progresso. Qui viene gestita la versione italiana del contenuto.</p>
        </div>
        <span class="translation-status">${escapeHtml(translationStatus())}</span>
      </div>

      <div class="translation-selectors">
        <label>Corso<select data-translation-course>${courseOptions || '<option>Nessun corso</option>'}</select></label>
        <label>Tipo<select data-translation-type>
          <option value="course" ${entityType === 'course' ? 'selected' : ''}>Corso</option>
          <option value="module" ${entityType === 'module' ? 'selected' : ''}>Modulo</option>
          <option value="lesson" ${entityType === 'lesson' ? 'selected' : ''}>Lezione</option>
        </select></label>
        <label>Elemento<select data-translation-entity>${entityOptions || '<option>Nessun elemento disponibile</option>'}</select></label>
      </div>

      ${sourceRow ? `<form data-translation-form class="translation-fields">
        ${fields.map(field => {
          const source = sourceRow[field.name] || '';
          const target = currentTarget(field);
          return `<div class="translation-field">
            <label><span>ES · ${escapeHtml(field.label)}</span><textarea readonly>${escapeHtml(source)}</textarea></label>
            <label><span>IT · ${escapeHtml(field.label)}</span><textarea name="${escapeHtml(field.name)}" data-kind="${field.kind}" placeholder="Scrivi la traduzione italiana…">${escapeHtml(target)}</textarea></label>
          </div>`;
        }).join('')}
        <div class="translation-actions">
          <button class="btn outline" type="submit" data-translation-save="draft">Salva bozza IT</button>
          <button class="btn primary" type="submit" data-translation-save="published">Pubblica italiano</button>
        </div>
        <p class="admin-status" data-translation-status aria-live="polite"></p>
      </form>` : '<div class="empty">Seleziona un elemento con contenuto reale per iniziare la traduzione italiana.</div>'}`;

    wirePanel();
  }

  function setStatus(message, ok = false) {
    const el = root.querySelector('[data-translation-status]');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('ok', !!ok);
  }

  function wirePanel() {
    root.querySelector('[data-translation-course]')?.addEventListener('change', async e => {
      selectedCourseId = e.target.value;
      selectedEntityId = null;
      await loadEntities();
    });
    root.querySelector('[data-translation-type]')?.addEventListener('change', async e => {
      entityType = e.target.value;
      selectedEntityId = null;
      await loadEntities();
    });
    root.querySelector('[data-translation-entity]')?.addEventListener('change', async e => {
      selectedEntityId = e.target.value;
      await loadSelectedEntity();
    });

    const form = root.querySelector('[data-translation-form]');
    if (!form) return;
    form.querySelectorAll('[data-translation-save]').forEach(button => button.addEventListener('click', () => {
      form.dataset.saveStatus = button.dataset.translationSave;
    }));
    form.addEventListener('submit', saveTranslations);
  }

  async function saveTranslations(event) {
    event.preventDefault();
    if (!sourceRow || !selectedCourseId || !selectedEntityId || !user) return;
    const form = event.currentTarget;
    const status = form.dataset.saveStatus === 'published' ? 'published' : 'draft';
    setStatus(status === 'published' ? 'Pubblicazione della traduzione…' : 'Salvataggio della bozza…');

    const fields = fieldsByType[entityType] || [];
    const rows = fields.map(field => {
      const control = form.elements[field.name];
      const target = String(control?.value || '').trim();
      if (!target) return null;
      const source = String(sourceRow[field.name] || '');
      return {
        course_id: selectedCourseId,
        entity_type: entityType,
        entity_id: selectedEntityId,
        locale: 'it',
        field_name: field.name,
        source_text: source,
        translated_text: field.kind === 'html' ? null : target,
        translated_html: field.kind === 'html' ? target : null,
        status,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };
    }).filter(Boolean);

    if (!rows.length) {
      setStatus('Aggiungi almeno una traduzione italiana prima di salvare.');
      return;
    }

    const { error } = await sb.from('academy_content_translations')
      .upsert(rows, { onConflict: 'entity_type,entity_id,locale,field_name' });
    if (error) {
      console.error('Yamilet translation save', error);
      setStatus('Non è stato possibile salvare la traduzione.');
      return;
    }

    setStatus(status === 'published' ? 'Italiano pubblicato correttamente.' : 'Bozza italiana salvata.', true);
    await loadSelectedEntity();
    window.dispatchEvent(new CustomEvent('yamilet:i18n-updated'));
  }

  async function boot() {
    try {
      await initClient();
      if (!await isStaff()) return;
      await loadCourses();
      const observer = new MutationObserver(() => {
        if (!root.querySelector('[data-translation-admin-v27]') && courses.length) renderPanel();
      });
      observer.observe(root, { childList: true });
    } catch (error) {
      console.warn('Yamilet translation admin', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
