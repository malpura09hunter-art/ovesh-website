(()=>{'use strict';
function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.remove('hidden');clearTimeout(window.__ovCloudActionToast);window.__ovCloudActionToast=setTimeout(()=>el.classList.add('hidden'),4000)}
window.addEventListener('click',async e=>{
 const target=e.target;
 if(!target||typeof target.closest!=='function')return;
 const view=target.closest('[data-b2-preview]');
 const download=target.closest('[data-b2-download]');
 const share=target.closest('[data-ov-share]');
 if(!view&&!download&&!share)return;
 e.preventDefault();
 e.stopImmediatePropagation();
 try{
  if(view){
   const actions=window.OVESH_B2_ACTIONS;
   if(typeof actions?.preview!=='function')throw new Error('File preview is still loading. Refresh OVESH CLOUD and try again.');
   await actions.preview(view.getAttribute('data-b2-preview'));
  }else if(download){
   const actions=window.OVESH_B2_ACTIONS;
   if(typeof actions?.download!=='function')throw new Error('File download is still loading. Refresh OVESH CLOUD and try again.');
   await actions.download(download.getAttribute('data-b2-download'));
  }else{
   const sharing=window.OVESH_SHARE;
   if(typeof sharing?.share!=='function')throw new Error('Secure sharing is still loading. Refresh OVESH CLOUD and try again.');
   await sharing.share(share.getAttribute('data-ov-share'));
  }
 }catch(err){console.error('[OVESH CLOUD] File action failed:',err);toast(err?.message||'The file action failed. Please try again.')}
},true);
})();