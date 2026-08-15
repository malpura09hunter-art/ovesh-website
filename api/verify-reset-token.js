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
  if (!token) {
    return res.status(400).json({ valid: false, reason: 'invalid' });
  }

  try {
    const firebase = getAdmin();
    const tokenHash = hashToken(token);
    const doc = await firebase.firestore().collection('passwordResetTokens').doc(tokenHash).get();

    if (!doc.exists) {
      console.log('VERIFY RESET TOKEN: not found');
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const data = doc.data();

    if (data.used) {
      console.log('VERIFY RESET TOKEN: already used');
      return res.status(200).json({ valid: false, reason: 'used' });
    }

    if (Date.now() > data.expiresAt) {
      console.log('VERIFY RESET TOKEN: expired');
      return res.status(200).json({ valid: false, reason: 'expired' });
    }

    console.log('VERIFY RESET TOKEN: valid');
    return res.status(200).json({ valid: true });

  } catch (error) {
    console.error('VERIFY RESET TOKEN FAILED:', error.code || error.message);
    return res.status(500).json({ valid: false, reason: 'error' });
  }
};
