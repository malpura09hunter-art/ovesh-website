// Temporary diagnostic endpoint — checks that required environment
// variables are present and well-formed, without sending any email or
// contacting Zoho/Firebase. Safe to delete once the email flow is confirmed
// working; does not print secret values, only pass/fail + safe metadata.
module.exports = async (req, res) => {
  const result = {};

  result.ZOHO_USER = process.env.ZOHO_USER
    ? { present: true, value: process.env.ZOHO_USER }
    : { present: false };

  result.ZOHO_APP_PASSWORD = process.env.ZOHO_APP_PASSWORD
    ? { present: true, length: process.env.ZOHO_APP_PASSWORD.length }
    : { present: false };

  result.SITE_URL = process.env.SITE_URL
    ? { present: true, value: process.env.SITE_URL }
    : { present: false };

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    result.FIREBASE_SERVICE_ACCOUNT_B64 = { present: false };
  } else {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    let entry = { present: true, length: b64.length };
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      try {
        const parsed = JSON.parse(decoded);
        entry.decodesToValidJson = true;
        entry.hasPrivateKey = !!parsed.private_key;
        entry.hasClientEmail = !!parsed.client_email;
        entry.projectId = parsed.project_id;
      } catch (e) {
        entry.decodesToValidJson = false;
        entry.jsonError = e.message;
        entry.decodedPreviewStart = decoded.slice(0, 30);
        entry.decodedPreviewEnd = decoded.slice(-30);
      }
    } catch (e) {
      entry.base64DecodeError = e.message;
    }
    result.FIREBASE_SERVICE_ACCOUNT_B64 = entry;
  }

  res.status(200).json(result);
};
