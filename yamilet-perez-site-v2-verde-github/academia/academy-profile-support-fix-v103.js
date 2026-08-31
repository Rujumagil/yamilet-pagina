(() => {
  'use strict';

  function patchLibraryLinks(root = document) {
    root.querySelectorAll?.('a[href="#resources"]').forEach(link => {
      link.setAttribute('href', '#library');
    });
  }

  function patch() {
    patchLibraryLinks(document);
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) patchLibraryLinks(node);
    }));
  });

  function start() {
    patch();
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href="#resources"]');
      if (link) link.setAttribute('href', '#library');
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
