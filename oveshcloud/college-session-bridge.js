/* OVESH CLOUD — College session bridge
 * College is a child workspace of the authenticated Cloud app.
 * It must re-render as soon as the shared Firebase auth session becomes available.
 */
(function(){
  'use strict';
  function boot(){
    if(!window.firebase || !firebase.auth) return setTimeout(boot,250);
    firebase.auth().onAuthStateChanged(function(user){
      window.OVESH_COLLEGE_USER = user || null;
      if(user && typeof window.renderCollegeLive === 'function') {
        try { window.renderCollegeLive(); } catch(e) { console.error('College session refresh failed',e); }
      }
    });
  }
  boot();
})();
