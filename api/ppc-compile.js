export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { source_code, stdin = '' } = req.body || {};
    if (typeof source_code !== 'string' || !source_code.trim()) {
      return res.status(400).json({ ok: false, error: 'Source code is required.' });
    }
    if (source_code.length > 50000 || String(stdin).length > 10000) {
      return res.status(413).json({ ok: false, error: 'Input or source code is too large.' });
    }

    const baseUrl = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
    if (process.env.JUDGE0_AUTH_USER) headers['X-Auth-User'] = process.env.JUDGE0_AUTH_USER;

    // Create first, then poll. This is more reliable than relying on wait=true
    // and also works with Judge0 instances that disable synchronous waiting.
    const create = await fetch(`${baseUrl}/submissions?base64_encoded=false`, {
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

    const created = await create.json().catch(() => ({}));
    if (!create.ok || !created.token) {
      return res.status(create.status || 502).json({
        ok: false,
        error: created?.error || created?.message || 'Unable to create compiler job.'
      });
    }

    let result = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const poll = await fetch(`${baseUrl}/submissions/${encodeURIComponent(created.token)}?base64_encoded=false`, { headers });
      const data = await poll.json().catch(() => ({}));
      if (!poll.ok) {
        return res.status(poll.status).json({ ok: false, error: data?.error || data?.message || 'Unable to read compiler result.' });
      }
      result = data;
      // Judge0 status IDs 1/2 are In Queue/Processing.
      if (!data.status || ![1, 2].includes(data.status.id)) break;
    }

    if (!result) return res.status(504).json({ ok: false, error: 'Compiler timed out.' });
    if (result.status && [1, 2].includes(result.status.id)) {
      return res.status(504).json({ ok: false, error: 'Compilation timed out. Please try again.' });
    }

    return res.status(200).json({
      ok: true,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compile_output: result.compile_output || '',
      message: result.message || '',
      status: result.status || null,
      time: result.time || null,
      memory: result.memory || null
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Compiler service is temporarily unavailable.' });
  }
}
