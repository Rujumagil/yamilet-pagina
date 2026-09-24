(() => {
  'use strict';
  const attributionKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid','msclkid'];
  const params = new URLSearchParams(location.search);

  document.querySelectorAll('[data-academy-cta]').forEach(link => {
    const url = new URL('/academia/', location.origin);
    url.searchParams.set('register','1');
    url.searchParams.set('course','metodo-mes');
    url.searchParams.set('cta', link.dataset.academyCta || 'metodo-mes-landing');
    let hasCampaign = false;
    attributionKeys.forEach(key => {
      const value = params.get(key);
      if (value) {
        url.searchParams.set(key,value);
        if (key === 'utm_campaign') hasCampaign = true;
      }
    });
    if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source','yamilet-site');
    if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium','website');
    if (!hasCampaign) url.searchParams.set('utm_campaign','metodo-mes-landing');
    link.href = url.toString();
  });

  const header = document.querySelector('[data-header]');
  const mobile = document.querySelector('[data-mobile-cta]');
  const updateChrome = () => {
    header?.classList.toggle('scrolled', scrollY > 24);
    mobile?.classList.toggle('show', scrollY > innerHeight * .72);
  };
  updateChrome();
  addEventListener('scroll', updateChrome, {passive:true});

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:.12, rootMargin:'0px 0px -40px'}) : null;

  document.querySelectorAll('.reveal').forEach(el => {
    if (io) io.observe(el);
    else el.classList.add('visible');
  });
})();