(()=>{'use strict';
const B='/ovesh/college';
let refreshing=false;
function isCollege(){return location.pathname===B||location.pathname.startsWith(B+'/');}
function v2Ready(){return window.OVESH_COLLEGE_V2&&typeof window.OVESH_COLLEGE_V2.refresh==='function';}
function refresh(){if(!isCollege()||!v2Ready()||refreshing)return;const page=document.getElementById('page');if(!page)return;if(page.querySelector('.cv2'))return;refreshing=true;Promise.resolve(window.OVESH_COLLEGE_V2.refresh()).finally(()=>{refreshing=false})}
function boot(){
  if(!document.getElementById('page'))return setTimeout(boot,50);
  document.addEventListener('click',e=>{
    const nav=e.target.closest('#nav [data-page="college"]');
    if(!nav)return;
    e.preventDefault();e.stopImmediatePropagation();
    history.pushState({},'',B);
    const title=document.getElementById('pageTitle');if(title)title.textContent='College';
    refresh();
    setTimeout(refresh,100);setTimeout(refresh,500);
  },true);
  const page=document.getElementById('page');
  new MutationObserver(()=>{if(isCollege())refresh()}).observe(page,{childList:true,subtree:true});
  window.addEventListener('popstate',()=>{if(isCollege()){setTimeout(refresh,0);setTimeout(refresh,300)}});
  setInterval(()=>{if(isCollege())refresh()},1000);
  if(isCollege())refresh();
}
if(v2Ready())boot();else{let n=0,t=setInterval(()=>{if(v2Ready()||++n>100){clearInterval(t);if(v2Ready())boot()}},50)}
})();