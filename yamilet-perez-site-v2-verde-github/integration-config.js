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
    enabled: true,
    mode: "supabase-rpc"
  }
};

(function yamiletLeadAttribution(){
  'use strict';

  const CONFIG_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/academy-public-config';
  const COMPAS_TRACKER_URL = 'https://app.proyectocompas.com/compas-attribution.js';
  const COMPAS_PUBLIC_KEY = 'wc_94eeb529d09ab712b4961646af31d03e4d1b';
  const cfg = window.YAMILET_INTEGRATION_CONFIG || {};
  const nativeFetch = window.fetch.bind(window);
  const isItalian = document.documentElement.lang === 'it';
  const ATTRIBUTION_KEYS = [
    'utm_source','utm_medium','utm_campaign','utm_content','utm_term',
    'gclid','gbraid','wbraid','fbclid','msclkid'
  ];

  function ensureCompasTracker(){
    if (window.CompasTracking?.__initialized) return;
    if (document.querySelector('script[data-yamilet-compas-attribution]')) return;
    const script = document.createElement('script');
    script.src = COMPAS_TRACKER_URL;
    script.async = true;
    script.dataset.key = COMPAS_PUBLIC_KEY;
    script.dataset.product = 'yamilet-metodo-mes';
    script.dataset.funnel = 'yamilet-site';
    script.dataset.yamiletCompasAttribution = 'true';
    document.head.appendChild(script);
  }

  ensureCompasTracker();

  function currentAttribution(defaultCampaign = '', defaultContent = '') {
    const params = new URLSearchParams(window.location.search);
    const trackerTouch = window.CompasTracking?.getAttribution?.()?.lastTouch || {};
    const value = {};

    ATTRIBUTION_KEYS.forEach(key => {
      value[key] = String(params.get(key) || trackerTouch[key] || '').slice(0,500);
    });

    if (!value.utm_source) {
      if (value.gclid || value.gbraid || value.wbraid) value.utm_source = 'google';
      else if (value.fbclid) value.utm_source = 'meta';
      else if (value.msclkid) value.utm_source = 'bing';
      else value.utm_source = 'yamilet-site';
    }

    if (!value.utm_medium) {
      value.utm_medium = value.gclid || value.gbraid || value.wbraid || value.fbclid || value.msclkid
        ? 'cpc'
        : 'website';
    }

    if (!value.utm_campaign && defaultCampaign) value.utm_campaign = defaultCampaign;
    if (!value.utm_content && defaultContent) value.utm_content = defaultContent;
    return value;
  }

  function academyUrl({register = false, cta = 'academy-link'} = {}) {
    const url = new URL('../academia/', window.location.href);
    const a = currentAttribution(register ? 'academy-registration' : 'academy-login', cta);
    ATTRIBUTION_KEYS.forEach(key => { if (a[key]) url.searchParams.set(key, a[key]); });
    url.searchParams.set('cta', cta);
    if (register) url.searchParams.set('register','1');
    return url.href;
  }

  function catalogUrl(cta = 'academy-catalog') {
    const url = new URL('../academia/catalogo.html', window.location.href);
    const a = currentAttribution('academy-catalog', cta);
    ATTRIBUTION_KEYS.forEach(key => { if (a[key]) url.searchParams.set(key, a[key]); });
    return url.href;
  }

  function bindLink(link, url) {
    if (!link) return;
    link.href = url;
    link.classList.remove('is-disabled');
    link.removeAttribute('aria-disabled');
    link.removeAttribute('title');
    if (link.dataset.yamiletTrackingBound === 'true') return;
    link.dataset.yamiletTrackingBound = 'true';
    link.addEventListener('click', event => {
      event.preventDefault();
      window.location.assign(link.href);
    });
  }

  function applyAcademyLinks() {
    document.querySelectorAll('[data-academy-link]').forEach((link,index) => {
      const cta = link.dataset.academyCta || (index === 0 ? 'nav-academy-login' : 'academy-card-login');
      bindLink(link, academyUrl({register:false,cta}));
    });

    const courseCta = document.querySelector('#academia .course-copy a.btn');
    if (courseCta) {
      courseCta.textContent = isItalian ? 'Registrarmi in Accademia' : 'Crear mi cuenta en la Academia';
      bindLink(courseCta, academyUrl({register:true,cta:'metodo-mes-course'}));
    }

    const courseExplore = document.querySelector('#academia .academy-card:first-of-type a');
    if (courseExplore) bindLink(courseExplore, catalogUrl('academy-courses-card'));
  }

  // Añade UTMs + click IDs al payload que app.js envía a book-free-class.
  window.fetch = function yamiletTrackedFetch(input, init = {}) {
    let trackedBooking = false;
    try {
      const target = typeof input === 'string' ? input : input?.url || '';
      if (cfg.booking?.endpoint && target === cfg.booking.endpoint && String(init.method || 'GET').toUpperCase() === 'POST' && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        const a = currentAttribution('free-class','booking-form');
        init = {...init, body:JSON.stringify({...body,...a})};
        trackedBooking = true;
      }
    } catch (_) {}

    return nativeFetch(input, init).then(response => {
      if (trackedBooking && response.ok) {
        window.CompasTracking?.track?.('lead_created', {
          metadata: {
            lead_type: 'free_class_booking',
            locale: isItalian ? 'it' : 'es'
          }
        });
      }
      return response;
    });
  };

  async function captureNewsletter(form) {
    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');
    const note = form.parentElement?.querySelector('.form-note');
    const email = String(input?.value || '').trim().toLowerCase();
    if (!email) return;

    if (button) button.disabled = true;
    if (note) note.textContent = isItalian ? 'Registrazione in corso…' : 'Registrando tu correo…';

    try {
      const configResponse = await nativeFetch(CONFIG_ENDPOINT,{headers:{Accept:'application/json'},cache:'no-store'});
      if (!configResponse.ok) throw new Error('config_unavailable');
      const publicConfig = await configResponse.json();
      const a = currentAttribution('newsletter','contact-section');
      const response = await nativeFetch(`${publicConfig.url}/rest/v1/rpc/capture_yamilet_public_lead`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':publicConfig.anonKey,
          'Authorization':`Bearer ${publicConfig.anonKey}`
        },
        body:JSON.stringify({
          target_email:email,
          target_locale:isItalian ? 'it' : 'es',
          target_source:'yamilet-landing-newsletter',
          target_page_url:window.location.href,
          target_utm_source:a.utm_source,
          target_utm_medium:a.utm_medium,
          target_utm_campaign:a.utm_campaign,
          target_utm_content:a.utm_content,
          target_utm_term:a.utm_term
        })
      });
      if (!response.ok) throw new Error('capture_failed');
      window.CompasTracking?.track?.('lead_created', {
        metadata: {
          lead_type: 'newsletter',
          locale: isItalian ? 'it' : 'es'
        }
      });
      form.reset();
      if (note) note.textContent = isItalian ? 'Grazie. La tua registrazione è stata ricevuta.' : 'Gracias. Tu registro fue recibido correctamente.';
    } catch (error) {
      console.warn('Yamilet lead capture', error);
      if (note) note.textContent = isItalian ? 'Non è stato possibile registrarti. Riprova tra poco.' : 'No fue posible registrar tu correo. Intenta nuevamente.';
    } finally {
      if (button) button.disabled = false;
    }
  }

  // Captura antes del listener heredado de app.js para evitar dobles envíos/alertas.
  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-newsletter]');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    captureNewsletter(form);
  }, true);

  applyAcademyLinks();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAcademyLinks, {once:true});
})();
