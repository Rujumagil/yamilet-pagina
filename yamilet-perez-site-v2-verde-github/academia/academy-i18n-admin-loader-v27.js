(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  let loadedAfterAuth = false;

  function loadEditorAgain() {
    if (loadedAfterAuth || document.querySelector('[data-translation-admin-v27]')) return;
    loadedAfterAuth = true;
    const script = document.createElement('script');
    script.src = `./academy-i18n-admin-v27.js?v=27-auth-${Date.now()}`;
    script.async = true;
    document.body.appendChild(script);
  }

  async function boot() {
    if (!window.supabase) return;
    try {
      const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const cfg = await response.json();
      const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      const { data } = await client.auth.getSession();
      if (data.session?.user) loadEditorAgain();
      client.auth.onAuthStateChange((event, session) => {
        if (session?.user && ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
          setTimeout(loadEditorAgain, 0);
        }
      });
    } catch (error) {
      console.warn('Yamilet i18n admin loader', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
