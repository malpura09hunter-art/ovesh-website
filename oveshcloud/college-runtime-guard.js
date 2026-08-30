(()=>{'use strict';
const B='/ovesh/college', C='college_subjects';
const D=[['PPC','Production & Business Economics','ppc'],['WP','Web Programming','wp'],['BLA','Business & Legal Applications','bla'],['LS','Life Skills','ls']];
let refreshing=false, seeded=false;
const isCollege=()=>location.pathname===B||location.pathname.startsWith(B+'/');
const ready=()=>window.OVESH_COLLEGE_V2&&typeof window.OVESH_COLLEGE_V2.refresh==='function';
async function ensureSubjects(){
  if(seeded||!window.firebase||!firebase.firestore||!firebase.auth)return;
  let u=firebase.auth().currentUser;
  if(!u)return;
  const ref=firebase.firestore().collection(C);
  const q=await ref.where('userId','==',u.uid).limit(500).get();
  const bySlug=new Map(q.docs.map(d=>[String(d.data().slug||'').toLowerCase(),d]));
  const batch=firebase.firestore().batch(); let n=0;
  for(const [name,description,slug] of D){
    if(bySlug.has(slug))continue;
    const d=ref.doc();batch.set(d,{userId:u.uid,name,description,slug,isDefault:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});n++;
  }
  if(n)await batch.commit();
  seeded=true;
}
async function refresh(){
  if(!isCollege()||!ready()||refreshing)return;
  const page=document.getElementById('page');if(!page)return;
  refreshing=true;
  try{await ensureSubjects();await window.OVESH_COLLEGE_V2.refresh()}catch(e){console.error('College bootstrap',e)}finally{refreshing=false}
}
function boot(){
  const page=document.getElementById('page');if(!page)return setTimeout(boot,50);
  document.addEventListener('click',e=>{const nav=e.target.closest('#nav [data-page="college"]');if(!nav)return;e.preventDefault();e.stopImmediatePropagation();history.pushState({},'',B);const t=document.getElementById('pageTitle');if(t)t.textContent='College';refresh();setTimeout(refresh,300)},true);
  new MutationObserver(()=>{if(isCollege()&&ready()&&!document.querySelector('#page .cv2'))refresh()}).observe(page,{childList:true,subtree:true});
  window.addEventListener('popstate',()=>{if(isCollege())setTimeout(refresh,0)});
  if(isCollege())refresh();
}
function wait(){if(ready()&&firebase?.auth?.().currentUser)boot();else setTimeout(wait,100)}
wait();
})();