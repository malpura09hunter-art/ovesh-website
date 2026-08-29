const crypto = require('crypto');
const admin = require('firebase-admin');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not configured');
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
async function requireFirebaseUser(req) {
  const h = String(req.headers.authorization || '');
  if (!h.startsWith('Bearer ')) throw new Error('Authentication required');
  initFirebaseAdmin();
  return admin.auth().verifyIdToken(h.slice(7));
}
function cfg() {
  const endpoint = String(process.env.B2_ENDPOINT || '').replace(/\/$/, '');
  const region = process.env.B2_REGION, bucket = process.env.B2_BUCKET;
  const keyId = process.env.B2_KEY_ID, applicationKey = process.env.B2_APPLICATION_KEY;
  if (!endpoint || !region || !bucket || !keyId || !applicationKey) throw new Error('Backblaze B2 is not fully configured in Vercel.');
  return { endpoint, region, bucket, keyId, applicationKey };
}
function client() {
  const c = cfg();
  return { c, s3: new S3Client({ region: c.region, endpoint: c.endpoint, forcePathStyle: true, credentials: { accessKeyId: c.keyId, secretAccessKey: c.applicationKey } }) };
}
function safeName(name) { const base = String(name || 'file').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180); return base || 'file'; }
function safeFolder(folder) { return String(folder || 'ovesh-cloud').split('/').map(x => x.replace(/[^a-zA-Z0-9._-]/g, '_')).filter(Boolean).join('/').slice(0, 300); }
function ownedKey(uid, key) { const s = String(key || ''); return s.startsWith(`users/${uid}/`) && !s.includes('..'); }
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const user = await requireFirebaseUser(req);
    const { c, s3 } = client();
    const body = req.body || {}, action = body.action;
    if (action === 'presign-upload') {
      const objectKey = `users/${user.uid}/${safeFolder(body.folder)}/${crypto.randomUUID()}-${safeName(body.fileName)}`;
      const command = new PutObjectCommand({ Bucket: c.bucket, Key: objectKey, ContentType: String(body.contentType || 'application/octet-stream').slice(0, 200) });
      return res.status(200).json({ ok: true, uploadUrl: await getSignedUrl(s3, command, { expiresIn: 900 }), objectKey, expiresIn: 900, storageProvider: 'backblaze-b2' });
    }
    if (action === 'presign-download') {
      const objectKey = String(body.objectKey || '');
      if (!ownedKey(user.uid, objectKey)) return res.status(403).json({ ok: false, error: 'Access denied.' });
      const command = new GetObjectCommand({ Bucket: c.bucket, Key: objectKey, ResponseContentDisposition: 'attachment' });
      return res.status(200).json({ ok: true, downloadUrl: await getSignedUrl(s3, command, { expiresIn: 900 }), expiresIn: 900 });
    }
    if (action === 'delete') {
      const objectKey = String(body.objectKey || '');
      if (!ownedKey(user.uid, objectKey)) return res.status(403).json({ ok: false, error: 'Access denied.' });
      await s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: objectKey }));
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Invalid Backblaze operation.' });
  } catch (error) {
    console.error('Backblaze API:', error);
    const msg = String(error?.message || error);
    const status = /Authentication required|auth\/id-token|ID token|Firebase ID token/i.test(msg) ? 401 : 500;
    return res.status(status).json({ ok: false, error: status === 401 ? 'Authentication required.' : msg });
  }
};
