const { S3Client, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || 'ovesh-cloud';
const MAX_WORKSPACE_BYTES = 5 * 1024 * 1024 * 1024;

function client() {
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) throw new Error('R2 environment variables are not configured.');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY }
  });
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(status).json(body);
}

function workspace(value) {
  const id = String(value || '');
  if (!/^[a-f0-9-]{16,80}$/i.test(id)) throw new Error('Invalid workspace.');
  return id;
}

function safeName(name) {
  const n = String(name || 'file').normalize('NFKC').replace(/[^a-zA-Z0-9._()\- ]/g, '_').trim();
  return (n || 'file').slice(0, 180);
}

async function list(s3, prefix) {
  const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: 1000 }));
  return (out.Contents || []).map(x => ({ key: x.Key, size: Number(x.Size || 0), updatedAt: x.LastModified || null })).filter(x => x.key !== prefix);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  try {
    const s3 = client();
    const action = String(req.query?.action || 'list');
    const ws = workspace(req.query?.workspace || req.body?.workspace);
    const prefix = `workspaces/${ws}/`;

    if (action === 'list') {
      const items = await list(s3, prefix);
      const used = items.reduce((a, x) => a + x.size, 0);
      return json(res, 200, { items, used, quota: MAX_WORKSPACE_BYTES });
    }

    if (action === 'presign-upload') {
      const name = safeName(req.query?.name);
      const size = Number(req.query?.size || 0);
      const type = String(req.query?.type || 'application/octet-stream').slice(0, 120);
      if (!Number.isFinite(size) || size <= 0 || size > 100 * 1024 * 1024) return json(res, 400, { error: 'Files must be between 1 byte and 100 MB.' });
      const items = await list(s3, prefix);
      const used = items.reduce((a, x) => a + x.size, 0);
      if (used + size > MAX_WORKSPACE_BYTES) return json(res, 413, { error: 'This workspace has reached its 5 GB limit.' });
      const key = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${name}`;
      const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: type }), { expiresIn: 900 });
      return json(res, 200, { url, key, name, size, type });
    }

    if (action === 'presign-download') {
      const key = String(req.query?.key || '');
      if (!key.startsWith(prefix)) return json(res, 403, { error: 'Invalid file.' });
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 900 });
      return json(res, 200, { url });
    }

    if (action === 'delete') {
      const key = String(req.body?.key || '');
      if (!key.startsWith(prefix)) return json(res, 403, { error: 'Invalid file.' });
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      return json(res, 200, { ok: true });
    }

    if (action === 'check') {
      const key = String(req.query?.key || '');
      if (!key.startsWith(prefix)) return json(res, 403, { error: 'Invalid file.' });
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return json(res, 200, { ok: true, size: head.ContentLength || 0 });
    }

    return json(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    console.error('OveshCloud R2 error:', e);
    return json(res, 500, { error: e.message || 'Storage service error.' });
  }
};
