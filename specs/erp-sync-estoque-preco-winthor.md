# Estoque e preço do Winthor no cadastro — ERP Sync

> O sync do Winthor passa a gravar no produto o estoque da filial escolhida e a preencher o preço vazio com o último preço de tabela vendido.
> Feature: `src/features/erp-sync` + `src/app/router/erp-sync` + painel do Winthor em Integrações
> Criado em: 2026-10-15 · Atualizado em: 2026-10-15
> Status: 🟡 Em andamento — revisada pelo Weydson em 2026-10-15

---

## Situacao atual

O sync do Winthor (Armazém Carvalho) roda e casa 20.476 produtos pelo código de barras, mas grava só o vínculo (`erpCode`, `erpActive`). O estoque lido do Oracle (`PCEST`) vai para `product_branch_stocks`, que só o Catálogo Promocional usa: a tela de Produtos e a vitrine do catálogo online leem `Product.currentStock`, que fica 0 (21.016 produtos "sem estoque", e a vitrine mostra 13 produtos). Preço não é sincronizado (de propósito: "nome, preço e ativo são do usuário"), e o campo que o conector lê (`PCPRODUT.PVENDA`) está zerado nos 24.062 produtos do Oracle.

O que o Oracle da Armazém tem (consultado em 2026-10-15, só leitura):
- `PCEST` por filial: filial 1 com 4.617 produtos com estoque, filial 2 com 1.842, filial 3 com 1.
- `PCTABPR` (tabela de preço por região) e `PCEMBALAGEM` (preço por embalagem): **sem permissão** para o usuário de leitura do NERP.
- `PCPEDI` (17 milhões de linhas): tem `PTABELA` (preço de tabela no momento da venda), `DATA`, `CODFILIALRETIRA`, `CODPROD`, `POSICAO`.

Arquivos principais:
- `src/features/erp-sync/server/sync-product-stock.ts` — espelho do estoque por filial
- `src/features/erp-sync/server/sync-products.ts` — sync do cadastro (chama o de estoque)
- `src/features/erp-sync/server/connectors/winthor-products.ts` — consultas ao Oracle
- `src/lib/inngest/functions.ts` — `erp-sync-deep-schedule` (3h, com produtos) e `erp-sync-schedule` (15 min, só vendas)
- `src/features/erp-sync/components/winthor-panel.tsx` — painel com "Atualizar agora"
- `prisma/schema.prisma` — `ErpConnection`, `ProductBranchStock`, `Product`

---

## Pendencias

### Funcional

- [ ] **Filial do estoque** (`ErpConnection.stockBranchCode`, migration aditiva) — escolha no painel do Winthor, entre as filiais vistas no último sync (código + nome). Sem filial escolhida, nada muda no produto (comportamento de hoje).
- [ ] **Estoque no produto** (`sync-product-stock.ts`) — depois de reconstruir `product_branch_stocks`, grava em `Product.currentStock` o estoque da filial escolhida para todo produto com `erpCode`; produto vinculado que não veio na leitura daquela filial fica com 0 (o conector só traz quem tem estoque). Produto sem `erpCode` não é tocado. Na mesma transação do espelho, para a tela nunca ver um meio-termo.
- [ ] **Preço vazio** (novo `sync-product-prices.ts`) — último `PTABELA > 0` de cada produto em `PCPEDI`, nos últimos 90 dias, na filial escolhida (`CODFILIALRETIRA`), pedidos não cancelados (`POSICAO <> 'C'`). Grava em `Product.salePrice` **só quando o preço do produto é 0**. Nunca altera preço preenchido.
- [ ] **Quando roda** — no sync noturno (`erp-sync-deep-schedule`, 3h) e no botão "Atualizar agora" do painel (os dois já sincronizam produtos). O sync de 15 min continua só com vendas.
- [ ] **Relatório** — `productSyncReport` ganha `stockUpdated` e `pricesFilled`; o painel mostra "estoque de N produtos (filial X) · N preços preenchidos".

- [x] **Astro: inadimplência por produto** (`astro/server/erp-consulta/inadimplentes-por-produto.ts`, tool `inadimplentesDoProduto`) — clientes com parcela vencida e não paga (`PCPREST`) em vendas que tiveram o produto (`PCMOV`, `NUMTRANSVENDA`, últimos 24 meses), por filial e dias de atraso; produto achado pelo nome/código entre os vinculados ao ERP (ambíguo → pergunta qual). Só admin com Winthor ligado, como `consultarErp`. — ✅ 2026-10-15

### UX

- [ ] **Painel do Winthor** — seletor "Filial do estoque" e a linha do relatório acima.

---

## Decisoes tomadas

- **Estoque segue o ERP** — para produto vinculado ao Winthor, o estoque da filial escolhida substitui o do NERP a cada sync (o Winthor é onde a loja movimenta estoque). Sem filial escolhida, nada muda.
- **Preço só preenche o vazio** — pedido do Weydson: "preenche o que está vazio". Preço digitado no NERP nunca é sobrescrito.
- **Preço provisório pelo último preço vendido** — `PCTABPR`/`PCEMBALAGEM` estão sem permissão. Quando a TI da Armazém liberar leitura, troca-se a fonte para a tabela de preço (pendência futura abaixo). Produto sem venda nos últimos 90 dias fica sem preço.
- **Catálogo Promocional (decisão do Weydson, 2026-10-15)** — o encarte usa o preço do produto como fonte; o "De"/"Por" editado no encarte vale só para aquele encarte e nunca redefine o preço em /produtos (já é assim: `overrides`/`offers` no `catalog-editor.tsx`). Portanto o preço preenchido pelo sync aparece no encarte que não tem preço próprio, e não mexe no que o usuário editou.
- **Filial escolhida no painel** — sem padrão automático; o Weydson escolhe a da Armazém depois.
- **Custo no Oracle da loja, não nos outros clientes** — a consulta de preço lê só a Armazém, uma vez por noite (3h) ou no botão; o catálogo online lê o banco do NERP, nunca o Oracle. Consulta com `DATA >= SYSDATE - 90` e filial no `WHERE` (filtro no banco, não no cliente) e com o tempo máximo do `oracle-client`; estourou, o sync de preço desiste e o resto do sync segue.

---

## Proximos passos

1. Migration `stockBranchCode` + seletor no painel.
2. Estoque no produto.
3. Preço vazio pelo último preço vendido.
4. Relatório no painel.

---

## Melhorias futuras (nao urgentes)

- [ ] Fonte de preço pela `PCTABPR` (região) e preço da caixa pela `PCEMBALAGEM`, quando a TI liberar leitura.
- [ ] Estoque de mais de uma filial no catálogo (ex.: somar filiais escolhidas).

## Carteira de clientes para o Órbita (spec 0106 do Órbita, fase 1) — 2026-10-15

- `erpCarteira.listar` (S2S, escopo `customer:rw`; pela tela só admin): página de até 200 clientes que já compraram (`PCCLIENT.DTULTCOMP` preenchido, sem `DTEXCLUSAO`), com filial, consultor (`CODUSUR1`), dívida vencida (`PCPREST`), pedidos faturados (`PCPEDC`, 120 mais recentes) e departamentos/produtos dos últimos 12 meses (`PCMOV`). `desde` limita a quem comprou, pagou ou passou a dever desde a data.
- No fim do `erp-sync-run` com produtos (o diário das 03h), `avisarOrbitaCarteiraAtualizada` chama `POST /api/integrations/nerp/erp-carteira` no Órbita (mesma assinatura dos pedidos). Falha no aviso não desfaz o sync.
