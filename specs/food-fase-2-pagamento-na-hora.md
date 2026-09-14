# Food Fase 2 — pagamento na hora

> O cliente paga no cardápio e o pedido só então entra na cozinha. PIX com QR e copia-e-cola pelo Asaas, credencial por organização, e o webhook que hoje aceita qualquer requisição passa a conferir assinatura e a deduplicar evento.
> Feature: `src/features/pagamentos` + `src/app/router/pagamentos` + `src/app/api/payments/asaas/webhook` + `src/features/storefront/components/cardapio`
> Branch: `feat/food-fase-2-pagamento-na-hora` (a partir de `feat/food-fase-3-salao-e-mesas`)
> Criado em: 2026-09-14 · Atualizado em: 2026-09-14
> Status: 📋 Planejado
> Épico: [`food-service.md`](./food-service.md) · herda as decisões de [`pagamentos-gateway.md`](./pagamentos-gateway.md)

---

## Situacao atual

A [Fase 1](./food-fase-1-pedido-sem-papel.md) fez o pedido do cardápio esperar o **aceite do dono**
antes de ir para a cozinha, porque não havia pagamento: aceitar era a única barreira entre um trote
e comida na chapa. O dev decidiu o desenho definitivo: **só pedido pago vai para a cozinha**. O
aceite deixa de ser o caminho normal e vira a exceção — o pedido cuja confirmação de pagamento não
chegou.

Hoje não existe cobrança nenhuma no nerp-2 para o balcão. O que existe é checkout hospedado da loja
online, e ele tem três defeitos que esta fase precisa resolver antes de encostar em dinheiro de
verdade:

1. **`src/app/api/assas/webhooks/route.ts` não confere assinatura.** A "garantia" é checar se
   `body.event` e `body.checkout.id` existem. Quem souber a URL cria venda paga.
2. **Não deduplica evento.** O Stripe tem `ProcessedStripeEvent` — com o comentário "creditar duas
   vezes é dinheiro" — mas só na trilha de Stars. O caminho da loja não usa.
3. **Numeração por `findFirst + 1`**, correndo contra o contador atômico `Organization.lastSaleNumber`
   que `sales/create.ts` usa. Duas vendas ao mesmo tempo colidem no `@@unique`.

Arquivos principais:
- `src/app/api/assas/webhooks/route.ts` — o webhook a reescrever
- `src/app/router/checkout/menu-checkout.ts` — o checkout do cardápio, hoje sem cobrança
- `src/features/integracoes/server/credentials.ts` — `cifrarCredenciais`/`decifrarCredenciais`
  (AES-256-GCM, mesmo cofre do S2S). **É o molde da credencial por organização**
- `src/lib/pedidos/create-orders-from-sale.ts` — `requiresAcceptance`, que a Fase 1 deixou pronto
- `/Users/weydsonlima/nasaex-wey/src/lib/asaas.ts` — 140 linhas, autocontido: `findOrCreateCustomer`,
  `createCharge`, `getPixQrCode`, `dueDatePlus`

---

## O que muda no banco

**A credencial NÃO ganha tabela.** `FinancialIntegration` já é o cofre por
organização — AES-256-GCM pelo mesmo `nasa-s2s-crypto`, com `environment` e tela
de instalação prontas —, e a seção "Gateways de pagamento" do `/integracoes`
existia vazia esperando um manifesto. Um segundo lugar para guardar chave é um
segundo lugar de onde ela pode vazar. O segredo do webhook entra no mesmo blob
cifrado, como campo `webhookSecret`.

```prisma
/// Uma tentativa de cobrança. Append-only na prática: o status muda, a linha não some.
model Charge {
  id             String   @id @default(cuid())
  organizationId String
  saleId         String?
  integrationId  String?  // a instalação do gateway (FinancialIntegration)
  provider       String
  externalId     String   // id da cobrança no provedor
  status         ChargeStatus @default(PENDING)
  method         PaymentMethod
  amount         Decimal  @db.Decimal(10, 2)
  /// PIX copia-e-cola e a imagem do QR, como vieram do provedor.
  pixPayload     String?  @db.Text
  paidAt         DateTime?

  @@unique([provider, externalId])
  @@index([organizationId, status])
  @@map("charges")
}

enum ChargeStatus { PENDING  PAID  EXPIRED  REFUNDED  FAILED }

/// Dedupe de webhook, para qualquer provedor. "Creditar duas vezes é dinheiro."
model ProcessedWebhookEvent {
  id        String   @id @default(cuid())
  provider  String
  eventId   String
  createdAt DateTime @default(now())

  @@unique([provider, eventId])
  @@map("processed_webhook_events")
}
```

`Sale` ganha `chargeId`/`paidAt` já existente — **conferir antes de criar coluna nova**: `Sale.paidAt`
já está no schema desde o PDV.

---

## Pendencias

### Critico

- [x] **Webhook com assinatura** — sem isso, qualquer um marca pedido como pago e a cozinha produz de
      graça. O Asaas manda o segredo no cabeçalho `asaas-access-token`; comparar com
      `timingSafeEqual`, nunca com `===` — ✅ 2026-09-14 (`/api/payments/asaas/webhook`)
- [x] **Dedupe por evento** (`ProcessedWebhookEvent`) — provedor reenvia quando não recebe 200, e sem
      trava o mesmo pedido entra duas vezes na cozinha — ✅ 2026-09-14
- [x] **Numeração atômica** — o webhook usa `nextSaleNumber` (`src/lib/pedidos/resolve-sale-items.ts`),
      não `findFirst + 1` — ✅ 2026-09-14 (o webhook não cria venda; só confirma)
- [x] **Credencial nunca em texto puro nem em log** — `cifrarCredenciais` na escrita,
      `sanitizarErro` em toda mensagem que possa carregar a chave — ✅ 2026-09-14
- [x] **Pagou é o que manda para a cozinha** — `createKitchenOrdersFromSale(saleId, { requiresAcceptance: false })`
      só depois do webhook confirmar. Enquanto não confirmar, o pedido fica na barra "Novos pedidos".

### Funcional

- [x] **Port do cliente Asaas** (`src/lib/asaas.ts`) — copiar as 140 linhas do `nasaex-wey`, trocando
      só o que for import. É autocontido e não depende de nada de lá — ✅ 2026-09-14
- [x] **Tela de credenciais** — resolvida por um **manifesto** (`catalog/gateways.ts`) em vez de
      tela nova: a instalação, o mascaramento e o "em branco mantém o que está guardado" já são do
      catálogo. A seção "Gateways de pagamento" deixou de renderizar vazia — ✅ 2026-09-14
- [x] **PIX no cardápio** — ao enviar o pedido, o cliente vê o QR e o copia-e-cola, e a tela fica
      esperando a confirmação (poll de 2 s no status da cobrança) — ✅ 2026-09-14
- [x] **Aceite vira exceção** — a barra "Novos pedidos" passa a listar só o que não confirmou
      pagamento, e **qualquer pessoa da equipe com acesso ao app do garçom** pode aceitar ou recusar
      (decisão do dev). Hoje as procedures de aceite exigem a permissão `pedidos`.
- [ ] **Forma de pagamento no cupom e no card** — o garçom e a cozinha precisam ver "PIX · pago" sem
      abrir nada.

### UX

- [ ] **A tela de espera do PIX não pode parecer travada** — QR grande, copia-e-cola com um toque,
      e o que acontece quando confirmar dito em uma frase.
- [ ] **Falha de pagamento não perde o pedido** — o carrinho continua montado para tentar de novo.

### Qualidade de codigo

- [x] **Um provedor atrás de uma porta** — `criarCobranca`/`consultarCobranca` como interface, com o
      Asaas como primeiro adaptador. O `desktop-pagamento-eletronico.md` já fez isso para o TEF e é
      o molde: o domínio não conhece o provedor.
- [ ] **Aposentar `src/app/api/assas/webhooks/route.ts`** ou reescrevê-lo sobre o caminho novo — dois
      webhooks do mesmo provedor com regras diferentes é como um volta a divergir do outro.

---

## Decisoes tomadas

- **Só pedido pago vai para a cozinha** (decisão do dev, 2026-09-14). O aceite manual da Fase 1
  continua existindo, mas para a exceção: pagamento que não confirmou.
- **Qualquer pessoa da equipe aceita pelo app do garçom** (decisão do dev, 2026-09-14) — o gerente
  não está sempre olhando, e o pedido não pode esperar por ele. O vínculo com a organização é a
  trava; a permissão `pedidos` não.
- **Asaas primeiro, atrás de uma porta** — é o que o `nasaex-wey` já tem rodando, e PIX no Brasil é
  o que o food truck precisa. Stripe entra depois pelo mesmo contrato.
- **Credencial por organização, cifrada** — cada loja tem a própria conta Asaas; a chave mora no
  banco, cifrada pelo cofre que o S2S já usa. Nunca no `.env`, que é global.
- **Sem tabela nova de credencial** (corrigido durante a implementação, 2026-09-14) — o primeiro
  rascunho desta spec criava `PaymentGatewayConfig`. `FinancialIntegration` já fazia tudo o que ela
  faria, com tela pronta; a tabela foi removida antes de a migration ser aplicada.
- **Webhook fail-closed** — instalação sem `webhookSecret` configurado RECUSA o aviso de pagamento
  (401). O contrário seria uma porta aberta por esquecimento de preencher um campo opcional.

---

## Criterios de aceite

1. Com credencial de sandbox cadastrada, enviar um pedido pelo cardápio devolve QR de PIX e
   copia-e-cola na tela.
2. Pagando no sandbox, o webhook confirma e **só então** o pedido aparece na cozinha e na fila de
   impressão.
3. Webhook sem assinatura válida é recusado com 401 e **não** cria nada.
4. O mesmo evento entregue duas vezes cria o pedido **uma** vez.
5. Pedido cuja confirmação não chegou fica na barra "Novos pedidos", e um garçom qualquer consegue
   aceitar ou recusar pelo app.
6. O cupom e o card mostram forma de pagamento e valor.
7. **Regressão:** organização sem credencial cadastrada continua no fluxo da Fase 1 — pedido entra
   aguardando aceite, sem cobrança.
8. `pnpm check-types`, `pnpm lint` e `pnpm test` passam.

---

## Antes de testar

1. **Aplicar a migration**: `pnpm db:deploy` (`20260914100000_food_fase_2_cobrancas`). O
   `SCHEMA_VERSION` já está em `v98-food-fase-2-cobrancas`.
2. **Instalar o Asaas** em `/integracoes` → Gateways de pagamento, com chave de sandbox e o
   segredo do webhook. **Sem o segredo o aviso de pagamento é recusado** — é fail-closed.
3. Apontar o webhook do Asaas para `<url pública>/api/payments/asaas/webhook`. Em máquina local
   isso pede um túnel; o provedor não alcança `localhost`.
4. Sem gateway instalado, tudo continua como na Fase 1: o pedido espera liberação manual.

## O que ficou em aberto

- [ ] **O webhook antigo** (`/api/assas/webhooks`) continua no ar, sem assinatura e sem dedupe,
      servindo a loja online. Migrar ou aposentar — dois webhooks do mesmo provedor com regras
      diferentes voltam a divergir.
- [ ] **Sem teste de ponta a ponta** — precisa de credencial de sandbox e de endereço público.
- [ ] **Estorno pela tela** quando a cozinha recusa um pedido já pago.

## Proximos passos

1. Aplicar a migration e instalar uma credencial de sandbox.
2. Testar o ciclo: pedir no cardápio → pagar o PIX → ver o pedido cair na cozinha.
3. Aposentar o webhook antigo.

---

## Melhorias futuras (nao urgentes)

- [ ] Cartão de crédito e boleto pelo mesmo contrato.
- [ ] Estorno pela tela, quando a cozinha recusa um pedido já pago.
- [ ] Conciliação: casar a liquidação da adquirente com a venda (depende de `SalePayment` ganhar
      `acquirer`/`nsu`, pendência registrada em `pdv-caixa.md`).
- [ ] Split de pagamento, para praça de alimentação com vários donos.
