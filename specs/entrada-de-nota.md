# Entrada de nota — Recebimento de mercadoria com múltiplos produtos

> Documento de entrada (nota do fornecedor) com N itens que, ao ser processado, move estoque, atualiza custo, sugere preço de venda e gera contas a pagar.
> Feature: `src/features/purchases` (novo) + `src/app/router/purchase` (novo) + `src/app/(main)/(rest)/estoque/entradas` (novo) · reaproveita `src/features/stock`, `src/features/financeiro`, `src/utils/pricing.ts`
> Criado em: 2026-09-01 · Atualizado em: 2026-09-01
> Status: 🟢 Implementado — aguardando teste do dev

---

## Situacao atual

Dar entrada de mercadoria hoje só é possível pelo dialog
`src/components/modals/stock/create-stock-moviment-modal.tsx`: **um produto por
vez**, sem documento, sem fornecedor e sem custo. Receber uma nota de 40 itens
significa abrir o dialog 40 vezes, e o custo de compra não é gravado em lugar
nenhum — `StockMovement.unitCost` existe no schema e está `null` em 100% das
linhas, porque nenhum handler o preenche.

Os modelos, porém, **já existem e nunca foram usados**: `Purchase`,
`PurchaseItem` e `PurchaseStatus` estão no `prisma/schema.prisma` desde a
migration `20251204200853_create_erpc_tables`, com `StockMovement.purchaseId` e
`MovementType.COMPRA` prontos. Um grep de `prisma.purchase` em `src/` retorna
zero ocorrências. Este spec é o encanamento sobre esse modelo.

O desenho segue o Winthor (módulo 13, rotina 1301): a nota é digitada como
rascunho, conferida, e só o **processamento** mexe em estoque, custo e
financeiro.

Arquivos principais:
- `src/app/router/purchase/*` — procedures (criar, editar, listar, processar, cancelar)
- `src/features/purchases/*` — a tela da nota e a lista
- `src/features/financeiro/lib/purchase-entries.ts` — parcelas → lançamentos
- `prisma/schema.prisma` — modelos: `Purchase`, `PurchaseItem`, `StockMovement`, `PaymentEntry`, `Product`

---

## Pendencias

### Critico

- [x] **`Organization.lastPurchaseNumber`** (`prisma/schema.prisma`) — par do `lastSaleNumber`; sem ele a numeração da nota fica sujeita a corrida. — ✅ 2026-09-01
- [x] **Idempotência do financeiro** (`prisma/schema.prisma`) — `PaymentEntry` precisa de `purchaseId` + `purchaseEntryKey` com `@@unique`, espelhando `saleId`/`saleEntryKey`. Sem isso, reprocessar duplica contas a pagar. — ✅ 2026-09-01
- [x] **Dupla contagem no DRE** (`src/app/router/financeiro/reports.ts`) — a venda já lança CMV como `COST`. Uma compra lançada como despesa/custo conta o mesmo dinheiro duas vezes, e `PAYABLE` sem categoria cai em `uncategorizedExpense`, que é somado no `netResult`. Resolver com `PaymentCategory.excludeFromResult` (ver Decisões). — ✅ 2026-09-01
- [x] **`PurchaseItem.newSalePrice`** (`prisma/schema.prisma`) — o rascunho é salvável e reeditável; sem persistir o preço aceito, o operador refaz a precificação a cada reabertura. `NULL` = não mexer no preço. — ✅ 2026-09-01
- [x] **`PurchaseItem.sortOrder`** (`prisma/schema.prisma`) — `PurchaseItem` não tem `createdAt` nem ordem. Sem isso as linhas voltam do banco em ordem indefinida (conferência contra o papel fica inviável) e "último custo" com o mesmo produto em duas linhas vira não determinístico. — ✅ 2026-09-01
- [x] **`PaymentContact.supplierId`** (`prisma/schema.prisma`) — hoje não existe vínculo `Supplier` ↔ `PaymentContact`. Sem a FK o casamento é por documento/nome, e renomear o fornecedor forka um contato novo, duplicando o histórico de contas a pagar. — ✅ 2026-09-01
- [x] **Trava de reprocessamento** (`src/app/router/purchase/process.ts`) — compare-and-swap no `updateMany`, não leitura seguida de `if`. — ✅ 2026-09-01
- [x] **`resetDb()` sem `purchase.deleteMany`** (`tests/integration/helpers.ts`) — `PurchaseItem.product` é `onDelete: Restrict`; o primeiro teste que criar nota com itens derruba o `product.deleteMany` e a suíte inteira. — ✅ 2026-09-01
- [x] **Arquivo morto com IDOR** (`src/app/router/stock/register-purchase.ts`) — cópia não importada de `register-entry.ts` que busca produto com `findUnique` sem `organizationId`. Nome sugere "entrada por compra": risco de ser plugado por engano. — ✅ 2026-09-01

### Funcional

- [x] **Procedures `purchase/*`** — `create`, `update`, `list`, `get`, `process`, `cancel`, com `_shared.ts` no molde de `router/inventory/_shared.ts`. — ✅ 2026-09-01
- [x] **Processar** — movimento `COMPRA` por item com `purchaseId` e `unitCost`, `currentStock` atualizado, `costPrice = unitPrice − discount`, parcelas no Financeiro. — ✅ 2026-09-01
- [x] **Cadastro rápido de produto** — quando o código bipado não casa com nada, sem sair da nota. — ✅ 2026-09-01
- [x] **Parcelas** — N parcelas com datas editáveis, informadas no momento de processar. — ✅ 2026-09-01

### UX

- [x] **Página inteira, não dialog** (`/estoque/entradas`) — nota de 40 itens não cabe em popup; segue o padrão do PDV. — ✅ 2026-09-01
- [x] **Sugestão de preço nunca aplicada em silêncio** — checkbox por linha, mais "aplicar em todos" no cabeçalho. — ✅ 2026-09-01
- [x] **Bipe de código de barras** — reusar `hooks/use-barcode-scan.ts` e `products.findByCode`. — ✅ 2026-09-01

### Qualidade de codigo

- [x] **Ler produtos DENTRO da transação** — `sales/create.ts` lê o estoque fora da `$transaction`; não repetir a janela de corrida. — ✅ 2026-09-01
- [x] **Modal de movimentação oferece tipos que não implementa** (`create-stock-moviment-modal.tsx`) — o `<Select>` lista os 8 `MovementType`, o `onSubmit` só trata `ENTRADA`/`SAIDA`/`PERDA`. Escolher "Compra" não faz nada, sem erro nem toast. — ✅ 2026-09-01

---

## Decisoes tomadas

- **Duas etapas, como o Winthor** — a nota nasce `PENDING`, pode ser salva pela metade e editada; só "Processar entrada" mexe em estoque, custo e financeiro, levando a `RECEIVED`. Erro de digitação se corrige antes de sujar o estoque.
- **Custo = último custo direto da nota** (`unitPrice − discount` da linha) — sem rateio de frete, sem bloco fiscal, sem custo médio. É o `CUSTOULTENT` do Winthor.
- **Compra não entra no DRE** — comprar estoque é trocar caixa por ativo, não despesa; a despesa nasce na venda, e o CMV já a reconhece. Implementado como `PaymentCategory.excludeFromResult` + um `continue` nos dois laços de `reports.ts`, e não como valor novo no enum `FinancialCategoryType`: a flag não mexe em enum (nem no `z.enum` de `categories.ts`, nem no `else` pega-tudo do `getDro`) e resolve de uma vez a mesma classe de problema para empréstimo, aporte de sócio e compra de imobilizado. A conta a pagar continua no fluxo de caixa, que é `dueDate`-based — você vai pagar o fornecedor de verdade.
- **Contas a pagar nascem `PENDING`, nunca `PAID`** — diferente da venda, onde dinheiro/PIX/débito já entraram no balcão. "À vista" no papel não quer dizer que o dinheiro saiu: a nota costuma ser digitada dias depois e o pagamento sai pelo banco. Nascer `PAID` afirmaria um pagamento que ninguém fez.
- **Custo só é gravado quando maior que zero** — bonificação e brinde vêm com valor zero na nota e não podem zerar o `costPrice`, o que destruiria a margem em todos os relatórios.
- **Estoque por incremento atômico** — `currentStock: { increment }` com `previousStock` derivado do retorno, em aritmética `Decimal`. `sales/create.ts` lê o saldo FORA da transação e por isso tem corrida; não repetir.
- **Preço de venda preserva a margem atual** — `computePriceMetrics(custoAntigo, precoAtual).marginPercent` → `salePriceFromMargin(custoNovo, margem)`, usando `src/utils/pricing.ts`, que já existe e é testado.
- **Parcelas informadas ao processar**, não no rascunho — evita guardar parcela pendente e é como as duplicatas chegam na prática.
- **Quantidade e preço na unidade do próprio produto** — converter caixa→unidade exigiria um fator por linha que `PurchaseItem` não tem. Fica em melhorias futuras.
- **Estado dos itens no padrão do PDV**, não `useFieldArray` — `form.setValue` + array imutável, com `id` de linha separado de `productId`. `useFieldArray` existe em 2 de ~130 formulários, só em listas pequenas sem busca.
- **Rota sob `/estoque`** e não `/compras` — é o estoque que a nota move; reusa a chave de permissão `estoque` e as abas que já existem. `/compras` fica livre para quando houver pedido de compra.

---

## O que foi entregue

1. Schema (`lastPurchaseNumber`, `purchaseId`/`purchaseEntryKey`, `excludeFromResult`, `newSalePrice`, `sortOrder`, `PaymentContact.supplierId`) + migration manual idempotente + `db:generate` + bump do `SCHEMA_VERSION`.
2. `resetDb()` com `purchase.deleteMany` antes do `product.deleteMany`.
3. `lib/purchase-entries.ts` + unitário das parcelas.
4. Procedures `purchase/*` + registro no `router/index.ts`.
5. `continue` para categoria com `excludeFromResult` no `getDre` e no `getDro`.
6. Testes de integração (não-vazamento, processar, reprocessar, financeiro).
7. UI: lista → editor → cadastro rápido → dialog de processar.
8. Permissões, sidebar e aba do Estoque.
9. Limpeza: apagar `register-purchase.ts`, podar os tipos do modal de movimentação.

---

## Melhorias futuras (nao urgentes)

- [ ] Importação do XML da NF-e do fornecedor, com de-para EAN → produto.
- [ ] Pedido de compra e conferência com divergência de quantidade/preço contra o pedido.
- [ ] Conversão de embalagem: comprar em caixa e vender em unidade, usando `Product.packQty`.
- [ ] Estorno de nota já processada (hoje só rascunho se cancela).
- [ ] Custo com rateio de frete e bloco fiscal — o `CUSTOREAL` do Winthor (IPI + ST − créditos de ICMS/PIS/COFINS).
- [ ] Lote e validade por item (`ProductBatch` existe, sem FK para `PurchaseItem`).
