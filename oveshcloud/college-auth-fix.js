/* OVESH CLOUD — College auth bridge
 * College is a workspace inside the already-authenticated Cloud session.
 * Never create a second login/session for College.
 */
(function () {
  'use strict';
  window.OVESH_COLLEGE_AUTH = {
    isReady: function () {
      return !!(window.firebase && window.firebase.auth && window.firebase.auth().currentUser);
    },
    wait: function (callback) {
      if (typeof callback !== 'function') return;
      if (!window.firebase || !window.firebase.auth) { callback(null); return; }
      var auth = window.firebase.auth();
      var user = auth.currentUser;
      if (user) { callback(user); return; }
      var unsubscribe = auth.onAuthStateChanged(function (nextUser) {
        unsubscribe();
        callback(nextUser || null);
      });
    }
  };

  // Remove the old blocking "secure session" gate if a legacy College runtime injected it.
  function removeLegacyGate() {
    var nodes = document.querySelectorAll('[data-college-auth-gate], #college-auth-gate, .college-auth-gate');
    nodes.forEach(function (node) { node.remove(); });
  }
  removeLegacyGate();
  new MutationObserver(removeLegacyGate).observe(document.documentElement, { childList: true, subtree: true });
})();
