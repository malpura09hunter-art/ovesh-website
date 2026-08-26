/* Ovesh Cloud command-center authority guard.
   The previous elite layer replaced the logged-in home view after the command-center renderer ran.
   It is intentionally disabled so command-home.js is the single visual authority for the post-login home screen.
*/
(function () {
  'use strict';
  window.OVESH_CLOUD_ELITE_DISABLED = true;
})();
