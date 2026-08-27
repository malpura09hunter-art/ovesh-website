(()=>{'use strict';
const DB=()=>firebase.firestore();
const AUTH=()=>firebase.auth();
const defaults=[
  {name:'PPC',description:'PPC academic workspace',slug:'ppc'},
  {name:'Web Programming',description:'Web development and programming academic workspace',slug:'web-programming'},
  {name:'LS',description:'LS academic workspace',slug:'ls'}
];
async function seedDefaultCollegeSubjects(){
  try{
    if(!AUTH().currentUser) await AUTH().signInAnonymously();
    const userId=AUTH().currentUser?.uid;
    if(!userId)return;
    const ref=DB().collection('college_subjects');
    const existing=await ref.where('userId','==',userId).limit(500).get();
    const bySlug={};
    existing.docs.forEach(d=>{const x=d.data();if(x.slug)bySlug[String(x.slug).toLowerCase()]=d.id;});
    const batch=DB().batch();let added=0;
    defaults.forEach(s=>{
      if(bySlug[s.slug])return;
      const doc=ref.doc();
      batch.set(doc,{...s,userId,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),isDefault:true});
      added++;
    });
    if(added)await batch.commit();
    window.dispatchEvent(new CustomEvent('college-defaults-ready',{detail:{added}}));
  }catch(e){console.warn('College default subject seed failed:',e)}
}
window.addEventListener('DOMContentLoaded',seedDefaultCollegeSubjects);
})();
