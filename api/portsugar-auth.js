import crypto from 'crypto';

const COOKIE = 'portsugar_client_session';
const MAX_AGE = 60 * 60 * 8;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function secret() {
  return process.env.PORTSUGAR_SESSION_SECRET || '';
}
function readSession(req) {
  const cookie = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  if (!cookie || !secret()) return null;
  let token;
  try { token = decodeURIComponent(cookie.slice(COOKIE.length + 1)); } catch { return null; }
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.aud !== 'portsugar-client' || !data.exp || Date.now() >= Number(data.exp)) return null;
    return data;
  } catch { return null; }
}
function setCookie(res, value, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  const action = String(req.query?.action || '');
  if (req.method === 'GET' && action === 'session') {
    const session = readSession(req);
    if (!session) return res.status(401).json({ ok: false, authenticated: false });
    return res.status(200).json({ ok: true, authenticated: true, email: session.email, expiresAt: session.exp });
  }
  if (req.method === 'POST' && action === 'logout') {
    setCookie(res, '', 0);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const expectedEmail = String(process.env.PORTSUGAR_CLIENT_EMAIL || '').trim().toLowerCase();
  const expectedPassword = String(process.env.PORTSUGAR_CLIENT_PASSWORD || '');
  if (!secret() || !expectedEmail || !expectedPassword) {
    return res.status(503).json({ ok: false, error: 'PORTSUGAR_AUTH_NOT_CONFIGURED' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!safeEqual(email, expectedEmail) || !safeEqual(password, expectedPassword)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }
  const payload = Buffer.from(JSON.stringify({
    aud: 'portsugar-client',
    email: expectedEmail,
    iat: Date.now(),
    exp: Date.now() + MAX_AGE * 1000,
    nonce: crypto.randomBytes(16).toString('hex')
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  setCookie(res, payload + '.' + signature, MAX_AGE);
  return res.status(200).json({ ok: true, authenticated: true, email: expectedEmail });
}