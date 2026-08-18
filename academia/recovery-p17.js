(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const RECOVERY_KEY = 'yamilet_recovery_requested_at';

  const loginForm = document.querySelector('[data-login-form]');
  const recoveryBtn = document.querySelector('[data-password-recovery]');
  const magicBtn = document.querySelector('[data-magic-link]');
  const authView = document.querySelector('[data-auth-view]');
  const resetView = document.querySelector('[data-reset-view]');
  const deniedView = document.querySelector('[data-denied-view]');
  const dashboard = document.querySelector('[data-dashboard]');
  const resetForm = document.querySelector('[data-reset-form]');
  const authStatus = document.querySelector('[data-auth-status]');
  const resetStatus = document.querySelector('[data-reset-status]');

  let clientPromise;

  function setAuthStatus(text, ok = false) {
    if (!authStatus) return;
    authStatus.textContent = text || '';
    authStatus.classList.toggle('ok', !!ok);
  }

  function setResetStatus(text, ok = false) {
    if (!resetStatus) return;
    resetStatus.textContent = text || '';
    resetStatus.classList.toggle('ok', !!ok);
  }

  function urlRecoveryIntent() {
    const query = new URLSearchParams(location.search);
    if (query.get('recovery') === '1' || query.get('mode') === 'recovery') return true;
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const hashParams = new URLSearchParams(hash);
    return hashParams.get('type') === 'recovery' || /(?:^|&)type=recovery(?:&|$)/.test(hash);
  }

  function showReset(text = '') {
    [authView, deniedView, dashboard].forEach(view => view?.classList.add('hidden'));
    resetView?.classList.remove('hidden');
    if (text) setResetStatus(text);
  }

  function recoveryRedirect() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '?recovery=1';
    return url.href;
  }

  function markRecoveryRequested() {
    try { localStorage.setItem(RECOVERY_KEY, String(Date.now())); } catch {}
  }

  function clearRecoveryRequested() {
    try { localStorage.removeItem(RECOVERY_KEY); } catch {}
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('config_unavailable');
        const cfg = await response.json();
        return window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
      })();
    }
    return clientPromise;
  }

  if (magicBtn) {
    magicBtn.textContent = 'Entrar sin contraseña';
    magicBtn.setAttribute('aria-label', 'Recibir un enlace para iniciar sesión sin cambiar la contraseña');
  }

  if (recoveryBtn) {
    recoveryBtn.textContent = 'Cambiar mi contraseña';
    recoveryBtn.setAttribute('aria-label', 'Recibir un correo para crear una nueva contraseña');

    recoveryBtn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const email = String(loginForm?.querySelector('input[name=email]')?.value || '').trim().toLowerCase();
      if (!email) {
        setAuthStatus('Escribe primero tu correo para cambiar la contraseña.');
        return;
      }

      recoveryBtn.disabled = true;
      setAuthStatus('Enviando correo para cambiar tu contraseña…');
      markRecoveryRequested();

      try {
        const client = await getClient();
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: recoveryRedirect(),
        });

        if (error) throw error;
        setAuthStatus('Revisa tu correo y pulsa “Cambiar contraseña”. Ese enlace abrirá directamente la pantalla para crear una nueva contraseña.', true);
      } catch (error) {
        console.error('Yamilet password recovery request', error);
        clearRecoveryRequested();
        setAuthStatus('No fue posible enviar el correo de recuperación. Intenta nuevamente.');
      } finally {
        recoveryBtn.disabled = false;
      }
    }, true);
  }

  if (resetForm) {
    resetForm.addEventListener('submit', async event => {
      if (!urlRecoveryIntent()) return;

      event.preventDefault();
      event.stopImmediatePropagation();

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

      const submit = resetForm.querySelector('button[type=submit]');
      if (submit) submit.disabled = true;
      setResetStatus('Guardando nueva contraseña…');

      try {
        const client = await getClient();
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session?.user) {
          setResetStatus('El enlace no tiene una sesión de recuperación válida o ya expiró. Solicita un nuevo correo desde el acceso de la Academia.');
          return;
        }

        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;

        clearRecoveryRequested();
        resetForm.reset();
        setResetStatus('Contraseña actualizada correctamente. Entrando a tu Academia…', true);

        const clean = new URL('./', window.location.href).href;
        history.replaceState({}, '', clean);
        setTimeout(() => window.location.replace(clean), 700);
      } catch (error) {
        console.error('Yamilet password recovery update', error);
        setResetStatus('No fue posible actualizar la contraseña. Solicita un nuevo enlace e inténtalo otra vez.');
      } finally {
        if (submit) submit.disabled = false;
      }
    }, true);
  }

  async function startRecoveryGuard() {
    if (!urlRecoveryIntent()) return;

    showReset('Validando tu enlace seguro…');

    try {
      const client = await getClient();

      client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (urlRecoveryIntent() && session?.user)) {
          showReset('Enlace validado. Crea tu nueva contraseña.');
        }
      });

      const { data } = await client.auth.getSession();
      if (data.session?.user) {
        showReset('Enlace validado. Crea tu nueva contraseña.');
        return;
      }

      setTimeout(async () => {
        const { data: retry } = await client.auth.getSession();
        if (retry.session?.user) {
          showReset('Enlace validado. Crea tu nueva contraseña.');
        } else {
          showReset('No fue posible validar este enlace. Puede haber expirado o ya haber sido utilizado. Solicita uno nuevo desde el acceso de la Academia.');
        }
      }, 1200);
    } catch (error) {
      console.error('Yamilet recovery guard', error);
      showReset('No fue posible validar este enlace. Solicita uno nuevo desde el acceso de la Academia.');
    }
  }

  startRecoveryGuard();
})();
