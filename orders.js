// Pedidos: usa Redis (Upstash / Vercel KV) quando configurado; senão, arquivo JSON local.
// Na Vercel o disco não é permanente, então conecte o Redis lá.
const fs = require('fs');
const path = require('path');
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error('Redis: ' + (d.error || r.status));
  return d.result;
}
const FILE = path.join(__dirname, '..', 'server', 'data', 'orders.json');
const loadFile = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const writeFile = all => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(all, null, 2)); };

async function get(id) {
  if (URL_) { const v = await redis(['GET', 'order:' + id]); return v ? JSON.parse(v) : null; }
  return loadFile()[id] || null;
}
async function put(order) {
  if (URL_) { await redis(['SET', 'order:' + order.id, JSON.stringify(order)]); return order; }
  const all = loadFile(); all[order.id] = order; writeFile(all); return order;
}
module.exports = {
  get,
  create: put,
  async update(id, patch) { const o = await get(id); if (!o) return null; return put({ ...o, ...patch, updatedAt: new Date().toISOString() }); }
};
