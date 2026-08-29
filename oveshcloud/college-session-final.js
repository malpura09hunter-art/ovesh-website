(()=>{'use strict';
/* OVESH CLOUD — authoritative College session handoff.
   College is not a second login. It waits for the same Firebase session used by Cloud. */
const ready=async()=>{try{if(!window.firebase||!firebase.auth)return null;const a=firebase.auth();if(a.currentUser)return a.currentUser;try{const r=await a.signInAnonymously();return r.user||a.currentUser||null}catch(e){console.warn('[College] Firebase session unavailable',e);return null}}catch(e){console.warn('[College] auth init failed',e);return null}};
const openCollege=async()=>{const b=document.querySelector('#nav [data-page="college"]');if(!b)return;const u=await ready();if(!u)return;setTimeout(()=>{if(document.body.contains(b))b.click()},0)};
function removeGate(){document.querySelectorAll('[data-college-auth-gate],#college-auth-gate,.college-auth-gate').forEach(x=>x.remove());const p=document.getElementById('page');if(p&&/College is waiting for your secure session/i.test(p.textContent||'')){openCollege()}}
function install(){const nav=document.getElementById('nav');if(nav&&!nav.dataset.collegeFinal){nav.dataset.collegeFinal='1';nav.addEventListener('click',async e=>{const b=e.target.closest('[data-page="college"]');if(!b)return;if(firebase.auth().currentUser)return; e.preventDefault();e.stopImmediatePropagation();await openCollege()},true)}
 const observer=new MutationObserver(removeGate);observer.observe(document.documentElement,{childList:true,subtree:true});removeGate();
 const a=firebase.auth();a.onAuthStateChanged(u=>{if(u)removeGate()});
 // Establish the same anonymous Firebase session early so College never races the main app.
 if(!a.currentUser)ready();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
})();
