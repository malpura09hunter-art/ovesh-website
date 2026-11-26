(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastState='',lastAnnouncement='';
function styles(){if($('#ovUploadExperienceStyles'))return;const s=document.createElement('style');s.id='ovUploadExperienceStyles';s.textContent=`
#ovUploadExperience{margin:14px 0 0;padding:16px 17px;border:1px solid rgba(104,190,225,.2);border-radius:16px;background:linear-gradient(145deg,rgba(11,28,48,.88),rgba(7,16,29,.82));box-shadow:0 14px 40px rgba(0,0,0,.18);color:#eaf6ff;transition:border-color .25s,background .25s}
#ovUploadExperience .ov-ue-top{display:flex;align-items:center;gap:12px}
#ovUploadExperience .ov-ue-icon{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;border-radius:12px;background:rgba(70,194,222,.12);border:1px solid rgba(90,208,232,.22);color:#8deaff;font-size:19px}
#ovUploadExperience .ov-ue-copy{min-width:0;flex:1}
#ovUploadExperience .ov-ue-title{font-size:13px;font-weight:700;letter-spacing:.01em}
#ovUploadExperience .ov-ue-detail{margin-top:4px;font-size:11px;line-height:1.5;color:rgba(225,240,255,.62);overflow-wrap:anywhere}
#ovUploadExperience .ov-ue-percent{font-size:13px;font-variant-numeric:tabular-nums;color:#b9efff;font-weight:700}
#ovUploadExperience .ov-ue-track{height:5px;margin-top:15px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden}
#ovUploadExperience .ov-ue-fill{height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#45bfe5,#75f0cf);box-shadow:0 0 14px rgba(69,191,229,.35);transition:width .22s ease}
#ovUploadExperience .ov-ue-foot{display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:10px;color:rgba(225,240,255,.48)}
#ovUploadExperience.is-done{border-color:rgba(102,225,174,.32);background:linear-gradient(145deg,rgba(10,43,39,.78),rgba(7,22,29,.88))}
#ovUploadExperience.is-done .ov-ue-icon{color:#8ff0c0;background:rgba(75,210,147,.12);border-color:rgba(102,225,174,.3);animation:ovUploadPop .45s cubic-bezier(.2,.8,.2,1)}
#ovUploadExperience.is-done .ov-ue-fill{background:linear-gradient(90deg,#48d59a,#9af0c8)}
#ovUploadExperience.is-error{border-color:rgba(255,120,120,.32)}
@keyframes ovUploadPop{0%{transform:scale(.72);opacity:.4}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
.upload-success-panel{margin-top:14px!important;padding:17px!important;border:1px solid rgba(100,224,170,.25)!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(10,44,39,.72),rgba(9,22,32,.82))!important;color:#eafff5}
.upload-success-panel>strong{display:block;font-size:14px;color:#9bf0c6}
.upload-success-panel>p{font-size:12px;line-height:1.6;color:rgba(232,255,245,.7)}
.upload-success-item{margin-top:10px!important;padding:11px!important;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.035)}
.upload-success-item small{display:block;margin-top:4px;color:rgba(225,240,255,.58)}
@media(prefers-reduced-motion:reduce){#ovUploadExperience *,#ovUploadExperience{animation:none!important;transition:none!important}}
`;document.head.appendChild(s)}
function mount(){const status=$('#uploadStatus'),input=$('#fileInput');if(!status||!input)return null;styles();let panel=$('#ovUploadExperience');if(!panel){panel=document.createElement('section');panel.id='ovUploadExperience';panel.setAttribute('aria-live','polite');panel.setAttribute('aria-atomic','true');status.insertAdjacentElement('afterend',panel)}return{status,input,panel}}
function paint(title,detail,pct,mode='active',foot='SECURE UPLOAD'){const refs=mount();if(!refs)return;const {panel}=refs;panel.classList.toggle('is-done',mode==='done');panel.classList.toggle('is-error',mode==='error');const icon=mode==='done'?'✓':mode==='error'?'!':mode==='ready'?'↥':'↑';panel.innerHTML='<div class="ov-ue-top"><div class="ov-ue-icon" aria-hidden="true">'+icon+'</div><div class="ov-ue-copy"><div class="ov-ue-title">'+esc(title)+'</div><div class="ov-ue-detail">'+esc(detail)+'</div></div>'+(Number.isFinite(pct)?'<div class="ov-ue-percent">'+Math.round(pct)+'%</div>':'')+'</div>'+(Number.isFinite(pct)?'<div class="ov-ue-track"><div class="ov-ue-fill" style="width:'+Math.max(0,Math.min(100,pct))+'%"></div></div>':'')+'<div class="ov-ue-foot"><span>'+esc(foot)+'</span><span>'+(mode==='done'?'SAVED TO PRIVATE CLOUD':mode==='error'?'ACTION NEEDS ATTENTION':mode==='ready'?'READY WHEN YOU ARE':'OV CLOUD · BACKBLAZE B2')+'</span></div>'}
function update(){const refs=mount();if(!refs)return;const {status,input}=refs;const msg=String(status.textContent||'').trim();const selected=Array.from(input.files||[]);if(!msg){if(selected.length)paint('Files ready to upload',selected.length+' file'+(selected.length===1?'':'s')+' selected · '+selected.map(f=>f.name).join(', '),0,'ready','READY');return}
const names=selected.map(f=>f.name);const uploading=msg.match(/^Uploading\s+(.+?)\s+·\s+(\d+)%$/i);
if(/^Preparing\s+/i.test(msg)){const name=msg.replace(/^Preparing\s+/i,'').replace(/…$/,'');paint('Preparing your file',name+' · Secure upload is being initialized.',2,'active','PREPARING');lastState=msg;return}
if(uploading){const name=uploading[1],p=Number(uploading[2]);const idx=Math.max(0,names.indexOf(name)),count=Math.max(1,names.length);const overall=(idx*100+p)/count;paint(p>=100?'Finalizing secure upload':'Uploading your file',name+' · '+(idx+1)+' of '+count+' file'+(count===1?'':'s'),overall,'active',p>=100?'VERIFYING FILE':'TRANSFERRING DATA');lastState=msg;return}
if(/successfully uploaded/i.test(msg)){paint('Upload complete',msg+' Your files are now available in your private OV CLOUD storage.',100,'done','UPLOAD CONFIRMED');lastState=msg;return}
if(/failed|error|could not|unable/i.test(msg)){paint('Upload needs attention',msg,undefined,'error','UPLOAD NOT CONFIRMED');lastState=msg;return}
if(/^Ready to upload/i.test(msg)){paint('Files ready to upload',msg,0,'ready','READY WHEN YOU ARE');lastState=msg;return}
}
function watch(){const refs=mount();if(!refs)return;const status=refs.status;if(status&&!status.dataset.ovUploadObserved){status.dataset.ovUploadObserved='1';new MutationObserver(update).observe(status,{childList:true,subtree:true,characterData:true})}update()}
document.addEventListener('change',e=>{if(e.target?.matches?.('#fileInput'))setTimeout(watch,0)});
const observer=new MutationObserver(()=>setTimeout(watch,0));observer.observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();