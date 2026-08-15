const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

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
      // Fail fast instead of hanging until Vercel's function timeout kills
      // the request with no email sent and no clean error surfaced.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000
    });
  }

  return transporter;
}

// Transient connection-level errors are worth one retry (a fresh SMTP
// connection can succeed where a flaky one failed). Auth failures,
// rejected recipients, and config errors are NOT retried — retrying those
// just delays a real failure and risks duplicate sends once the underlying
// problem is eventually fixed.
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

function htmlEmail(link) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:30px 15px;background:#f4f7f5;font-family:Arial,sans-serif;color:#172019;">

<div style="
max-width:560px;
margin:auto;
background:#ffffff;
border:1px solid #dfe7e1;
border-radius:12px;
overflow:hidden;
">

<div style="
padding:22px 28px;
background:#fbfdfb;
border-bottom:1px solid #e7ece8;
">

<div style="
font-size:13px;
font-weight:bold;
letter-spacing:1.2px;
color:#173c23;
">
OVESHMALPURA CYBER LABS
</div>

<div style="
margin-top:5px;
font-size:12px;
color:#6b776f;
">
Client Portal Security
</div>

</div>

<div style="padding:32px 28px;">

<h1 style="
margin:0 0 16px;
font-size:24px;
color:#172019;
">
Password reset request
</h1>

<p style="
font-size:15px;
line-height:1.65;
color:#465249;
">
We received a request to reset the password for your
OveshMalpura Cyber Labs Client Portal account.
</p>

<p style="
font-size:15px;
line-height:1.65;
color:#465249;
">
If you made this request, use the button below to choose a new password.
</p>

<a href="${escapeHtml(link)}"
style="
display:inline-block;
background:#176b35;
color:#ffffff;
text-decoration:none;
font-size:15px;
font-weight:bold;
padding:13px 22px;
border-radius:7px;
">
Reset Password
</a>

<div style="
margin-top:26px;
padding-top:20px;
border-top:1px solid #e7ece8;
">

<p style="
font-size:13px;
line-height:1.6;
color:#6b776f;
">
For your security, this password-reset link is temporary
and can only be used once.
</p>

<p style="
font-size:13px;
line-height:1.6;
color:#6b776f;
">
If you did not request a password reset, no action is required.
Your password will remain unchanged.
</p>

</div>

</div>

<div style="
padding:18px 28px;
background:#fbfdfb;
border-top:1px solid #e7ece8;
">

<p style="
font-size:12px;
line-height:1.5;
color:#7b857e;
">
This is an automated security message from
OveshMalpura Cyber Labs Client Portal.
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

Password reset request

We received a request to reset the password for your OveshMalpura Cyber Labs Client Portal account.

Use this link to choose a new password:

${link}

If you did not request a password reset, no action is required.
Your password will remain unchanged.

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
     * Find the account.
     */
    let user;

    try {
      user = await firebase.auth().getUserByEmail(email);
    } catch (error) {

      // Don't reveal whether the account exists.
      if (error.code === 'auth/user-not-found') {
        return res.status(200).json({
          ok: true
        });
      }

      throw error;
    }

    /*
     * ONLY email/password accounts
     * can reset a password here.
     */
    const isEmailPasswordAccount =
      Array.isArray(user.providerData) &&
      user.providerData.some(
        provider => provider?.providerId === 'password'
      );

    if (!isEmailPasswordAccount) {
      return res.status(200).json({
        ok: true
      });
    }

    /*
     * Firebase generates the secure reset code.
     * Firebase does NOT send the email.
     */
    const firebaseLink =
      await firebase.auth().generatePasswordResetLink(
        email,
        {
          url: `${siteUrl}/reset-password.html`
        }
      );

    const firebaseUrl = new URL(firebaseLink);

    const oobCode =
      firebaseUrl.searchParams.get('oobCode');

    if (!oobCode) {
      throw new Error('Firebase did not return reset code');
    }

    console.log('FIREBASE RESET CREDENTIAL GENERATED');

    /*
     * Your branded reset page.
     */
    const resetLink =
      `${siteUrl}/reset-password.html` +
      `?mode=resetPassword` +
      `&oobCode=${encodeURIComponent(oobCode)}`;

    /*
     * ZOHO IS THE ONLY EMAIL SENDER.
     */
    console.log('ZOHO SMTP SEND STARTED');

    const result =
      await sendWithOneRetry(getTransporter(), {

        from:
          `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,

        to: email,

        replyTo:
          process.env.ZOHO_USER,

        subject:
          'Password reset request | OveshMalpura Cyber Labs',

        text:
          textEmail(resetLink),

        html:
          htmlEmail(resetLink),

        headers: {
          'X-Auto-Response-Suppress': 'All'
        }

      });

    console.log(
      'ZOHO SMTP MESSAGE ACCEPTED:',
      result.messageId
    );

    return res.status(200).json({
      ok: true,
      mailer: 'zoho'
    });

  } catch (error) {

    console.error(
      'PASSWORD RESET SEND FAILED:',
      error.code || error.message
    );

    return res.status(500).json({
      error: 'Could not send reset email'
    });
  }
};
