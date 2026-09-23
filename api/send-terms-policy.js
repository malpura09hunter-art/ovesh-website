const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

function getAdmin() {
  if (!admin.apps.length) {
    const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '', 'base64').toString('utf8');
    if (!raw) throw new Error('Firebase service account is not configured');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return admin;
}

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in',
      port: 465,
      secure: true,
      auth: { user: process.env.ZOHO_USER, pass: process.env.ZOHO_APP_PASSWORD },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function emailHtml(name, siteUrl) {
  const safeName = escapeHtml(name) || 'there';
  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:30px 15px;background:#f4f7f5;font-family:Arial,sans-serif;color:#172019;">
<div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dfe7e1;border-radius:12px;overflow:hidden;">
<div style="padding:22px 28px;background:#fbfdfb;border-bottom:1px solid #e7ece8;">
<div style="font-size:13px;font-weight:bold;letter-spacing:1.2px;color:#173c23;">OVESHMALPURA CYBER LABS</div>
<div style="margin-top:5px;font-size:12px;color:#6b776f;">Client Portal</div>
</div>
<div style="padding:32px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;color:#172019;">Terms &amp; Privacy Information</h1>
<p style="font-size:15px;line-height:1.65;color:#465249;">Hi ${safeName},</p>
<p style="font-size:15px;line-height:1.65;color:#465249;">
We are sharing the current Terms &amp; Conditions and Privacy Policy information for your OveshMalpura Cyber Labs Client Portal account. Please review the information that applies to your use of the website and services.
</p>
<div style="margin:22px 0;">
<a href="${siteUrl}/sign-agreement.html" style="display:inline-block;background:#176b35;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 20px;border-radius:7px;margin:0 8px 10px 0;">View Terms &amp; Conditions</a>
<a href="${siteUrl}/privacy-policy.html" style="display:inline-block;background:#fff;color:#176b35;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 20px;border-radius:7px;border:1px solid #176b35;margin:0 0 10px;">View Privacy Policy</a>
</div>
<p style="font-size:13px;line-height:1.6;color:#6b776f;margin:22px 0 0;">
If you have questions about an applicable project agreement, quotation, or service request, please refer to the relevant project documentation.
</p>
</div>
<div style="padding:18px 28px;background:#fbfdfb;border-top:1px solid #e7ece8;">
<p style="font-size:12px;line-height:1.5;color:#7b857e;margin:0;">OveshMalpura Cyber Labs Client Portal · This is a service information email.</p>
</div></div></body></html>`;
}

function emailText(name, siteUrl) {
  return `OveshMalpura Cyber Labs
Client Portal

Terms & Privacy Information

Hi ${name || 'there'},

We are sharing the current Terms & Conditions and Privacy Policy information for your OveshMalpura Cyber Labs Client Portal account.

Terms & Conditions:
${siteUrl}/sign-agreement.html

Privacy Policy:
${siteUrl}/privacy-policy.html

Please review the information that applies to your use of the website and services.

OveshMalpura Cyber Labs Client Portal
`;
}

async function verifyAdmin(req, firebase) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new Error('Missing authorization');
  const token = header.slice(7);
  const decoded = await firebase.auth().verifyIdToken(token);
  const adminDoc = await firebase.firestore().collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists) throw new Error('Admin access required');
  return decoded;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const firebase = getAdmin();
    await verifyAdmin(req, firebase);

    const siteUrl = (process.env.SITE_URL || 'https://malpuraovesh.vercel.app').replace(/\/$/, '');
    const snap = await firebase.firestore().collection('users').get();

    const recipients = [];
    const seen = new Set();

    snap.forEach(doc => {
      const data = doc.data() || {};
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      // A lastLogin timestamp marks an account that has actually completed a login.
      if (!email || !data.lastLogin || seen.has(email)) return;
      seen.add(email);
      recipients.push({ email, name: data.fullName || '' });
    });

    if (!recipients.length) return res.status(200).json({ ok: true, attempted: 0, sent: 0, failed: 0 });

    const transport = getTransporter();
    let sent = 0;
    let failed = 0;
    const failures = [];

    for (let i = 0; i < recipients.length; i += 4) {
      const batch = recipients.slice(i, i + 4);
      const results = await Promise.all(batch.map(async recipient => {
        try {
          await transport.sendMail({
            from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
            to: recipient.email,
            replyTo: process.env.ZOHO_USER,
            subject: 'OveshMalpura Cyber Labs — Terms & Privacy Information',
            text: emailText(recipient.name, siteUrl),
            html: emailHtml(recipient.name, siteUrl),
            headers: { 'X-Auto-Response-Suppress': 'All' }
          });
          return { ok: true };
        } catch (error) {
          console.error('POLICY EMAIL FAILED:', recipient.email, error.code || error.message);
          return { ok: false, email: recipient.email, error: error.code || error.message };
        }
      }));
      for (const result of results) {
        if (result.ok) sent++;
        else { failed++; failures.push({ email: result.email, error: result.error }); }
      }
    }

    return res.status(200).json({ ok: failed === 0, attempted: recipients.length, sent, failed, failures });
  } catch (error) {
    console.error('POLICY EMAIL BULK SEND FAILED:', error.code || error.message);
    const status = error.message === 'Admin access required' || error.message === 'Missing authorization' ? 403 : 500;
    return res.status(status).json({ error: error.message || 'Could not send policy email' });
  }
};
