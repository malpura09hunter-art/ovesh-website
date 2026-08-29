const crypto = require('crypto');
const admin = require('firebase-admin');

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not configured');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function requireFirebaseUser(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) throw new Error('Authentication required');
  initFirebaseAdmin();
  return admin.auth().verifyIdToken(header.slice(7));
}

function imagekitConfigured() {
  return !!(process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_URL_ENDPOINT);
}

function authParams() {
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 30 * 60;
  const signature = crypto.createHmac('sha1', process.env.IMAGEKIT_PRIVATE_KEY).update(token + expire).digest('hex');
  return { token, expire, signature, publicKey: process.env.IMAGEKIT_PUBLIC_KEY, urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT };
}

async function deleteFile(fileId) {
  const basic = Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64');
  const r = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${basic}` }
  });
  if (!r.ok && r.status !== 204) {
    const text = await r.text().catch(() => '');
    throw new Error(text || `ImageKit delete failed (${r.status})`);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireFirebaseUser(req);
    if (!imagekitConfigured()) return res.status(503).json({ ok: false, error: 'ImageKit is not configured in Vercel yet.' });

    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, ...authParams(), uid: user.uid });
    }

    if (req.method === 'POST') {
      const { action, fileId } = req.body || {};
      if (action !== 'delete' || !fileId || typeof fileId !== 'string') return res.status(400).json({ ok: false, error: 'Invalid ImageKit operation.' });
      await deleteFile(fileId);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('ImageKit API:', error);
    const status = /Authentication required|auth\/id-token|ID token|Firebase ID token/i.test(String(error.message)) ? 401 : 500;
    return res.status(status).json({ ok: false, error: status === 401 ? 'Authentication required.' : (error.message || 'ImageKit service unavailable.') });
  }
};
