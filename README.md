# Checkout da North Club

Fluxo: carrinho → `POST /api/checkout` (preços recalculados aqui) → checkout seguro do provedor → webhook assinado → pedido `approved`.
O retorno do cliente à loja **não** aprova nada: a página só consulta `GET /api/orders/:id`.

## Publicar na Vercel
1. Na raiz do projeto, rode `npx vercel` — ou suba a pasta para um repositório GitHub e importe em vercel.com/new (Framework: *Other*, sem comando de build).
2. Em *Storage*, crie um banco **Upstash Redis** e conecte ao projeto (as variáveis do Redis entram sozinhas).
3. Em *Settings > Environment Variables*, adicione `PAYMENT_PROVIDER`, `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` (ou as da Stripe). Com domínio próprio, adicione também `SITE_URL`.
4. Faça *Redeploy*. A loja abre na raiz do domínio e o checkout usa `/api` automaticamente.
5. Cadastre o webhook no provedor: `https://SEU-DOMINIO/api/webhooks/mercadopago`.

## Servidor próprio (alternativa)
1. Node 20.6 ou superior.
2. `cd server && npm install`
3. `cp .env.example .env` e preencha as credenciais (ficam só no servidor).
4. `npm start` — a loja abre em `SITE_URL`.
5. Fora do editor o site já usa `/api` sozinho. Para outro endereço, preencha a prop **checkoutApi**.

## Provedor
- **Mercado Pago** (padrão): crie uma aplicação em *Suas integrações*, copie o Access Token de produção e, em *Webhooks*, cadastre `SITE_URL/api/webhooks/mercadopago` com o evento *Pagamentos*. Copie a assinatura secreta para `MP_WEBHOOK_SECRET`.
- **Stripe**: em *Developers > Webhooks*, cadastre `SITE_URL/api/webhooks/stripe` com os eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `checkout.session.expired`. Ative Pix/boleto em *Payment methods*.
- Para trocar: `PAYMENT_PROVIDER=stripe` no .env.
- Para um provedor novo: crie `lib/providers/nome.js` exportando `createCheckout(order, { siteUrl, returnUrl }) → { url, sessionId }` e `handleWebhook(req) → { orderId, status, amount, paymentId } | null`.

## Conta bancária do vendedor
O repasse é feito pelo próprio provedor para a conta cadastrada no painel dele — o site nunca transfere dinheiro.
- Mercado Pago: *Seu negócio > Configurações > Retirar dinheiro* (ou saque automático) com a conta do proprietário.
- Stripe: *Settings > Payouts* com a conta bancária do proprietário.

## Segurança
- Credenciais só no `.env` (fora do git). Nada de chaves no HTML/JS.
- Dados de cartão ficam no provedor; a loja não os recebe.
- Webhooks têm assinatura verificada; o valor pago é comparado ao total do pedido (divergência vira `review`).
- Pedidos ficam no Redis (Vercel) ou em `server/data/orders.json` (servidor próprio) — ver `lib/orders.js`.
- O catálogo de preços do servidor está em `lib/catalog.js`. Ao alterar produtos ou preços na loja, atualize também esse arquivo.
