/* ============================================================
   OVESH MALPURA CYBER LABS — Firebase Configuration
   ============================================================
   1. Go to https://console.firebase.google.com
   2. Create a project (or use an existing one)
   3. Enable: Authentication > Sign-in method > Email/Password
   4. Enable: Firestore Database > Create database (production mode)
   5. Project Settings > General > Your apps > Add app (Web)
   6. Copy the config object it gives you and paste it below,
      replacing the placeholder values.

   PHASE 1 SCOPE: Firestore + Authentication only.
   Cloud Storage is intentionally NOT initialized — do not add
   firebase-storage-compat.js or firebase.storage() calls until
   Storage is explicitly enabled in a later phase.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDB8ZVagSc8C3o3tdrwUcuflZhT8X5lMZ0",
  authDomain: "ovesh-malpura-cyber-lab.firebaseapp.com",
  projectId: "ovesh-malpura-cyber-lab",
  storageBucket: "ovesh-malpura-cyber-lab.firebasestorage.app",
  messagingSenderId: "744299528984",
  appId: "1:744299528984:web:08bce9e624a382856cd46d"
};

// Initialize Firebase (using the compat SDK loaded via <script> tags,
// so this works with plain HTML/JS — no build step required)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Google Sign-In provider (used by login.html's "Continue with Google")
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Microsoft Sign-In provider (used by login.html's "Continue with Microsoft")
// Requires "microsoft.com" to be enabled under Firebase Console ->
// Authentication -> Sign-in method, with an Azure AD app registration's
// Application (client) ID + secret configured there.
const microsoftProvider = new firebase.auth.OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({ prompt: 'select_account' });

// Explicit persistent (survives browser restart) auth session.
// This is Firebase's default, but we set it explicitly so
// "Persistent Login Session" is guaranteed rather than assumed.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
  console.error('Auth persistence error:', err);
});

// Creates the users/{uid} doc on a user's FIRST Google sign-in only.
// On every subsequent sign-in, only lastLogin is touched — existing
// profile fields (fullName, role, etc.) are never overwritten.
// Wrapped in a transaction to prevent duplicate writes / race conditions
// if the auth state fires more than once in quick succession.
// Returns true if this was the user's first Google sign-in (doc just
// created), false if they already had a profile — callers use this to
// decide whether to send a welcome email.
// Returns true if this was the user's first sign-in with this provider
// (doc just created), false if they already had a profile — callers use
// this to decide whether to send a welcome email. providerLabel is a
// short string like 'google' or 'microsoft', stored on the profile.
async function syncOAuthUserDoc(user, providerLabel) {
  const ref = db.collection('users').doc(user.uid);
  let isNewUser = false;
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) {
      isNewUser = true;
      tx.set(ref, {
        uid: user.uid,
        fullName: user.displayName || '',
        email: user.email,
        photoURL: user.photoURL || '',
        provider: providerLabel,
        emailVerified: user.emailVerified,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        role: 'client'
      });
    } else {
      tx.update(ref, { lastLogin: firebase.firestore.FieldValue.serverTimestamp() });
    }
  });
  return isNewUser;
}

// Kept as an alias so any other page still calling syncGoogleUserDoc
// directly keeps working unchanged.
function syncGoogleUserDoc(user) {
  return syncOAuthUserDoc(user, 'google');
}

/* ---------------- Shared helpers used across pages ---------------- */

// Redirect signed-out users away from protected pages
function requireAuth(onReady) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = (window.location.pathname.includes('/admin/'))
        ? 'login.html'
        : 'login.html';
      return;
    }
    onReady(user);
  });
}

// Checks the signed-in user is listed in the "admins" collection.
// Returns the admin doc (or null) via callback.
async function requireAdmin(onReady, onDenied) {
  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = 'login.html'; return; }
    try {
      const adminDoc = await db.collection('admins').doc(user.uid).get();
      if (!adminDoc.exists) {
        if (onDenied) onDenied(user);
        else { alert('This account does not have admin access.'); auth.signOut(); window.location.href = 'login.html'; }
        return;
      }
      onReady(user, adminDoc.data());
    } catch (err) {
      console.error('Admin check failed:', err);
      if (onDenied) onDenied(user);
    }
  });
}

// Formats a Firestore Timestamp (or Date) into a readable string
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Shared error translator for both Auth and Firestore errors
function friendlyError(err) {
  const map = {
    // Auth
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error — check your connection and try again.',
    'auth/requires-recent-login': 'Please log out and log back in, then try this action again.',
    'auth/user-disabled': 'This account has been disabled. Contact support.',
    'auth/expired-action-code': 'This reset link has expired. Please request a new one.',
    'auth/invalid-action-code': 'This reset link is invalid or has already been used. Please request a new one.',
    'auth/missing-android-pkg-name': 'This reset link is invalid. Please request a new one.',
    'auth/missing-continue-uri': 'This reset link is invalid. Please request a new one.',
    'auth/operation-not-allowed': 'This sign-in method is not currently enabled. Contact support.',
    // Google Sign-In
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup — trying an alternate method.',
    'auth/unauthorized-domain': 'This domain is not authorized for Google Sign-In. Contact the site owner.',
    // Firestore
    'permission-denied': 'You don\'t have permission to do that.',
    'unavailable': 'Service temporarily unavailable — check your connection and try again.',
    'deadline-exceeded': 'The request timed out. Please try again.'
  };
  return map[err.code] || err.message || 'Something went wrong. Please try again.';
}
