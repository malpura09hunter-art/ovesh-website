const nodemailer = require('nodemailer');

// Reuse the transporter across warm invocations instead of recreating it
// on every request.
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { email, name } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  const siteUrl = process.env.SITE_URL || 'https://malpuraovesh.vercel.app';

  try {
    await getTransporter().sendMail({
      from: `"OveshMalpura Cyber Labs" <${process.env.ZOHO_USER}>`,
      to: email,
      subject: 'Welcome to OveshMalpura Cyber Labs',
      html: welcomeHtml(name, siteUrl)
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-welcome failed:', err.message);
    // Never block the signup flow on the client side — the account
    // already exists regardless of whether this email sends.
    res.status(500).json({ error: 'Could not send welcome email' });
  }
};
