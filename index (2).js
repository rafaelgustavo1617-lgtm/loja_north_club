// Servidor próprio (VPS, Render, Railway). Na Vercel, as rotas em /api substituem este arquivo.
const express = require('express');
const path = require('path');
const { startCheckout, applyWebhook, publicOrder, STORE_PAGE, siteUrl, providerName } = require('../lib/checkout');
const app = express();

app.post('/api/webhooks/:provider', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  res.sendStatus(await applyWebhook(req.params.provider, { get: h => req.get(h), query: req.query, body: req.body }));
});
app.use(express.json({ limit: '100kb' }));
app.post('/api/checkout', async (req, res) => { const r = await startCheckout(req.body); res.status(r.status).json(r.body); });
app.get('/api/orders/:id', async (req, res) => { const o = await publicOrder(req.params.id); o ? res.json(o) : res.sendStatus(404); });
app.use((req, res, next) => (/^\/(server|lib|api)\//.test(req.path) ? res.sendStatus(404) : next()));
app.get('/', (req, res) => res.redirect(STORE_PAGE));
app.use(express.static(path.join(__dirname, '..'), { dotfiles: 'deny' }));
app.listen(process.env.PORT || 3000, () => console.log('Loja em ' + siteUrl() + ' · provedor: ' + providerName));
