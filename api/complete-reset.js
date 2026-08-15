const admin = require('firebase-admin');
const crypto = require('crypto');

function getAdmin() {
  if (!admin.apps.length) {
    const raw = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '',
      'base64'
    ).toString('utf8');
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!token) {
    return res.status(400).json({ error: 'invalid', message: 'This password reset link is invalid. Please request a new password reset link.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 6 characters.' });
  }

  console.log('COMPLETE RESET: request received');

  try {
    const firebase = getAdmin();
    const db = firebase.firestore();
    const tokenHash = hashToken(token);
    const tokenRef = db.collection('passwordResetTokens').doc(tokenHash);

    // Re-validate at the point of consumption (not just at page-load time)
    // to close the gap between "checked valid" and "actually used" — and
    // do it inside a transaction so two simultaneous submits with the same
    // token can't both succeed.
    const uid = await db.runTransaction(async (tx) => {
      const doc = await tx.get(tokenRef);

      if (!doc.exists) {
        const err = new Error('invalid');
        err.reason = 'invalid';
        throw err;
      }

      const data = doc.data();

      if (data.used) {
        const err = new Error('used');
        err.reason = 'used';
        throw err;
      }

      if (Date.now() > data.expiresAt) {
        const err = new Error('expired');
        err.reason = 'expired';
        throw err;
      }

      tx.update(tokenRef, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
      return data.uid;
    });

    console.log('COMPLETE RESET: token validated and consumed');

    // Setting the password on an existing UID — this does NOT create a
    // duplicate account, does NOT unlink Google/Microsoft, and does NOT
    // change the UID. It simply adds/updates the "password" provider
    // alongside whatever providers already exist on this account.
    await firebase.auth().updateUser(uid, { password: newPassword });

    console.log('COMPLETE RESET: password updated successfully');

    return res.status(200).json({ ok: true });

  } catch (error) {
    if (error.reason === 'invalid') {
      console.log('COMPLETE RESET: token invalid');
      return res.status(400).json({ error: 'invalid', message: 'This password reset link is invalid. Please request a new password reset link.' });
    }
    if (error.reason === 'used') {
      console.log('COMPLETE RESET: token already used');
      return res.status(400).json({ error: 'used', message: 'This password reset link has already been used. Please request a new one if you still need to reset your password.' });
    }
    if (error.reason === 'expired') {
      console.log('COMPLETE RESET: token expired');
      return res.status(400).json({ error: 'expired', message: 'This password reset link has expired. Please request a new password reset link.' });
    }

    console.error('COMPLETE RESET FAILED:', error.code || error.message);
    return res.status(500).json({ error: 'server_error', message: 'We couldn\'t complete the request. Please try again.' });
  }
};
