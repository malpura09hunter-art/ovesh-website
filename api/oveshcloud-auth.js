import crypto from 'crypto';
import admin from 'firebase-admin';

function firebaseAdmin() {
  if (!admin.apps.length) {
    const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '', 'base64').toString('utf8');
    if (!raw) throw new Error('Firebase service account is not configured');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin;
}

function detectOS(ua = '') {
  if (/Windows NT 10\.0/i.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS/iPadOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Not available';
}

function detectBrowser(ua = '') {
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Google Chrome';
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  return 'Not available';
}

function detectDevice(ua = '') {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'Mobile / Tablet' : 'Desktop / Laptop';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { username, password, location } = req.body || {};
  const u = process.env.OVESH_CLOUD_USERNAME || 'OVESH';
  const p = process.env.OVESH_CLOUD_PASSWORD;
  if (!p) return res.status(500).json({ ok: false, error: 'OVESH_CLOUD_PASSWORD is not configured in Vercel' });
  if (username !== u || password !== p) return res.status(401).json({ ok: false, error: 'ACCESS DENIED' });

  // Do not wait for third-party IP/ISP services during authentication.
  // The client security panel loads network information independently after login.
  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').toString().split(',')[0].trim() || null;
  const ua = req.headers['user-agent'] || '';
  const timestamp = new Date().toISOString();
  const sessionSecret = process.env.OVESH_CLOUD_SESSION_SECRET || p;
  const payload = Buffer.from(JSON.stringify({ u, iat: Date.now(), nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  const token = `${payload}.${signature}`;

  // Mint a Firebase custom token so the browser can establish a real
  // Firebase Auth session for the fixed Cloud admin UID. This is what
  // Firestore/Storage security rules and cloud.js's onAuthStateChanged
  // gate actually check — without it, login "succeeds" visually but the
  // real command-center data/storage never unlocks. Failure here must
  // NEVER block login itself; it degrades to a clear front-end notice.
  let customToken = null;
  let customTokenError = null;
  const adminUid = process.env.OVESH_CLOUD_ADMIN_UID;
  if (!adminUid) {
    customTokenError = 'OVESH_CLOUD_ADMIN_UID is not configured in Vercel';
  } else {
    try {
      const app = firebaseAdmin();
      customToken = await app.auth().createCustomToken(adminUid);
    } catch (e) {
      customTokenError = e.message || 'Failed to mint Firebase session token';
    }
  }

  return res.status(200).json({
    ok: true,
    token,
    customToken,
    customTokenError,
    security: {
      timestamp,
      ip,
      isp: 'Loading…',
      os: detectOS(ua),
      browser: detectBrowser(ua),
      device: detectDevice(ua),
      userAgent: ua || 'Not available',
      location: location || null,
      locationStatus: location ? 'Browser permission granted' : 'Permission not granted'
    }
  });
}
