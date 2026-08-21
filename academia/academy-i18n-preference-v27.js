(() => {
  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const STORAGE_KEY = 'yamilet-academy-locale';
  const ALLOWED = new Set(['es', 'it']);
  let client = null;
  let workspace = null;
  let workspaceSlug = 'yamilet-mes';
  let syncing = false;

  async function initClient() {
    if (client) return client;
    if (!window.supabase) return null;
    const response = await fetch(CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const cfg = await response.json();
    workspaceSlug = cfg.workspaceSlug || workspaceSlug;
    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return client;
  }

  async function resolveWorkspace() {
    const sb = await initClient();
    if (!sb) return null;
    if (workspace?.id) return workspace;
    const { data, error } = await sb.from('workspaces')
      .select('id,name,slug')
      .eq('slug', workspaceSlug)
      .maybeSingle();
    if (error) return null;
    workspace = data || null;
    return workspace;
  }

  async function savePreference(user, nextLocale) {
    if (!user || !ALLOWED.has(nextLocale)) return;
    const sb = await initClient();
    const ws = await resolveWorkspace();
    if (!sb || !ws) return;
    const { error } = await sb.from('academy_user_preferences').upsert({
      user_id: user.id,
      workspace_id: ws.id,
      locale: nextLocale,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,workspace_id' });
    if (error) console.warn('Academia Yamilet locale sync', error);
  }

  async function syncPreference(user) {
    if (!user || syncing) return;
    syncing = true;
    try {
      const sb = await initClient();
      const ws = await resolveWorkspace();
      if (!sb || !ws) return;
      const { data, error } = await sb.from('academy_user_preferences')
        .select('locale')
        .eq('user_id', user.id)
        .eq('workspace_id', ws.id)
        .maybeSingle();
      if (error) return;

      if (ALLOWED.has(data?.locale)) {
        localStorage.setItem(STORAGE_KEY, data.locale);
        const current = window.YamiletI18n?.getLocale?.();
        if (current !== data.locale) await window.YamiletI18n?.setLocale?.(data.locale, { persist: false });
      } else {
        const current = window.YamiletI18n?.getLocale?.() || localStorage.getItem(STORAGE_KEY) || 'es';
        await savePreference(user, ALLOWED.has(current) ? current : 'es');
      }
    } finally {
      syncing = false;
    }
  }

  async function boot() {
    const sb = await initClient();
    if (!sb) return;

    window.addEventListener('yamilet:language-change', async event => {
      const nextLocale = event.detail?.locale;
      if (!ALLOWED.has(nextLocale)) return;
      const { data } = await sb.auth.getSession();
      if (data.session?.user) await savePreference(data.session.user, nextLocale);
    });

    sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setTimeout(() => syncPreference(session.user), 0);
    });

    const { data } = await sb.auth.getSession();
    if (data.session?.user) await syncPreference(data.session.user);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
