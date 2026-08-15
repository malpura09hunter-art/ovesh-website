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
  <div style="background:#030a03;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#060f06;border:1px solid rgba(0,255,65,0.25);border-radius:10px;padding:32px;">
      <p style="font-family:monospace;color:#00aa22;letter-spacing:2px;font-size:11px;text-transform:uppercase;margin:0 0 8px;">Security Alert</p>
      <h1 style="color:#39ff14;font-size:22px;margin:0 0 20px;">New sign-in to your account</h1>
      <p style="color:#c8ffd4;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi ${safeName}, your OveshMalpura Cyber Labs account was just signed into.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="color:#4a7a52;font-size:13px;padding:6px 0;font-family:monospace;">DEVICE</td>
          <td style="color:#c8ffd4;font-size:14px;padding:6px 0;text-align:right;">${escapeHtml(device)}</td>
        </tr>
        <tr>
          <td style="color:#4a7a52;font-size:13px;padding:6px 0;font-family:monospace;">TIME</td>
          <td style="color:#c8ffd4;font-size:14px;padding:6px 0;text-align:right;">${escapeHtml(time)}</td>
        </tr>
        <tr>
          <td style="color:#4a7a52;font-size:13px;padding:6px 0;font-family:monospace;">IP ADDRESS</td>
          <td style="color:#c8ffd4;font-size:14px;padding:6px 0;text-align:right;">${escapeHtml(ip)}</td>
        </tr>
      </table>
      <p style="color:#c8ffd4;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Was this you? No action needed.
      </p>
      <p style="color:#c8ffd4;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Wasn't you? Secure your account now:
      </p>
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#ff4455;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px;">Reset Your Password</a>
    </div>
  </div>`;
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
      subject: 'New sign-in to your OveshMalpura Cyber Labs account',
      html: loginAlertHtml({ name, device, time, ip, resetUrl: `${siteUrl}/login.html` })
    });
    console.log('LOGIN ALERT EMAIL ACCEPTED:', result.messageId);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('LOGIN ALERT EMAIL SEND FAILED:', err.code || err.message);
    // Never block login on this failing — the alert is a nice-to-have.
    res.status(500).json({ error: 'Could not send login alert' });
  }
};
