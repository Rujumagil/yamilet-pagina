(() => {
  'use strict';

  const VERSION = '78.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let contextPromise = null;
  let renderTimer = null;
  let neutralTimer = null;

  function currentRoute() {
    return decodeURIComponent(String(location.hash || '#home').replace(/^#/, '').split('/')[0] || 'home');
  }

  function initials(name = '') {
    return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'AY';
  }

  function roleLabel(role = '') {
    const value = String(role || '').toLowerCase();
    if (value === 'owner') return 'Propietario';
    if (value === 'admin') return 'Administrador';
    if (value === 'instructor') return 'Instructor';
    return 'Estudiante';
  }

  function languageLabel(lang) {
    return lang === 'it' ? 'Italiano' : 'Español';
  }

  function currentLanguage() {
    return $('[data-academy-lang][aria-pressed="true"]')?.dataset.academyLang || 'es';
  }

  function readMetric(selector, fallback = '0') {
    return ($(selector)?.textContent || fallback).trim() || fallback;
  }

  async function getContext(force = false) {
    if (force) contextPromise = null;
    if (contextPromise) return contextPromise;
    contextPromise = (async () => {
      const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('profile_config');
      const config = await response.json();
      const sb = window.supabase.createClient(config.url, config.anonKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) throw new Error('profile_session');
      const user = session.user;
      const [{data:profile},{data:workspace}] = await Promise.all([
        sb.from('profiles').select('id,email,full_name,avatar_url,role,status,created_at').eq('id', user.id).maybeSingle(),
        sb.from('workspaces').select('id,name,slug').eq('slug', config.workspaceSlug || 'yamilet-mes').maybeSingle()
      ]);
      let membership = null;
      if (workspace?.id) {
        const {data} = await sb.from('workspace_members').select('role,status').eq('workspace_id', workspace.id).eq('user_id', user.id).maybeSingle();
        membership = data || null;
      }
      return {sb,config,user,profile:profile||{},workspace:workspace||null,membership};
    })().catch(error => { contextPromise = null; throw error; });
    return contextPromise;
  }

  function host() {
    const main = $('.dashboard-main');
    if (!main) return null;
    let node = $('[data-aula-pages-v71]', main);
    if (!node) {
      node = document.createElement('section');
      node.className = 'aula-v71-page-host';
      node.dataset.aulaPagesV71 = 'true';
      main.appendChild(node);
    }
    return node;
  }

  function setIndependentMode(active) {
    const main = $('.dashboard-main');
    const page = host();
    if (!main || !page) return;
    if (active) {
      main.dataset.v78Route = 'profile';
      page.hidden = false;
      Array.from(main.children).forEach(child => {
        const keep = child === page || child.classList.contains('academy-topbar');
        if (!keep) child.dataset.v78Suppressed = 'true';
      });
    } else if (main.dataset.v78Route === 'profile') {
      delete main.dataset.v78Route;
      Array.from(main.children).forEach(child => delete child.dataset.v78Suppressed);
    }
  }

  function flash(message, type = '') {
    let node = $('[data-v78-profile-flash]');
    if (!node) {
      node = document.createElement('div');
      node.className = 'v78-profile-flash';
      node.dataset.v78ProfileFlash = 'true';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add('show');
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => node.classList.remove('show'), 3200);
  }

  async function saveName(form, ctx) {
    const input = form.elements.full_name;
    const button = $('button[type="submit"]', form);
    const name = String(input?.value || '').trim();
    if (!name) return flash('Escribe tu nombre completo.', 'error');
    if (button) button.disabled = true;
    try {
      const {error} = await ctx.sb.from('profiles').update({full_name:name}).eq('id', ctx.user.id);
      if (error) throw error;
      ctx.profile.full_name = name;
      const heading = $('[data-user-name]');
      if (heading) heading.textContent = name;
      flash('Perfil actualizado correctamente.', 'ok');
      scheduleRender(80, true);
    } catch (error) {
      console.error('Academia Yamilet profile save', error);
      flash('No fue posible guardar los cambios.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function requestPasswordReset(email, button) {
    if (!email) return flash('No encontramos un correo válido en tu cuenta.', 'error');
    if (button) button.disabled = true;
    try {
      const ctx = await getContext();
      const url = new URL(window.location.href);
      url.hash = '';
      url.search = '?recovery=1';
      const {error} = await ctx.sb.auth.resetPasswordForEmail(email, {redirectTo:url.href});
      if (error) throw error;
      flash('Correo enviado. Revisa tu bandeja para crear una nueva contraseña.', 'ok');
    } catch (error) {
      console.error('Academia Yamilet profile recovery', error);
      flash('No fue posible enviar el correo de recuperación.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderProfile(ctx) {
    const page = host();
    if (!page) return;
    setIndependentMode(true);
    const profile = ctx.profile || {};
    const name = profile.full_name || ctx.user.user_metadata?.full_name || 'Estudiante';
    const email = profile.email || ctx.user.email || '';
    const status = String(profile.status || ctx.membership?.status || 'active').toLowerCase();
    const role = roleLabel(ctx.membership?.role || profile.role || 'student');
    const lang = currentLanguage();
    const courses = readMetric('[data-course-count]', '0');
    const progress = readMetric('[data-overall-progress]', '0%');
    const avatar = profile.avatar_url ? `<img src="${esc(profile.avatar_url)}" alt="Foto de perfil">` : `<span>${esc(initials(name))}</span>`;

    page.innerHTML = `<div class="v78-profile-page">
      <section class="v78-profile-heading"><div><span>Tu cuenta</span><h1>Mi perfil</h1><p>Administra tus datos, preferencias de idioma y seguridad desde un espacio personal de Academia Yamilet.</p></div><a href="#help">Ayuda y soporte</a></section>
      <section class="v78-profile-summary">
        <article><span>Programas</span><strong>${esc(courses)}</strong><small>disponibles</small></article>
        <article><span>Progreso</span><strong>${esc(progress)}</strong><small>avance general</small></article>
        <article><span>Idioma</span><strong>${lang === 'it' ? 'IT' : 'ES'}</strong><small>${esc(languageLabel(lang))}</small></article>
        <article><span>Cuenta</span><strong>${status === 'active' ? '✓' : '—'}</strong><small>${status === 'active' ? 'acceso activo' : 'revisar estado'}</small></article>
      </section>
      <section class="v78-profile-main">
        <article class="v78-profile-identity">
          <div class="v78-profile-avatar">${avatar}</div>
          <span class="v78-profile-role">${esc(role)}</span>
          <h2>${esc(name)}</h2>
          <p>${esc(email)}</p>
          <div class="v78-profile-status"><span class="${status === 'active' ? 'active' : ''}">${status === 'active' ? 'Cuenta activa' : esc(status)}</span><span>Academia Yamilet</span></div>
        </article>
        <article class="v78-profile-data">
          <div class="v78-profile-section-head"><span>Información personal</span><h2>Datos de cuenta</h2><p>El nombre se utiliza en tu perfil y en los documentos académicos que correspondan.</p></div>
          <form data-v78-profile-form>
            <label>Nombre completo<input name="full_name" value="${esc(name === 'Estudiante' ? '' : name)}" maxlength="120" autocomplete="name" required></label>
            <label>Correo de acceso<input value="${esc(email)}" disabled></label>
            <div class="v78-profile-form-actions"><button type="submit">Guardar cambios</button><a href="#courses">Ir a mis cursos</a></div>
          </form>
        </article>
      </section>
      <section class="v78-profile-settings">
        <article><div class="v78-setting-icon">文</div><div><span>Preferencias</span><h3>Idioma de la Academia</h3><p>Selecciona el idioma de navegación de tu cuenta.</p><div class="v78-setting-actions"><button type="button" data-v78-lang="es" class="${lang === 'es' ? 'active' : ''}">Español</button><button type="button" data-v78-lang="it" class="${lang === 'it' ? 'active' : ''}">Italiano</button></div></div></article>
        <article><div class="v78-setting-icon">⌁</div><div><span>Seguridad</span><h3>Acceso y contraseña</h3><p>Solicita un enlace seguro si deseas crear una nueva contraseña.</p><div class="v78-setting-actions"><button type="button" class="primary" data-v78-password>Cambiar contraseña</button></div></div></article>
        <article><div class="v78-setting-icon">◇</div><div><span>Reconocimientos</span><h3>Certificados</h3><p>Consulta tus certificados disponibles y el progreso de los que están en proceso.</p><div class="v78-setting-actions"><a href="#certificates">Ver certificados</a></div></div></article>
        <article><div class="v78-setting-icon">?</div><div><span>Soporte</span><h3>¿Necesitas ayuda?</h3><p>Abre el centro de ayuda para resolver dudas o registrar una solicitud.</p><div class="v78-setting-actions"><a href="#help">Abrir soporte</a></div></div></article>
      </section>
    </div>`;

    $('[data-v78-profile-form]', page)?.addEventListener('submit', event => {
      event.preventDefault();
      saveName(event.currentTarget, ctx);
    });
    $$('[data-v78-lang]', page).forEach(button => button.addEventListener('click', () => {
      const target = $(`[data-academy-lang="${button.dataset.v78Lang}"]`);
      target?.click();
      $$('[data-v78-lang]', page).forEach(item => item.classList.toggle('active', item === button));
    }));
    $('[data-v78-password]', page)?.addEventListener('click', event => requestPasswordReset(email, event.currentTarget));
  }

  async function render(force = false) {
    if (currentRoute() !== 'profile') {
      setIndependentMode(false);
      return false;
    }
    const page = host();
    if (!page) return false;
    setIndependentMode(true);
    page.innerHTML = '<section class="v78-profile-loading"><span></span><p>Preparando tu perfil…</p></section>';
    try {
      const ctx = await getContext(force);
      if (currentRoute() !== 'profile') return false;
      renderProfile(ctx);
      window.scrollTo({top:0,behavior:'auto'});
      return true;
    } catch (error) {
      console.error('Academia Yamilet profile v78', error);
      page.innerHTML = '<section class="v78-profile-empty"><strong>No fue posible cargar tu perfil</strong><span>El resto de la Academia sigue disponible. Intenta nuevamente desde el menú.</span><a href="#home">Volver al inicio</a></section>';
      return false;
    }
  }

  function scheduleRender(delay = 100, force = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => render(force), delay);
  }

  function routeBurst() {
    scheduleRender(90);
    setTimeout(() => render(), 260);
    setTimeout(() => render(), 520);
  }

  function neutralizeText(value = '') {
    return String(value)
      .replace(/\bAlumnas\b/g, 'Estudiantes')
      .replace(/\balumnas\b/g, 'estudiantes')
      .replace(/\bAlumna\b/g, 'Estudiante')
      .replace(/\balumna\b/g, 'estudiante')
      .replace(/\bBienvenido\b/g, 'Te damos la bienvenida')
      .replace(/\bBienvenida\b/g, 'Te damos la bienvenida')
      .replace(/Ya estoy inscrita/g, 'Ya tengo acceso')
      .replace(/Ya estoy inscrito/g, 'Ya tengo acceso');
  }

  function neutralizeNode(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) return;
      const next = neutralizeText(node.nodeValue || '');
      if (next !== node.nodeValue) node.nodeValue = next;
    });
    const elements = root.matches?.('*') ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')];
    elements.forEach(element => ['title','aria-label','placeholder'].forEach(attr => {
      if (!element.hasAttribute?.(attr)) return;
      const current = element.getAttribute(attr) || '';
      const next = neutralizeText(current);
      if (next !== current) element.setAttribute(attr, next);
    }));
  }

  function scheduleNeutralize() {
    clearTimeout(neutralTimer);
    neutralTimer = setTimeout(() => neutralizeNode(document.body), 20);
  }

  function start() {
    neutralizeNode(document.body);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) neutralizeNode(node);
        else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          const next = neutralizeText(node.nodeValue || '');
          if (next !== node.nodeValue) node.nodeValue = next;
        }
      }));
      scheduleNeutralize();
    });
    observer.observe(document.body, {childList:true,subtree:true});
    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="profile"],[data-avatar-button],a[href="#profile"]')) routeBurst();
    }, true);
    window.addEventListener('hashchange', routeBurst);
    window.addEventListener('popstate', routeBurst);
    window.addEventListener('pageshow', () => { scheduleNeutralize(); routeBurst(); });
    [260,700,1400,2400].forEach(delay => setTimeout(() => render(), delay));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();

  window.ACADEMIA_YAMILET_PROFILE = {render:() => render(true),version:VERSION};
})();
