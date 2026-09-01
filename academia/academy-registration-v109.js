(() => {
  'use strict';

  const VERSION = '109.0.0';
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const $ = (selector, root = document) => root.querySelector(selector);

  const COPY = {
    es: {
      eyebrow: 'NUEVA EN LA ACADEMIA',
      title: '¿Aún no tienes cuenta?',
      text: 'Crea tu perfil de alumna para formar parte de Academia Yamilet. Tus cursos aparecerán cuando tu inscripción sea activada.',
      open: 'Crear mi cuenta',
      formEyebrow: 'REGISTRO A LA ACADEMIA',
      formTitle: 'Crea tu cuenta',
      formText: 'Regístrate con tus datos. Crear tu cuenta no activa automáticamente un curso de pago.',
      name: 'Nombre completo',
      email: 'Correo',
      password: 'Contraseña',
      confirm: 'Confirmar contraseña',
      understand: 'Entiendo que los cursos se activan cuando mi inscripción sea confirmada.',
      submit: 'Registrarme en la Academia',
      back: 'Ya tengo cuenta · volver al acceso',
      working: 'Creando tu cuenta…',
      mismatch: 'Las contraseñas no coinciden.',
      short: 'La contraseña debe tener al menos 8 caracteres.',
      required: 'Completa todos los campos para continuar.',
      consent: 'Confirma que entiendes cómo se activa el acceso a los cursos.',
      successConfirm: 'Cuenta registrada. Revisa tu correo para confirmar tu dirección y después podrás iniciar sesión.',
      successReady: 'Cuenta creada correctamente. Ya puedes iniciar sesión. Tus cursos aparecerán cuando tu inscripción sea activada.',
      exists: 'Este correo ya está registrado. Puedes iniciar sesión o usar “Cambiar mi contraseña”.',
      error: 'No fue posible completar el registro. Intenta nuevamente en unos minutos.'
    },
    it: {
      eyebrow: 'NUOVA NELL’ACCADEMIA',
      title: 'Non hai ancora un account?',
      text: 'Crea il tuo profilo di studentessa per entrare in Academia Yamilet. I corsi appariranno quando la tua iscrizione sarà attivata.',
      open: 'Crea il mio account',
      formEyebrow: 'REGISTRAZIONE ALL’ACCADEMIA',
      formTitle: 'Crea il tuo account',
      formText: 'Registrati con i tuoi dati. La creazione dell’account non attiva automaticamente un corso a pagamento.',
      name: 'Nome e cognome',
      email: 'Email',
      password: 'Password',
      confirm: 'Conferma password',
      understand: 'Ho capito che i corsi si attivano quando la mia iscrizione viene confermata.',
      submit: 'Registrami all’Accademia',
      back: 'Ho già un account · torna all’accesso',
      working: 'Creazione account…',
      mismatch: 'Le password non coincidono.',
      short: 'La password deve contenere almeno 8 caratteri.',
      required: 'Completa tutti i campi per continuare.',
      consent: 'Conferma di aver compreso come viene attivato l’accesso ai corsi.',
      successConfirm: 'Account registrato. Controlla la tua email per confermare l’indirizzo e poi potrai accedere.',
      successReady: 'Account creato correttamente. Ora puoi accedere. I corsi appariranno quando la tua iscrizione sarà attivata.',
      exists: 'Questa email è già registrata. Puoi accedere o usare il recupero password.',
      error: 'Non è stato possibile completare la registrazione. Riprova tra qualche minuto.'
    }
  };

  let clientPromise = null;
  let activeLang = 'es';

  function getLang() {
    const selected = $('[data-academy-lang][aria-pressed="true"]');
    return selected?.dataset.academyLang === 'it' ? 'it' : 'es';
  }

  async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('config_unavailable');
      const cfg = await response.json();
      return window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    })();
    return clientPromise;
  }

  function markup() {
    return `
      <section class="academy-register-entry" data-academy-register-entry>
        <div class="academy-register-entry-copy">
          <span data-reg-copy="eyebrow"></span>
          <strong data-reg-copy="title"></strong>
          <p data-reg-copy="text"></p>
        </div>
        <button class="academy-register-open" type="button" data-register-open></button>
      </section>
      <section class="academy-register-panel" data-register-panel hidden>
        <div class="academy-register-head">
          <span data-reg-copy="formEyebrow"></span>
          <h3 data-reg-copy="formTitle"></h3>
          <p data-reg-copy="formText"></p>
        </div>
        <form class="academy-register-form" data-register-form novalidate>
          <label><span data-reg-copy="name"></span><input type="text" name="full_name" autocomplete="name" minlength="2" maxlength="120" required></label>
          <label><span data-reg-copy="email"></span><input type="email" name="email" autocomplete="email" required></label>
          <div class="academy-register-passwords">
            <label><span data-reg-copy="password"></span><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
            <label><span data-reg-copy="confirm"></span><input type="password" name="confirm_password" autocomplete="new-password" minlength="8" required></label>
          </div>
          <label class="academy-register-check"><input type="checkbox" name="activation_understood" required><span data-reg-copy="understand"></span></label>
          <button class="academy-register-submit" type="submit" data-register-submit></button>
          <p class="academy-register-status" data-register-status aria-live="polite"></p>
          <button class="academy-register-back" type="button" data-register-close></button>
        </form>
      </section>`;
  }

  function applyCopy(root) {
    activeLang = getLang();
    const t = COPY[activeLang];
    root.querySelectorAll('[data-reg-copy]').forEach(node => {
      const key = node.dataset.regCopy;
      if (t[key]) node.textContent = t[key];
    });
    const open = $('[data-register-open]', root);
    const submit = $('[data-register-submit]', root);
    const back = $('[data-register-close]', root);
    if (open) open.textContent = t.open;
    if (submit && !submit.disabled) submit.textContent = t.submit;
    if (back) back.textContent = t.back;
  }

  function setStatus(root, text, ok = false) {
    const status = $('[data-register-status]', root);
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('ok', !!ok);
  }

  function openRegistration(root) {
    const entry = $('[data-academy-register-entry]', root);
    const panel = $('[data-register-panel]', root);
    if (entry) entry.hidden = true;
    if (panel) panel.hidden = false;
    root.classList.add('academy-registration-open');
    setStatus(root, '');
    window.setTimeout(() => $('[name="full_name"]', root)?.focus(), 80);
  }

  function closeRegistration(root) {
    const entry = $('[data-academy-register-entry]', root);
    const panel = $('[data-register-panel]', root);
    if (entry) entry.hidden = false;
    if (panel) panel.hidden = true;
    root.classList.remove('academy-registration-open');
    setStatus(root, '');
  }

  function friendlyError(error, t) {
    const raw = String(error?.message || error || '').toLowerCase();
    if (raw.includes('already registered') || raw.includes('already been registered') || raw.includes('user already exists')) return t.exists;
    return t.error;
  }

  async function submitRegistration(root, form) {
    const t = COPY[activeLang = getLang()];
    const fd = new FormData(form);
    const fullName = String(fd.get('full_name') || '').trim().replace(/\s+/g, ' ');
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const confirm = String(fd.get('confirm_password') || '');
    const understood = fd.get('activation_understood') === 'on';
    const submit = $('[data-register-submit]', root);

    if (!fullName || !email || !password || !confirm) return setStatus(root, t.required);
    if (password.length < 8) return setStatus(root, t.short);
    if (password !== confirm) return setStatus(root, t.mismatch);
    if (!understood) return setStatus(root, t.consent);

    submit.disabled = true;
    submit.textContent = t.working;
    setStatus(root, '');

    try {
      const client = await getClient();
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: fullName,
            academy: 'yamilet',
            registration_source: 'academy-public',
            course_interest: 'metodo-mes'
          }
        }
      });
      if (error) throw error;

      form.reset();
      if (data?.session) {
        await client.auth.signOut().catch(() => null);
        setStatus(root, t.successReady, true);
      } else {
        setStatus(root, t.successConfirm, true);
      }
    } catch (error) {
      console.warn('Academia Yamilet registration', error);
      setStatus(root, friendlyError(error, t));
    } finally {
      submit.disabled = false;
      submit.textContent = t.submit;
    }
  }

  function mount() {
    const card = $('.auth-shell[data-auth-view] .login-card');
    if (!card || card.dataset.registrationV109 === 'true') return false;
    card.dataset.registrationV109 = 'true';
    card.insertAdjacentHTML('beforeend', markup());
    applyCopy(card);

    $('[data-register-open]', card)?.addEventListener('click', () => openRegistration(card));
    $('[data-register-close]', card)?.addEventListener('click', () => closeRegistration(card));
    $('[data-register-form]', card)?.addEventListener('submit', event => {
      event.preventDefault();
      submitRegistration(card, event.currentTarget);
    });

    document.querySelectorAll('[data-academy-lang]').forEach(button => {
      button.addEventListener('click', () => window.setTimeout(() => applyCopy(card), 20));
    });
    return true;
  }

  function start() {
    if (mount()) return;
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.ACADEMIA_YAMILET_REGISTRATION_V109 = Object.freeze({ version: VERSION, mount });
})();
