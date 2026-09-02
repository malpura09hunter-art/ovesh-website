const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const requestCounts = new Map();

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '', 'base64').toString('utf8');
  if (!raw) throw new Error('Firebase service unavailable');
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
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
function escapeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
const TOKEN_TTL_MS = 30 * 60 * 1000;
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'unknown'; }
function rateLimited(key) {
  const now = Date.now(), old = requestCounts.get(key);
  if (!old || now - old.startedAt > WINDOW_MS) { requestCounts.set(key, { startedAt: now, count: 1 }); return false; }
  old.count += 1; return old.count > MAX_REQUESTS;
}
function htmlEmail(link) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:30px 15px;background:#f4f7f5;font-family:Arial,sans-serif;color:#172019;"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dfe7e1;border-radius:12px;overflow:hidden;"><div style="padding:22px 28px;background:#fbfdfb;border-bottom:1px solid #e7ece8;"><div style="font-size:13px;font-weight:bold;letter-spacing:1.2px;color:#173c23;">OVESHMALPURA CYBER LABS</div><div style="margin-top:5px;font-size:12px;color:#6b776f;">Client Portal Security</div></div><div style="padding:32px 28px;"><h1 style="margin:0 0 16px;font-size:24px;color:#172019;">Password Reset Request</h1><p style="font-size:15px;line-height:1.65;color:#465249;">We received a request to reset the password for your OveshMalpura Cyber Labs Client Portal account.</p><a href="${escapeHtml(link)}" style="display:inline-block;background:#176b35;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 22px;border-radius:7px;">Reset Your Client Portal Password</a><p style="margin-top:26px;font-size:13px;line-height:1.6;color:#6b776f;">For your security, this link expires in 30 minutes and can only be used once. If you did not request this, no action is required.</p></div></div></body></html>`;
}
function textEmail(link) { return `OveshMalpura Cyber Labs\nClient Portal Security\n\nPassword Reset Request\n\nUse this link to reset your password:\n\n${link}\n\nThe link expires in 30 minutes and can only be used once.\n`; }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rawEmail = req.body?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid request.' });
  const ip = clientIp(req);
  if (rateLimited(`reset:${ip}`) || rateLimited(`reset-email:${email}`)) return res.status(429).json({ error: 'Too many password reset requests. Please try again later.' });

  const siteUrl = (process.env.SITE_URL || 'https://malpuraovesh.vercel.app').replace(/\/$/, '');
  try {
    const firebase = getAdmin();
    let user;
    try { user = await firebase.auth().getUserByEmail(email); }
    catch (error) {
      if (error.code === 'auth/user-not-found') return res.status(200).json({ ok: true });
      throw error;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    await firebase.firestore().collection('passwordResetTokens').doc(tokenHash).set({ uid: user.uid, expiresAt: Date.now() + TOKEN_TTL_MS, used: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    const resetLink = `${siteUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
    await sendWithOneRetry(getTransporter(), { from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`, to: email, replyTo: process.env.ZOHO_USER, subject: 'Reset Your OveshMalpura Cyber Labs Client Portal Password', text: textEmail(resetLink), html: htmlEmail(resetLink), headers: { 'X-Auto-Response-Suppress': 'All' } });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('PASSWORD RESET:', error.code || 'send_failed');
    return res.status(500).json({ error: 'Could not send reset email' });
  }
};
