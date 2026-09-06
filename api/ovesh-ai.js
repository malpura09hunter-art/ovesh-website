export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return res.status(503).json({ error: 'OVESH AI is not configured yet. Add OPENROUTER_API_KEY in Vercel Environment Variables.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || '').trim();
    const context = String(body.context || '').slice(0, 30000);
    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const system = `You are ASK OVESH AI, the private AI assistant inside OVESH CLOUD™.\nBe concise, useful, and professional. You help the authenticated owner organize and understand their cloud workspace and academic files. Never claim to have opened or read a file unless its contents are actually included in the context. If the context only contains filenames/metadata, say so. Do not expose secrets, API keys, passwords, or authentication data.\n\nCurrent OVESH CLOUD workspace context:\n${context || 'No workspace context was supplied.'}`;

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://malpuraovesh.vercel.app',
        // HTTP header values must stay within the ByteString/Latin-1 range.
        // Keep the trademark symbol in visible UI text/system prompts, but use
        // an ASCII-only title for the provider header.
        'X-Title': 'OVESH CLOUD - ASK OVESH AI'
      },
      body: JSON.stringify({
        model: process.env.OVESH_AI_MODEL || 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message }
        ],
        temperature: 0.25,
        max_tokens: 700
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'AI provider request failed.' });
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) return res.status(502).json({ error: 'OVESH AI returned an empty response.' });
    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'OVESH AI request failed.' });
  }
}