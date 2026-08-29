/* OVESH CLOUD — College session bridge */
(function(){
  'use strict';
  function boot(){
    if(!window.firebase || !firebase.auth) return setTimeout(boot,250);
    firebase.auth().onAuthStateChanged(function(user){
      window.OVESH_COLLEGE_USER=user||null;
      if(user){
        // college-live.js owns the renderer inside a closure; re-trigger its existing nav handler.
        var btn=document.querySelector('#nav [data-page="college"]');
        if(btn){ btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); }
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
