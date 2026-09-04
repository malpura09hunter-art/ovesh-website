/* ============================================================
   OVESH MALPURA CYBER LABS — Firebase Configuration
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyDB8ZVagSc8C3o3tdrwUcuflZhT8X5lMZ0",
  authDomain: "ovesh-malpura-cyber-lab.firebaseapp.com",
  projectId: "ovesh-malpura-cyber-lab",
  storageBucket: "ovesh-malpura-cyber-lab.firebasestorage.app",
  messagingSenderId: "744299528984",
  appId: "1:744299528984:web:08bce9e624a382856cd46d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const microsoftProvider = new firebase.auth.OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({ prompt: 'select_account' });
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => console.error('Auth persistence error:', err));

async function syncOAuthUserDoc(user, providerLabel) {
  const ref = db.collection('users').doc(user.uid);
  let isNewUser = false;
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) {
      isNewUser = true;
      tx.set(ref, { uid:user.uid, fullName:user.displayName||'', email:user.email, photoURL:user.photoURL||'', provider:providerLabel, emailVerified:user.emailVerified, createdAt:firebase.firestore.FieldValue.serverTimestamp(), lastLogin:firebase.firestore.FieldValue.serverTimestamp(), role:'client' });
    } else tx.update(ref, { lastLogin:firebase.firestore.FieldValue.serverTimestamp() });
  });
  return isNewUser;
}
function syncGoogleUserDoc(user){ return syncOAuthUserDoc(user,'google'); }
function requireAuth(onReady){
  auth.onAuthStateChanged(user=>{
    if(!user){ window.location.href = window.location.pathname.includes('/admin/') ? 'login.html' : 'login.html'; return; }
    onReady(user);
  });
}
async function requireAdmin(onReady,onDenied){
  auth.onAuthStateChanged(async user=>{
    if(!user){window.location.href='login.html';return;}
    try{const adminDoc=await db.collection('admins').doc(user.uid).get();if(!adminDoc.exists){if(onDenied)onDenied(user);else{alert('This account does not have admin access.');auth.signOut();window.location.href='login.html';}return;}onReady(user,adminDoc.data())}catch(err){console.error('Admin check failed:',err);if(onDenied)onDenied(user)}});
}
function fmtDate(ts){if(!ts)return '—';const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'});}
function friendlyError(err){const map={'auth/user-not-found':'No account found with that email.','auth/wrong-password':'Incorrect password. Try again.','auth/invalid-credential':'Incorrect email or password.','auth/email-already-in-use':'An account with that email already exists.','auth/weak-password':'Password should be at least 6 characters.','auth/invalid-email':'Please enter a valid email address.','auth/too-many-requests':'Too many attempts. Please wait a moment and try again.','auth/network-request-failed':'Network error — check your connection and try again.','auth/requires-recent-login':'Please log out and log back in, then try this action again.','auth/user-disabled':'This account has been disabled. Contact support.','auth/account-exists-with-different-credential':'An account already exists with this email using a different sign-in method.','auth/popup-blocked':'Your browser blocked the sign-in popup — trying an alternate method.','auth/unauthorized-domain':'This domain is not authorized for Google Sign-In. Contact the site owner.','permission-denied':'You don\'t have permission to do that.','unavailable':'Service temporarily unavailable — check your connection and try again.','deadline-exceeded':'The request timed out. Please try again.'};return map[err.code]||err.message||'Something went wrong. Please try again.';}

/* OveshCloud-only visual/login enhancement loader. */
if(location.pathname.startsWith('/oveshcloud')){
  const s=document.createElement('script');
  s.src='/oveshcloud/hero-security.js?v=20260821';
  s.defer=true;
  document.head.appendChild(s);
}

/* Runtime guard: app.js expects telemetry/security nodes that older markup may not contain. */
(function(){
  const ids=['loginDevice','loginBrowser','loginOS','loginLocation','loginIP','secDevice','secBrowser','secOS','secScreen','secIP','secTime','secPrecise','secIPLocation'];
  ids.forEach(id=>{if(!document.getElementById(id)){const n=document.createElement('span');n.id=id;n.hidden=true;document.body.appendChild(n)}});
  const style=document.createElement('style');
  style.textContent='#birthdayView{display:none!important;visibility:hidden!important;pointer-events:none!important}';
  document.head.appendChild(style);
  const b=document.getElementById('birthdayView');
  if(b){b.classList.add('hidden');b.setAttribute('aria-hidden','true')}
})();

/* ============================================================
   OVESH CLOUD LOGIN RECOVERY
   Prevents a failed visual/security transition from leaving the
   user on a blank screen. This does not bypass authentication:
   it only recovers the already-authenticated UI transition.
   ============================================================ */
(function(){
  function boot(){
    const sec=document.getElementById('securityView');
    const welcome=document.getElementById('welcomeView');
    const app=document.getElementById('appView');
    const login=document.getElementById('loginView');
    const birthday=document.getElementById('birthdayView');
    if(!sec||!welcome||!app||!login)return;

    if(birthday){birthday.classList.add('hidden');birthday.style.setProperty('display','none','important');birthday.setAttribute('aria-hidden','true')}

    const recover=()=>{
      if(!sec.classList.contains('hidden')){
        sec.style.display='block';
        const modal=sec.querySelector('.security-modal');
        if(modal)modal.style.display='block';
        if(!sec.dataset.recoveryTimer){
          sec.dataset.recoveryTimer='1';
          setTimeout(()=>{
            sec.classList.add('hidden');
            sec.style.display='none';
            welcome.classList.add('hidden');
            welcome.style.display='none';
            app.classList.remove('hidden');
            app.style.display='grid';
            try{if(typeof window.render==='function')window.render('command')}catch(e){console.warn('Workspace render recovery:',e)}
            const page=document.getElementById('page');
            if(page&&!page.innerHTML.trim())page.innerHTML='<div style="padding:40px;color:#8e99ad;font-family:system-ui">OVESH CLOUD workspace loading…</div>';
          },2400);
        }
      }
    };

    const observer=new MutationObserver(recover);
    observer.observe(sec,{attributes:true,attributeFilter:['class','style']});
    observer.observe(welcome,{attributes:true,attributeFilter:['class','style']});
    recover();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
