/* OVESH CLOUD™ — Security flow recovery fix
 * Loaded after app.js. Keeps the existing security UX but prevents
 * optional telemetry/network work from blocking the post-login transition.
 */
(function () {
  'use strict';

  function get(id) { return document.getElementById(id); }

  function openAppSafely() {
    var security = get('securityView');
    var app = get('appView');
    if (!app) return;
    if (security) security.classList.add('hidden');
    app.classList.remove('hidden');
    document.body.classList.remove('security-active');
  }

  // If the existing app exposes openApp, wrap it so an exception in optional
  // security telemetry cannot leave the user trapped on the security overlay.
  if (typeof window.openApp === 'function' && !window.__oveshSecurityWrapped) {
    var originalOpenApp = window.openApp;
    window.openApp = function () {
      try { return originalOpenApp.apply(this, arguments); }
      catch (error) {
        console.error('[OVESH SECURITY] App transition failed:', error);
        openAppSafely();
      }
    };
    window.__oveshSecurityWrapped = true;
  }

  // Safety recovery: if the security overlay is visible after authentication
  // and the normal continuation handler has failed, expose the existing
  // Continue control rather than leaving a dead-end overlay.
  document.addEventListener('DOMContentLoaded', function () {
    var security = get('securityView');
    var continueBtn = get('continueBtn');
    if (!security || !continueBtn || continueBtn.__oveshRecoveryBound) return;

    continueBtn.__oveshRecoveryBound = true;
    continueBtn.addEventListener('click', function () {
      setTimeout(function () {
        if (!security.classList.contains('hidden')) {
          openAppSafely();
        }
      }, 0);
    }, true);
  });
})();
