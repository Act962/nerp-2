# Catálogo online → Órbita (modo `ORBITA`)

O pedido feito no Catálogo online (`/catalogo/<slug>`) vira uma `Sale` em
`PENDING_APPROVAL` e é empurrado ao Órbita (NASA). Lá o Astro negocia com o
cliente, cobra via PIX (Asaas) e, com o pagamento, chama o NERP de volta para
confirmar a venda. O lado do Órbita está documentado no nasaex-wey, em
`docs/nerp-catalog-orbita.md`.

## Fluxo

1. A loja escolhe **Órbita** em Catálogo → Modo de operação
   (`CatalogOperationMode.ORBITA`). A aba avisa quando não há chave do Órbita
   ativa com o escopo `catalog-orders:push` (`catalogSettings.orbitaConnection`).
2. O cliente fecha o carrinho sem login (como no modo APPROVAL), informando
   nome e WhatsApp com DDD. `checkout.orbitaCheckout`:
   - confere o modo ORBITA, `allowOrders` e a chave com o escopo de envio;
   - cria a venda por `createPendingSale`
     (`src/features/storefront/server/create-pending-sale.ts`) — o mesmo miolo
     do `approvalCheckout`: preço por `resolveManyPrices`, cliente reusado pelo
     telefone, número de `Organization.lastSaleNumber`;
   - agenda `enqueueOrbitaOrder(saleId, delivery)` e devolve
     `{ saleId, saleNumber }`.
3. A função Inngest `orbita-order-delivery` (evento
   `catalog/orbita-order.requested`, 5 retries, idempotência e concorrência
   pela `saleId`) monta o payload, assina e faz o POST. Com `orbitaSyncedAt`
   já preenchido, é no-op.
4. A resposta vai para a `Sale`: `orbitaOrderToken`, `orbitaPortalUrl`,
   `orbitaWhatsappUrl`, `orbitaSyncedAt`.
5. A tela `checkout/sucesso?pedido=<n>&venda=<id>` consulta
   `checkout.orbitaStatus` a cada 3 s por até 40 s e mostra "Acompanhar e pagar
   meu pedido" (portal) e "Continuar no WhatsApp". Se o Órbita não responder a
   tempo, avisa que a loja vai entrar em contato.
6. Pago (ou desistido), o Órbita chama `catalogOrder.updateStatus`.

## Envio NERP → Órbita

`POST ${NASA_SYNC_BASE_URL}/api/integrations/nerp/orders`

Cabeçalhos (a chave é a `NasaIntegrationKey` ativa da org com
`catalog-orders:push` ou `*`, segredo decifrado com `decryptSecret`):

| Cabeçalho | Valor |
| --- | --- |
| `X-Nerp-Api-Key` | `key.apiKey` |
| `X-Nerp-Org-Id` | id da organização no NERP |
| `X-Nerp-Timestamp` | `Date.now()` em ms, como string |
| `X-Nerp-Signature` | `hex(HMAC-SHA256(secret, "POST\n/api/integrations/nerp/orders\n" + body + "\n" + timestamp))` |
| `Content-Type` | `application/json` |

O corpo enviado é exatamente a string assinada. Assinatura em
`src/features/orbita-orders/lib/sign.ts` — o espelho de
`src/lib/nasa-s2s-verify.ts`.

Payload (`src/features/orbita-orders/lib/payload.ts`):

```ts
{
  nerpSaleId: string, saleNumber: number, createdAt: string /* ISO */,
  customer: { name: string, phone: string /* só dígitos */, email: string | null, document: string | null },
  delivery: { method: string | null, address: string | null, notes: string | null },
  items: Array<{ productId: string, name: string, sku: string | null, quantity: number,
                 unitPrice: number, total: number, imageUrl: string | null }>,
  subtotal: number, shipping: number, discount: number, total: number,
  catalogUrl: string | null
}
```

Resposta:

- `200` → `{ orderToken: string, portalUrl: string, whatsappUrl: string | null }`.
- `409 { "error": "catalog_integration_inactive" }` → `NonRetriableError`.
- Qualquer outro não-2xx → erro, o Inngest tenta de novo.

## Retorno Órbita → NERP

`catalogOrder.updateStatus` (`src/app/router/catalog-order/update-status.ts`),
chamado por S2S em `/api/rpc` com a mesma assinatura `X-Nerp-*`. Exige o escopo
`sales:rw` (`ESCOPO_POR_PATH` em `src/lib/s2s-scopes.ts`) e recusa sessão de
usuário: confirmar aqui registra um pagamento que ninguém no balcão viu.

```ts
input:  { saleId: string, status: "CONFIRMED" | "CANCELED",
          payment?: { method: "PIX" | "CREDIT_CARD" | "BOLETO" | "OTHER",
                      amount: number, gatewayPaymentId: string, paidAt: string /* ISO */ } }
output: { ok: true, status: string }
```

- A venda é revalidada por `{ id, organizationId }` da chave.
- Idempotente: venda já no status pedido devolve `ok`. A transição sai de
  `PENDING_APPROVAL` por `updateMany` condicional, então chamadas simultâneas
  não baixam estoque em dobro.
- `CONFIRMED`: status `CONFIRMED`, `paidAt`, `paymentMethod`, um `SalePayment`
  (PIX→`PIX`, CREDIT_CARD→`CREDITO`, BOLETO→`BOLETO`, OTHER→`OUTROS`) e a baixa
  de estoque por `applySaleStockOut` (`src/features/sales/server/stock-out.ts`,
  o mesmo helper do PDV). O id do pagamento no gateway vai para as notas da
  venda. Como no PDV, lançamento financeiro só acontece em venda `COMPLETED`.
- `CANCELED`: status `CANCELLED` com `cancelledAt` e nota, sem mexer em estoque.

## Configuração

1. Migration `20260926120000_catalog_orbita_mode` (`pnpm db:deploy`) e
   `pnpm db:generate`.
2. Variáveis no NERP: `NASA_SYNC_BASE_URL` (base do Órbita),
   `NASA_S2S_ENCRYPTION_KEY` (cofre das chaves) e `BETTER_AUTH_URL` (monta o
   `catalogUrl`).
3. No Órbita, conectar o NERP pedindo os escopos `sales:rw` e
   `catalog-orders:push`; o dono da org autoriza em
   `/authorize/nasa-integration`.
4. No NERP, Catálogo → Modo de operação → **Órbita**, com "aceitar pedidos"
   ligado.
5. `pnpm inngest:dev` em desenvolvimento para a entrega rodar.

## Pedidos unificados

Todo pedido do Catálogo online — de qualquer modo — aparece em `/pedidos`, na
aba **Catálogo online** (a padrão; `?aba=cozinha` abre o quadro da cozinha,
que não mudou).

**Origem da venda.** `Sale.origin` (`SaleOrigin`, default `PDV`) diz de onde a
venda veio e é gravada na criação:

| Origem | Quem grava | Quem fecha |
|---|---|---|
| `CATALOGO_APROVACAO` | `approvalCheckout` via `createPendingSale` | a loja: "Abrir no PDV" ou "Recusar" |
| `CATALOGO_ORBITA` | `orbitaCheckout` via `createPendingSale` | só o Órbita (`catalogOrder.updateStatus`) |
| `CATALOGO_COZINHA` | `pedidosCheckout` | nasce `CONFIRMED`; os pratos vão para a cozinha |
| `CATALOGO_MARKETPLACE` | webhooks Asaas e Stripe | nasce `CONFIRMED` (pago online) |
| `PDV` | balcão, device, seed | fora da aba |

A migration `20260926150000_sale_origin_unified_orders` preenche o passado com o
que dá para afirmar: token do Órbita → `CATALOGO_ORBITA`; `PENDING_APPROVAL` sem
token → `CATALOGO_APROVACAO`. Pedidos antigos de cozinha e marketplace não
deixaram rastro e ficam `PDV`.

**Procedures** (`src/app/router/pedidos/catalog-orders/`):

- `kitchen.catalogOrders.list` — `{ status?: PENDING|CONFIRMED|CANCELLED,
  origin?, cursor?, limit }`. Grupos: `PENDING` = `PENDING_APPROVAL`;
  `CONFIRMED` = `CONFIRMED`/`PROCESSING`/`COMPLETED`; `CANCELLED`. Devolve
  itens, cliente, total, pagamento, `orbitaPortalUrl` e `closure` (lido da nota:
  "virou venda no PDV" ou "recusado: motivo").
- `kitchen.catalogOrders.reject` — `{ saleId, reason }`, só para
  `CATALOGO_APROVACAO` em `PENDING_APPROVAL`; transição condicional
  (`updateMany` por status) para não atropelar uma aprovação simultânea.

**O pedido do Órbita não é da loja.** `sales.listPendingApproval` exclui
`CATALOGO_ORBITA`, e `sales.approvePending` e `kitchen.catalogOrders.reject`
respondem "Pedido em negociação no Órbita — só o Órbita confirma ou cancela".
Antes disso o operador via o pedido na fila do PDV e podia fechá-lo por baixo
de uma negociação em andamento. Na aba, o card do Órbita só tem o selo
"Negociando no Órbita" e o link "Ver pedido no Órbita".

**"Abrir no PDV"** reaproveita o `approvePending` do diálogo do PDV: a venda
pendente fecha como `CANCELLED` com a nota "Aprovada no PDV por …", o carrinho
vai pelo `usePdvUiStore.hydratePayload` e o `/vendas/novo` o consome ao montar.
Por isso ela aparece em Cancelados com o selo "Virou venda no PDV" — a venda de
verdade é a nova, do balcão.

**Cozinha.** `createKitchenOrdersFromSale` grava `KitchenOrder.saleId` e um
evento `CREATED` com ator `SYSTEM` ("Catálogo online"). O card da cozinha mostra
"Catálogo #N" no lugar de "Mesa Pedido #N".

As regras sem I/O (grupos de status, notas de fechamento, mensagem do Órbita)
ficam em `src/features/pedidos/utils/catalog-order-status.ts`; o teste de
integração é `tests/integration/catalog-orders-list.test.ts`.
