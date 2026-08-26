export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { source_code, stdin = '' } = req.body || {};

    if (typeof source_code !== 'string' || !source_code.trim()) {
      return res.status(400).json({ ok: false, error: 'Source code is required.' });
    }

    if (source_code.length > 50000 || String(stdin).length > 10000) {
      return res.status(413).json({ ok: false, error: 'Input or source code is too large.' });
    }

    const baseUrl = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/$/, '');
    const token = process.env.JUDGE0_AUTH_TOKEN || '';
    const user = process.env.JUDGE0_AUTH_USER || '';
    const headers = { 'Content-Type': 'application/json' };

    if (token) headers['X-Auth-Token'] = token;
    if (user) headers['X-Auth-User'] = user;

    const createUrl = `${baseUrl}/submissions?base64_encoded=false&wait=true`;
    const response = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language_id: 50,
        source_code,
        stdin: String(stdin).slice(0, 10000),
        cpu_time_limit: 3,
        wall_time_limit: 5,
        memory_limit: 128000
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data?.error || data?.message || `Compiler service returned HTTP ${response.status}.`
      });
    }

    return res.status(200).json({
      ok: true,
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      compile_output: data.compile_output || '',
      message: data.message || '',
      status: data.status || null,
      time: data.time || null,
      memory: data.memory || null
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Compiler service is temporarily unavailable.'
    });
  }
}
