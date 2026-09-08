# Catálogo Promocional — casamento de produtos por nome normalizado

> Corrigir a importação da aba "Lista": planilha com o nome IDÊNTICO ao cadastro
> voltava como "produto novo" e duplicava a tabela de produtos.
> Feature: `src/features/promotional-catalog` + `src/app/router/promotional-catalog`
> Branch: `feat/catalogo-promocional-melhorias-6`
> Criado em: 2026-09-08 · Atualizado em: 2026-09-08
> Status: 🟡 Em andamento (código pronto, falta o dev testar)

---

## Situacao atual

O encarte "ENCARTE SET 08 A 20.09" (244 linhas, 17 produtos distintos, 27
clientes) foi importado na aba "Lista": **3 produtos casaram e 13 vieram como
"novos"** — sendo que os 17 já estavam cadastrados, com o nome escrito
exatamente igual.

A causa está em `match-products-by-name.ts`. O `searchKey()` montava a chave
tirando acento e pontuação e pegando as duas primeiras palavras…

```
"Cafes - Café Santa Clara Extra Forte 250G"  →  "CAFES CAFE"
```

…e a query procurava essa chave **crua na coluna do banco**:

```ts
name: { contains: key, mode: "insensitive" }
```

`mode: "insensitive"` resolve caixa, não resolve **acento nem pontuação**. O
nome gravado continua sendo `"Cafes - Café Santa Clara Extra Forte 250G"`, que
não contém a substring `"CAFES CAFE"`. Normalizava-se o termo mas não a coluna:
não casava nunca.

Passavam só os nomes cujas duas primeiras palavras são separadas por espaço
simples e sem acento — exatamente três:

| passou | chave |
|---|---|
| `Flocao Milho Dona Clara 500g` | `Flocao Milho` |
| `Leite Vegetal` | `Leite Vegetal` |
| `Cappuccino pronto - Pronto - POWER WAY` | `Cappuccino pronto` |

17 nomes → 16 chaves (`700G` e `700g` colapsam no `matchKey`) − 3 = **13
"novos"**, que é o número que apareceu na tela.

Como `createProductForOrg` só garante **slug** único (desempate por timestamp) e
não checa nome, cada importação que erra o casamento **duplica o cadastro**. Já
aconteceu em produção: `Achocolatado - 3Corações - Refil - 700G` e `...700g` são
dois produtos hoje.

Arquivos principais:
- `src/app/router/promotional-catalog/match-products-by-name.ts` — a cascata de casamento
- `src/app/router/promotional-catalog/create-offer-products.ts` — cria os "novos" do wizard
- `src/features/promotional-catalog/lib/product-match.ts` — normalização compartilhada
- `src/features/promotional-catalog/components/catalog-list-wizard.tsx` — a tela

---

## Pendencias

### Critico

- [x] **Casar nome normalizado dos dois lados** (`match-products-by-name.ts`) —
  os tiers 3 e 4 passam a rodar sobre um índice em memória do cadastro, montado
  com UMA query por importação. Acaba com o `contains` de termo normalizado
  contra coluna crua. — ✅ 2026-09-08
- [x] **Trava anti-duplicata na criação** (`create-offer-products.ts`) —
  reconsulta por nome normalizado antes de criar e devolve o id existente
  (`reused: true`), inclusive para repetição dentro do próprio lote. — ✅ 2026-09-08

### Funcional

- [x] **Palpite por palavras com peso na gramatura** (`product-match.ts`) —
  Dice sobre os tokens; gramatura diferente **zera** o score, senão o
  achocolatado de 400G casa com o de 700G (o resto do nome é igual). — ✅ 2026-09-08
- [ ] **Limpar as duplicatas já criadas** — `700G`/`700g` e o que mais tiver
  entrado nas importações anteriores. Precisa da lista revisada pelo dev antes
  de qualquer merge/exclusão: produto pode estar referenciado em catálogo salvo.

### Qualidade de codigo

- [x] **Teste unitário** (`lib/product-match.test.ts`) — 12 casos com os 17
  nomes reais do encarte. — ✅ 2026-09-08
- [ ] **Teste de integração** (`tests/integration/catalog-match-produtos.test.ts`)
  — escrito, mas **não executado**: o Docker não está de pé nesta máquina
  (portas 5433/5434 fechadas). Rodar com `docker compose up -d db-test`.

---

## Decisoes tomadas

- **Índice em memória, não SQL** — comparar nome normalizado no Postgres exigiria
  `unaccent` (extensão) ou coluna gerada. Carregar `{id, name, thumbnail}` da org
  numa query e casar em JS resolve acento, pontuação e caixa de uma vez, e ainda
  permite o score por palavras. Teto de **20.000 produtos**; acima disso o que
  sobrar cai no plano B (a busca por prefixo antiga), que é pior mas varre a
  tabela inteira em vez de só o pedaço carregado.
- **`source: "name-prefix"` mantido** — o tier 4 não é mais prefixo, é score por
  palavras, mas o valor fica gravado em `matchSource` de catálogos já salvos e a
  tela já o lê como "palpite" (selo **conferir**). Renomear invalidaria config
  salva sem ganho.
- **Piso do palpite = 0,7** — calibrado no encarte real: "Soluveis - Santa Clara
  - Refil - 40G" contra "Soluveis - Kimimo - Refil - 40G" dá 0,57 (marca
  diferente, tem que recusar); o mesmo nome sem o prefixo de categoria dá 0,9
  (tem que aceitar).
- **Trava anti-duplicata no wizard, não em `createProductForOrg`** — no cadastro
  manual de produto, nome repetido pode ser intencional. O fluxo que precisa da
  trava é o de importação em lote.
- **Dedup só entre produtos ativos** — mesmo recorte do casamento
  (`isActive: true`). Nome que só existe em produto inativo não bloqueia a
  criação de um novo.

---

## Proximos passos

1. Dev testar a importação do encarte real na branch: esperado **16/16 casados**,
   nenhum "novo".
2. Rodar o teste de integração com o `db-test` de pé.
3. Levantar e revisar as duplicatas já criadas em produção antes de limpar.

---

## Melhorias futuras (nao urgentes)

- [ ] Apelidos por organização ("SC" → "Santa Clara", "3C" → "3 Corações") para
      casar nome abreviado da planilha.
- [ ] Mostrar no wizard **como** cada linha casou (exato/palpite) com o score, em
      vez de só o selo "conferir".
- [ ] Coluna de código/EAN no encarte: com barcode, o casamento é exato e nada
      disso é necessário.
