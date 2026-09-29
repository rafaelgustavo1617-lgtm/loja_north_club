// Mercado Pago Checkout Pro — cartão, Pix, boleto e saldo Mercado Pago.
// Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro
const crypto = require('crypto');
const API = 'https://api.mercadopago.com';
const auth = () => ({ Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN });

async function createCheckout(order, { siteUrl, returnUrl }) {
  const r = await fetch(API + '/checkout/preferences', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json', 'X-Idempotency-Key': order.id },
    body: JSON.stringify({
      items: order.items.map(i => ({ id: i.id, title: i.brand + ' ' + i.name + ' (' + i.variant + ')', quantity: i.qty, unit_price: i.unitPrice, currency_id: 'BRL' })),
      external_reference: order.id,
      notification_url: siteUrl + '/api/webhooks/mercadopago',
      back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
      auto_return: 'approved',
      statement_descriptor: 'NORTHCLUB'
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Mercado Pago: ' + (d.message || r.status));
  return { url: d.init_point, sessionId: d.id };
}

function verifySignature(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) throw new Error('MP_WEBHOOK_SECRET não configurado');
  const parts = Object.fromEntries(String(req.get('x-signature') || '').split(',').map(p => p.trim().split('=')));
  const manifest = 'id:' + String(dataId).toLowerCase() + ';request-id:' + (req.get('x-request-id') || '') + ';ts:' + parts.ts + ';';
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const got = Buffer.from(parts.v1 || '', 'utf8'), exp = Buffer.from(expected, 'utf8');
  if (got.length !== exp.length || !crypto.timingSafeEqual(got, exp)) throw new Error('Assinatura inválida');
}

const STATUS = { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled', refunded: 'cancelled', charged_back: 'cancelled' };

async function handleWebhook(req) {
  const body = JSON.parse(req.body.toString('utf8') || '{}');
  const type = req.query.type || body.type;
  const dataId = req.query['data.id'] || (body.data && body.data.id);
  if (type !== 'payment' || !dataId) return null;
  verifySignature(req, dataId);
  // A fonte da verdade é a consulta direta à API, não o corpo da notificação.
  const r = await fetch(API + '/v1/payments/' + dataId, { headers: auth() });
  const p = await r.json();
  if (!r.ok) throw new Error('Pagamento não encontrado');
  return { orderId: p.external_reference, status: STATUS[p.status] || 'pending', amount: p.transaction_amount, paymentId: String(p.id) };
}

module.exports = { createCheckout, handleWebhook };
