(()=>{'use strict';
const TOTAL_BYTES=10*1024*1024*1024;
const TOTAL_LABEL='10 GB';
function formatBytes(bytes){const n=Number(bytes)||0;if(n<1024)return `${n} B`;if(n<1024**2)return `${(n/1024).toFixed(1)} KB`;if(n<1024**3)return `${(n/1024**2).toFixed(1)} MB`;if(n<1024**4)return `${(n/1024**3).toFixed(2)} GB`;return `${(n/1024**4).toFixed(2)} TB`}
function updateStatic(){document.querySelectorAll('.storage-number').forEach(el=>{if(!el.dataset.liveStorage&&!el.dataset.baseStorage)el.dataset.baseStorage=el.textContent.trim().replace(/\s*\/\s*10\s*GB$/i,'').trim();if(!el.dataset.liveStorage){const used=el.dataset.baseStorage||'0 B';el.textContent=`${used} / ${TOTAL_LABEL}`}})}
async function loadLive(){try{const r=await fetch('/api/backblaze',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({action:'storage-stats'})});const data=await r.json();if(!r.ok||!data.ok)return;const used=Number(data.usedBytes)||0;const free=Math.max(TOTAL_BYTES-used,0);document.querySelectorAll('.storage-number').forEach(el=>{el.dataset.liveStorage='1';el.textContent=`${formatBytes(used)} / ${TOTAL_LABEL}`});document.querySelectorAll('.storage-meta').forEach(el=>{el.dataset.quotaLabel='1';el.textContent=`${data.fileCount||0} files · ${formatBytes(free)} free · live Backblaze usage`});document.querySelectorAll('[data-storage-free]').forEach(el=>el.textContent=formatBytes(free));document.querySelectorAll('[data-storage-used]').forEach(el=>el.textContent=formatBytes(used));document.querySelectorAll('[data-storage-total]').forEach(el=>el.textContent=TOTAL_LABEL)}catch(e){/* keep existing UI if live stats are temporarily unavailable */}}
function update(){updateStatic();loadLive()}
new MutationObserver(updateStatic).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
update();setTimeout(loadLive,1200);setInterval(loadLive,60000);
})();
