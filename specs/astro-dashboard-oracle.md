# Astro no dashboard — consultas ao Oracle e widgets

> O Astro responde perguntas de relatório puxando direto do Oracle do cliente
> (Winthor), pergunta os filtros que faltam antes de responder e, numa segunda
> etapa, cria e edita widgets do dashboard com aprovação.
> Feature: `src/features/astro/server/erp-consulta` + `src/features/astro/server/tools/erp.ts` + `packages/astro-widget`
> Criado em: 2026-10-15 · Atualizado em: 2026-10-15
> Status: 🟡 Em andamento

---

## Situacao atual

O Astro do app já tem ferramentas de leitura (vendas, clientes, estoque…), mas
todas leem o Postgres do NERP — nenhuma chega ao Oracle do Winthor, que é onde
está o dado de verdade de quem tem ERP externo (inadimplência, cadastro de
clientes com filial, pedidos). O dashboard já consulta o Oracle pelo
construtor de consultas (`oracle-explorer`), com pré-voo, só leitura e
timeout curto; o Astro não reaproveita nada disso.

O widget do chat já manda a URL da página (`landingPage`), mas a rota
`/api/astro/chat` descarta — o Astro não sabe que a pessoa está no dashboard.

Arquivos principais:
- `src/app/api/astro/chat/route.ts` — rota do chat (stream), monta as tools
- `src/features/astro/server/tools-app.ts` — conjunto de tools do app
- `src/features/erp-sync/server/oracle-explorer/` — dicionário, pré-voo, `runOracleQuery`
- `src/features/dashboard-widgets/lib/oracle-query-config.ts` — schema da consulta
- `packages/astro-widget/src/astro-widget.tsx` — o painel do chat

---

## Criterios de aceite

Fase 1 — leitura com perguntas de filtro:

- **CA-1** — Em `/dashboard`, "quantos clientes da filial 2 não compram há 60
  dias?" é respondido com o número vindo do Oracle, sem criar nada.
- **CA-5** — Consulta recusada (tabela não liberada, pré-voo, timeout, sem
  conexão Oracle, usuário sem permissão) vira explicação em português, não
  erro técnico.
- **CA-7** — "Quantos inadimplentes tem?" sem filtro: o Astro pergunta filial
  e período, com botões, SEM consultar o Oracle. Respondido, sai o número.
- **CA-8** — "Inadimplentes da matriz há mais de 90 dias" responde direto, sem
  pergunta.
- **CA-9** — Toda resposta com número diz o recorte: indicador, filial(is),
  período com as datas.

Fase 2 — widgets (pendente):

- **CA-2** — "Cria um widget com isso" mostra o cartão de aprovação com o
  resumo; aprovado, o widget aparece no dashboard sem recarregar.
- **CA-3** — "Muda aquele widget para lista" / "remove o widget X" com
  aprovação; só nos widgets do próprio usuário.
- **CA-4** — Fora de `/dashboard`, as tools de widget não são oferecidas; as
  de consulta seguem a regra de acesso (admin da organização).
- **CA-6** — Cada ação de widget deixa rastro em `AstroAcao` e segue a
  cobrança em ★ das outras ações.
- **CA-10** — Na mesma conversa, ele lembra a última filial escolhida e
  oferece "Mesma filial (MATRIZ)?" em vez de recomeçar.

---

## Pendencias

### Funcional

- [ ] **Tool `consultarErp`** (`tools/erp.ts`) — indicadores curados
  (inadimplência, clientes sem compra, vendas); filtros obrigatórios por
  indicador; devolve `escolhas` quando falta filtro — CA-1, CA-7, CA-8
- [ ] **Recorte na resposta** — texto do recorte montado em código, não pelo
  modelo — CA-9
- [ ] **Erros em português** — sem Oracle, sem permissão, pré-voo, timeout — CA-5
- [ ] **Página atual no prompt** — a rota lê o pathname de `landingPage` e
  passa `navegacao.pagina` quando é `/dashboard`
- [ ] **Botões de escolha no painel** (`packages/astro-widget`) — saída de tool
  com `escolhas` vira botões que enviam a resposta como mensagem
- [ ] **Fase 2** — `criarWidget`, `editarWidget`, `removerWidget` com aprovação
  (CA-2, CA-3, CA-4, CA-6) e memória da filial na conversa (CA-10)

---

## Decisoes tomadas

- **Indicadores curados, não SQL livre nem tabela livre** — o modelo escolhe
  `indicador`, `filiais` e `periodo`; o código monta a `OracleQueryConfig` e
  ela passa pelo mesmo pré-voo e `runOracleQuery` do dashboard. Pedir ao
  modelo para escolher tabela e coluna do Winthor (centenas de colunas
  crípticas) erra em silêncio; um enum de indicadores erra alto.
- **A falta de filtro é decidida pela tool, não pelo prompt** — `filiais` e
  `periodo` são opcionais no schema de propósito: quando faltam, a tool NÃO
  consulta e devolve as perguntas com as opções reais (filiais lidas da
  PCFILIAL). Se fossem obrigatórios no schema, o modelo inventaria um valor
  para conseguir chamar a tool.
- **Uma consulta por filial, somadas no código** — o motor só junta filtros com
  AND, então "filial 1 + sem filial" não cabe numa consulta; e somar por filial
  dá o detalhamento de graça. São no máximo poucas filiais, e o
  `runOracleQuery` colapsa consultas repetidas.
- **Período vira intervalo `custom` calculado na hora** — "há mais de 60 dias
  desde 2026" é `de 2026-01-01 até hoje−61`. Sem depender de preset fixo nem do
  formato de data do Oracle (`01-JAN-2026` funcionava por acaso do NLS).
- **Só admin consulta** — mesma regra do construtor de consultas
  (`requireOrgAdmin`): o Oracle é o banco de produção do cliente.
- **Nome da filial** — vem do espelho de estoque (`ProductBranchStock`, o mesmo
  que a tela de Integrações mostra) e cai para `PCFILIAL.FANTASIA`; sempre com
  o código na frente ("Filial 1 · MATRIZ"), porque a fantasia se repete entre
  filiais neste cliente.

---

## Proximos passos

1. Fase 1 (esta branch): `consultarErp` + botões de escolha + página no prompt
2. Fase 2: tools de widget com aprovação, reaproveitando `dashboardWidgets.add`/`update`
3. Memória da filial na conversa (CA-10)
