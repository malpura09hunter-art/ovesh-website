const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Reuse the transporter across warm invocations instead of recreating it.
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

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function welcomeHtml(name, siteUrl) {
  const safeName = escapeHtml(name) || 'there';
  return `
  <div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#060f06;border:1px solid rgba(0,255,65,0.25);border-radius:10px;padding:32px;">
      <p style="font-family:monospace;color:#00aa22;letter-spacing:2px;font-size:11px;text-transform:uppercase;margin:0 0 8px;">Client Portal</p>
      <h1 style="color:#39ff14;font-size:22px;margin:0 0 20px;">Welcome, ${safeName}</h1>
      <p style="color:#c8ffd4;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Your account with <strong>OveshMalpura Cyber Labs</strong> is set up. You can now sign in to your
        client portal to browse services, request work, and track your requests.
      </p>
      <a href="${siteUrl}/login.html" style="display:inline-block;background:#00cc33;color:#021002;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px;margin:8px 0 20px;">Go to Client Portal</a>
      <p style="color:#4a7a52;font-size:13px;line-height:1.5;margin:0;">
        If you didn't create this account, you can ignore this email.
      </p>
    </div>
  </div>`;
}

function termsHtml(name, siteUrl) {
  const safeName = escapeHtml(name) || 'there';
  return `
<!DOCTYPE html><html><body style="margin:0;padding:30px 15px;background:#f4f7f5;font-family:Arial,sans-serif;color:#172019;">
<div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dfe7e1;border-radius:12px;overflow:hidden;">
<div style="padding:22px 28px;background:#fbfdfb;border-bottom:1px solid #e7ece8;">
<div style="font-size:13px;font-weight:bold;letter-spacing:1.2px;color:#173c23;">OVESHMALPURA CYBER LABS</div>
<div style="margin-top:5px;font-size:12px;color:#6b776f;">Client Portal</div></div>
<div style="padding:32px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;color:#172019;">Terms &amp; Privacy Information</h1>
<p style="font-size:15px;line-height:1.65;color:#465249;">Hi ${safeName},</p>
<p style="font-size:15px;line-height:1.65;color:#465249;">We are sharing the current Terms &amp; Conditions and Privacy Policy information for your OveshMalpura Cyber Labs Client Portal account. Please review the information that applies to your use of the website and services.</p>
<div style="margin:22px 0;">
<a href="${siteUrl}/sign-agreement.html" style="display:inline-block;background:#176b35;color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 20px;border-radius:7px;margin:0 8px 10px 0;">View Terms &amp; Conditions</a>
<a href="${siteUrl}/privacy-policy.html" style="display:inline-block;background:#fff;color:#176b35;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 20px;border-radius:7px;border:1px solid #176b35;margin:0 0 10px;">View Privacy Policy</a>
</div>
<p style="font-size:13px;line-height:1.6;color:#6b776f;margin:22px 0 0;">If you have questions about an applicable project agreement, quotation, or service request, please refer to the relevant project documentation.</p>
</div>
<div style="padding:18px 28px;background:#fbfdfb;border-top:1px solid #e7ece8;"><p style="font-size:12px;line-height:1.5;color:#7b857e;margin:0;">OveshMalpura Cyber Labs Client Portal · This is a service information email.</p></div>
</div></body></html>`;
}

function termsText(name, siteUrl) {
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


function parseDevice(ua) {
  if (!ua) return 'Unknown device';
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown browser';
  if (/Edg\\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\\//i.test(ua)) browser = 'Safari';

  return `${browser} on ${os}`;
}

function loginAlertHtml({ name, device, time, ip, resetUrl }) {
  const safeName = escapeHtml(name) || 'there';
  return `
<!DOCTYPE html><html><body style="margin:0;padding:30px 15px;background:#f4f7f5;font-family:Arial,sans-serif;color:#172019;">
<div style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #dfe7e1;border-radius:12px;overflow:hidden;">
<div style="padding:22px 28px;background:#fbfdfb;border-bottom:1px solid #e7ece8;">
<div style="font-size:13px;font-weight:bold;letter-spacing:1.2px;color:#173c23;">OVESHMALPURA CYBER LABS</div>
<div style="margin-top:5px;font-size:12px;color:#6b776f;">Client Portal Security</div></div>
<div style="padding:32px 28px;">
<h1 style="margin:0 0 16px;font-size:24px;color:#172019;">New sign-in to your account</h1>
<p style="font-size:15px;line-height:1.65;color:#465249;">Hi ${safeName}, your OveshMalpura Cyber Labs Client Portal account was just signed into. Here are the details:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fbfdfb;border:1px solid #e7ece8;border-radius:8px;">
<tr><td style="padding:12px 16px;font-size:12px;color:#6b776f;letter-spacing:0.5px;border-bottom:1px solid #e7ece8;">DEVICE</td><td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;border-bottom:1px solid #e7ece8;">${escapeHtml(device)}</td></tr>
<tr><td style="padding:12px 16px;font-size:12px;color:#6b776f;letter-spacing:0.5px;border-bottom:1px solid #e7ece8;">TIME</td><td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;border-bottom:1px solid #e7ece8;">${escapeHtml(time)}</td></tr>
<tr><td style="padding:12px 16px;font-size:12px;color:#6b776f;letter-spacing:0.5px;">IP ADDRESS</td><td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;">${escapeHtml(ip)}</td></tr>
</table>
<p style="font-size:15px;line-height:1.65;color:#465249;margin:0 0 4px;"><strong>Was this you?</strong> No action needed — you can ignore this email.</p>
<p style="font-size:15px;line-height:1.65;color:#465249;margin:16px 0 20px;"><strong>Wasn't you?</strong> Secure your account immediately:</p>
<a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#c0293f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 22px;border-radius:7px;">Secure My Account</a>
<div style="margin-top:26px;padding-top:20px;border-top:1px solid #e7ece8;"><p style="font-size:13px;line-height:1.6;color:#6b776f;">This alert is sent every time your account is signed into, as a security precaution.</p></div>
</div>
<div style="padding:18px 28px;background:#fbfdfb;border-top:1px solid #e7ece8;"><p style="font-size:12px;line-height:1.5;color:#7b857e;">This is an automated security message from OveshMalpura Cyber Labs Client Portal. Please do not reply to this email.</p></div>
</div></body></html>`;
}

function loginAlertText({ name, device, time, ip, resetUrl }) {
  return `
OveshMalpura Cyber Labs
Client Portal Security

New sign-in to your account

Hi ${name || 'there'}, your OveshMalpura Cyber Labs Client Portal account was just signed into.

Device: ${device}
Time: ${time}
IP address: ${ip}

Was this you? No action needed.
Wasn't you? Secure your account now: ${resetUrl}

This alert is sent every time your account is signed into, as a security precaution.

This is an automated security message from OveshMalpura Cyber Labs Client Portal.
`;
}

async function verifyAdmin(req, firebase) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new Error('Missing authorization');
  const decoded = await firebase.auth().verifyIdToken(header.slice(7));
  const adminDoc = await firebase.firestore().collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists) throw new Error('Admin access required');
  return decoded;
}

async function sendTermsPolicyToLoggedInUsers(firebase, siteUrl) {
  const snap = await firebase.firestore().collection('users').get();
  const recipients = [];
  const seen = new Set();

  snap.forEach(doc => {
    const data = doc.data() || {};
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (!email || !data.lastLogin || seen.has(email)) return;
    seen.add(email);
    recipients.push({ email, name: data.fullName || '' });
  });

  let sent = 0, failed = 0;
  const sentRecipients = [];
  const failures = [];
  const transport = getTransporter();

  for (let i = 0; i < recipients.length; i += 4) {
    const batch = recipients.slice(i, i + 4);
    const results = await Promise.all(batch.map(async recipient => {
      try {
        await transport.sendMail({
          from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
          to: recipient.email,
          replyTo: process.env.ZOHO_USER,
          subject: 'OveshMalpura Cyber Labs — Terms & Privacy Information',
          text: termsText(recipient.name, siteUrl),
          html: termsHtml(recipient.name, siteUrl),
          headers: { 'X-Auto-Response-Suppress': 'All' }
        });
        return { ok: true, email: recipient.email, name: recipient.name };
      } catch (error) {
        console.error('POLICY EMAIL FAILED:', recipient.email, error.code || error.message);
        return { ok: false, email: recipient.email, error: error.code || error.message };
      }
    }));
    for (const result of results) {
      if (result.ok) { sent++; sentRecipients.push({ email: result.email, name: result.name }); }
      else { failed++; failures.push({ email: result.email, error: result.error }); }
    }
  }
  return { attempted: recipients.length, sent, failed, sentRecipients, failures };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  if (body.mode === 'login-alert') {
    const { email, name, userAgent } = body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Missing email' });
    }

    const siteUrl = process.env.SITE_URL || 'https://malpuraovesh.vercel.app';
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Unknown';
    const time = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    }) + ' IST';
    const device = parseDevice(userAgent);

    console.log('LOGIN ALERT EMAIL SEND STARTED');

    try {
      const result = await sendWithOneRetry(getTransporter(), {
        from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
        to: email,
        replyTo: process.env.ZOHO_USER,
        subject: 'New sign-in to your OveshMalpura Cyber Labs account',
        text: loginAlertText({ name, device, time, ip, resetUrl: `${siteUrl}/login.html` }),
        html: loginAlertHtml({ name, device, time, ip, resetUrl: `${siteUrl}/login.html` }),
        headers: { 'X-Auto-Response-Suppress': 'All' }
      });
      console.log('LOGIN ALERT EMAIL ACCEPTED:', result.messageId);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('LOGIN ALERT EMAIL SEND FAILED:', err.code || err.message);
      return res.status(500).json({ error: 'Could not send login alert' });
    }
  }


  // Admin-only bulk Terms & Privacy email mode. This keeps the existing
  // welcome-email endpoint while avoiding an extra Vercel serverless function.
  if (body.mode === 'terms-policy') {
    try {
      const firebase = (() => {
        if (!admin.apps.length) {
          const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '', 'base64').toString('utf8');
          if (!raw) throw new Error('Firebase service account is not configured');
          admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
        }
        return admin;
      })();
      await verifyAdmin(req, firebase);
      const siteUrl = (process.env.SITE_URL || 'https://malpuraovesh.vercel.app').replace(/\/$/, '');
      const result = await sendTermsPolicyToLoggedInUsers(firebase, siteUrl);
      return res.status(200).json({ ok: result.failed === 0, ...result });
    } catch (error) {
      console.error('POLICY EMAIL BULK SEND FAILED:', error.code || error.message);
      const status = error.message === 'Admin access required' || error.message === 'Missing authorization' ? 403 : 500;
      return res.status(status).json({ error: error.message || 'Could not send policy email' });
    }
  }

  const { email, name } = body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  const siteUrl = process.env.SITE_URL || 'https://malpuraovesh.vercel.app';
  console.log('WELCOME EMAIL SEND STARTED');

  try {
    const result = await sendWithOneRetry(getTransporter(), {
      from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
      to: email,
      subject: 'Welcome to OveshMalpura Cyber Labs',
      html: welcomeHtml(name, siteUrl)
    });
    console.log('WELCOME EMAIL ACCEPTED:', result.messageId);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('WELCOME EMAIL SEND FAILED:', err.code || err.message);
    res.status(500).json({ error: 'Could not send welcome email' });
  }
};
