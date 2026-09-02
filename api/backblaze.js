const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 120;
const requestCounts = new Map();

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return i < 0 ? [x, ''] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function requireCloudSession(req) {
  const token = parseCookies(req).__Host_ovesh_cloud_session;
  if (!token) {
    const e = new Error('Secure OVESH CLOUD session is not ready. Please sign in again.');
    e.statusCode = 401;
    throw e;
  }
  const [payload, sig] = token.split('.');
  const secret = process.env.OVESH_CLOUD_SESSION_SECRET;
  if (!payload || !sig || !secret || secret.length < 32) {
    const e = new Error('Secure OVESH CLOUD session is unavailable.');
    e.statusCode = 401;
    throw e;
  }
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const e = new Error('Secure OVESH CLOUD session is invalid. Please sign in again.');
    e.statusCode = 401;
    throw e;
  }
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch {
    const e = new Error('Secure OVESH CLOUD session is invalid.');
    e.statusCode = 401;
    throw e;
  }
  if (!data.exp || Date.now() > Number(data.exp)) {
    const e = new Error('Secure OVESH CLOUD session has expired. Please sign in again.');
    e.statusCode = 401;
    throw e;
  }
  return { uid: String(data.u || 'OVESH').replace(/[^a-zA-Z0-9._-]/g, '_') };
}
function rateLimited(key) {
  const now = Date.now();
  const old = requestCounts.get(key);
  if (!old || now - old.startedAt > WINDOW_MS) {
    requestCounts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  old.count += 1;
  return old.count > MAX_REQUESTS;
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
    const e = new Error('Backblaze storage is not configured.');
    e.statusCode = 503;
    console.error('Backblaze missing server configuration:', missing.join(','));
    throw e;
  }
  return { endpoint, region, bucket, keyId, applicationKey };
}
function client() {
  const c = cfg();
  return { c, s3: new S3Client({ region: c.region, endpoint: c.endpoint, forcePathStyle: false, credentials: { accessKeyId: c.keyId, secretAccessKey: c.applicationKey } }) };
}
const safeName = n => (String(n || 'file').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file');
const safeFolder = f => String(f || 'ovesh-cloud').split('/').map(x => x.replace(/[^a-zA-Z0-9._-]/g, '_')).filter(Boolean).join('/').slice(0, 300);
const ownedKey = (uid, key) => String(key || '').startsWith(`users/${uid}/`) && !String(key || '').includes('..');
const mimeForName = name => {
  const e = String(name || '').split('.').pop().toLowerCase();
  return ({ jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', avif:'image/avif', pdf:'application/pdf', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt:'application/vnd.ms-powerpoint', txt:'text/plain', md:'text/markdown', json:'application/json', csv:'text/csv', html:'text/html', css:'text/css', js:'text/javascript', ts:'text/plain', tsx:'text/plain', jsx:'text/plain', xml:'application/xml', log:'text/plain', yml:'text/plain', yaml:'text/plain', mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', m4v:'video/mp4', mp3:'audio/mpeg', wav:'audio/wav', m4a:'audio/mp4', aac:'audio/aac', flac:'audio/flac' })[e] || 'application/octet-stream';
};
function sendError(res, error) {
  console.error('Backblaze API:', error?.code || error?.message || error);
  const status = Number(error?.statusCode) || 500;
  return res.status(status).json({ ok: false, error: status === 401 ? 'Authentication required.' : status === 403 ? 'Access denied.' : status === 429 ? 'Too many storage requests. Please try again later.' : status === 503 ? 'Storage service is temporarily unavailable.' : 'Backblaze storage request failed.' });
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const user = requireCloudSession(req);
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (rateLimited(`b2:${ip}:${user.uid}`)) return res.status(429).json({ ok: false, error: 'Too many storage requests. Please try again later.' });
    const { c, s3 } = client();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'status') {
      await s3.send(new HeadBucketCommand({ Bucket: c.bucket }));
      return res.status(200).json({ ok: true, storageProvider: 'backblaze-b2', bucketConfigured: true });
    }
    if (action === 'list-files') {
      const prefix = `users/${user.uid}/`;
      const out = await s3.send(new ListObjectsV2Command({ Bucket: c.bucket, Prefix: prefix, MaxKeys: 1000 }));
      const items = (out.Contents || []).filter(x => x.Key && x.Key !== prefix).map(x => {
        const key = String(x.Key), name = key.split('/').pop().replace(/^[0-9a-f-]{36}-/i, '');
        return { id: key, objectKey: key, url: key, name, size: Number(x.Size || 0), contentType: mimeForName(name), storageProvider: 'backblaze-b2', createdAt: x.LastModified ? new Date(x.LastModified).toISOString() : null };
      });
      return res.status(200).json({ ok: true, files: items, storageProvider: 'backblaze-b2' });
    }
    if (action === 'configure-cors') return res.status(400).json({ ok: false, error: 'CORS is managed in Backblaze bucket settings and is not changed automatically by OVESH CLOUD.' });

    if (action === 'presign-upload') {
      const fileName = safeName(body.fileName);
      const size = Number(body.size);
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) return res.status(413).json({ ok: false, error: 'File is too large. Maximum upload size is 50 MB.' });
      const objectKey = `users/${user.uid}/${safeFolder(body.folder)}/${crypto.randomUUID()}-${fileName}`;
      const contentType = mimeForName(fileName);
      const command = new PutObjectCommand({ Bucket: c.bucket, Key: objectKey, ContentLength: size, ContentType: contentType });
      return res.status(200).json({ ok: true, uploadUrl: await getSignedUrl(s3, command, { expiresIn: 900 }), objectKey, expiresIn: 900, maxUploadBytes: MAX_UPLOAD_BYTES, storageProvider: 'backblaze-b2' });
    }

    if (action === 'presign-download' || action === 'presign-preview') {
      const objectKey = String(body.objectKey || '');
      if (!ownedKey(user.uid, objectKey)) return res.status(403).json({ ok: false, error: 'Access denied.' });
      const inline = action === 'presign-preview' || body.inline === true;
      const fileName = safeName(objectKey.split('/').pop().replace(/^[0-9a-f-]{36}-/i, 'file'));
      const contentType = mimeForName(fileName);
      const command = new GetObjectCommand({ Bucket: c.bucket, Key: objectKey, ResponseContentDisposition: `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`, ResponseContentType: contentType });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
      return res.status(200).json({ ok: true, [inline ? 'previewUrl' : 'downloadUrl']: signedUrl, expiresIn: 900 });
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
