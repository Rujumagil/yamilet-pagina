(() => {
  'use strict';

  const MARKER = '/imagenes-academia-yamilet-final/';
  const PUBLIC_BASE = new URL('../imagenes-academia-yamilet-final/', document.baseURI).href;

  function corrected(value = '') {
    const text = String(value || '');
    const index = text.indexOf(MARKER);
    if (index < 0) return text;
    const tail = text.slice(index + MARKER.length);
    const file = tail.split(/[?#\s,]/)[0];
    return file ? `${PUBLIC_BASE}${file}` : text;
  }

  function patchElement(node) {
    if (!(node instanceof Element)) return;

    if (node.matches('img[src]')) {
      const next = corrected(node.getAttribute('src'));
      if (next && next !== node.getAttribute('src')) node.setAttribute('src', next);
    }

    if (node.matches('source[srcset]')) {
      const current = node.getAttribute('srcset') || '';
      const next = corrected(current);
      if (next && next !== current) node.setAttribute('srcset', next);
    }

    if (node.matches('link[href]')) {
      const current = node.getAttribute('href') || '';
      if (current.includes('imagenes-academia-yamilet-final')) {
        const next = corrected(current);
        if (next && next !== current) node.setAttribute('href', next);
      }
    }

    node.querySelectorAll?.('img[src],source[srcset],link[href]').forEach(patchElement);
  }

  function patchAll() {
    patchElement(document.documentElement);
  }

  const style = document.createElement('style');
  style.id = 'academy-visual-path-fix-v92';
  style.textContent = `
    body:has(.dashboard:not(.hidden)) .dashboard-main{
      background-image:linear-gradient(rgba(245,243,237,.91),rgba(245,243,237,.96)),url("${PUBLIC_BASE}17-academia-fondo-claro.webp")!important;
    }
    .academy-avatar.academy-avatar-fallback{
      background-image:url("${PUBLIC_BASE}18-avatar-alumno-generico.webp")!important;
    }
  `;
  document.head.appendChild(style);

  patchAll();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') patchElement(record.target);
      record.addedNodes?.forEach(node => patchElement(node));
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'href']
  });

  window.addEventListener('pageshow', patchAll);
  window.setTimeout(patchAll, 100);
  window.setTimeout(patchAll, 500);
  window.setTimeout(patchAll, 1500);
})();
