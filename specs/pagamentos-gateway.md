# Pagamentos — Gateway PIX/Boleto/Cartão (port do nasaex-wey)

> Cobranças PIX/boleto/cartão via Asaas + Stripe, espelhando o módulo Payment do `nasaex-wey`.
> Feature: `src/features/pagamentos` (novo) + `src/app/router/pagamentos` (novo) + `src/app/api/payments/*` (webhooks) · lib `src/lib/asaas.ts` (port)
> Criado em: 2026-08-08 · Atualizado em: 2026-08-08
> Status: 📋 Planejado (esboço)

---

## Situacao atual

O nerp-2 **não tem gateway de pagamento** para o balcão/loja — só Stripe/Asaas para venda de plano (checkout de assinatura). O `nasaex-wey` já tem um cliente Asaas autocontido e webhooks funcionando, alinhados ao mesmo stack (oRPC, Prisma 7, Better Auth, tenancy por `organizationId`), prontos para espelhar.

Fonte a espelhar (`/Users/weydsonlima/nasaex-wey`):
- `src/lib/asaas.ts` — cliente REST (plain fetch): `findOrCreateCustomer`, `createCharge` (PIX/BOLETO/CREDIT_CARD), `getPixQrCode`
- `src/app/api/payments/asaas/webhook/route.ts` — webhook Asaas (hardwired para "Stars")
- `src/app/router/stars/create-gateway-checkout.ts` — entrada que cria as cobranças
- Models: `PaymentGatewayConfig`, `StarsPayment`, `ProcessedStripeEvent`

---

## Pendencias

### Critico

- [ ] **Webhook sem assinatura** — o webhook Asaas original não verifica assinatura; ao portar, **adicionar verificação** e resolver `externalReference` no model de cobrança/venda do nerp-2 (não em "Stars").

### Funcional

- [ ] **Port do cliente** — copiar `src/lib/asaas.ts` como está (autocontido).
- [ ] **Model de cobrança genérico** — `Payment`/`Charge` (no lugar de `StarsPayment`) + `PaymentGatewayConfig` (credenciais por org) + `ProcessedStripeEvent` (dedupe Stripe).
- [ ] **Procedures** — criar cobrança (PIX/boleto/cartão), consultar status, QR PIX; escopo `organizationId`.
- [ ] **Webhooks** — `src/app/api/payments/asaas/webhook` + `src/app/api/stripe/webhook` (reaproveitar os existentes do nerp-2 onde possível).
- [ ] **Amarração ao PDV** (`pdv-caixa`) — venda a prazo/PIX/boleto gera cobrança e lança em contas a receber (`financeiro-contas`).

### UX

- [ ] Tela/config de credenciais do gateway por org (Asaas/Stripe, sandbox/prod).
- [ ] No PDV: opção de pagamento por PIX (QR) / boleto além de dinheiro/cartão.

### Qualidade de codigo

- [ ] Segredos: Stripe via `.env`, Asaas em `PaymentGatewayConfig` (DB) — replicar a escolha e nunca logar chave.

---

## Decisoes tomadas

- **Espelhar o Payment do `nasaex-wey`** (não construir do zero) — stack idêntico, port direto com adaptação de import (`@/generated/prisma/client`) e tenancy por `organizationId`.
- **Reescrever o webhook** para o domínio do nerp-2 + **assinatura** (o original é acoplado a "Stars" e sem verificação).

---

## Proximos passos

1. Portar `src/lib/asaas.ts` + models de cobrança/config.
2. Procedures de cobrança + webhooks com assinatura.
3. Integrar ao PDV (`pdv-caixa`) e a contas a receber (`financeiro-contas`).

---

## Melhorias futuras (nao urgentes)

- [ ] Split de pagamento (marketplace) e estorno via Asaas.
- [ ] Conciliação automática de recebíveis (retorno bancário).
