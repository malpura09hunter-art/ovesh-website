import crypto from 'crypto';
import { getDb } from '../lib/oveshcloud-alerts.js';

function ownerSession(req) {
  const raw = String(req.headers.cookie || '');
  const item = raw.split(';').map(x => x.trim()).find(x => x.startsWith('ovesh_cloud_session='));
  if (!item) return false;
  let token = '';
  try { token = decodeURIComponent(item.slice('ovesh_cloud_session='.length)); } catch { return false; }
  const [payload, signature, extra] = token.split('.');
  const secret = process.env.OVESH_CLOUD_SESSION_SECRET || process.env.OVESH_CLOUD_PASSWORD;
  if (!payload || !signature || extra || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.u === (process.env.OVESH_CLOUD_USERNAME || 'OVESH') && Number(session.exp) > Date.now();
  } catch { return false; }
}

async function countCollection(db, name) {
  try {
    const result = await db.collection(name).count().get();
    return Number(result.data().count || 0);
  } catch {
    return null;
  }
}

async function getBriefing() {
  const db = getDb();
  const [files, requests, events] = await Promise.all([
    countCollection(db, 'oveshCloudFiles'),
    countCollection(db, 'service_requests'),
    db.collection('oveshCloudSecurityEvents').orderBy('createdAt', 'desc').limit(25).get().catch(() => null)
  ]);
  const recent = events ? events.docs.map(doc => {
    const item = doc.data() || {};
    return {
      severity: String(item.severity || 'info').toLowerCase(),
      eventType: String(item.eventType || 'security event').slice(0, 80),
      outcome: String(item.outcome || 'recorded').slice(0, 40)
    };
  }) : [];
  const high = recent.filter(x => x.severity === 'high' || x.severity === 'critical').length;
  return {
    files,
    requests,
    recentSecurityEvents: recent.length,
    highSeverityEvents: high,
    securityAvailable: Boolean(events)
  };
}

function answerFor(message, stats) {
  const q = String(message || '').toLowerCase();
  const count = value => value === null ? 'not available' : String(value);
  if (/\b(help|what can you do|commands)\b/.test(q)) {
    return 'I can give you a cloud briefing, report file metadata counts, summarize recent security events, and report service request totals. Try asking: cloud status, file count, or security status.';
  }
  if (/\b(security|alert|threat|suspicious|incident)\b/.test(q)) {
    if (!stats.securityAvailable) return 'I could not retrieve the security event summary right now. Your cloud session remains separate and unaffected.';
    if (stats.highSeverityEvents > 0) return 'The latest 25 recorded security events include ' + stats.highSeverityEvents + ' high or critical severity event' + (stats.highSeverityEvents === 1 ? '' : 's') + '. Please open the Security section to inspect the full records. I have not changed any access or files.';
    return 'I found no high or critical severity events in the latest ' + stats.recentSecurityEvents + ' recorded security events. Please use the Security section for the full event history.';
  }
  if (/\b(file|files|upload|storage)\b/.test(q)) {
    return stats.files === null ? 'The file metadata count is currently unavailable.' : 'OV CLOUD currently has ' + stats.files + ' file metadata record' + (stats.files === 1 ? '' : 's') + ' in its Firestore file index. This is an index count, not a measurement of Backblaze storage usage.';
  }
  if (/\b(client|order|request|project)\b/.test(q)) {
    return stats.requests === null ? 'The service request count is currently unavailable.' : 'I can see ' + stats.requests + ' service request record' + (stats.requests === 1 ? '' : 's') + ' in the workspace request collection.';
  }
  if (/\b(status|briefing|overview|summary|how are things|good morning|good afternoon|hello|hi)\b/.test(q)) {
    const fileText = stats.files === null ? 'File index count unavailable' : stats.files + ' file metadata records';
    const requestText = stats.requests === null ? 'service request count unavailable' : stats.requests + ' service requests';
    const securityText = stats.securityAvailable
      ? (stats.highSeverityEvents ? stats.highSeverityEvents + ' high or critical events among the latest ' + stats.recentSecurityEvents + ' security records' : 'no high or critical events among the latest ' + stats.recentSecurityEvents + ' security records')
      : 'security summary temporarily unavailable';
    return 'Your OV CLOUD owner session is active. The workspace index shows ' + fileText + ' and ' + requestText + '. Security summary: ' + securityText + '. These are read-only summaries. What would you like to check next?';
  }
  return 'I am ORION, your OV CLOUD voice companion. I can summarize cloud status, file index counts, service requests, and recent security events. Ask me for a cloud briefing or say help.';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!ownerSession(req)) return res.status(401).json({ ok: false, error: 'A valid OV CLOUD owner session is required.' });
  const message = String(req.body?.message || '').trim().slice(0, 300);
  if (!message) return res.status(400).json({ ok: false, error: 'Please provide a short message.' });
  try {
    const stats = await getBriefing();
    return res.status(200).json({ ok: true, answer: answerFor(message, stats), stats });
  } catch (error) {
    console.error('OV CLOUD ORION briefing failed:', error?.message || error);
    return res.status(503).json({ ok: false, error: 'ORION cannot reach the workspace summary right now.' });
  }
}
