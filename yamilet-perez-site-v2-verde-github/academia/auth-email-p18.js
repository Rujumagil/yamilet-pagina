(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  let clientPromise;

  const statusEl = document.querySelector('[data-auth-status]');
  const loginForm = document.querySelector('[data-login-form]');

  function setStatus(text, ok = false) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('ok', !!ok);
  }

  function isRateLimit(error) {
    if (!error) return false;
    const code = String(error.code || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    const status = Number(error.status || error.statusCode || 0);
    return status === 429 || code.includes('rate_limit') || code === 'over_email_send_rate_limit' || message.includes('rate limit') || message.includes('too many requests');
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('config_unavailable');
        const cfg = await response.json();
        return window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      })();
    }
    return clientPromise;
  }

  function accountEmail() {
    return String(loginForm?.querySelector('input[name=email]')?.value || '').trim().toLowerCase();
  }

  function academyBaseUrl() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    return url.href;
  }

  async function handleMagic(button) {
    const email = accountEmail();
    if (!email) {
      setStatus('Escribe primero tu correo.');
      return;
    }

    button.disabled = true;
    setStatus('Solicitando enlace seguro…');
    try {
      const client = await getClient();
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: academyBaseUrl() }
      });
      if (error) throw error;
      setStatus('Listo. Revisa tu correo: te enviamos un enlace de acceso de un solo uso.', true);
    } catch (error) {
      console.error('Yamilet magic link', error);
      if (isRateLimit(error)) {
        setStatus('Se alcanzó temporalmente el límite de correos de seguridad de Supabase. Tu correo sí está registrado. Espera un poco antes de solicitar otro enlace.');
      } else {
        setStatus('No fue posible enviar el enlace en este momento. Intenta nuevamente más tarde.');
      }
    } finally {
      button.disabled = false;
    }
  }

  async function handleRecovery(button) {
    const email = accountEmail();
    if (!email) {
      setStatus('Escribe primero tu correo para cambiar la contraseña.');
      return;
    }

    const redirect = new URL(academyBaseUrl());
    redirect.searchParams.set('recovery', '1');

    button.disabled = true;
    setStatus('Solicitando correo para cambiar tu contraseña…');
    try {
      const client = await getClient();
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirect.href });
      if (error) throw error;
      setStatus('Revisa tu correo. El nuevo enlace abrirá directamente la pantalla para crear una contraseña.', true);
    } catch (error) {
      console.error('Yamilet password reset email', error);
      if (isRateLimit(error)) {
        setStatus('Se alcanzó temporalmente el límite de correos de seguridad de Supabase. Tu correo sí está registrado. Espera un poco antes de solicitar otro correo.');
      } else {
        setStatus('No fue posible enviar el correo de recuperación en este momento. Intenta nuevamente más tarde.');
      }
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-magic-link], [data-password-recovery]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (button.matches('[data-magic-link]')) handleMagic(button);
    else handleRecovery(button);
  }, true);
})();
