// Seleciona o provedor pelo PAYMENT_PROVIDER. Para trocar de provedor, crie um arquivo
// nesta pasta que exporte createCheckout(order, ctx) e handleWebhook(req).
const name = (process.env.PAYMENT_PROVIDER || 'mercadopago').toLowerCase();
if (!/^[a-z0-9_-]+$/.test(name)) throw new Error('PAYMENT_PROVIDER inválido');
const provider = require('./' + name);
for (const fn of ['createCheckout', 'handleWebhook']) {
  if (typeof provider[fn] !== 'function') throw new Error('Provedor "' + name + '" não implementa ' + fn);
}
module.exports = { name, ...provider };
