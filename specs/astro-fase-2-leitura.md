# Astro — Fase 2: a IA que conhece a operação (leitura)

> O Astro passa a responder com os números da organização: vendas com comparação e previsão, clientes que pararam de comprar, estoque baixo e parado, agenda de campo, trade, catálogos, WhatsApp, Stars e suporte. Só leitura — escrever é a Fase 3. Fase 2 de 6 do épico "nerp sem barreira de entrada + Astro operacional".
> Feature: `src/features/astro/server/{periodo,previsao}.ts` + `src/features/astro/server/tools/*` + `src/features/sales/lib/venda-valida.ts` + `src/features/astro-consultor/server/prompt.ts`
> Branch: `feat/astro-fase-2-leitura` (empilhada por patch sobre `feat/astro-stars-planos` + `feat/sandbox-fase-0-brechas` + `feat/sandbox-fase-1-entrada`)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento · **sem migration**

---

## Situacao atual

O canal logado tinha cinco tools de leitura num arquivo só (`tools-app.ts`): quem é a organização, módulos, buscar produto, resumo de vendas e contar cadastros. Agora são vinte e uma, uma pasta por domínio, e o registro só as mescla.

Arquivos principais:
- `src/features/astro/server/tools/_contexto.ts` — o contexto que toda tool recebe (`organizationId` em closure) e a conversão de `Decimal`.
- `src/features/astro/server/tools/{operacao,vendas,previsao,clientes,estoque,calendario,trade,catalogos,whatsapp,stars,suporte}.ts`.
- `src/features/astro/server/periodo.ts` — `intervaloDoPeriodo` e `intervaloAnterior`, sobre o recorte de /vendas.
- `src/features/astro/server/previsao.ts` — o cálculo puro da projeção.
- `src/features/sales/lib/venda-valida.ts` — a régua única de "o que conta como venda".

---

## O que foi feito

### Duas fontes de verdade que faltavam
- [x] **`venda-valida.ts`**: `CONFIRMED | PROCESSING | COMPLETED`, filtrando por `createdAt`. Havia três respostas para "quanto vendi": o Astro somava `COMPLETED` por `completedAt`, os widgets somavam `CONFIRMED` por `createdAt`, e a listagem de vendas não filtrava status.
- [x] **`periodo.ts`**: `hoje | ontem | 7d | 30d | mes | mes_anterior` no fuso da loja, reaproveitando `period-range.ts` (que passou a exportar `inicioDoDiaNaLoja` e `maisDias`). O `inicioDoPeriodo` que o Astro tinha, com deslocamento fixo de −3h, saiu.

### Tools de leitura (todas com `organizationId` em closure)
- [x] **Operação**: `minhaOperacao` (agora com nicho, interesses e `contaDeTeste`), `modulosContratados`, `contarCadastros`, `buscarProdutos`.
- [x] **Vendas**: `resumoDeVendas` (com comparação ao período anterior de mesmo tamanho), `serieDeVendas` (`date_trunc` no fuso da loja via `$queryRaw`, `organizationId` como parâmetro), `produtosMaisVendidos` (via `sale`, porque `SaleItem` não tem `organizationId`), `vendasAbaixoDoTicketUsual` (média móvel de 90 dias menos um desvio-padrão, com o método na resposta).
- [x] **Previsão**: `previsaoDeVendas` (7/14/30 dias). Nível = média de 28 dias; fator por dia da semana; faixa de ±1 desvio dos resíduos. Usa `SalesFactDaily` quando há ERP ativo, senão as vendas próprias. Devolve método, fonte e confiança.
- [x] **Clientes**: `topClientes`, `clientesInativos` (última venda por cliente + quem nunca comprou), `historicoDoCliente`.
- [x] **Estoque**: `estoqueBaixo` (mesma regra dos widgets), `estoqueParado` (com valor parado a custo), `coberturaDeEstoque` (dias de estoque pela saída média de 30 dias).
- [x] **Calendário**: `proximosEventos`, obrigatoriamente por `resolveCalendarActor` + `buildCalendarWhere` — um promotor não vê ação de loja que não é dele.
- [x] **Trade**: `painelDeTrade`, `contratosVencendo` (a loja vem pelo ponto do mapa → planta → loja).
- [x] **Catálogos**: `listarCatalogosPromocionais`, `previaDeCatalogo` (mesma seleção de produtos que a criação usaria, por `resolvePromotionalProducts`; categoria por nome, resolvida dentro da org).
- [x] **WhatsApp**: `estadoDoWhatsapp` — número ativo, funis, campanhas recentes e **por que** não dá para disparar (sem número ou conta de teste).
- [x] **Stars e suporte**: `extratoDeStars`, `consumoDoAstro`, `contatoDoSuporte`.

### Prompt
- [x] `ESCOPO_APP` virou índice por domínio (uma linha por assunto; o detalhe fica no `description` de cada tool, que vai como schema e não como prompt). `ROTEIRO_APP` passou a exigir método e confiança em previsão e anomalia, e a consultar o estado do WhatsApp antes de falar em disparo. Medido: **10.730 caracteres**, contra o teto de 12.000 do teste.

---

## Pendencias

### Funcional
- [ ] `painelDeTrade` não reusa `getTradeDashboard`: aquele procedure devolve 26 indicadores para a tela, este devolve o punhado que muda uma decisão. Se os dois divergirem, extrair um `kpisDeTrade(organizationId)` compartilhado.
- [ ] `vendasAbaixoDoTicketUsual` olha 90 dias fixos; loja nova com menos de 7 dias de venda recebe um aviso em vez do número.
- [ ] Nada aqui escreve. Criar catálogo, campanha e evento é a Fase 3, com aprovação na conversa.

---

## Decisoes tomadas

- **Uma pasta por domínio, um registro que só mescla** — `tools-app.ts` tinha 250 linhas e ia para mil; a suíte de isolamento percorre o registro inteiro, então tool nova é coberta por construção.
- **`organizationId` nunca é argumento de tool** — é a garantia estrutural do isolamento, e o teste `nenhuma tool aceita organizationId como argumento` percorre todos os schemas.
- **Previsão estatística, sem ML** — média com sazonalidade semanal e faixa de erro. Um modelo treinado exigiria dados, infra e explicação; isto responde "quanto devo vender sábado" com um método que cabe numa frase.
- **O método vai junto do número** em previsão e anomalia. Número de futuro sem método é chute com cara de certeza.
- **`$queryRaw` só na série temporal** — o `groupBy` do Prisma não trunca data com fuso, e agrupar em memória traria todas as vendas do período. `organizationId` entra como parâmetro, nunca interpolado.

---

## Testes

- unit: `features/astro/server/previsao.test.ts` (série sintética: constante, sazonalidade sábado/domingo, janela, confiança, nunca negativo), `features/astro/server/periodo.test.ts` (as 22h de Fortaleza ainda são hoje), `features/sales/lib/venda-valida.test.ts`, `astro-consultor/server/prompt.test.ts` (índice de domínios e teto de 12k).
- integração: `tests/integration/astro-tools-operacao.test.ts` — duas organizações com produtos, clientes e vendas em datas conhecidas; percorre as 21 tools e falha se qualquer resposta da A mencionar a B; confere os números (total 360 em 3 vendas, rascunho e cancelada fora, cobertura de 5 dias, inativo há 120 dias).
