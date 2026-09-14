# Food Fase 1 — o pedido sem papel

> Cardápio no celular, pedido sem cadastro, aceite do dono numa barra acima do kanban, balcão de botões grandes e o cupom saindo sozinho numa impressora Bluetooth de 58mm.
> Feature: `src/features/{storefront,pedidos,receipt-designer,impressao-termica}` + `src/app/router/{checkout,pedidos}` + `src/app/(storefront)/[subdomain]` + `src/app/(main)/(rest)/pedidos/impressao`
> Branch: `feat/food-fase-1-pedido-sem-papel` (a partir de `origin/main`)
> Criado em: 2026-09-13 · Atualizado em: 2026-09-13
> Status: 🟢 Código pronto, aguardando teste do dev — a migration ainda NÃO foi aplicada (ver "Antes de testar")
> Épico: [`food-service.md`](./food-service.md)

---

## Situacao atual

O KDS já existe e funciona: kanban por coluna, app do garçom que entra por QR, painel de
TV e uma tela de acompanhamento para o cliente que **já pisca e vibra** quando o pedido
fica pronto. A loja online também existe, e no modo `KITCHEN` uma venda confirmada já
vira pedido na cozinha. O que falta é tudo o que está entre uma coisa e outra: a loja é
uma vitrine de e-commerce, não um cardápio; o modo cozinha **exige conta de cliente**; o
pedido é uma linha por item, sem noção de "pedido inteiro"; e a impressão existe só por
diálogo do navegador, disparada à mão no PDV.

Três buracos concretos que esta fase fecha:

1. **Não dá para pedir sem cadastro no modo cozinha** — `checkout.kitchenCheckout` faz
   `catalogUser.findUnique` e devolve 404 se não achar. Só `approvalCheckout` tem o ramo
   de convidado por telefone, e ele serve à fila do PDV, não à cozinha.
2. **Não existe "o pedido"** — cada item é um `KitchenOrder` solto e a quantidade é
   codificada no texto (`"2x Coxinha"`). Sem agrupamento não há cupom por pedido nem
   acompanhamento do pedido inteiro.
3. **Não existe ESC-POS** no repositório inteiro — a impressão é `window.print()` com
   `@page` de altura medida, e o app desktop Tauri não tem nenhum gancho de impressora.

Arquivos principais:
- `src/features/pedidos/components/pedidos-board.tsx` — o kanban; `columns[0]` é renderizada
  como a coluna grande da esquerda (importa para a decisão do aceite)
- `src/features/pedidos/waiter/hooks/use-waiter-pedidos.ts` — **único** consumidor das cinco
  procedures públicas do garçom
- `src/lib/pedidos/create-kitchen-orders.ts` e `create-orders-from-sale.ts` — os dois
  criadores de pedido; o segundo roda também dentro dos webhooks Stripe e Asaas
- `src/app/router/checkout/approval-checkout.ts` — ramo de convidado por telefone,
  numeração atômica por `Organization.lastSaleNumber` e preço por `resolveManyPrices`
- `src/app/router/checkout/pedidos-checkout.ts` — modo cozinha; exige `CatalogUser`, tem
  corrida em `saleNumber` e ignora tabela de preço
- `src/features/receipt-designer/lib/{types,variables,presets,paper}.ts` — blocos do cupom,
  `resolveVariables`, `SAMPLE_DATA` e larguras em milímetros
- `src/features/receipt-designer/components/receipt-print.tsx` — `triggerReceiptPrint`, o
  fallback de impressão que continua valendo
- `prisma/schema.prisma` — `KitchenOrder`, `KitchenColumn`, `Sale`, `SaleItem`,
  `CatalogSettings`, `ReceiptTemplate`

---

## O que muda no banco

Uma migration só, com SQL de backfill escrito à mão.

```prisma
model KitchenOrder {
  ticketId   String?   // itens criados juntos compartilham o ticket; null = pedido legado
  acceptedAt DateTime? // null = aguardando aceite do dono, fora do board
  printedAt  DateTime? // null = ainda não saiu na impressora
  saleId     String?   // hoje NÃO existe ligação KitchenOrder ↔ Sale
  sale       Sale?     @relation(fields: [saleId], references: [id], onDelete: SetNull)

  @@index([organizationId, ticketId])
  @@index([organizationId, acceptedAt])
  @@index([organizationId, printedAt])
}

model Sale     { kitchenOrders KitchenOrder[] }
model SaleItem { notes String? @db.Text }       // "sem cebola" atravessando o checkout

enum KitchenOrderEventType { /* … */ ACCEPTED  REJECTED }
enum CatalogLayout { LISTA  CARDAPIO }          // CatalogSettings.layout, default LISTA
enum OrgSegment { /* … */ ALIMENTACAO }
```

**O backfill é o ponto onde isto dá errado.** Editar o SQL gerado antes de aplicar:

```sql
UPDATE kitchen_orders SET accepted_at = created_at;
UPDATE kitchen_orders SET printed_at  = created_at;
```

Sem o primeiro, todo pedido em andamento vira "aguardando aceite" e **some do board** no
deploy. Sem o segundo, a estação de impressão **imprime o histórico inteiro da
organização** no momento em que o dono conecta a impressora pela primeira vez — a bobina
toda, na frente do cliente.

Depois: `pnpm db:generate` e **bump de `SCHEMA_VERSION`** em `src/lib/db.ts:8`
(`v96-site-astro-animacoes` → `v97-food-fase-1`).

**Ticket é denormalizado de propósito**, quatro campos em vez de um modelo novo. Agrupa-se
sempre por `ticketId ?? id`, então pedido legado se comporta como ticket de um item e
nenhum backfill de ticket é necessário. Promover a `KitchenTicket` fica trivial na Fase 3
(`SELECT DISTINCT ticket_id`), que é quando a conta da mesa vai precisar de um lugar para
pendurar pagamento e histórico. Em troca, **toda escrita de estado de ticket é
`updateMany({ where: { ticketId } })` dentro de uma transação** — sem exceção.

---

## Pendencias

### Critico

- [x] **Backfill de `accepted_at` e `printed_at` na migration** — ver acima. É o item que
      quebra produção se esquecido. — ✅ 2026-09-13
- [x] **`SCHEMA_VERSION` sem bump** (`src/lib/db.ts:8`) — o client fica cacheado no
      `globalThis` e sobrevive ao hot-reload; sem o bump o dev roda com o client antigo e
      todo `select` dos campos novos estoura em runtime. — ✅ 2026-09-13
- [x] **`requiresAcceptance` com default `false`** em `createKitchenOrdersFromSale`
      (`src/lib/pedidos/create-orders-from-sale.ts`) — a função roda dentro dos webhooks
      Stripe e Asaas. Com default `true`, pedido **já pago** passaria a esperar aceite. — ✅ 2026-09-13
- [x] **Endurecer as procedures do garçom** — `publicCreate`, `publicDeliver`,
      `publicListForAttendant`, `publicCollaborators` e `publicProducts` aceitam
      `orgSlug` + `attendantId` como única credencial, e o `attendantId` sai publicamente
      de `publicCollaborators` com o mesmo `orgSlug`. Quem souber o slug cria e "entrega"
      pedido — e a partir desta fase o pedido carrega valor. Detalhe abaixo. — ✅ 2026-09-13
- [x] **Output zod + tipo espelhado** — `list.ts`, `public-list.ts`, `public-ready.ts` e
      `public-customer.ts` declaram output fechado, e `src/features/pedidos/hooks/use-pedidos.tsx`
      repete o tipo à mão. Campo novo que entre em um e não no outro **some em silêncio**
      no cliente. — ✅ 2026-09-13

### Funcional

- [x] **Cardápio** (`src/features/storefront/components/cardapio/`) — quando
      `CatalogSettings.layout = CARDAPIO`: faixa de categorias fixa no topo, card com foto
      grande, preço e botão `+` direto, folha do item com quantidade e observação, barra
      fixa no rodapé com "N itens · R$ X · Ver sacola". Reusa `catalogSettings.listProducts`
      (já devolve categorias e preço resolvido), `src/hooks/use-cart.ts` e `constructUrl`. — ✅ 2026-09-13
- [x] **Observação por item** — `SaleItem.notes` atravessando carrinho
      (`src/context/catalog/use-cart-session-store.ts` ganha `notes` e `updateNotes`) →
      checkout (`use-checkout-logic.ts` passa a montar `{id, quantity, notes}`) → `SaleItem`
      → `KitchenOrder.notes` → cupom. Zod com `notes` **opcional**, para o app antigo em
      cache não quebrar. **Uma linha por produto no carrinho** nesta fase: duas linhas do
      mesmo produto com observações diferentes exigiria `lineId` e mudaria o contrato
      `products: [{id, quantity}]` em todo lugar. — ✅ 2026-09-13
- [x] **`checkout.menuCheckout`** (`src/app/router/checkout/menu-checkout.ts`) — procedure
      nova. Valida a org pelo subdomínio, exige `allowOrders`, resolve o convidado por
      nome + WhatsApp, grava `Sale` `PENDING_APPROVAL` e chama
      `createKitchenOrdersFromSale(saleId, { requiresAcceptance: true })`.
      **Não estender** `approvalCheckout` (aprovar lá hidrata o carrinho do PDV e
      **cancela** a venda — `src/app/router/sales/approve-pending.ts`) nem `kitchenCheckout`
      (exige `CatalogUser`, e tem os dois defeitos já citados, que não devem ser copiados).
      Extrair para `src/lib/pedidos/`: `resolve-guest-customer.ts` e `resolve-sale-items.ts`. — ✅ 2026-09-13
- [x] **Pedido do cardápio não pode entrar na fila do PDV** —
      `src/app/router/sales/list-pending-approval.ts` filtra por `PENDING_APPROVAL`. Com a
      relação nova, uma linha resolve: `kitchenOrders: { none: {} }`. — ✅ 2026-09-13
- [x] **Barra "Novos pedidos"** (`src/features/pedidos/components/pending-tickets-bar.tsx`)
      acima do kanban, com contagem e som; cada card mostra cliente, WhatsApp, itens com
      observação e total, e os botões **Aceitar** / **Recusar**. Procedures
      `list-pending-tickets.ts`, `accept-ticket.ts` (grava `acceptedAt` e `columnEnteredAt`,
      põe a `Sale` em `CONFIRMED`, emite `ACCEPTED`) e `reject-ticket.ts` (arquiva, cancela
      a venda, emite `REJECTED`) — ambas em transação. — ✅ 2026-09-13
- [x] **Agrupamento por ticket no board e na tela do cliente** — o card mostra "N itens"
      e o botão primário virou `kitchen.moveTicket`, que leva o pedido inteiro; o arrastar
      continua item a item. A tela do cliente (`/pedido-cliente/ticket/<id>`) mostra o
      pedido completo — ✅ 2026-09-13
- [ ] **Agrupar também na TV e no app do garçom** — o painel continua mostrando um card
      por item ("Pedido #42" três vezes) e o garçom entrega item a item. Falta agrupar em
      `tv-display.tsx`/`public-ready.ts` e um `kitchen.deliverTicket` para o garçom levar a
      mesa inteira de uma vez. Não bloqueia o uso: é ruído visual, não erro.
- [x] **Encoder ESC-POS** (`src/features/receipt-designer/lib/escpos/`) — `commands.ts`,
      `encoding.ts`, `layout.ts`, `render-blocks.ts`, `cols.ts`. Função pura, sem DOM e sem
      async: entram `ReceiptBlock[]` + `ReceiptSaleData` + `ReceiptPaper`, sai
      `Uint8Array`. Reusa `buildVariables`/`resolveVariables` tal como estão — é o que
      garante que térmica e CSS resolvam a mesma coisa. Larguras em **colunas**
      (58mm = 32, 80mm = 48), que `paper.ts` não tem. — ✅ 2026-09-13
- [x] **Transporte e estação** (`src/features/impressao-termica/`) — `ble-printer.ts`,
      `chunk.ts`, `use-ble-printer.ts`, `use-wake-lock.ts`, `use-print-queue.ts`,
      `print-station.tsx`, `printer-settings.tsx`. Rota `/pedidos/impressao` (caminho já
      dentro da allowlist do `src/middleware.ts`, não precisa editá-lo).
      Procedures `kitchen.listPendingPrint` (`printedAt IS NULL AND acceptedAt IS NOT NULL`)
      e `kitchen.markPrinted`. — ✅ 2026-09-13
- [x] **Balcão com foto** — grade de produtos com imagem no app do garçom;
      `publicProducts` hoje devolve só `id`, `name` e `prepTimeMinutes`. — ✅ 2026-09-13
- [x] **Acompanhamento do pedido inteiro** — `kitchen.publicTicketOrder(ticketId)` + rota
      `/pedido-cliente/ticket/[ticketId]`, com itens, valor e tempo estimado correndo. A
      rota antiga por `orderId` **fica intacta**: há QR já impresso apontando para ela. — ✅ 2026-09-13
- [x] **Segmento `ALIMENTACAO`** (`src/lib/org-segment.ts`) — rótulo, dica e
      `SEGMENT_DEFAULT_DISABLED` desligando os módulos de trade para quem vende comida. — ✅ 2026-09-13

### UX

- [x] **Três toques por item, no máximo** — é o critério que decide o leiaute do balcão e do
      cardápio. Botão e texto grandes, foto clara, e nenhuma tela de cadastro no caminho. — ✅ 2026-09-13
- [x] **Codepage é ajuste por aparelho, não constante** — `ESC t n` seleciona a tabela
      (3 = CP860 português, 2 = CP850, 0 = CP437), e as impressoras genéricas mentem sobre
      o que suportam. `printer-settings.tsx` com botão "imprimir teste" mostrando
      `ÁÉÍÓÚ ÃÕ ÇÑ º ª` para o dono escolher o que sai legível. Caractere fora da tabela
      vira `?`, nunca byte solto. **Nunca enviar UTF-8 cru** — sai mojibake. — ✅ 2026-09-13
- [x] **A tela da estação não pode apagar** — `navigator.wakeLock.request("screen")`
      readquirido no `visibilitychange`; sem isso a tela apaga na primeira notificação.
      A UI precisa dizer "mantenha esta tela aberta", e a fila precisa tolerar drift: ao
      voltar do segundo plano, busca **tudo** o que está pendente, não só o último. — ✅ 2026-09-13
- [x] **Dizer ao dono o que o aparelho dele faz** — o piloto é **Android com Chrome**, que
      tem Web Bluetooth; iOS/Safari não tem, e nesse caso a tela deve oferecer o fallback
      por CSS em vez de falhar calada. Depois de recarregar a página o dono toca "Conectar"
      de novo — o objeto `BluetoothDevice` morre com a página e
      `navigator.bluetooth.getDevices()` é limitado demais para contar com ele. — ✅ 2026-09-13

### Qualidade de codigo

- [x] **Dois significados de `notes`** — no fluxo do garçom `KitchenOrder.notes` é a
      observação do item; em `create-orders-from-sale.ts` é o cabeçalho do pedido
      (`Cliente: X · Obs: Y`) repetido em todos os itens. O ticket é a hora de separar: a
      observação fica em `notes`, e o cabeçalho vai para `tableNumber`, que já é texto
      livre e já aparece com destaque no board, na TV e na busca. — ✅ 2026-09-13
- [x] **Não criar `showNotes` no bloco `items` do cupom** — os blocos são JSON persistido
      em `ReceiptTemplate.blocks` e nunca são migrados; template antigo ficaria sem a flag.
      Imprimir a observação sempre que houver texto. — ✅ 2026-09-13
- [x] **WIP limit passa a contar itens, não tickets** — `countIn` em `pedidos-board.tsx`
      conta linhas. Manter assim (zero mudança), mas documentar. — ✅ 2026-09-13

---

## Decisoes tomadas

- **Ticket denormalizado, não modelo novo** — quatro campos nullable e agrupamento por
  `ticketId ?? id` entregam o pedido inteiro sem migrar dado nenhum. O modelo vem na
  Fase 3, junto com a conta da mesa, que é quem realmente precisa dele.
- **Aceite numa barra acima do kanban, não numa coluna nova** — coluna "Aguardando aceite"
  reusaria move/eventos/WIP de graça, mas o board renderiza `columns[0]` como a coluna
  grande da esquerda: inserir coluna em `position 0` mudaria o leiaute de **toda** org que
  ativasse o cardápio. A barra tem impacto zero no kanban e repete um padrão que o PDV já
  usa (`src/features/sales/hooks/use-pending-orders.ts`), então o dono já reconhece.
- **Pedido do cardápio espera aceite; pedido do operador entra direto** — sem pagamento
  online na Fase 1, aceitar é o que impede pedido falso de virar cupom impresso. Na Fase 2,
  pago passa a valer como aceito.
- **`PENDING_APPROVAL` é o status do pedido não aceito** — `src/features/sales/lib/venda-valida.ts`
  já o exclui do faturamento, então pedido recusado não polui relatório.
- **Procedures do garçom autenticadas com checagem inline de `Member`, não
  `requireOrgMiddleware`** — o middleware resolve a org pelo `activeOrganizationId` da
  sessão, e `acceptWaiterJoin` (`src/lib/waiter-join.ts`) só o define para quem entra pelo
  `joinToken`. Garçom que já era membro, ou membro de duas orgs, tomaria 403 aleatório ou,
  pior, agiria na org errada. O padrão inline já existe no repo
  (`src/app/router/org-dashboard/index.ts`, `src/app/router/cancel-request/`). O `orgSlug`
  continua no input — é ele que diz qual org —, e o `attendantId` deixa de ser credencial e
  vira escolha de identidade (`Collaborator` não é `User`).
  `publicReady` (painel de TV) e `publicCustomerOrder` (QR do cliente) **seguem públicas**:
  a TV não tem login e o cuid do pedido é a credencial de quem recebeu o cupom.
- **Logo em raster fica fora da Fase 1** — `GS v 0` exige converter imagem para bitmap de
  1 bit, o que arrasta canvas e dobra o escopo da impressão. O nome da loja sai em negrito
  e dupla altura (`GS ! 0x11`).
- **Corte de papel (`GS V`) é opcional** — a maioria das 58mm Bluetooth não tem guilhotina
  e alguns modelos travam com o comando. Padrão: só avanço (`ESC d n`).
- **Uma linha por produto no carrinho** — ver "Observação por item" acima.

---

## Como imprimir: o que o transporte precisa respeitar

Não é detalhe de implementação, é onde a fase falha se for feita por cima:

- **Gesto do usuário** — `navigator.bluetooth.requestDevice()` só roda dentro de um
  handler de clique. O `BluetoothDevice` é obtido **uma vez** no botão "Conectar
  impressora" e guardado; reconexão e impressão usam esse objeto e não pedem gesto novo.
- **Descoberta** — as 58mm BLE se espalham por poucos serviços: `0xFFE0/0xFFE1` (HM-10),
  `0x18F0/0x2AF1` (PT-210/MTP-2), `0xFF00/0xFF02` e Nordic UART (`6e400001…/6e400002…`).
  Usar `acceptAllDevices` com **todos** eles em `optionalServices`: serviço fora dessa
  lista faz `getPrimaryService` lançar `SecurityError`, e é o erro nº 1 de quem implementa
  isso pela primeira vez.
- **Chunking e ritmo** — o Web Bluetooth não expõe o MTU. Começar em **20 bytes**
  (ATT padrão 23 − 3), com pausa de **20–40 ms** entre pedaços, e deixar o dono subir para
  100/180 nas configurações. `writeValueWithoutResponse` não espera confirmação e estoura o
  buffer da impressora: a saída sai picotada. Se a característica aceitar `write` com
  resposta, preferir — é controle de fluxo de graça.
- **Fila serializada** — dois pedidos simultâneos intercalando bytes saem como um cupom
  corrompido. Um mutex de impressão.
- **Reconexão** — ouvir `gattserverdisconnected` e reconectar com backoff (1s, 2s, 4s, teto
  de 30s).
- **Idempotência do cupom** — `Set<ticketId>` em voo no cliente (o poll de 5 s não pode
  redisparar durante a impressão) **e** `updateMany({ where: { ticketId, printedAt: null } })`
  no servidor; `count === 0` significa que outra estação pegou. Se duas estações forem
  cenário real, reivindicar **antes** de mandar os bytes, não depois.
- **Tudo atrás de uma interface `PrinterTransport`** — é o que torna encoder e fila
  testáveis com um transporte falso. BLE em si não se testa sem hardware.

---

## Criterios de aceite

1. Numa org em modo cardápio, a loja abre no celular **sem login**: faixa de categorias,
   foto grande, `+` no próprio card, folha do item com observação, barra "N itens · R$ X".
2. Finalizar pedindo **só nome e WhatsApp** gera a venda e N pedidos com o mesmo
   `ticketId` e `acceptedAt` nulo; cliente que já pediu antes é reaproveitado pelo telefone.
3. O board mostra "Novos pedidos" com contagem e som. **Aceitar** move o ticket para a
   coluna inicial e confirma a venda; **Recusar** arquiva e cancela — e pedido recusado não
   entra em relatório de faturamento.
4. Na estação, conectar a impressora **uma vez**; daí em diante todo ticket aceito sai
   sozinho em até 10 s, com cliente, itens, observação por item, total e QR de
   acompanhamento. A tela não apaga. Reimprimir funciona. **Um ticket nunca sai duas
   vezes.** Sem Bluetooth disponível, o botão cai no diálogo de impressão atual.
5. No balcão, um pedido de três itens se monta em **no máximo três toques por item**, entra
   direto na cozinha e imprime.
6. O QR impresso abre o pedido **inteiro** no celular do cliente, com valor e tempo
   correndo, e pisca/vibra quando fica pronto.
7. As cinco procedures do garçom exigem sessão e vínculo com a org; teste de integração
   cobre "membro da org A não age na org B".
8. **Regressão**: org que não usa cardápio não vê diferença nenhuma — board, TV, app do
   garçom e webhooks Stripe/Asaas seguem iguais, e pedido antigo aparece como ticket de um
   item.
9. `pnpm check-types`, `pnpm lint` e `pnpm test` passam.

---

## Testes

Unitários puros, projeto `unit` (node), no molde de
`src/features/receipt-designer/lib/org-receipt.test.ts`:

- `layout.test.ts` — `twoCols` preenche exatamente N colunas; nome longo trunca sem
  estourar; conta **caracteres, não bytes** (acento não pode comer coluna).
- `encoding.test.ts` — `ç ã ó` viram os bytes CP860 esperados; caractere fora da tabela
  vira `?`; ASCII intacto; CP850 difere de CP860 onde deve.
- `render-blocks.test.ts` — golden a partir de `presetBlocks("NAO_FISCAL")` + `SAMPLE_DATA`:
  começa com `ESC @`; contém as três linhas de item decodificadas; `{{numero}}` e `{{data}}`
  resolvidos (prova que reusa `resolveVariables`); desconto zero não imprime a linha de
  desconto; termina em avanço.
- `qr.test.ts` — `GS ( k` com `pL`/`pH` corretos para payload curto **e** para payload acima
  de 255 bytes (o PIX copia-e-cola cai nesse caso, e é o off-by-one clássico).
- `chunk.test.ts` — divisão exata, resto, pedaço maior que o total, entrada vazia.

Integração (`apps/web/tests/integration/kitchen-waiter-auth.test.ts`, molde de
`tests/integration/supplier-list.test.ts`): sem sessão → `UNAUTHORIZED`; membro da org A
chamando com o `orgSlug` da org B → `FORBIDDEN`; membro de A agindo em A → ok.

---

## Antes de testar

1. **Aplicar a migration**: `pnpm db:deploy`. Ela NÃO foi aplicada — o banco de
   desenvolvimento é compartilhado, e escrever nele é decisão do dev. Sem isso, toda tela
   que lê os campos novos responde 500.
2. `pnpm db:generate` e o bump de `SCHEMA_VERSION` já estão no código (`v96-food-fase-1`).
3. **Ligar o cardápio** numa organização: Catálogo → Operação → leiaute **Cardápio**, com
   "aceitar pedidos" marcado. Sem isso, `menuCheckout` recusa e a loja continua vitrine.
4. Ter ao menos uma coluna inicial na cozinha (a organização nova já nasce com as três).
5. A estação de impressão é `/pedidos/impressao`, **no Chrome do Android**. No computador
   ela abre e funciona, mas cai no diálogo de impressão em vez do Bluetooth.
6. Teste de integração: precisa do contêiner `db-test`, que não existe nesta máquina —
   `pnpm test:integration` fica com você.

## Proximos passos

1. Aplicar a migration e testar o fluxo inteiro: pedir pelo cardápio → aceitar no board →
   cupom no papel → acompanhar pelo QR.
2. Fechar o que ficou de fora: agrupar na TV e no app do garçom (ver Pendências).
3. Fase 2 — pagamento na hora, quando houver credencial de gateway.

---

## Melhorias futuras (nao urgentes)

- [ ] Logo em raster no cupom (`GS v 0`).
- [ ] Reimpressão da segunda via a partir do histórico de vendas.
- [ ] Enviar o cupom por WhatsApp em vez de imprimir.
- [ ] Corrigir `pedidos-checkout.ts` — corrida em `saleNumber` e tabela de preço ignorada.
      São defeitos pré-existentes; PR separado.
- [ ] Realtime no lugar do polling de 5 s — a infra Pusher já existe
      (`src/lib/realtime/`), hoje usada só por WhatsApp, mapa e planograma.
