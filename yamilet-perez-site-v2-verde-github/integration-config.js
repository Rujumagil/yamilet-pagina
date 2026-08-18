window.YAMILET_INTEGRATION_CONFIG = {
  academy: {
    enabled: true,
    url: new URL('../academia/', window.location.href).href
  },
  booking: {
    enabled: true,
    endpoint: "https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/book-free-class"
  },
  leadCapture: {
    enabled: false,
    endpoint: ""
  }
};

(function forceAcademyLinks(){
  const academyUrl = new URL('../academia/', window.location.href).href;
  const apply = () => {
    document.querySelectorAll('[data-academy-link]').forEach(link => {
      link.href = academyUrl;
      link.classList.remove('is-disabled');
      link.removeAttribute('aria-disabled');
      link.removeAttribute('title');
      if (link.dataset.academyBound === 'true') return;
      link.dataset.academyBound = 'true';
      link.addEventListener('click', event => {
        event.preventDefault();
        window.location.assign(academyUrl);
      });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})();
