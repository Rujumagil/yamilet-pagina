(() => {
  'use strict';

  const RELEASE = '20260821.39';
  let timer = null;

  function injectStyles() {
    if (document.querySelector('style[data-yamilet-language-v39]')) return;
    const style = document.createElement('style');
    style.dataset.yamiletLanguageV39 = '1';
    style.textContent = `
      .academy-language-compact{
        display:inline-flex;
        align-items:center;
        gap:2px;
        padding:3px;
        border:1px solid rgba(18,63,53,.12);
        border-radius:999px;
        background:#f7faf8;
        box-shadow:0 4px 14px rgba(18,63,53,.04);
      }
      .academy-language-compact button{
        min-width:34px;
        height:30px;
        padding:0 9px;
        border:0;
        border-radius:999px;
        background:transparent;
        color:#64746c;
        font:800 10px/1 Inter,system-ui,sans-serif;
        letter-spacing:.08em;
        cursor:pointer;
        transition:.18s ease;
      }
      .academy-language-compact button:hover{
        color:#123f35;
        background:#eef5f1;
      }
      .academy-language-compact button.active,
      .academy-language-compact button[aria-pressed="true"]{
        background:#123f35;
        color:#fff;
        box-shadow:0 4px 10px rgba(18,63,53,.18);
      }
      @media(max-width:900px){
        .academy-language-compact{margin-left:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function syncState() {
    const locale = window.YamiletI18n?.getLocale?.() || document.body?.dataset.academyLocale || 'es';
    document.querySelectorAll('.academy-language-compact [data-academy-lang]').forEach(btn => {
      const active = btn.dataset.academyLang === locale;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function mount() {
    injectStyles();
    const actions = document.querySelector('.academy-topbar-actions');
    if (!actions) return false;
    if (actions.querySelector('.academy-language-compact')) {
      syncState();
      return true;
    }

    const selector = document.createElement('div');
    selector.className = 'academy-language-compact';
    selector.setAttribute('aria-label', 'Idioma de la Academia');
    selector.innerHTML = `
      <button type="button" data-academy-lang="es" aria-pressed="true" title="Español">ES</button>
      <button type="button" data-academy-lang="it" aria-pressed="false" title="Italiano">IT</button>`;

    actions.prepend(selector);
    syncState();
    return true;
  }

  function boot() {
    if (mount()) return;
    clearInterval(timer);
    timer = setInterval(() => {
      if (mount()) clearInterval(timer);
    }, 200);
    setTimeout(() => clearInterval(timer), 10000);
  }

  window.addEventListener('yamilet:language-change', syncState);
  window.addEventListener('pageshow', () => setTimeout(mount, 80));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.ACADEMIA_YAMILET_LANGUAGE_V39 = { release: RELEASE, mount, syncState };
})();
