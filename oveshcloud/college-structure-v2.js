(()=>{'use strict';
/* Final College structure layer: adds the academic Skills subject without replacing the existing College OS. */
const db=()=>firebase.firestore();
const auth=()=>firebase.auth();
async function ensureSkillsSubject(){
  try{
    const u=auth().currentUser;
    if(!u)return;
    const ref=db().collection('college_subjects');
    const q=await ref.where('userId','==',u.uid).where('slug','==','skills').limit(1).get();
    if(q.empty){
      await ref.add({
        userId:u.uid,
        name:'Skills',
        description:'Skills developed through college subjects, practical work and projects.',
        slug:'skills',
        isDefault:true,
        category:'academic',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    window.dispatchEvent(new CustomEvent('college-structure-ready'));
  }catch(e){console.warn('College structure initialization:',e)}
}
function start(){
  if(!window.firebase?.auth)return;
  const a=auth();
  if(a.currentUser)ensureSkillsSubject();
  else a.onAuthStateChanged(u=>{if(u)ensureSkillsSubject()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
