import crypto from 'crypto';

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
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'Mobile / Tablet';
  return 'Desktop / Laptop';
}

async function lookupISP(ip) {
  if (!ip || ip === '::1' || /^127\./.test(ip)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    return data?.success === false ? null : (data?.connection?.isp || data?.connection?.org || null);
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { username, password, location } = req.body || {};
  const u = process.env.OVESH_CLOUD_USERNAME || 'OVESH';
  const p = process.env.OVESH_CLOUD_PASSWORD;
  if (!p) return res.status(500).json({ ok: false, error: 'OVESH_CLOUD_PASSWORD is not configured in Vercel' });
  if (username !== u || password !== p) return res.status(401).json({ ok: false, error: 'ACCESS DENIED' });

  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').toString().split(',')[0].trim() || null;
  const ua = req.headers['user-agent'] || '';
  const isp = await lookupISP(ip);
  const timestamp = new Date().toISOString();
  const sessionSecret = process.env.OVESH_CLOUD_SESSION_SECRET || p;
  const payload = Buffer.from(JSON.stringify({ u, iat: Date.now(), nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  const token = `${payload}.${signature}`;

  return res.status(200).json({
    ok: true,
    token,
    security: {
      timestamp,
      ip,
      isp: isp || 'Not available',
      os: detectOS(ua),
      browser: detectBrowser(ua),
      device: detectDevice(ua),
      userAgent: ua || 'Not available',
      location: location || null,
      locationStatus: location ? 'Browser permission granted' : 'Permission not granted'
    }
  });
}
