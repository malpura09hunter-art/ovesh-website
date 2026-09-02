const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 12;
const MAX_OUTPUT_CHARS = 50_000;
const requestCounts = new Map();
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'unknown'; }
function rateLimited(ip) {
  const now = Date.now();
  const old = requestCounts.get(ip);
  if (!old || now - old.startedAt > WINDOW_MS) { requestCounts.set(ip, { startedAt: now, count: 1 }); return false; }
  old.count += 1;
  return old.count > MAX_REQUESTS;
}
function cap(value) { return String(value || '').slice(0, MAX_OUTPUT_CHARS); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (rateLimited(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many compiler requests. Please wait a minute and try again.' });

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const source_code = typeof body.source_code === 'string' ? body.source_code : '';
    const stdin = typeof body.stdin === 'string' ? body.stdin : '';
    if (!source_code.trim()) return res.status(400).json({ ok: false, error: 'Source code is required.' });
    if (source_code.length > 50000 || stdin.length > 10000) return res.status(413).json({ ok: false, error: 'Input or source code is too large.' });

    const baseUrl = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
    if (process.env.JUDGE0_AUTH_USER) headers['X-Auth-User'] = process.env.JUDGE0_AUTH_USER;

    const create = await fetch(`${baseUrl}/submissions?base64_encoded=false`, { method: 'POST', headers, body: JSON.stringify({ language_id: 50, source_code, stdin, cpu_time_limit: 3, wall_time_limit: 5, memory_limit: 128000, max_file_size: 1024 }) });
    const created = await create.json().catch(() => ({}));
    if (!create.ok || !created.token) return res.status(502).json({ ok: false, error: 'Unable to create compiler job.' });

    let result = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const poll = await fetch(`${baseUrl}/submissions/${encodeURIComponent(created.token)}?base64_encoded=false`, { headers });
      const data = await poll.json().catch(() => ({}));
      if (!poll.ok) return res.status(502).json({ ok: false, error: 'Unable to read compiler result.' });
      result = data;
      if (!data.status || ![1, 2].includes(data.status.id)) break;
    }
    if (!result || (result.status && [1, 2].includes(result.status.id))) return res.status(504).json({ ok: false, error: 'Compilation timed out. Please try again.' });
    return res.status(200).json({ ok: true, stdout: cap(result.stdout), stderr: cap(result.stderr), compile_output: cap(result.compile_output), message: cap(result.message), status: result.status || null, time: result.time || null, memory: result.memory || null });
  } catch {
    return res.status(500).json({ ok: false, error: 'Compiler service is temporarily unavailable.' });
  }
}
