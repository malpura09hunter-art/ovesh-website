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
  <div style="margin:0;padding:32px 16px;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#172019;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe7e1;border-radius:12px;overflow:hidden;">
      <div style="padding:22px 28px;border-bottom:1px solid #e7ece8;background:#fbfdfb;">
        <div style="font-size:13px;font-weight:700;letter-spacing:1.2px;color:#173c23;">OVESHMALPURA CYBER LABS</div>
        <div style="margin-top:5px;font-size:12px;color:#6b776f;">Client Portal Security</div>
      </div>
      <div style="padding:32px 28px 28px;">
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#172019;font-weight:700;">Password reset request</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#465249;">
          We received a request to reset the password for your OveshMalpura Cyber Labs Client Portal account.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#465249;">
          If you made this request, use the button below to choose a new password.
        </p>
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#176b35;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:7px;">Reset Password</a>
        <div style="margin-top:26px;padding-top:20px;border-top:1px solid #e7ece8;">
          <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b776f;">
            For your security, this password-reset link expires soon and can only be used once.
          </p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6b776f;">
            If you did not request a password reset, no action is required. Your password will remain unchanged.
          </p>
        </div>
      </div>
      <div style="padding:18px 28px;background:#fbfdfb;border-top:1px solid #e7ece8;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#7b857e;">This is an automated security message from OveshMalpura Cyber Labs Client Portal. Please do not reply to this email.</p>
      </div>
    </div>
  </div>`;
}

function resetText(link) {
  return `OveshMalpura Cyber Labs — Client Portal Security\n\nPassword reset request\n\nWe received a request to reset the password for your OveshMalpura Cyber Labs Client Portal account.\n\nIf you made this request, use the link below to choose a new password:\n${link}\n\nFor your security, this password-reset link expires soon and can only be used once.\n\nIf you did not request a password reset, no action is required. Your password will remain unchanged.\n\nThis is an automated security message from OveshMalpura Cyber Labs Client Portal.`;
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

    const oobCode = new URL(rawLink).searchParams.get('oobCode');
    if (!oobCode) throw new Error('Firebase did not return a password reset code');

    const link = `${siteUrl}/reset-password.html?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;

    await getTransporter().sendMail({
      from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
      to: email,
      replyTo: process.env.ZOHO_USER,
      subject: 'Password reset request | OveshMalpura Cyber Labs',
      text: resetText(link),
      html: resetHtml(link),
      headers: {
        'X-Auto-Response-Suppress': 'All'
      }
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      res.status(200).json({ ok: true });
      return;
    }
    console.error('send-reset failed:', err.message);
    res.status(500).json({ error: 'Could not send reset email', detail: err.message });
  }
};
