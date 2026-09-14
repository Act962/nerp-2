# Orbita Food — o pedido que sai do papel

> O épico inteiro em uma página: um food truck largando o bloquinho, as seis fases que levam do cardápio no Instagram até o programa de fidelidade, e o que em cada uma é reuso do que já existe.
> Feature: `src/features/{pedidos,storefront,receipt-designer,impressao-termica,fidelidade}` + `src/app/router/{pedidos,checkout,fidelidade}` + `src/app/(storefront)` + `src/app/(waiter)`
> Criado em: 2026-09-13 · Atualizado em: 2026-09-13
> Status: 🟡 Em andamento — Fase 1 com código pronto; fases 2 a 6 planejadas

---

## Situacao atual

O pedido nasce de uma conversa real: um food truck de hambúrguer anota no papel. O dono
já tentou ERP e sistema de pedido e desistiu — complexo demais para quem vive dentro do
operacional e não tem tempo nem cabeça para treinamento. É o retrato de milhares de
negócios no Brasil: o software existe, mas pede do operador uma disponibilidade que ele
não tem.

O que ele pediu, na ordem em que dói: o cliente vindo do Instagram deveria pedir **e
pagar** na hora (conferir pagamento é um segundo processo demorado, e é o que mais atrasa
a fila); o pedido deveria **sair impresso sozinho** na impressora de cupom não fiscal;
quem pede no balcão deveria passar pelo mesmo caminho, numa tela de botão grande, texto
grande e foto clara; e o cliente deveria acompanhar no próprio celular, com a tela
piscando quando ficasse pronto.

O módulo Pedidos já tem a espinha dorsal — o que falta é a experiência e a impressão.

Arquivos principais:
- `src/features/pedidos/` — board kanban (`components/pedidos-board.tsx`), app do garçom
  (`waiter/`), painel de TV (`components/tv-display.tsx`) e a tela do cliente
  (`customer/customer-order-view.tsx`), que **já pisca e vibra** quando fica pronto
- `src/app/router/pedidos/` — `router.kitchen`: `list`, `create`, `createMany`, `move`,
  `setArchived`, `columns.*`, `waiterJoinLink` e sete procedures públicas
- `src/lib/pedidos/` — `create-kitchen-orders.ts`, `create-orders-from-sale.ts` (a ponte
  `Sale` → cozinha quando `CatalogSettings.operationMode = KITCHEN`), `order-events.ts`
- `src/features/storefront/` + `src/app/(storefront)/[subdomain]/` — a loja online
  pública por subdomínio, com carrinho em zustand e três modos de operação
- `src/features/receipt-designer/` — editor de cupom por blocos e impressão 80/58/A4 por
  CSS, com auto-print ao fechar venda no PDV
- `prisma/schema.prisma` — `KitchenColumn`, `KitchenOrder`, `KitchenOrderEvent`,
  `Collaborator`, `Sale`, `SaleItem`, `CatalogSettings`, `ReceiptTemplate`

O que **não** existe e é preciso construir: entidade Mesa, ESC-POS (zero ocorrências no
repo inteiro), cobrança PIX/QR, fidelidade, indicação. O cliente final está espalhado em
três modelos desconectados — `Customer` (ERP, sem login), `Shopper` (global, token HMAC) e
`CatalogUser` (loja online); o épico escolhe o `Customer`, que é o único escopado por
organização e o único que o pedido sem cadastro já alimenta.

---

## Quem usa

| Pessoa | O que precisa | Onde |
|---|---|---|
| **Dono** | Ver pedido entrando, aceitar, imprimir, fechar o dia | `/pedidos` + `/pedidos/impressao` |
| **Operador de balcão** | Montar o pedido do cliente à sua frente em segundos | app do garçom (`/registrar-pedido/<slug>`) |
| **Cozinha** | Saber o que produzir e em que ordem | board + painel de TV |
| **Cliente no local** | Pedir sem baixar nada e saber quando está pronto | QR da mesa → cardápio → `/pedido-cliente/...` |
| **Cliente do Instagram** | Pedir e pagar num link, sem cadastro | loja online em modo cardápio |

---

## As fases

Cada fase = 1 spec = 1 branch = 1 PR. A ordem é a ordem da dor: a Fase 1 é o que tira o
papel da operação na primeira semana; o resto é o que faz o cliente voltar.

| # | Fase | Entrega | Spec |
|---|---|---|---|
| **1** ✅ | **Pedido sem papel** | Cardápio mobile, pedido sem cadastro, aceite pelo dono, balcão de botões grandes e o **cupom saindo sozinho na impressora Bluetooth** | [`food-fase-1-pedido-sem-papel.md`](./food-fase-1-pedido-sem-papel.md) |
| **2** | **Pagamento na hora** | PIX/cartão dentro do cardápio; pago = aceito sem intervenção. Corrige de passagem o webhook Asaas | a escrever |
| **3** | **Salão e mesas** | Mesa como entidade, QR por mesa, conta aberta, fechar e transferir conta | a escrever |
| **4** | **A espera** | Tela do pedido com valor e tempo correndo, aviso quando fica pronto, jogos | a escrever |
| **5** | **STAR pay — fidelidade** | Pontos por compra e resgate em produtos | a escrever |
| **6** | **STAR pay — indicação** | Link de indicação por colaborador, crédito por cadastro e por compra | a escrever |

### Fase 2 — Pagamento na hora

Cobrança PIX (QR e copia-e-cola) e cartão no fim do cardápio; pedido pago entra na cozinha
sem passar pela fila de aceite. Herda o que [`pagamentos-gateway.md`](./pagamentos-gateway.md)
já decidiu (espelhar o cliente Asaas do `nasaex-wey`, credencial por org cifrada no molde
de `FinancialIntegration`) e paga três dívidas do caminho que já existe hoje em
`src/app/api/assas/webhooks/route.ts`: **não verifica assinatura**, **não deduplica
evento** e deriva `saleNumber` por `findFirst + 1`, correndo contra o contador atômico
`Organization.lastSaleNumber`.

### Fase 3 — Salão e mesas

Hoje `KitchenOrder.tableNumber` é texto livre — "18", "Balcão 3" — e não existe
agrupamento por mesa, conta aberta nem fechamento. A fase cria a Mesa com QR próprio (o
cliente escaneia e cai no cardápio já identificado), a conta que acumula tickets e o
fechamento. É aqui que o `ticketId` denormalizado da Fase 1 vira o modelo `KitchenTicket`
de verdade: a conta precisa de um lugar para pendurar cliente, pagamento e histórico.

### Fase 4 — A espera

A tela `/pedido-cliente/...` já pisca e vibra; falta o que dá sensação de controle —
valor, tempo estimado correndo, posição na fila — e o que o dono autorizou para ocupar a
espera: jogos leves no celular do cliente. Avaliar aviso ativo (o app hoje só notifica
consumidor por e-mail, num único fluxo; não há push, PWA nem WhatsApp para consumidor).

### Fase 5 — STAR pay: fidelidade

O cliente acumula pontos por compra e troca por produtos de uma lista do programa.

**Nomenclatura é decisão fechada**: `Star*` no schema já é a moeda de crédito **da
organização** (Astro, WhatsApp, recarga via Stripe, cota do plano — ver
[`astro-stars-planos.md`](./astro-stars-planos.md)). O programa do consumidor usa modelos
próprios `LoyaltyProgram` / `LoyaltyAccount` / `LoyaltyEntry` (ledger append-only) /
`LoyaltyReward` / `LoyaltyRedemption`, e **"STAR pay" é marca, aparece só na UI do
consumidor**. Misturar os dois saldos seria misturar o que a loja paga à plataforma com o
que o cliente ganha da loja.

**A regra de pontuação é configuração da organização, não constante do código.**
`LoyaltyProgram` guarda por org: a base (pontos por compra **ou** pontos por real gasto),
quanto vale, valor mínimo da compra para pontuar, validade do ponto e se o programa está
ligado. Um food truck que vende lanche de R$ 25 e um supermercado de carrinho de R$ 400
não pontuam igual, e nenhum dos dois deveria depender de deploy para mudar isso. A tela de
configuração do programa é parte da Fase 5, não um ajuste escondido.

**O saldo é da loja, não da rede.** `LoyaltyAccount` é escopada por `organizationId` —
`@@unique([organizationId, customerId])` — e pendura no `Customer`, com o telefone como
chave. É a identidade que a Fase 1 estabelece, a de menor atrito, e a única das três já
escopada por organização: `Shopper` é global e serviria a um saldo de rede, que não é o
caso. Quem come no food truck acumula ali; o ponto não atravessa para outra loja do
Órbita.

Consequência para a multi-tenancy: o ledger segue a regra de sempre — toda query com
`organizationId` explícito, sem exceção.

### Fase 6 — STAR pay: indicação

Colaborador e usuário do sistema ganham um link próprio; cadastro ou compra que chega por
ele credita pontos a quem indicou. `OrganizationJoinLink` (`src/lib/join-link.ts`) é o
molde estrutural pronto: token único, revogável, com aceite.

---

## Pendencias

### Critico

- [x] **Onde mora o saldo de fidelidade** — decidido: o saldo é **da loja**, escopado por
      `organizationId`, pendurado no `Customer` com o telefone como chave. Não vale em
      outras organizações da rede Órbita — ✅ 2026-09-13
- [x] **Regra de pontuação** — decidido: é **configuração por organização**
      (`LoyaltyProgram`), não valor fixo no código. Base, valor, compra mínima e validade
      do ponto ficam na tela da Fase 5 — ✅ 2026-09-13

### Funcional

- [x] **Segmento `ALIMENTACAO`** (`src/lib/org-segment.ts`, enum `OrgSegment`) — entrou na
      Fase 1 com `SEGMENT_DEFAULT_DISABLED` desligando os 19 módulos de trade. Falta
      apresentá-lo no onboarding — ✅ 2026-09-13
- [ ] **Aviso ativo ao consumidor** — não há push, PWA nem caminho de WhatsApp para
      consumidor (`Shopper.phone` existe e nunca é usado). Decidir na Fase 4.

### UX

- [ ] **Um cadastro de produto que sirva a um cardápio** — `Product.description` guarda
      JSON do TipTap e `prepTimeMinutes` já existe, mas não há campo de porção, adicional
      nem opção obrigatória ("ponto da carne"). Avaliar na Fase 3.

### Qualidade de codigo

- [ ] **`specs/README.md` e `specs/MAPA-PROJETO.md` estão defasados** a ponto de induzir a
      erro: listam caixa, financeiro, atalhos do PDV e impressão como planejado quando já
      estão construídos. Não é deste épico, mas quem ler para planejar vai tropeçar.

---

## Decisoes tomadas

- **Segmento Food dentro do Órbita, não produto separado** — reaproveita produto, caixa,
  financeiro e cliente; o que muda é onboarding e leiaute. Um app à parte duplicaria
  cadastro, autenticação e financeiro para ganhar liberdade de UX que o leiaute já dá.
- **"STAR pay" é marca de UI; os modelos são `Loyalty*`** — `Star*` é a moeda de cobrança
  da organização. Ver Fase 5.
- **Impressão por Web Bluetooth no celular do dono** — é o cenário real do food truck: sem
  PC, sem cabo, sem servidor de impressão. O aparelho do primeiro cliente é **Android**,
  onde o Chrome tem Web Bluetooth, então o caminho principal está confirmado. Limite
  conhecido: iOS/Safari não tem a API — iPhone cai no fallback de impressão por CSS, que
  segue existindo como rede de segurança, não como plano A.
- **Cardápio é leiaute dentro da loja online** — mesma URL pública, mesmas procedures de
  catálogo. Rota nova duplicaria carrinho e checkout para ganhar só liberdade visual.
- **Pedido sem cadastro: nome + WhatsApp viram `Customer`** — é o que
  `src/app/router/checkout/approval-checkout.ts` já faz, e é onde o saldo de fidelidade
  vai pendurar.
- **Cada organização configura a própria regra de pontuação** — quanto vale a compra em
  pontos é decisão do dono da loja, não do código. Ver Fase 5.
- **O saldo de fidelidade vale só na loja que o deu** — escopado por `organizationId`,
  como todo o resto do sistema. Saldo de rede exigiria pendurar no `Shopper` (identidade
  global) e resolver quem paga o resgate quando a loja que credita não é a que entrega.

---

## Proximos passos

1. Fase 1 — [`food-fase-1-pedido-sem-papel.md`](./food-fase-1-pedido-sem-papel.md).
2. Fase 2, quando houver credencial de gateway.
3. Fases 3 a 6, na ordem. As duas perguntas que travavam a Fase 5 estão respondidas: a
   regra de pontuação é configuração da org e o saldo é da loja.

---

## Melhorias futuras (nao urgentes)

- [ ] Impressão ESC-POS pelo app desktop Tauri (USB/serial, guilhotina e gaveta), para
      quem opera com PC — hoje o `apps/desktop` não tem uma linha de código de impressora.
- [ ] Delivery: entregador, raio de entrega, taxa por bairro.
- [ ] Cardápio com horário — item que só aparece no almoço, esgotar item do dia.
- [ ] Relatório do dono em uma tela: o que mais vendeu, horário de pico, tempo médio de
      preparo (os dados já estão em `KitchenOrderEvent`, ninguém lê).
