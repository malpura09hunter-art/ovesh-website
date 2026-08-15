const nodemailer = require('nodemailer');

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
      console.warn('ZOHO SMTP transient failure on login alert, retrying once:', err.code);
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

// Very lightweight user-agent parse — just enough to show something
// readable, not a full device-detection library.
function parseDevice(ua) {
  if (!ua) return 'Unknown device';
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  return `${browser} on ${os}`;
}

function loginAlertHtml({ name, device, time, ip, resetUrl }) {
  const safeName = escapeHtml(name) || 'there';
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

<h1 style="margin:0 0 16px;font-size:24px;color:#172019;">New sign-in to your account</h1>

<p style="font-size:15px;line-height:1.65;color:#465249;">
Hi ${safeName}, your OveshMalpura Cyber Labs Client Portal account was just signed into. Here are the details:
</p>

<table style="width:100%;border-collapse:collapse;margin:20px 0;background:#fbfdfb;border:1px solid #e7ece8;border-radius:8px;">
<tr>
<td style="padding:12px 16px;font-size:12px;color:#6b776f;letter-spacing:0.5px;border-bottom:1px solid #e7ece8;">DEVICE</td>
<td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;border-bottom:1px solid #e7ece8;">${escapeHtml(device)}</td>
</tr>
<tr>
<td style="padding:12px 16px;font-size:12px;color:#6b776f;letter-spacing:0.5px;border-bottom:1px solid #e7ece8;">TIME</td>
<td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;border-bottom:1px solid #e7ece8;">${escapeHtml(time)}</td>
</tr>
<tr>
<td style="padding:12px 16px;font-size:12px;color:#6b776f;letter-spacing:0.5px;">IP ADDRESS</td>
<td style="padding:12px 16px;font-size:14px;color:#172019;text-align:right;">${escapeHtml(ip)}</td>
</tr>
</table>

<p style="font-size:15px;line-height:1.65;color:#465249;margin:0 0 4px;">
<strong>Was this you?</strong> No action needed — you can ignore this email.
</p>

<p style="font-size:15px;line-height:1.65;color:#465249;margin:16px 0 20px;">
<strong>Wasn't you?</strong> Secure your account immediately:
</p>

<a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#c0293f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 22px;border-radius:7px;">Secure My Account</a>

<div style="margin-top:26px;padding-top:20px;border-top:1px solid #e7ece8;">
<p style="font-size:13px;line-height:1.6;color:#6b776f;">
This alert is sent every time your account is signed into, as a security precaution.
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, name, userAgent } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  const siteUrl = process.env.SITE_URL || 'https://malpuraovesh.vercel.app';
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Unknown';
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
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
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('LOGIN ALERT EMAIL SEND FAILED:', err.code || err.message);
    // Never block login on this failing — the alert is a nice-to-have.
    res.status(500).json({ error: 'Could not send login alert' });
  }
};
