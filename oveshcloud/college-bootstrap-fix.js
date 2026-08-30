(()=>{'use strict';
const B='/ovesh/college';
const D=[['PPC','Production & Business Economics','ppc'],['WP','Web Programming','wp'],['BLA','Business & Legal Applications','bla'],['LS','Life Skills','ls']];
const K=[['assignments','Assignments'],['practicals','Practicals'],['files','Files'],['notes','Notes'],['projects','Projects'],['presentations','Presentations']];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let seeded=false;
async function seedDefaults(){
 if(seeded||!window.firebase||!firebase.auth||!firebase.firestore)return false;
 const user=firebase.auth().currentUser;if(!user)return false;
 const db=firebase.firestore(), ref=db.collection('college_subjects');
 try{
  const q=await ref.where('userId','==',user.uid).limit(500).get();
  const existing=new Map(q.docs.map(d=>[String(d.data().slug||'').toLowerCase(),d.id]));
  const batch=db.batch();let writes=0;
  for(const [name,description,slug] of D){if(existing.has(slug))continue;const d=ref.doc();batch.set(d,{userId:user.uid,name,description,slug,isDefault:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});writes++}
  if(writes)await batch.commit();
  seeded=true;
  if(window.OVESH_COLLEGE_V2)await window.OVESH_COLLEGE_V2.refresh();
  return true;
 }catch(e){console.warn('College default bootstrap failed:',e);return false}
}
function fallback(){
 if(!location.pathname.startsWith(B))return;
 const p=document.getElementById('page');if(!p)return;
 const parts=location.pathname.slice(B.length).split('/').filter(Boolean);
 if(parts.length)return;
 if(p.querySelector('.cv2')&&!/0 SUBJECTS/.test(p.innerText||''))return;
 p.innerHTML=`<div class="cv2"><div class="cv2head"><div><div class="cv2k">OVESH CLOUD™ · COLLEGE</div><h1 class="cv2h">College Workspace</h1><p class="cv2p">Choose a subject first. Your academic content is organized subject → category → item.</p></div></div><div class="cv2toolbar"><div><h2>Subjects</h2><span class="cv2count">4 SUBJECTS</span></div></div><div class="cv2subjects">${D.map(s=>`<article class="cv2card"><div class="cv2icon">${s[0]}</div><h2>${s[0]}</h2><p>${s[1]}</p><div class="cv2foot"><span class="cv2count">ACADEMIC WORKSPACE</span><button class="cv2btn cv2primary" data-college-go="${B}/subjects/${s[2]}">OPEN SUBJECT →</button></div></article>`).join('')}</div></div>`;
 p.querySelectorAll('[data-college-go]').forEach(b=>b.onclick=e=>{e.preventDefault();history.pushState({},'',b.dataset.collegeGo);if(window.OVESH_COLLEGE_V2)window.OVESH_COLLEGE_V2.refresh();else fallback()});
}
function boot(){
 const p=document.getElementById('page');if(!p)return setTimeout(boot,100);
 if(window.firebase?.auth){firebase.auth().onAuthStateChanged(()=>{seedDefaults().then(()=>setTimeout(()=>{if(window.OVESH_COLLEGE_V2)window.OVESH_COLLEGE_V2.refresh()},100))})}
 new MutationObserver(()=>{if(location.pathname.startsWith(B))setTimeout(()=>{seedDefaults().then(()=>{if(!seeded)fallback()})},80)}).observe(p,{childList:true,subtree:true});
 setTimeout(()=>seedDefaults().then(()=>{if(!seeded)fallback()}),500);
 setTimeout(()=>seedDefaults().then(()=>{if(!seeded)fallback()}),2000);
}
boot();
})();