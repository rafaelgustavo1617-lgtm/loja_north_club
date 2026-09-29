// Stripe Checkout — cartão, Pix e boleto (conforme ativados no painel da Stripe).
// Docs: https://docs.stripe.com/payments/checkout
const crypto = require('crypto');

async function createCheckout(order, { returnUrl }) {
  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('success_url', returnUrl);
  f.set('cancel_url', returnUrl);
  f.set('client_reference_id', order.id);
  f.set('metadata[order_id]', order.id);
  order.items.forEach((i, n) => {
    f.set('line_items[' + n + '][quantity]', String(i.qty));
    f.set('line_items[' + n + '][price_data][currency]', 'brl');
    f.set('line_items[' + n + '][price_data][unit_amount]', String(Math.round(i.unitPrice * 100)));
    f.set('line_items[' + n + '][price_data][product_data][name]', i.brand + ' ' + i.name + ' (' + i.variant + ')');
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': order.id },
    body: f
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Stripe: ' + ((d.error && d.error.message) || r.status));
  return { url: d.url, sessionId: d.id };
}

function verify(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET não configurado');
  const raw = req.body.toString('utf8');
  const items = String(req.get('stripe-signature') || '').split(',').map(p => p.split('='));
  const t = (items.find(x => x[0] === 't') || [])[1];
  const sigs = items.filter(x => x[0] === 'v1').map(x => x[1]);
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new Error('Timestamp inválido');
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
  const ok = sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) throw new Error('Assinatura inválida');
  return JSON.parse(raw);
}

async function handleWebhook(req) {
  const ev = verify(req);
  const s = ev.data && ev.data.object;
  if (!s || s.object !== 'checkout.session') return null;
  const map = {
    'checkout.session.completed': s.payment_status === 'paid' ? 'approved' : 'pending',
    'checkout.session.async_payment_succeeded': 'approved',
    'checkout.session.async_payment_failed': 'rejected',
    'checkout.session.expired': 'cancelled'
  };
  if (!map[ev.type]) return null;
  return { orderId: s.client_reference_id, status: map[ev.type], amount: s.amount_total / 100, paymentId: s.payment_intent || s.id };
}

module.exports = { createCheckout, handleWebhook };
