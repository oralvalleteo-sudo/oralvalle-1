/* Oral Valle 055 — cadastro de notificações Web Push (chave pública VAPID). */
(function () {
  'use strict';
  // Substitua APENAS pelo valor Public Key gerado no seu computador.
  const VAPID_PUBLIC_KEY = 'BD-S_MitPiKJLbbsv2BlZnq7Ko9QOchv9SBluTG29CLGv8G2tMf9N7zH3RXKM--ul1urnTOGUfDuXWbcrB5TjSE';
  function keyBytes(base64url) {
    const padded = (base64url + '='.repeat((4 - base64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  }
  async function activatePush() {
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Este aparelho não oferece suporte a Web Push neste modo.');
    }
    if (VAPID_PUBLIC_KEY.startsWith('COLE_AQUI')) throw new Error('Configure primeiro a chave pública VAPID.');
    if (!window.OralCloud?.session?.access_token || !window.OralCloud?.clinicId) {
      throw new Error('Entre na clínica antes de ativar as notificações Push.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permissão de notificações não concedida.');
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID_PUBLIC_KEY)
      });
    }
    const response = await fetch(window.OralCloud.config.url + '/functions/v1/oralvalle-push-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.OralCloud.config.publishableKey,
        'Authorization': 'Bearer ' + window.OralCloud.session.access_token
      },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Não foi possível registrar este aparelho.');
    return result;
  }
  document.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-act="pushactivate"]');
    if (!button) return;
    event.preventDefault();
    button.disabled = true;
    try {
      await activatePush();
      alert('Notificações Push cadastradas neste aparelho!');
    } catch (error) {
      alert('Não foi possível ativar Push: ' + error.message);
    } finally { button.disabled = false; }
  }, true);
  window.OralVallePush = { activatePush };
})();
