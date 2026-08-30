(()=>{'use strict';
const V2='/oveshcloud/college-workspace-v2.js?v=2.2.0';
function loadV2(){if(window.OVESH_COLLEGE_V2)return;const s=document.createElement('script');s.src=V2;s.async=false;document.head.appendChild(s)}
function install(){
 if(!window.OVESH_COLLEGE_V2){setTimeout(install,30);return}
 if(window.__OVESH_COLLEGE_BRIDGE__)return;window.__OVESH_COLLEGE_BRIDGE__=true;
 const legacy=window.render;
 window.render=function(page){
   if(page==='college'){
     if(typeof window.OVESH_COLLEGE_V2.refresh==='function') window.OVESH_COLLEGE_V2.refresh();
     else if(typeof legacy==='function') legacy.call(this,page);
     return;
   }
   return typeof legacy==='function'?legacy.apply(this,arguments):undefined;
 };
 const p=document.getElementById('page');
 if(p && (location.pathname==='/ovesh/college'||location.pathname.startsWith('/ovesh/college/')) && typeof window.OVESH_COLLEGE_V2.refresh==='function') window.OVESH_COLLEGE_V2.refresh();
}
loadV2();install();
})();