const { applyWebhook } = require('../lib/checkout');
const readRaw = req => new Promise((ok, fail) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', fail); });
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const body = await readRaw(req);
  const code = await applyWebhook(String(req.query.provider), { get: h => req.headers[h.toLowerCase()], query: req.query, body });
  res.status(code).end();
};
