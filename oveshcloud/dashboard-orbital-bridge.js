/* OV CLOUD — keep the signature orbital canvas on the login screen only.
   The authenticated dashboard intentionally uses its clean previous background.
   Do not move the canvas into .main; authentication and application behavior stay untouched.
*/
(function(){
  'use strict';
  const canvasStage=document.getElementById('orbital-canvas-container');
  const brandStage=document.querySelector('#loginView .brand-stage');
  if(!canvasStage||!brandStage)return;
  if(canvasStage.parentElement!==brandStage){
    brandStage.appendChild(canvasStage);
    canvasStage.classList.remove('dashboard-orbital-stage');
  }
})();
