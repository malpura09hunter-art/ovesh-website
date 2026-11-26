/* OV CLOUD — reuse the existing signature orbital O on login and dashboard.
   Move the same canvas between views; do not create a second renderer.
   Visual-only: authentication, APIs, storage, database and navigation are untouched.
*/
(function(){
  'use strict';
  const canvasStage=document.getElementById('orbital-canvas-container');
  const brandStage=document.querySelector('#loginView .brand-stage');
  const appView=document.getElementById('appView');
  const main=document.querySelector('#appView .main');
  if(!canvasStage||!brandStage||!appView||!main)return;

  function syncOrbitalStage(){
    const dashboardActive=!appView.classList.contains('hidden');
    if(dashboardActive){
      if(canvasStage.parentElement!==main) main.appendChild(canvasStage);
      canvasStage.classList.add('dashboard-orbital-stage');
    }else{
      if(canvasStage.parentElement!==brandStage) brandStage.appendChild(canvasStage);
      canvasStage.classList.remove('dashboard-orbital-stage');
    }
    // Recalculate the existing renderer after its host changes size.
    window.dispatchEvent(new Event('resize'));
  }

  syncOrbitalStage();
  const observer=new MutationObserver(syncOrbitalStage);
  observer.observe(appView,{attributes:true,attributeFilter:['class']});
})();
