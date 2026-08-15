const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

function getAdmin() {
  if (!admin.apps.length) {
    const raw = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '',
      'base64'
    ).toString('utf8');

    const serviceAccount = JSON.parse(raw);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
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
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000
    });
  }

  return transporter;
}

const RETRYABLE_ERROR_CODES = new Set([
  'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNRESET', 'EDNS'
]);

async function sendWithOneRetry(transport, mailOptions) {
  try {
    return await transport.sendMail(mailOptions);
  } catch (err) {
    if (RETRYABLE_ERROR_CODES.has(err.code)) {
      console.warn('ZOHO SMTP transient failure, retrying once:', err.code);
      return await transport.sendMail(mailOptions);
    }
    throw err;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function htmlEmail(link) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:30px 15px;background:#f4f7f5;font-family:Arial,sans-serif;color:#172019;">

<div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #dfe7e1;border-radius:12px;overflow:hidden;">

<div style="padding:22px 28px;background:#fbfdfb;border-bottom:1px solid #e7ece8;">
<div style="font-size:13px;font-weight:bold;letter-spacing:1.2px;color:#173c23;">OVESHMALPURA CYBER LABS</div>
<div style="margin-top:5px;font-size:12px;color:#6b776f;">Client Portal Security</div>
</div>

<div style="padding:32px 28px;">

<h1 style="margin:0 0 16px;font-size:24px;color:#172019;">Password Reset Request</h1>

<p style="font-size:15px;line-height:1.65;color:#465249;">
We received a request to reset the password for your OveshMalpura Cyber Labs Client Portal account.
</p>

<p style="font-size:15px;line-height:1.65;color:#465249;">
You can securely create or reset your Client Portal password using the button below — this works
regardless of how you originally signed in.
</p>

<a href="${escapeHtml(link)}" style="display:inline-block;background:#176b35;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 22px;border-radius:7px;">
Reset Your Client Portal Password
</a>

<div style="margin-top:26px;padding-top:20px;border-top:1px solid #e7ece8;">
<p style="font-size:13px;line-height:1.6;color:#6b776f;">
For your security, this link expires in 30 minutes and can only be used once.
</p>
<p style="font-size:13px;line-height:1.6;color:#6b776f;">
If you didn't request this, no action is required — your account is unaffected.
</p>
</div>

</div>

<div style="padding:18px 28px;background:#fbfdfb;border-top:1px solid #e7ece8;">
<p style="font-size:12px;line-height:1.5;color:#7b857e;">
This is an automated security message from OveshMalpura Cyber Labs Client Portal.
Please do not reply to this email.
</p>
</div>

</div>

</body>
</html>
`;
}

function textEmail(link) {
  return `
OveshMalpura Cyber Labs
Client Portal Security

Password Reset Request

We received a request to reset the password for your OveshMalpura Cyber Labs Client Portal account.

You can securely create or reset your Client Portal password using this link (works regardless of how
you originally signed in):

${link}

For your security, this link expires in 30 minutes and can only be used once.

If you didn't request this, no action is required — your account is unaffected.

This is an automated security message from OveshMalpura Cyber Labs Client Portal.
`;
}

module.exports = async (req, res) => {

  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const rawEmail = req.body?.email;

  const email =
    typeof rawEmail === 'string'
      ? rawEmail.trim().toLowerCase()
      : '';

  if (!email) {
    return res.status(400).json({
      error: 'Missing email'
    });
  }

  console.log('PASSWORD RESET REQUEST RECEIVED');

  const siteUrl = (
    process.env.SITE_URL ||
    'https://malpuraovesh.vercel.app'
  ).replace(/\/$/, '');

  try {

    const firebase = getAdmin();

    /*
     * Find the account. This now applies to EVERY account regardless of
     * which provider(s) it has — Google, Microsoft, password, or any
     * combination. Setting a Client Portal password is always allowed;
     * it's simply added as another sign-in method on the same UID.
     */
    let user;

    try {
      user = await firebase.auth().getUserByEmail(email);
      console.log('PASSWORD RESET: account found, uid=' + user.uid + ', providers=' + JSON.stringify((user.providerData || []).map(p => p.providerId)));
    } catch (error) {

      // Don't reveal whether the account exists.
      if (error.code === 'auth/user-not-found') {
        console.log('PASSWORD RESET: no account found for this email — skipping silently');
        return res.status(200).json({
          ok: true
        });
      }

      console.error('PASSWORD RESET: unexpected error during account lookup:', error.code || error.message);
      throw error;
    }

    /*
     * Generate our own cryptographically secure, single-use token.
     * Only a SHA-256 hash of it is stored — the raw token exists only in
     * the email link itself, never persisted anywhere.
     */
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + TOKEN_TTL_MS;

    await firebase.firestore().collection('passwordResetTokens').doc(tokenHash).set({
      uid: user.uid,
      expiresAt,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('PASSWORD RESET: token issued, expires in 30 min');

    const resetLink = `${siteUrl}/reset-password.html?token=${token}`;

    /*
     * ZOHO IS THE ONLY EMAIL SENDER.
     */
    console.log('ZOHO SMTP SEND STARTED');

    const result =
      await sendWithOneRetry(getTransporter(), {
        from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
        to: email,
        replyTo: process.env.ZOHO_USER,
        subject: 'Reset Your OveshMalpura Cyber Labs Client Portal Password',
        text: textEmail(resetLink),
        html: htmlEmail(resetLink),
        headers: { 'X-Auto-Response-Suppress': 'All' }
      });

    console.log('ZOHO SMTP MESSAGE ACCEPTED:', result.messageId);

    return res.status(200).json({
      ok: true,
      mailer: 'zoho'
    });

  } catch (error) {

    console.error('PASSWORD RESET SEND FAILED:', error.code || error.message);

    return res.status(500).json({
      error: 'Could not send reset email'
    });
  }
};
