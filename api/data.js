// Simpan sebagai: api/data.js (di repo GitHub)
// Penyimpanan jurnal: Vercel Function + Upstash Redis, tanpa paket tambahan.
const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(DB_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + DB_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pass = process.env.JOURNAL_KEY;
  if (!pass || req.headers['x-key'] !== pass) return res.status(401).json({ error: 'kata sandi salah' });
  if (!DB_URL || !DB_TOKEN) return res.status(500).json({ error: 'database belum terhubung' });

  const m = String(req.query.m || '');
  try {
    if (req.method === 'GET') {
      const months = {};
      if (m) {
        const v = await redis(['HGET', 'jam24', m]);
        if (v) months[m] = JSON.parse(v);
      } else {
        const a = (await redis(['HGETALL', 'jam24'])) || [];
        if (Array.isArray(a)) for (let i = 0; i < a.length; i += 2) months[a[i]] = JSON.parse(a[i + 1]);
        else for (const k in a) months[k] = JSON.parse(a[k]);
      }
      return res.status(200).json({ months });
    }
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!/^\d{4}-\d{2}$/.test(m) || !body || typeof body.days !== 'object') {
        return res.status(400).json({ error: 'data tidak valid' });
      }
      const text = JSON.stringify({ days: body.days });
      if (text.length > 900000) return res.status(413).json({ error: 'terlalu besar' });
      await redis(['HSET', 'jam24', m, text]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'metode tidak didukung' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
