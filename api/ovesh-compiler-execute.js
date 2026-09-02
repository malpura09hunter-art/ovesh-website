const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 12;
const MAX_OUTPUT_CHARS = 50_000;
const requestCounts = new Map();

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'unknown';
}
function rateLimited(ip) {
  const now = Date.now();
  const old = requestCounts.get(ip);
  if (!old || now - old.startedAt > WINDOW_MS) {
    requestCounts.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  old.count += 1;
  return old.count > MAX_REQUESTS;
}
function cap(value) {
  return String(value || '').slice(0, MAX_OUTPUT_CHARS);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (rateLimited(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many compiler requests. Please wait a minute and try again.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const source_code = typeof body.source_code === 'string' ? body.source_code : '';
  const stdin = typeof body.stdin === 'string' ? body.stdin : '';
  const filename = typeof body.filename === 'string' ? body.filename.slice(0, 120) : 'main.c';
  if (source_code.length > 100000) return res.status(413).json({ ok: false, error: 'Source code is too large.' });
  if (stdin.length > 20000) return res.status(413).json({ ok: false, error: 'Input is too large.' });

  const base = process.env.JUDGE0_URL || 'https://ce.judge0.com';
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;

  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/submissions/?base64_encoded=false&wait=true`, {
      method: 'POST', headers,
      body: JSON.stringify({ language_id: Number(process.env.JUDGE0_C_LANGUAGE_ID || 50), source_code, stdin, cpu_time_limit: 2, cpu_extra_time: 0.5, wall_time_limit: 5, memory_limit: 128000, max_file_size: 1024 })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ ok: false, error: 'Compiler execution service unavailable.' });
    const status = data.status?.description || 'UNKNOWN';
    let mapped = 'SUCCESS';
    if (status === 'Compilation Error') mapped = 'COMPILATION ERROR';
    else if (status.startsWith('Runtime Error')) mapped = 'RUNTIME ERROR';
    else if (status === 'Time Limit Exceeded') mapped = 'TIMEOUT';
    else if (status !== 'Accepted') mapped = status.toUpperCase();
    return res.status(200).json({ ok: true, status: mapped, stdout: cap(data.stdout), stderr: cap(data.stderr), compile_output: cap(data.compile_output), time: data.time || null, memory: data.memory || null, filename });
  } catch {
    return res.status(502).json({ ok: false, error: 'Execution service unavailable.' });
  }
}
