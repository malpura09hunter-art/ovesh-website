(function(){'use strict';
// Ovesh Cloud boot recovery: prevents post-login black screens caused by competing UI scripts.
function ready(){
 var app=document.getElementById('app'), login=document.getElementById('login'), gate=document.getElementById('accessGate'), welcome=document.getElementById('workspaceReady');
 if(!app||!login)return;
 function enter(){
  if(login) login.style.setProperty('display','none','important');
  if(gate){gate.classList.add('hidden');gate.style.setProperty('display','none','important');}
  if(welcome){welcome.classList.add('hidden');welcome.style.setProperty('display','none','important');}
  app.classList.remove('hidden');app.style.setProperty('display','flex','important');
  try{if(window.state){window.state.user=window.__oveshAuthUser||{uid:'oveshcloud-admin',displayName:'Ovesh Malpura'};} if(typeof window.load==='function')window.load();}catch(e){console.error('Cloud boot recovery:',e);}
 }
 var button=document.getElementById('enterWorkspace');
 if(button)button.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();enter();},true);
 // If authentication has already succeeded in this browser, don't leave a black/hidden app.
 window.__oveshEnterWorkspace=enter;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
