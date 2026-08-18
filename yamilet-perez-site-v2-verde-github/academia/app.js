(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const authView = document.querySelector('[data-auth-view]');
  const resetView = document.querySelector('[data-reset-view]');
  const deniedView = document.querySelector('[data-denied-view]');
  const dashboard = document.querySelector('[data-dashboard]');
  const statusEl = document.querySelector('[data-auth-status]');
  const resetStatusEl = document.querySelector('[data-reset-status]');
  const loginForm = document.querySelector('[data-login-form]');
  const resetForm = document.querySelector('[data-reset-form]');
  const magicBtn = document.querySelector('[data-magic-link]');
  const recoveryBtn = document.querySelector('[data-password-recovery]');
  const signoutBtn = document.querySelector('[data-signout]');
  const deniedSignoutBtn = document.querySelector('[data-denied-signout]');
  let sb, workspace, membership, workspaceSlug = 'yamilet-mes';
  let recoveryMode = false;
  let dashboardLoading = false;

  const setStatus = (text, ok = false) => {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('ok', !!ok);
  };

  const setResetStatus = (text, ok = false) => {
    if (!resetStatusEl) return;
    resetStatusEl.textContent = text || '';
    resetStatusEl.classList.toggle('ok', !!ok);
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));

  const formatDate = value => {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${value}T12:00:00Z`));
  };

  function showView(target) {
    [authView, resetView, deniedView, dashboard].forEach(view => view?.classList.add('hidden'));
    target?.classList.remove('hidden');
  }

  function setManagerVisibility(visible) {
    document.querySelectorAll('[data-manager-only]').forEach(el => {
      el.classList.toggle('hidden', !visible);
    });
  }

  async function initSupabase() {
    const res = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('config_unavailable');
    const cfg = await res.json();
    workspaceSlug = cfg.workspaceSlug || workspaceSlug;
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return sb;
  }

  async function fetchVisibleCourses(workspaceId) {
    const { data, error } = await sb
      .from('courses')
      .select('id,title,subtitle,description,status,instructor_name,duration_label,cover_url')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function renderCourses(courses) {
    const list = document.querySelector('[data-course-list]');
    const count = document.querySelector('[data-course-count]');
    if (count) count.textContent = courses.length;
    if (!list) return;

    if (!courses.length) {
      list.innerHTML = '<div class="empty">Los cursos aparecerán aquí conforme se publiquen o se active tu inscripción.</div>';
      return;
    }

    list.innerHTML = courses.map(c => `
      <article class="course-card">
        <span class="tag">${c.status === 'published' ? 'Disponible' : 'En preparación'}</span>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.subtitle || c.description || 'Contenido de Academia Yamilet.')}</p>
        <p><strong>Instructora:</strong> ${escapeHtml(c.instructor_name || 'Yamilet Pérez')}</p>
        ${c.duration_label ? `<p><strong>Duración:</strong> ${escapeHtml(c.duration_label)}</p>` : ''}
      </article>
    `).join('');
  }

  async function loadBookings() {
    const list = document.querySelector('[data-booking-list]');
    const count = document.querySelector('[data-booking-count]');
    if (!list) return;

    const { data, error } = await sb
      .from('free_class_bookings')
      .select('id,booking_date,full_name,email,status')
      .eq('workspace_id', workspace.id)
      .order('booking_date', { ascending: true })
      .limit(100);

    if (error) {
      list.innerHTML = '<div class="empty">No fue posible cargar las reservaciones.</div>';
      return;
    }

    if (count) count.textContent = (data || []).filter(x => x.status === 'requested').length;
    if (!data?.length) {
      list.innerHTML = '<div class="empty">Todavía no hay solicitudes de clase gratuita.</div>';
      return;
    }

    list.innerHTML = data.map(b => `
      <article class="booking-row">
        <strong>${formatDate(b.booking_date)}</strong>
        <span>${escapeHtml(b.full_name)}</span>
        <span>${escapeHtml(b.email)}</span>
        <select data-booking-status="${b.id}" aria-label="Estado de reserva de ${escapeHtml(b.full_name)}">
          <option value="requested" ${b.status === 'requested' ? 'selected' : ''}>Solicitada</option>
          <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmada</option>
          <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completada</option>
          <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelada</option>
        </select>
      </article>
    `).join('');

    list.querySelectorAll('[data-booking-status]').forEach(select => {
      select.addEventListener('change', async () => {
        select.disabled = true;
        const { error: updateError } = await sb
          .from('free_class_bookings')
          .update({ status: select.value })
          .eq('workspace_id', workspace.id)
          .eq('id', select.dataset.bookingStatus);
        select.disabled = false;
        if (updateError) alert('No fue posible actualizar la reservación.');
        else await loadBookings();
      });
    });
  }

  async function loadDashboard(user) {
    if (!user || dashboardLoading || recoveryMode) return;
    dashboardLoading = true;

    try {
      const [{ data: profile }, { data: ws, error: wsError }] = await Promise.all([
        sb.from('profiles').select('full_name,role,email').eq('id', user.id).maybeSingle(),
        sb.from('workspaces').select('id,name,slug,accent_color').eq('slug', workspaceSlug).maybeSingle()
      ]);

      if (wsError || !ws) {
        setStatus('No se encontró la configuración de Academia Yamilet.');
        showView(authView);
        return;
      }

      workspace = ws;
      const { data: member } = await sb
        .from('workspace_members')
        .select('role,status')
        .eq('workspace_id', ws.id)
        .eq('user_id', user.id)
        .maybeSingle();

      membership = member?.status === 'active' ? member : null;
      const courses = await fetchVisibleCourses(ws.id);
      const isPlatformAdmin = profile?.role === 'admin';
      const isWorkspaceStaff = !!membership && ['owner', 'admin', 'instructor'].includes(membership.role);
      const canManageBookings = isPlatformAdmin || (!!membership && ['owner', 'admin'].includes(membership.role));
      const hasAcademyAccess = isPlatformAdmin || isWorkspaceStaff || courses.length > 0;

      if (!hasAcademyAccess) {
        showView(deniedView);
        return;
      }

      document.querySelector('[data-user-name]').textContent = profile?.full_name || user.email?.split('@')[0] || 'Alumno';
      document.querySelector('[data-user-role]').textContent = `${ws.name} · ${membership?.role || profile?.role || 'alumno'}`;
      setManagerVisibility(canManageBookings);
      renderCourses(courses);
      showView(dashboard);

      if (canManageBookings) await loadBookings();
    } catch (error) {
      console.error('Academia Yamilet dashboard', error);
      setStatus('No fue posible cargar tu Academia. Intenta nuevamente.');
      showView(authView);
    } finally {
      dashboardLoading = false;
    }
  }

  function accountEmail() {
    return String(loginForm?.querySelector('input[name=email]')?.value || '').trim().toLowerCase();
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    recoveryMode = false;
    setStatus('');
    showView(authView);
  }

  async function start() {
    try {
      await initSupabase();

      loginForm?.addEventListener('submit', async e => {
        e.preventDefault();
        setStatus('Validando acceso…');
        const fd = new FormData(loginForm);
        const email = String(fd.get('email') || '').trim().toLowerCase();
        const password = String(fd.get('password') || '');
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          setStatus('No se pudo iniciar sesión. Revisa tus datos o recupera tu contraseña.');
          return;
        }
        setStatus('Acceso correcto.', true);
        await loadDashboard(data.user);
      });

      magicBtn?.addEventListener('click', async () => {
        const email = accountEmail();
        if (!email) {
          setStatus('Escribe primero tu correo.');
          return;
        }
        setStatus('Enviando enlace seguro…');
        const redirectTo = new URL('./', window.location.href).href;
        const { error } = await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
        });
        if (error) {
          setStatus('No fue posible enviar el enlace. Verifica que el correo esté registrado.');
          return;
        }
        setStatus('Revisa tu correo. Te enviamos un enlace de acceso.', true);
      });

      recoveryBtn?.addEventListener('click', async () => {
        const email = accountEmail();
        if (!email) {
          setStatus('Escribe primero tu correo para recuperar la contraseña.');
          return;
        }
        setStatus('Preparando recuperación segura…');
        const redirectTo = new URL('./?recovery=1', window.location.href).href;
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
          setStatus('No fue posible iniciar la recuperación. Intenta nuevamente.');
          return;
        }
        setStatus('Revisa tu correo. Te enviamos el enlace para crear una nueva contraseña.', true);
      });

      resetForm?.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(resetForm);
        const password = String(fd.get('password') || '');
        const confirm = String(fd.get('confirm_password') || '');
        if (password.length < 8) {
          setResetStatus('La contraseña debe tener al menos 8 caracteres.');
          return;
        }
        if (password !== confirm) {
          setResetStatus('Las contraseñas no coinciden.');
          return;
        }

        setResetStatus('Guardando nueva contraseña…');
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) {
          setResetStatus('No fue posible actualizar la contraseña. Solicita un nuevo enlace.');
          return;
        }

        setResetStatus('Contraseña actualizada correctamente.', true);
        recoveryMode = false;
        history.replaceState({}, '', new URL('./', window.location.href).href);
        resetForm.reset();
        await loadDashboard(data.user);
      });

      signoutBtn?.addEventListener('click', signOut);
      deniedSignoutBtn?.addEventListener('click', signOut);
      document.querySelector('[data-scroll-courses]')?.addEventListener('click', () => document.querySelector('#mis-cursos')?.scrollIntoView({ behavior: 'smooth' }));
      document.querySelector('[data-scroll-bookings]')?.addEventListener('click', () => document.querySelector('#reservas')?.scrollIntoView({ behavior: 'smooth' }));

      sb.auth.onAuthStateChange((event, session) => {
        setTimeout(async () => {
          if (event === 'PASSWORD_RECOVERY') {
            recoveryMode = true;
            setResetStatus('');
            showView(resetView);
            return;
          }
          if (event === 'SIGNED_OUT') {
            recoveryMode = false;
            showView(authView);
            return;
          }
          if (session?.user && !recoveryMode && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
            await loadDashboard(session.user);
          }
        }, 0);
      });

      const { data } = await sb.auth.getSession();
      const recoveryHint = new URLSearchParams(location.search).get('recovery') === '1';
      if (recoveryHint && data.session?.user) {
        recoveryMode = true;
        showView(resetView);
      } else if (data.session?.user) {
        await loadDashboard(data.session.user);
      } else {
        showView(authView);
      }
    } catch (error) {
      console.error('Academia Yamilet init', error);
      setStatus('No fue posible conectar con Academia Yamilet. Intenta nuevamente en unos minutos.');
      showView(authView);
    }
  }

  start();
})();
