const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

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
  if (!header.startsWith('Bearer ')) { const e = new Error('Authentication required'); e.statusCode = 401; throw e; }
  try { return await getAdmin().auth().verifyIdToken(header.slice(7)); }
  catch { const e = new Error('Authentication required'); e.statusCode = 401; throw e; }
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
function welcomeHtml(name, siteUrl) {
  const safeName = escapeHtml(name) || 'there';
  return `<div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:480px;margin:0 auto;background:#060f06;border:1px solid rgba(0,255,65,0.25);border-radius:10px;padding:32px;"><p style="font-family:monospace;color:#00aa22;letter-spacing:2px;font-size:11px;text-transform:uppercase;margin:0 0 8px;">Client Portal</p><h1 style="color:#39ff14;font-size:22px;margin:0 0 20px;">Welcome, ${safeName}</h1><p style="color:#c8ffd4;font-size:15px;line-height:1.6;margin:0 0 16px;">Your account with <strong>OveshMalpura Cyber Labs</strong> is set up. You can now sign in to your client portal.</p><a href="${escapeHtml(siteUrl)}/login.html" style="display:inline-block;background:#00cc33;color:#021002;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px;margin:8px 0 20px;">Go to Client Portal</a></div></div>`;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (!user.email) return res.status(400).json({ error: 'Authenticated account has no email address.' });
    const siteUrl = (process.env.SITE_URL || 'https://malpuraovesh.vercel.app').replace(/\/$/, '');
    const name = user.name || user.email.split('@')[0];
    await sendWithOneRetry(getTransporter(), { from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`, to: user.email, subject: 'Welcome to OveshMalpura Cyber Labs', html: welcomeHtml(name, siteUrl) });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('WELCOME EMAIL:', err.code || err.message);
    const status = Number(err.statusCode) || 500;
    return res.status(status).json({ error: status === 401 ? 'Authentication required.' : 'Could not send welcome email' });
  }
};
