(()=>{'use strict';
function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.remove('hidden');clearTimeout(window.__ovCloudActionToast);window.__ovCloudActionToast=setTimeout(()=>el.classList.add('hidden'),4000)}
window.addEventListener('click',async e=>{
 const target=e.target;
 if(!target||typeof target.closest!=='function')return;
 const view=target.closest('[data-b2-preview]');
 const download=target.closest('[data-b2-download]');
 const share=target.closest('[data-ov-share]');
 if(!view&&!download&&!share)return;
 // The file-manager and share modules already own these clicks at document level.
 // Let those handlers run when available; intercept only as a fallback if a module failed to load.
 const actions=window.OVESH_B2_ACTIONS;
 const sharing=window.OVESH_SHARE;
 if((view&&typeof actions?.preview==='function')||
    (download&&typeof actions?.download==='function')||
    (share&&typeof sharing?.share==='function'))return;
 e.preventDefault();
 e.stopImmediatePropagation();
 const button=view||download||share;
 try{
  if(view&&typeof actions?.preview==='function')await actions.preview(button.getAttribute('data-b2-preview'));
  else if(download&&typeof actions?.download==='function')await actions.download(button.getAttribute('data-b2-download'));
  else if(share&&typeof sharing?.share==='function')await sharing.share(button.getAttribute('data-ov-share'));
  else throw new Error(view?'Preview module did not load.':download?'Download module did not load.':'Share module did not load. Refresh OVESH CLOUD and try again.');
 }catch(err){console.error('[OVESH CLOUD] File action failed:',err);toast(err?.message||'The file action failed. Please try again.')}
},true);
})();