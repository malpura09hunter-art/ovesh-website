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
  }

  // Defense-in-depth fallback: openApp() itself (in app.js) now hides
  // #securityView directly, which is the real fix for the stuck-overlay bug.
  // This listener/observer pair stays only as a safety net in case a future
  // change to the transition path regresses it again — it does nothing when
  // the overlay is already hidden.
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
