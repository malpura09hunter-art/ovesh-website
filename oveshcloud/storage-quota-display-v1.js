(()=>{'use strict';
const TOTAL='10 GB';
function update(){
  document.querySelectorAll('.storage-number').forEach(el=>{
    const raw=el.dataset.baseStorage||el.textContent.trim();
    if(!el.dataset.baseStorage)el.dataset.baseStorage=raw.replace(/\s*\/\s*10\s*GB$/i,'').trim();
    const used=el.dataset.baseStorage||'0 B';
    if(el.textContent.trim()!==`${used} / ${TOTAL}`)el.textContent=`${used} / ${TOTAL}`;
  });
  document.querySelectorAll('.storage-meta').forEach(el=>{
    if(!el.dataset.quotaLabel && /indexed file data|indexed files/i.test(el.textContent)){
      el.dataset.quotaLabel='1';
      el.textContent=`${el.textContent.trim()} · ${TOTAL} total quota`;
    }
  });
}
new MutationObserver(update).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
update();
})();
