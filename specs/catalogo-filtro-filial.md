# Catálogo Promocional — filtro por filial (estoque do ERP)

> Montar encarte só com o que a loja realmente vende: filtro por filial com
> estoque, apoiado num espelho novo de `PCEST`. De quebra, busca e Filtros
> passam a aparecer nas duas abas do diálogo.
> Feature: `src/features/promotional-catalog` + `src/features/erp-sync`
> Branch: `feat/catalogo-promocional-melhorias-7`
> Criado em: 2026-09-08 · Atualizado em: 2026-09-08
> Status: 🟡 Código pronto — falta aplicar a migration e rodar o sync

---

## Situacao atual

No Armazém Carvalho o filtro **"Só ativos"** do diálogo "Adicionar produto ao
catálogo" devolvia **20.872 produtos**, quando a operação trabalha com ~1,5 mil.
Ligar "Incluir produtos inativos" devolvia **os mesmos 20.872** — prova de que
não existe um único produto inativo na org e de que o filtro era um no-op.

São dois campos distintos em `Product`:

| campo | significado | quem escreve |
|---|---|---|
| `isActive` | "disponível para venda" | o usuário — default `true` |
| `erpActive` | espelho do status no ERP | o sync |

E o sync **nunca toca em `isActive`** (comentário explícito em
`sync-products.ts`: "Nome, preço e `isActive` são do usuário"). Cria tudo com
`isActive: true`. O filtro do catálogo lê `isActive` — por isso enxerga o
cadastro inteiro.

Mesmo `erpActive` não resolveria: ele vale `DTEXCLUSAO IS NULL`, ou seja "não
foi excluído do cadastro do Winthor". Medido no Oracle do cliente:

| critério | produtos |
|---|---|
| `PCPRODUT` total | 23.933 |
| `DTEXCLUSAO IS NULL` (o que `erpActive` marca) | 18.874 |
| **`PCEST.QTESTGER >= 1`, qualquer filial** | **5.291** |
| ↳ filial 1 — ARMAZEM CARVALHO | 4.551 |
| ↳ filial 2 — ARMAZEM CARVALHO | 1.780 |
| espelhado no NERP hoje | 20.872 |

A definição de ativo que o negócio usa é **"tem pelo menos 1 em estoque"**, e
essa informação nunca foi espelhada: a SQL do connector lê só `PCPRODUT` e não
encosta em `PCEST`.

---

## Pendencias

### Critico

- [x] **Espelhar estoque por filial** — model `ProductBranchStock` + migration
  `20260908180000_product_branch_stock`, `SCHEMA_VERSION` → **v87**. — ✅ 2026-09-08
- [x] **Ler `PCEST` no connector** — `fetchWinthorProductStock`, com
  `LEFT JOIN PCFILIAL` para o nome. — ✅ 2026-09-08
- [x] **Passada de sync do estoque** — `sync-product-stock.ts`, chamada depois
  do cadastro. — ✅ 2026-09-08
- [x] **Filtro `branchCode`/`withStock`** — em `_product-filters.ts`, o contrato
  que as três procedures compartilham. — ✅ 2026-09-08
- [x] **Seletor de filial** no popover de Filtros, alimentado por
  `promotionalCatalog.branchList`. — ✅ 2026-09-08

### UX

- [x] **Busca e Filtros visíveis nas duas abas** — estavam dentro da aba
  "Buscar produto"; na aba "Por categoria" o filtro continuava valendo (o
  "restam N" já o respeitava) mas não aparecia nem dava para desligar. — ✅ 2026-09-08

### Operacao (fora do código)

- [ ] Aplicar a migration em produção (`pnpm db:deploy`). Até lá `branchList`
      responde `P2021` e o seletor fica escondido.
- [ ] Rodar o sync uma vez para popular. Só então o filtro devolve os
      4.551 / 1.780.
- [ ] O espelho de produtos está **desatualizado** (20.872 no NERP contra
      23.933 no Winthor) — investigar à parte.

---

## Decisoes tomadas

- **Só linha COM estoque** (`QTESTGER >= 1` no `WHERE` do Oracle) — guardar as
  zeradas triplicaria a tabela (~24 mil produtos × 3 filiais) para responder a
  mesma pergunta pelo avesso: "tem linha" É "tem estoque". Quem precisar
  distinguir zerado de não-sincronizado olha o relatório de sync.
- **Tabela nova, não `StoreProduct`** — `Store` é a loja CLIENTE do trade
  marketing (as 27 da org: CARDOSO, F S COMERCIAL, GAROTO…), filial é unidade
  do próprio ERP. Misturar faria a mesma coluna significar duas coisas.
- **`isActive` continua do usuário** — o estoque entra como filtro NOVO, não
  sobrescrevendo `isActive`. Sobrescrever desfaria edição manual a cada passada
  do sync, que é a razão de `erpActive` existir separado.
- **Filtro no espelho, não no Oracle ao vivo** — o diálogo pagina de 8 em 8
  produtos; consultar o banco on-prem do cliente a cada filtro amarraria a
  montagem do encarte à latência e à disponibilidade dele.
- **Paginação pela tupla `(codprod, codfilial)`** — paginar só por produto
  cortaria um item no meio quando as filiais dele caem em páginas diferentes, e
  as que sobrassem sumiriam do espelho.
- **Falha no estoque não derruba o sync do cadastro** — cliente sem permissão
  de leitura em `PCEST` continua com o cadastro em dia, só sem o filtro.

---

## Proximos passos

1. Aplicar migration + rodar o sync no Armazém Carvalho.
2. Conferir na tela: seletor com as duas filiais e as contagens do Oracle.
3. Investigar o espelho desatualizado (20.872 × 23.933).

---

## Melhorias futuras (nao urgentes)

- [ ] Espelhar também o preço por filial (`PCTABPR`): hoje 20.859 dos 20.872
      produtos estão sem preço porque só se lê `PCPRODUT.PVENDA`.
- [ ] Filtro por faixa de estoque (não só "tem"), se aparecer o caso.
