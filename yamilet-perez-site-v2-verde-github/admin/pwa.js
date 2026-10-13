(() => {
  'use strict';

  const BUILD = '4';
  const PUBLIC_VAPID_KEY = 'BMpalGhIpd9AipWKCNaHn8mMQjz1bdW-PF8q_NVUaRknw70fCid9yliJ5t4dFe6t8epibGWM6_tJkPn5M73Tw_o';
  const PUSH_ENDPOINT = 'https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/yamilet-push-send';
  const $ = s => document.querySelector(s);
  let deferredInstallPrompt = null;
  let context = window.YAMILET_ADMIN_CONTEXT || null;
  let toastTimer = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function base64ToUint8Array(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  function showToast(message, error = false) {
    const el = $('[data-pwa-toast]');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 4300);
  }

  function setStatus(message) {
    const el = $('[data-pwa-status]');
    if (el) el.textContent = message;
  }

  function installButton() {
    return $('[data-install-app]');
  }

  function pushButton() {
    return $('[data-enable-push]');
  }

  function updateInstallUI() {
    const btn = installButton();
    if (!btn) return;
    if (isStandalone()) {
      btn.hidden = false;
      btn.disabled = true;
      btn.textContent = '✓ App instalada';
      return;
    }
    if (deferredInstallPrompt || isIOS()) {
      btn.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Instalar Yamilet Admin';
    } else {
      btn.hidden = true;
    }
  }

  async function getRegistration() {
    if (!('serviceWorker' in navigator)) throw new Error('service_worker_unsupported');
    return navigator.serviceWorker.ready;
  }

  async function currentSubscription() {
    try {
      const registration = await getRegistration();
      return await registration.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  async function updatePushUI() {
    const btn = pushButton();
    if (!btn) return;

    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
      btn.disabled = true;
      btn.textContent = 'Push no compatible';
      setStatus('Este navegador no permite notificaciones push para esta app.');
      return;
    }

    if (Notification.permission === 'denied') {
      btn.disabled = true;
      btn.textContent = 'Notificaciones bloqueadas';
      setStatus('Activa las notificaciones desde los permisos del navegador o de la app.');
      return;
    }

    const sub = await currentSubscription();
    if (sub) {
      btn.disabled = false;
      btn.dataset.active = 'true';
      btn.textContent = '✓ Notificaciones activas';
      setStatus('Recibirás avisos de nuevos registros y nuevas citas, incluso con la app cerrada.');
    } else {
      btn.disabled = false;
      btn.dataset.active = 'false';
      btn.textContent = 'Activar notificaciones';
      if (isIOS() && !isStandalone()) {
        setStatus('En iPhone/iPad primero instala Yamilet Admin en la pantalla de inicio y ábrela desde ahí.');
      } else {
        setStatus('Actívalas para recibir nuevos registros y solicitudes de cita.');
      }
    }
  }

  async function saveSubscription(subscription) {
    context = window.YAMILET_ADMIN_CONTEXT || context;
    if (!context?.sb || !context?.workspace?.id || !context?.user?.id) throw new Error('admin_context_missing');

    const json = subscription.toJSON();
    const row = {
      workspace_id: context.workspace.id,
      user_id: context.user.id,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
      user_agent: navigator.userAgent.slice(0, 500),
      device_label: [navigator.platform || '', isStandalone() ? 'App instalada' : 'Navegador'].filter(Boolean).join(' · ').slice(0, 160),
      enabled: true,
      updated_at: new Date().toISOString(),
      last_error: null
    };

    const { error } = await context.sb
      .from('yamilet_push_subscriptions')
      .upsert(row, { onConflict:'endpoint' });

    if (error) throw error;
  }

  async function sendTestPush() {
    context = window.YAMILET_ADMIN_CONTEXT || context;
    if (!context?.sb || !context?.user?.id) return;
    const { data:{ session } } = await context.sb.auth.getSession();
    if (!session?.access_token) return;

    const response = await fetch(PUSH_ENDPOINT, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + session.access_token
      },
      body:JSON.stringify({
        user_id:context.user.id,
        title:'Yamilet Admin está listo ✨',
        body:'Las notificaciones ya están activas en este dispositivo.',
        url:'/admin/#dashboard',
        tag:'yamilet-push-welcome'
      })
    });
    if (!response.ok) throw new Error('test_push_failed');
  }

  async function enablePush() {
    if (isIOS() && !isStandalone()) {
      showToast('En iPhone/iPad: instala primero la app con Compartir → Agregar a pantalla de inicio.', true);
      return;
    }

    const btn = pushButton();
    if (btn?.dataset.active === 'true') {
      showToast('Las notificaciones ya están activas en este dispositivo.');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Activando…';
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await updatePushUI();
        showToast('No se concedió permiso para notificaciones.', true);
        return;
      }

      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:base64ToUint8Array(PUBLIC_VAPID_KEY)
        });
      }

      await saveSubscription(subscription);
      await sendTestPush();
      await updatePushUI();
      showToast('Notificaciones activadas. Enviaremos una prueba a este dispositivo.');
    } catch (error) {
      console.error('Yamilet Admin push', error);
      await updatePushUI();
      showToast('No fue posible activar las notificaciones en este dispositivo.', true);
    }
  }

  async function installApp() {
    if (isStandalone()) return;

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      updateInstallUI();
      if (choice?.outcome === 'accepted') showToast('Instalación iniciada. Yamilet Admin aparecerá como una app.');
      return;
    }

    if (isIOS()) {
      showToast('En Safari toca Compartir y después “Agregar a pantalla de inicio”.');
      return;
    }

    showToast('Abre el menú del navegador y elige “Instalar app” o “Agregar a pantalla de inicio”.');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
    navigator.serviceWorker
      .register('./sw.js?build=' + encodeURIComponent(BUILD), { scope:'./', updateViaCache:'none' })
      .then(registration => registration.update().catch(() => null))
      .catch(error => console.warn('Yamilet Admin PWA', error));
  }

  document.addEventListener('yamilet-admin-ready', () => {
    context = window.YAMILET_ADMIN_CONTEXT || context;
    updatePushUI();
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallUI();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallUI();
    showToast('Yamilet Admin quedó instalada correctamente.');
  });

  window.addEventListener('online', () => showToast('Conexión restablecida.'));
  window.addEventListener('offline', () => showToast('Sin conexión. Los datos privados requieren internet.', true));

  document.addEventListener('DOMContentLoaded', () => {
    $('[data-install-app]')?.addEventListener('click', installApp);
    $('[data-enable-push]')?.addEventListener('click', enablePush);
    updateInstallUI();
    updatePushUI();
  }, { once:true });

  registerServiceWorker();
})();
