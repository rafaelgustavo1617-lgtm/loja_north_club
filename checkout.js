const { startCheckout } = require('../lib/checkout');
const readRaw = req => new Promise((ok, fail) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', fail); });
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  let body = {};
  try { body = JSON.parse((await readRaw(req)).toString('utf8') || '{}'); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
  const r = await startCheckout(body);
  res.status(r.status).json(r.body);
};
