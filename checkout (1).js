// Regras de checkout usadas pelo servidor Express (server/) e pelas funções da Vercel (api/).
const crypto = require('crypto');
const { findP } = require('./catalog');
const orders = require('./orders');
const provider = require('./providers');

const siteUrl = () => (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')).replace(/\/$/, '');
const STORE_PAGE = '/' + encodeURIComponent('North Club.dc.html');

async function startCheckout(body) {
  const input = Array.isArray(body && body.items) ? body.items : [];
  if (!input.length || input.length > 50) return { status: 400, body: { error: 'Carrinho inválido' } };
  const items = [];
  for (const it of input) {
    const p = findP(it && it.id);
    const qty = Number(it && it.qty);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > 10) return { status: 400, body: { error: 'Item inválido' } };
    const sel = (it.sel && typeof it.sel === 'object') ? it.sel : {};
    let add = 0;
    for (const o of p.options) {
      const v = o.values.find(x => x.v === sel[o.key]);
      if (!v) return { status: 400, body: { error: 'Selecione ' + o.label + ' de ' + p.name } };
      add += v.add || 0;
    }
    items.push({ id: p.id, brand: p.brand, name: p.name, variant: p.options.map(o => sel[o.key]).join(' · '), qty, unitPrice: Math.round((p.price + add) * 100) / 100 });
  }
  const total = Math.round(items.reduce((s, i) => s + i.unitPrice * i.qty, 0) * 100) / 100;
  const order = await orders.create({ id: crypto.randomBytes(12).toString('hex'), items, total, currency: 'BRL', status: 'pending', provider: provider.name, createdAt: new Date().toISOString() });
  try {
    const base = siteUrl();
    const { url, sessionId } = await provider.createCheckout(order, { siteUrl: base, returnUrl: base + STORE_PAGE + '#/pedido/' + order.id });
    await orders.update(order.id, { providerSessionId: sessionId });
    return { status: 200, body: { orderId: order.id, url } };
  } catch (e) {
    console.error(e);
    await orders.update(order.id, { status: 'cancelled', note: 'Falha ao criar checkout' });
    return { status: 502, body: { error: 'Provedor de pagamento indisponível' } };
  }
}

// Único caminho que aprova um pedido. req: { get(header), query, body: Buffer }
async function applyWebhook(providerName, req) {
  if (providerName !== provider.name) return 404;
  try {
    const ev = await provider.handleWebhook(req);
    if (ev && ev.orderId) {
      const o = await orders.get(ev.orderId);
      if (o && o.status !== 'approved') {
        if (ev.status === 'approved' && Math.abs(Number(ev.amount) - o.total) > 0.01) await orders.update(o.id, { status: 'review', note: 'Valor pago diferente do pedido' });
        else await orders.update(o.id, { status: ev.status, providerPaymentId: ev.paymentId, ...(ev.status === 'approved' ? { paidAt: new Date().toISOString() } : {}) });
      }
    }
    return 200;
  } catch (e) {
    console.error('Webhook rejeitado:', e.message);
    return 400;
  }
}

async function publicOrder(id) {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const o = await orders.get(id);
  return o ? { id: o.id, status: o.status, total: o.total, items: o.items.map(i => ({ name: i.name, variant: i.variant, qty: i.qty })) } : null;
}

module.exports = { startCheckout, applyWebhook, publicOrder, STORE_PAGE, siteUrl, providerName: provider.name };
