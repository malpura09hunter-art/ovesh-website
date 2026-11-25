/* OV CLOUD — move the existing signature orbital canvas into the authenticated dashboard.
   Reuses the same renderer; no second WebGL context or duplicate animation loop.
*/
(function(){
  'use strict';
  const app=document.getElementById('appView');
  const canvasStage=document.getElementById('orbital-canvas-container');
  const main=document.querySelector('#appView .main');
  if(!app||!canvasStage||!main)return;

  function syncDashboardOrbital(){
    const authenticatedViewVisible=!app.classList.contains('hidden');
    if(!authenticatedViewVisible)return;
    if(canvasStage.parentElement!==main){
      canvasStage.classList.add('dashboard-orbital-stage');
      main.insertBefore(canvasStage,main.firstChild);
      requestAnimationFrame(function(){
        window.dispatchEvent(new Event('resize'));
      });
    }
  }

  const observer=new MutationObserver(syncDashboardOrbital);
  observer.observe(app,{attributes:true,attributeFilter:['class']});
  syncDashboardOrbital();
})();
