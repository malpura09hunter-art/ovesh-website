const crypto = require('crypto');
const admin = require('firebase-admin');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is not configured');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is invalid');
  }
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function requireFirebaseUser(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    const error = new Error('Authentication required. Please sign in to OVESH CLOUD again.');
    error.statusCode = 401;
    throw error;
  }
  initFirebaseAdmin();
  try {
    return await admin.auth().verifyIdToken(header.slice(7));
  } catch {
    const error = new Error('Your OVESH CLOUD session has expired. Please sign in again.');
    error.statusCode = 401;
    throw error;
  }
}

function cfg() {
  const endpoint = String(process.env.B2_ENDPOINT || '').trim().replace(/\/$/, '');
  const region = String(process.env.B2_REGION || '').trim();
  const bucket = String(process.env.B2_BUCKET || '').trim();
  const keyId = String(process.env.B2_KEY_ID || '').trim();
  const applicationKey = String(process.env.B2_APPLICATION_KEY || '').trim();
  const missing = [];
  if (!endpoint) missing.push('B2_ENDPOINT');
  if (!region) missing.push('B2_REGION');
  if (!bucket) missing.push('B2_BUCKET');
  if (!keyId) missing.push('B2_KEY_ID');
  if (!applicationKey) missing.push('B2_APPLICATION_KEY');
  if (missing.length) {
    const error = new Error(`Backblaze is not configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
  if (!/^https:\/\//i.test(endpoint)) {
    const error = new Error('B2_ENDPOINT must start with https://');
    error.statusCode = 500;
    throw error;
  }
  return { endpoint, region, bucket, keyId, applicationKey };
}

function client() {
  const c = cfg();
  return {
    c,
    s3: new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: c.keyId, secretAccessKey: c.applicationKey }
    })
  };
}

function safeName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  return base || 'file';
}
function safeFolder(folder) {
  return String(folder || 'ovesh-cloud').split('/').map(x => x.replace(/[^a-zA-Z0-9._-]/g, '_')).filter(Boolean).join('/').slice(0, 300);
}
function ownedKey(uid, key) {
  const value = String(key || '');
  return value.startsWith(`users/${uid}/`) && !value.includes('..');
}
function sendError(res, error) {
  console.error('Backblaze API:', error);
  const status = Number(error && error.statusCode) || 500;
  const message = status >= 500 ? String(error?.message || 'Backblaze storage request failed.') : String(error?.message || 'Request failed.');
  return res.status(status).json({ ok: false, error: message });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const user = await requireFirebaseUser(req);
    const { c, s3 } = client();
    const body = req.body || {};
    const action = body.action;

    if (action === 'status') {
      await s3.send(new HeadBucketCommand({ Bucket: c.bucket }));
      return res.status(200).json({ ok: true, storageProvider: 'backblaze-b2', bucketConfigured: true });
    }

    if (action === 'presign-upload') {
      const fileName = safeName(body.fileName);
      const objectKey = `users/${user.uid}/${safeFolder(body.folder)}/${crypto.randomUUID()}-${fileName}`;
      const command = new PutObjectCommand({
        Bucket: c.bucket,
        Key: objectKey,
        ContentType: String(body.contentType || 'application/octet-stream').slice(0, 200)
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
      return res.status(200).json({ ok: true, uploadUrl, objectKey, expiresIn: 900, storageProvider: 'backblaze-b2' });
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
    return sendError(res, error);
  }
};
