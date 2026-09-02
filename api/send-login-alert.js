const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 3;
const requestCounts = new Map();

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '';
  if (!raw) throw new Error('Firebase service unavailable');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}
async function requireUser(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    const e = new Error('Authentication required'); e.statusCode = 401; throw e;
  }
  try { return await getAdmin().auth().verifyIdToken(header.slice(7)); }
  catch { const e = new Error('Authentication required'); e.statusCode = 401; throw e; }
}
function rateLimited(uid) {
  const now = Date.now(), old = requestCounts.get(uid);
  if (!old || now - old.startedAt > WINDOW_MS) { requestCounts.set(uid, { startedAt: now, count: 1 }); return false; }
  old.count += 1; return old.count > MAX_REQUESTS;
}
let transporter;
function getTransporter() {
  if (!transporter) transporter = nodemailer.createTransport({ host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in', port: 465, secure: true, auth: { user: process.env.ZOHO_USER, pass: process.env.ZOHO_APP_PASSWORD }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000 });
  return transporter;
}
const RETRYABLE_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNRESET', 'EDNS']);
async function sendWithOneRetry(transport, mailOptions) {
  try { return await transport.sendMail(mailOptions); }
  catch (err) { if (RETRYABLE_ERROR_CODES.has(err.code)) return await transport.sendMail(mailOptions); throw err; }
}
function escapeHtml(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function parseDevice(ua) {
  if (!ua) return 'Unknown device';
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows'; else if (/Mac OS X/i.test(ua)) os = 'macOS'; else if (/Android/i.test(ua)) os = 'Android'; else if (/iPhone|iPad/i.test(ua)) os = 'iOS'; else if (/Linux/i.test(ua)) os = 'Linux';
  let browser = 'Unknown browser';
  if (/Edg\//i.test(ua)) browser = 'Edge'; else if (/Chrome\//i.test(ua)) browser = 'Chrome'; else if (/Firefox\//i.test(ua)) browser = 'Firefox'; else if (/Safari\//i.test(ua)) browser = 'Safari';
  return `${browser} on ${os}`;
}
function loginAlertHtml({ name, device, time, ip, resetUrl }) {
  const safeName = escapeHtml(name) || 'there';
  return `<!DOCTYPE html><html><body style="margin:0;padding:30px 15px;background:#f4f7f5;font-family:Arial,sans-serif;color:#172019;"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dfe7e1;border-radius:12px;overflow:hidden;"><div style="padding:22px 28px;background:#fbfdfb;border-bottom:1px solid #e7ece8;"><div style="font-size:13px;font-weight:bold;letter-spacing:1.2px;color:#173c23;">OVESHMALPURA CYBER LABS</div><div style="margin-top:5px;font-size:12px;color:#6b776f;">Client Portal Security</div></div><div style="padding:32px 28px;"><h1 style="margin:0 0 16px;font-size:24px;color:#172019;">New sign-in to your account</h1><p style="font-size:15px;line-height:1.65;color:#465249;">Hi ${safeName}, your OveshMalpura Cyber Labs Client Portal account was just signed into.</p><table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fbfdfb;border:1px solid #e7ece8;"><tr><td style="padding:12px 16px;font-size:12px;color:#6b776f;">DEVICE</td><td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;">${escapeHtml(device)}</td></tr><tr><td style="padding:12px 16px;font-size:12px;color:#6b776f;">TIME</td><td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;">${escapeHtml(time)}</td></tr><tr><td style="padding:12px 16px;font-size:12px;color:#6b776f;">IP ADDRESS</td><td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;">${escapeHtml(ip)}</td></tr></table><p style="font-size:15px;line-height:1.65;color:#465249;"><strong>Was this you?</strong> No action needed.</p><p style="font-size:15px;line-height:1.65;color:#465249;"><strong>Wasn't you?</strong> Secure your account immediately:</p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#c0293f;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 22px;border-radius:7px;">Open Client Portal</a></div></div></body></html>`;
}
function loginAlertText({ name, device, time, ip, resetUrl }) { return `OveshMalpura Cyber Labs\nClient Portal Security\n\nNew sign-in to your account\n\nHi ${name || 'there'}, your account was just signed into.\n\nDevice: ${device}\nTime: ${time}\nIP address: ${ip}\n\nIf this wasn't you, open: ${resetUrl}\n`; }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (rateLimited(user.uid)) return res.status(429).json({ error: 'Too many login alerts requested.' });
    if (!user.email) return res.status(400).json({ error: 'Authenticated account has no email address.' });
    const siteUrl = (process.env.SITE_URL || 'https://malpuraovesh.vercel.app').replace(/\/$/, '');
    const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'Unknown';
    const ua = String(req.headers['user-agent'] || '').slice(0, 500);
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
    const device = parseDevice(ua);
    const name = user.name || user.email.split('@')[0];
    await sendWithOneRetry(getTransporter(), { from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`, to: user.email, replyTo: process.env.ZOHO_USER, subject: 'New sign-in to your OveshMalpura Cyber Labs account', text: loginAlertText({ name, device, time, ip, resetUrl: `${siteUrl}/login.html` }), html: loginAlertHtml({ name, device, time, ip, resetUrl: `${siteUrl}/login.html` }), headers: { 'X-Auto-Response-Suppress': 'All' } });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('LOGIN ALERT:', err.code || err.message);
    const status = Number(err.statusCode) || 500;
    return res.status(status).json({ error: status === 401 ? 'Authentication required.' : 'Could not send login alert' });
  }
};
