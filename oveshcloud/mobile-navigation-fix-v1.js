(()=>{'use strict';
const ready=()=>{
  const app=document.querySelector('#appView');
  const top=document.querySelector('.topbar');
  const nav=document.querySelector('#nav');
  const side=document.querySelector('.sidebar');
  if(!app||!top||!nav||!side)return false;
  if(!document.getElementById('mobileNavBtn')){
    const b=document.createElement('button');
    b.id='mobileNavBtn'; b.type='button'; b.className='mobile-nav-btn'; b.setAttribute('aria-label','Open navigation'); b.setAttribute('aria-expanded','false'); b.innerHTML='☰';
    top.prepend(b);
    const close=()=>{app.classList.remove('mobile-nav-open');b.setAttribute('aria-expanded','false');};
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const open=app.classList.toggle('mobile-nav-open');b.setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',e=>{if(!app.classList.contains('mobile-nav-open'))return;if(e.target.closest('.sidebar')||e.target.closest('#mobileNavBtn'))return;close()},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    nav.addEventListener('click',e=>{if(e.target.closest('button'))close()});
    new MutationObserver(()=>{if(document.querySelector('#nav button.active')){}}).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  }
  return true;
};
if(!ready()){const mo=new MutationObserver(()=>{if(ready())mo.disconnect()});mo.observe(document.body,{childList:true,subtree:true})}
})();