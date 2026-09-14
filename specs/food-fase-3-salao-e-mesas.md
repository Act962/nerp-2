# Food Fase 3 — salão e mesas

> A mesa vira cadastro: grade colorida no app do garçom, conta que acumula, adesivo de QR para abrir a mesa pela câmera, e a montagem do pedido com busca e +/− na mesma tela.
> Feature: `src/features/mesas` + `src/features/pedidos/waiter` + `src/app/router/mesa` + `src/app/(main)/(rest)/pedidos/mesas`
> Branch: `feat/food-fase-3-salao-e-mesas` (a partir de `feat/food-fase-1-pedido-sem-papel`)
> Criado em: 2026-09-13 · Atualizado em: 2026-09-13
> Status: 🟢 Código pronto, aguardando teste do dev — migration já aplicada no Neon
> Épico: [`food-service.md`](./food-service.md) · leiaute aprovado pelo dev antes da implementação

---

## Situacao atual

Depois da [Fase 1](./food-fase-1-pedido-sem-papel.md) o pedido já sai do papel, mas o salão
não existe: **`KitchenOrder.tableNumber` é texto livre digitado a cada pedido**. Sem
entidade, não há grade de mesas, não há conta acumulada, não há como saber se a mesa 12
está ocupada, e não há o que colar de adesivo na mesa.

O app do garçom hoje é uma lista dos pedidos dele com cinco abas (Prontos / Atrasados / Em
preparo / Todos / Concluídos) e uma folha de registro que pede a mesa por digitação. É
tela de acompanhamento, não de atendimento: quem está com a comanda na mão precisa ver o
**salão**, não a fila da cozinha.

Falta também preço no pedido do balcão: `waiterCreate` cria `KitchenOrder` sem `Sale`, então
não há valor nenhum para somar numa conta de mesa.

Arquivos principais:
- `src/features/pedidos/waiter/components/waiter-app.tsx` — o app atual (abas + folha)
- `src/features/pedidos/waiter/components/waiter-register-sheet.tsx` — grade de fotos da Fase 1
- `src/features/pedidos/waiter/hooks/use-waiter-session.ts` — identidade do garçom em localStorage
- `src/app/router/pedidos/waiter-*.ts` — as procedures do garçom, autenticadas na Fase 1
- `src/features/shopper/components/barcode-scanner.tsx` — câmera + `BarcodeDetector` nativo
  com fallback zxing em wasm. Lê só código de barras 1D; falta o formato `qr_code`
- `prisma/schema.prisma` — `KitchenOrder`, `Sale`, `Collaborator`

---

## O que muda no banco

```prisma
model ServiceTable {
  id                 String    @id @default(cuid())
  organizationId     String
  number             Int       // "Mesa 12" — o que o cliente lê no adesivo
  name               String?   // apelido: "Varanda 1", "Balcão"
  seats              Int?      // lugares; informativo
  qrToken            String    @unique // o adesivo. Endereço É a credencial
  closingRequestedAt DateTime? // garçom pediu a conta; mesa fica "Fechando"
  isActive           Boolean   @default(true)

  @@unique([organizationId, number])
  @@map("service_tables")
}

model KitchenOrder { tableId String? } // + relação; tableNumber continua como rótulo
```

**O estado da mesa não é coluna.** Guardar `status` obrigaria a manter sincronizado com os
pedidos, e a primeira falha de escrita deixaria mesa ocupada eternamente. O estado é
derivado a cada leitura:

| Estado | Regra |
|---|---|
| **Livre** | nenhum `KitchenOrder` ativo (não arquivado) apontando para a mesa |
| **Consumindo** | tem pedido ativo e `closingRequestedAt` nulo |
| **Fechando** | `closingRequestedAt` preenchido |

O total da conta é a soma das `Sale` ligadas aos pedidos ativos da mesa.

Migration única + `pnpm db:generate` + bump de `SCHEMA_VERSION` (`v96-food-fase-1` →
`v97-food-fase-3-mesas`).

---

## Pendencias

### Critico

- [x] **Pedido do garçom precisa gerar venda** (`waiter-create.ts`) — sem `Sale` não há
      valor, e sem valor a conta da mesa é sempre R$ 0,00. Reusar `resolveSaleItems` e
      `nextSaleNumber` da Fase 1; item de texto livre entra na cozinha mas não na venda,
      porque não tem preço. — ✅ 2026-09-13
- [x] **A fila de aprovação do PDV precisa de filtro mais fino** — a Fase 1 excluiu toda
      venda com pedido na cozinha (`kitchenOrders: { none: {} }`). Com a conta de mesa isso
      esconde justamente o que o caixa precisa receber. Trocar por "esconder só o que ainda
      espera aceite": `NOT: { kitchenOrders: { some: { acceptedAt: null } } }`. — ✅ 2026-09-13
- [x] **`qrToken` com entropia de credencial** — reusar `src/lib/share-token.ts`
      (`randomBytes(32).toString("base64url")`), não `cuid`. O adesivo fica exposto na mesa
      de um salão público; quem fotografa abre pedido naquela mesa. — ✅ 2026-09-13

### Funcional

- [x] **Cadastro de mesas** (`/pedidos/mesas`) — criar em lote ("da 1 até a 20"), editar
      apelido e lugares, desativar. Desativar em vez de apagar: mesa com histórico de
      pedido não pode sumir do relatório. — ✅ 2026-09-13
- [x] **Folha de QRs para imprimir** — um QR por mesa com o número em corpo grande, na
      folha A4, reusando `triggerReceiptPrint`/`@page` que a impressão já resolve. — ✅ 2026-09-13
- [x] **Grade de mesas no app do garçom** — 3 colunas, número em corpo grande, nome de quem
      abriu, valor acumulado e há quanto tempo. Busca por número ou por cliente. — ✅ 2026-09-13
- [x] **Tela da mesa** — busca de item, faixa de categorias, lista com foto e +/− na
      própria linha, barra fixa com "N itens · Enviar · R$ X". — ✅ 2026-09-13
- [x] **Leitor de QR da mesa** — acrescentar `qr_code` aos formatos do `BarcodeScanner`
      (hoje só 1D) e uma procedure que resolve `qrToken` → mesa. — ✅ 2026-09-13
- [x] **Fechar conta e liberar mesa** — "Fechar conta" marca `closingRequestedAt` (a mesa
      fica azul, sinalizando ao caixa); "Liberar mesa" arquiva os pedidos e devolve a mesa
      para Livre. — ✅ 2026-09-13

### UX

- [x] **Cor e palavra, nunca cor sozinha** — o food truck opera no sol, e 8% dos homens não
      distingue verde de vermelho. Cada card diz "Livre" / "Consumindo" / "Fechando". — ✅ 2026-09-13
- [x] **O +/− na linha do produto** — no app de referência é preciso entrar na categoria
      para achar o item. Aqui a busca e o contador estão na primeira tela do pedido. — ✅ 2026-09-13
- [x] **Alvo de toque de 44px para cima** — quem usa está de pé, com uma mão, andando. — ✅ 2026-09-13

### Qualidade de codigo

- [x] **`tableNumber` continua existindo** como rótulo textual do card (é o que a TV, o
      board e a busca já mostram). `tableId` é o vínculo; o texto é o retrato. Não trocar um
      pelo outro, senão pedido antigo perde a identificação. — ✅ 2026-09-13

---

## Decisoes tomadas

- **O QR diz a mesa; a sessão diz o garçom.** O pedido do dev era o adesivo trazer as duas
  coisas. O nome vem de quem está logado no aparelho: se viesse do papel, qualquer um
  assinaria pedido no nome do colega, e o `attendantId` voltaria a ser credencial — o
  problema que a Fase 1 acabou de fechar.
- **Estado derivado, não coluna** — ver acima.
- **Mesa desativa, não apaga** — histórico de pedido não pode perder a referência.
- **O app do garçom continua em `/registrar-pedido/<slug>`** — há QR de convite já impresso
  apontando para lá, e trocar a rota quebraria papel que está na mão de gente.
- **Navegação por estado, não por rota** — grade → mesa → pedido acontece na mesma página.
  No celular, cada navegação custa um repintar inteiro, e o garçom faz esse caminho
  dezenas de vezes por turno.
- **Sem pagamento aqui.** Fechar a conta sinaliza ao caixa e libera a mesa; receber é PDV,
  e cobrar no cartão é a Fase 2.

---

## Criterios de aceite

1. Em `/pedidos/mesas` dá para criar as mesas de 1 a 20 de uma vez, e imprimir uma folha
   com um QR por mesa.
2. O app do garçom abre na grade: cada mesa mostra número, estado por cor **e** palavra,
   valor da conta e há quanto tempo está aberta.
3. Ler o QR da mesa abre a tela daquela mesa direto, sem digitar número.
4. Na tela da mesa: buscar item, filtrar por categoria, e somar quantidade pelo +/− da
   própria linha — sem abrir sub-tela.
5. Enviar o pedido cria a venda e os pedidos na cozinha sob um único ticket, e o valor
   entra na conta da mesa na mesma hora.
6. "Fechar conta" deixa a mesa em Fechando; "Liberar mesa" devolve para Livre e arquiva os
   pedidos. A venda continua na fila do caixa para ser recebida.
7. **Regressão:** organização sem nenhuma mesa cadastrada continua usando o app como hoje —
   a grade mostra o vazio com um caminho para cadastrar, e o pedido por mesa digitada
   segue funcionando.
8. `pnpm check-types`, `pnpm lint` e `pnpm test` passam.

---

## O que ficou em aberto

- [ ] **O adesivo não leva a mesa para o cliente** — quem aponta a câmera do celular no QR
      cai no cardápio da loja (a rota `/mesa/<token>` existe justamente para o papel colado
      não dar 404), mas o pedido não sai amarrado àquela mesa. Falta carregar o `tableId` do
      adesivo até o `menuCheckout`.
- [ ] **A TV e o app do garçom ainda não agrupam por pedido** — pendência herdada da Fase 1.
- [ ] **`/pedidos` entra em laço de render na montagem** — o console acusa
      "Maximum update depth exceeded" algumas centenas de vezes a cada carga da página,
      e depois para. **É anterior a este trabalho**: medido trocando board, coluna e card
      pelas versões de `origin/main`, o laço continua (291 ocorrências). A tela funciona,
      mas é setState dentro de efeito em algum ponto do board — vale caçar em branch
      própria.
- [ ] **`kitchen.waiterJoinLink` responde 500** quando falta `SYNC_SHARED_SECRET` no `.env`,
      derrubando o QR de convite do garçom no board. É anterior a esta fase; o menu agora
      tem "App do garçom" como caminho alternativo.

## Salao de demonstracao

`scripts/seed-food-demo.ts` enche o salão com todos os estados de uma vez —
cardápio de 10 itens, três garçons, doze mesas, mesa consumindo, mesa com pedido
pronto (que alimenta a TV), mesa pedindo a conta, ticket esperando aceite e
ticket na fila da impressora:

```bash
SEED_DATABASE_URL="<url do banco>" pnpm --filter @nerp/web exec tsx scripts/seed-food-demo.ts <slug-da-org>
```

Reexecutável: apaga o que ele mesmo criou (ticket com prefixo `demo-food-`)
antes de recriar. As fotos são as genéricas de `public/exemplo/`, as mesmas do
onboarding — não são fotos de hambúrguer, servem para a tela ser julgada com
imagem.

## Antes de testar

1. A migration **já foi aplicada** no Neon (`20260913200000_food_fase_3_salao_e_mesas`), e o
   `SCHEMA_VERSION` está em `v97-food-fase-3-mesas`.
2. Cadastrar as mesas em **Pedidos → Mesas** ("da 1 até a 20") e imprimir a folha de QRs.
3. O app do garçom abre em **Mesas**; "Meus pedidos" é a segunda seção da barra de baixo.
4. O leitor de QR precisa de HTTPS ou `localhost` — a câmera não abre em http de rede local.

## Proximos passos

1. Testar o fluxo: cadastrar mesas → abrir a mesa pela grade ou pelo QR → lançar pedido →
   conferir a conta somando → pedir a conta → liberar.
2. Fechar os dois itens em aberto acima.
3. Fase 2 — pagamento, para a conta ser recebida no próprio celular.

---

## Melhorias futuras (nao urgentes)

- [ ] Planta do salão de verdade (arrastar mesa na posição), reusando o motor de mapa de
      loja que já existe em `src/features/store-map/engine`.
- [ ] Transferir mesa e juntar mesas.
- [ ] Dividir a conta por pessoa.
- [ ] Couvert e taxa de serviço.
