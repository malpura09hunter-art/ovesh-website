const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

function getAdmin() {
  if (!admin.apps.length) {
    let raw;
    try {
      raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '', 'base64').toString('utf8');
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64: ' + e.message);
    }
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 did not decode to valid JSON (likely truncated/corrupted during copy-paste): ' + e.message);
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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
      auth: {
        user: process.env.ZOHO_USER,
        pass: process.env.ZOHO_APP_PASSWORD
      }
    });
  }
  return transporter;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function resetHtml(link) {
  return `
  <div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#060f06;border:1px solid rgba(0,255,65,0.25);border-radius:10px;padding:32px;">
      <p style="font-family:monospace;color:#00aa22;letter-spacing:2px;font-size:11px;text-transform:uppercase;margin:0 0 8px;">Client Portal</p>
      <h1 style="color:#39ff14;font-size:22px;margin:0 0 20px;">Reset your password</h1>
      <p style="color:#c8ffd4;font-size:15px;line-height:1.6;margin:0 0 16px;">
        We received a request to reset the password for your OveshMalpura Cyber Labs account.
        Click below to choose a new one. This link expires soon and can only be used once.
      </p>
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#00cc33;color:#021002;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px;margin:8px 0 20px;">Reset Password</a>
      <p style="color:#4a7a52;font-size:13px;line-height:1.5;margin:0;">
        If you didn't request this, you can safely ignore this email — your password will not be changed.
      </p>
    </div>
  </div>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  const siteUrl = process.env.SITE_URL || 'https://malpuraovesh.vercel.app';
  const actionCodeSettings = { url: `${siteUrl}/reset-password.html` };

  try {
    const adminSdk = getAdmin();
    const rawLink = await adminSdk.auth().generatePasswordResetLink(email, actionCodeSettings);

    // generatePasswordResetLink() returns a link pointing at Firebase's own
    // hosted action handler (PROJECT.firebaseapp.com/__/auth/action) with
    // mode/oobCode as query params. Since our reset-password.html already
    // handles mode+oobCode itself via the client SDK, we don't need
    // Firebase's hosted handler at all — just pull the oobCode out and
    // point straight at our own page. This avoids needing to verify a
    // custom Action URL domain in the Firebase Console.
    const oobCode = new URL(rawLink).searchParams.get('oobCode');
    const link = `${siteUrl}/reset-password.html?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;

    await getTransporter().sendMail({
      from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
      to: email,
      subject: 'Reset your OveshMalpura Cyber Labs password',
      html: resetHtml(link)
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    // Never reveal whether the email is registered — same response either way.
    if (err.code === 'auth/user-not-found') {
      res.status(200).json({ ok: true });
      return;
    }
    console.error('send-reset failed:', err.message);
    res.status(500).json({ error: 'Could not send reset email', detail: err.message });
  }
};
