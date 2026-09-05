(()=>{'use strict';
function wakeCollege(){const b=document.querySelector('#nav button[data-page="college"]');if(!b)return;b.classList.add('active');const page=document.querySelector('#page');if(page){const n=document.createComment('college-router-wakeup');page.appendChild(n);n.remove()}}
function install(){const nav=document.querySelector('#nav');if(!nav||nav.dataset.collegeNavFix)return;nav.dataset.collegeNavFix='1';nav.addEventListener('click',e=>{const b=e.target.closest('button[data-page="college"]');if(!b)return;setTimeout(wakeCollege,30);setTimeout(wakeCollege,150);setTimeout(wakeCollege,500)},false)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
})();
