import crypto from 'crypto';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map();

function detectOS(ua = '') {
  if (/Windows NT 10\.0/i.test(ua)) return 'Windows 10/11';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS/iPadOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Not available';
}
function detectBrowser(ua = '') {
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/OPR\//i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua)) return 'Google Chrome';
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Not available';
}
function detectDevice(ua = '') {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'Mobile / Tablet' : 'Desktop / Laptop';
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '')
    .split(',')[0].trim().slice(0, 80) || 'unknown';
}
function rateLimited(key) {
  const now = Date.now();
  const old = attempts.get(key);
  if (!old || now - old.startedAt > WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  old.count += 1;
  return old.count > MAX_ATTEMPTS;
}
function sameSecret(a, b) {
  const ah = crypto.createHash('sha256').update(String(a)).digest();
  const bh = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const ip = clientIp(req);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (username.length > 128 || password.length > 256) {
    return res.status(400).json({ ok: false, error: 'Invalid authentication request.' });
  }
  if (rateLimited(`login:${ip}:${username.toLowerCase()}`)) {
    return res.status(429).json({ ok: false, error: 'Too many authentication attempts. Please try again later.' });
  }

  const configuredUsername = typeof process.env.OVESH_CLOUD_USERNAME === 'string' ? process.env.OVESH_CLOUD_USERNAME : 'OVESH';
  const configuredPassword = process.env.OVESH_CLOUD_PASSWORD;
  const sessionSecret = process.env.OVESH_CLOUD_SESSION_SECRET;
  if (!configuredPassword || !sessionSecret || sessionSecret.length < 32) {
    console.error('OVESH CLOUD authentication is missing required server-side secrets.');
    return res.status(503).json({ ok: false, error: 'Authentication service is temporarily unavailable.' });
  }

  const validUser = sameSecret(username, configuredUsername);
  const validPassword = sameSecret(password, configuredPassword);
  if (!validUser || !validPassword) return res.status(401).json({ ok: false, error: 'ACCESS DENIED' });

  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    u: configuredUsername,
    iat: now,
    exp: now + 1000 * 60 * 60 * 12,
    nonce: crypto.randomBytes(24).toString('hex')
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  const token = `${payload}.${signature}`;

  res.setHeader('Set-Cookie', `__Host-ovesh_cloud_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
  const ua = String(req.headers['user-agent'] || '').slice(0, 500);
  const timestamp = new Date(now).toISOString();

  return res.status(200).json({
    ok: true,
    security: {
      timestamp,
      ip: ip === 'unknown' ? null : ip,
      isp: 'Not checked during authentication',
      os: detectOS(ua),
      browser: detectBrowser(ua),
      device: detectDevice(ua),
      userAgent: ua || 'Not available',
      locationStatus: 'Permission not requested'
    }
  });
}
