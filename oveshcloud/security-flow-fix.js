/* OVESH CLOUD™ — Security flow recovery fix
 * Loaded after app.js. Keeps the existing security UX but prevents
 * optional telemetry/network work from blocking the post-login transition.
 */
(function () {
  'use strict';

  // Compatibility fix: app.js uses AbortSignal.timeout() for optional
  // IP-location telemetry. Older Safari/WebViews do not provide it, and
  // that missing API can throw synchronously before the countdown is started.
  // Define the standard API before the user reaches the security screen.
  if (typeof window.AbortSignal !== 'undefined' && typeof window.AbortSignal.timeout !== 'function') {
    window.AbortSignal.timeout = function (milliseconds) {
      var controller = new AbortController();
      setTimeout(function () { controller.abort(); }, Math.max(0, Number(milliseconds) || 0));
      return controller.signal;
    };
  }

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

  // Independent fallback: if the normal countdown is ever interrupted by a
  // browser/API failure, recover from the visible security overlay without
  // changing the intended security UX or login flow.
  document.addEventListener('DOMContentLoaded', function () {
    var security = get('securityView');
    var continueBtn = get('continueBtn');
    if (!security || !continueBtn) return;

    continueBtn.__oveshRecoveryBound = true;
    continueBtn.addEventListener('click', function () {
      setTimeout(function () {
        if (!security.classList.contains('hidden')) openAppSafely();
      }, 0);
    }, true);

    var observer = new MutationObserver(function () {
      if (security.classList.contains('hidden')) return;
      if (security.__oveshRecoveryTimer) return;
      security.__oveshRecoveryTimer = setTimeout(function () {
        security.__oveshRecoveryTimer = null;
        if (!security.classList.contains('hidden')) openAppSafely();
      }, 2500);
    });
    observer.observe(security, { attributes: true, attributeFilter: ['class'] });
  });
})();
