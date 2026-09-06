(()=>{
'use strict';
function openWorkplaceDirect(){
  const welcome=document.getElementById('welcomeView');
  const security=document.getElementById('securityView');
  const login=document.getElementById('loginView');
  const app=document.getElementById('appView');
  if(welcome)welcome.classList.add('hidden');
  if(security)security.classList.add('hidden');
  if(login)login.classList.add('hidden');
  if(app){
    app.classList.remove('hidden');
    app.removeAttribute('hidden');
    app.style.display='flex';
  }
  const command=document.querySelector('#nav button[data-page="command"]');
  if(command){
    try{command.click()}catch{}
  }
  window.dispatchEvent(new CustomEvent('ovesh:workplace-open'));
}
function bind(){
  const enter=document.getElementById('enterBtn');
  if(!enter)return;
  enter.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openWorkplaceDirect();
  },true);
  enter.onclick=e=>{
    e.preventDefault();
    openWorkplaceDirect();
    return false;
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
