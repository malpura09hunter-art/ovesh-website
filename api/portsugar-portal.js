import crypto from 'crypto';

const CLIENT_EMAIL = () => String(process.env.PORTSUGAR_CLIENT_EMAIL || '').trim().toLowerCase();
const CLIENT_PASSWORD = () => String(process.env.PORTSUGAR_CLIENT_PASSWORD || '');
const SESSION_SECRET = () => String(process.env.PORTSUGAR_CLIENT_SESSION_SECRET || '');

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return i < 0 ? [v, ''] : [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}
function makeSession(email) {
  const payload = Buffer.from(JSON.stringify({ sub: email, role: 'portsugar_client', exp: Date.now() + 1000 * 60 * 60 * 12 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET()).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function readSession(req) {
  const token = parseCookies(req).portsugar_client_session || '';
  const parts = token.split('.');
  if (parts.length !== 2 || !SESSION_SECRET()) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET()).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1]), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (data.role !== 'portsugar_client' || data.sub !== CLIENT_EMAIL() || Number(data.exp) <= Date.now()) return null;
    return data;
  } catch { return null; }
}
function projectSummary() {
  return {
    clientName: 'PortSugar Canada',
    projectName: 'PortSugar Canada — Website Deployment',
    hosting: 'Hostinger',
    progress: 80,
    status: 'Final handover in progress',
    summary: 'Your website project is in its final handover stage. The remaining items are being tracked here by Ovesh Malpura Cyber Labs.',
    milestones: [
      { title: 'Website preparation and review', status: 'Completed' },
      { title: 'Contact form check', status: 'Tested' },
      { title: 'Production deployment confirmation', status: 'Final verification' },
      { title: 'Google Analytics configuration', status: 'Pending verification' },
      { title: 'ZIP backup and handover', status: 'Pending' },
      { title: 'Post-handover support', status: '35 days after handover' }
    ],
    payment: { status: 'Awaiting owner confirmation', note: 'The portal will show payment status only after it is verified by Ovesh Malpura Cyber Labs.' },
    agreement: { status: 'Managed by Ovesh Malpura Cyber Labs', note: 'Agreement and signature records will be shown here when the final record is available.' },
    updatedAt: new Date().toISOString()
  };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const email = CLIENT_EMAIL(), password = CLIENT_PASSWORD(), secret = SESSION_SECRET();
  if (!email || !password || !secret) return res.status(503).json({ ok: false, error: 'PortSugar client access is not configured yet.' });
  if (req.method === 'GET') {
    const session = readSession(req);
    if (!session) return res.status(401).json({ ok: false, authenticated: false });
    return res.status(200).json({ ok: true, authenticated: true, project: projectSummary() });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  const body = req.body || {};
  if (body.action === 'logout') {
    res.setHeader('Set-Cookie', 'portsugar_client_session=; Path=/api/portsugar-portal; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return res.status(200).json({ ok: true });
  }
  const suppliedEmail = String(body.email || '').trim().toLowerCase();
  const suppliedPassword = String(body.password || '');
  const emailOk = suppliedEmail.length === email.length && crypto.timingSafeEqual(Buffer.from(suppliedEmail), Buffer.from(email));
  const passwordOk = suppliedPassword.length === password.length && crypto.timingSafeEqual(Buffer.from(suppliedPassword), Buffer.from(password));
  if (!emailOk || !passwordOk) return res.status(401).json({ ok: false, error: 'Email or password is incorrect.' });
  const token = makeSession(email);
  res.setHeader('Set-Cookie', 'portsugar_client_session=' + token + '; Path=/api/portsugar-portal; HttpOnly; Secure; SameSite=Strict; Max-Age=43200');
  return res.status(200).json({ ok: true, authenticated: true, project: projectSummary() });
}
