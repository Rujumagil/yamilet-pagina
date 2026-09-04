(() => {
  'use strict';

  const VERSION = '130.0.0';
  let timer = null;
  let observer = null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function isCertificatesRoute() {
    return String(location.hash || '').replace(/^#/, '').split('/')[0] === 'certificates';
  }

  function modernPage() {
    return $('[data-aula-pages-v71] .v71-certificates-page');
  }

  function legacyChecks() {
    const legacy = $('[data-shell-page="certificates"]');
    if (!legacy) return [];
    return $$('.academy-cert-eligibility .academy-cert-checks span', legacy)
      .map(node => node.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  function enhance() {
    if (!isCertificatesRoute()) return false;
    const page = modernPage();
    if (!page) return false;

    document.body.classList.add('academy-certificates-v130-active');
    page.classList.add('academy-certificates-v130');

    const card = $('.v71-certificate-progress', page);
    if (!card) return true;

    const copy = $('div', card);
    if (copy && !$('.v130-cert-requirements', card)) {
      const checks = legacyChecks();
      if (checks.length) {
        const details = document.createElement('div');
        details.className = 'v130-cert-requirements';
        details.setAttribute('aria-label', 'Requisitos para tu certificado');
        details.innerHTML = checks.map(text => `<span>${text}</span>`).join('');
        copy.appendChild(details);
      }
    }

    return true;
  }

  function schedule(delay = 80) {
    window.clearTimeout(timer);
    timer = window.setTimeout(enhance, delay);
  }

  function start() {
    observer = new MutationObserver(() => {
      if (isCertificatesRoute()) schedule(70);
    });
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class','data-v71-route'] });

    document.addEventListener('click', event => {
      if (event.target.closest('[data-shell-route="certificates"],[data-pwa-extra-route="certificates"],a[href="#certificates"]')) {
        window.setTimeout(() => schedule(0), 150);
        window.setTimeout(() => schedule(0), 520);
      }
    }, true);

    window.addEventListener('hashchange', () => {
      document.body.classList.toggle('academy-certificates-v130-active', isCertificatesRoute());
      schedule(120);
    });
    window.addEventListener('pageshow', () => schedule(220));

    schedule(350);
    window.ACADEMIA_YAMILET_CERTIFICATES_V130 = Object.freeze({ version:VERSION, refresh:() => schedule(0) });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
