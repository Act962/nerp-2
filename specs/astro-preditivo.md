# ASTRO — Assistente de consultas preditivas em linguagem natural

> Camada de inteligência do Órbita: o usuário pergunta em português ("quais lojas com ruptura subindo?", "previsão de venda da indústria X no próximo mês") e o ASTRO responde com dados, gráficos e previsões, orquestrando um LLM sobre os dados do Órbita. Épico.
> Escopo: novo `src/features/astro` + `src/app/router/astro`; reusa infra de SQL segura do Oracle Explorer e séries `SalesFactDaily`/`ScanEvent`.
> Branch: `feat/astro-preditivo` · Pilar: Órbita Insights (Indústria/Distribuidor)
> Criado em: 2026-08-18 · Status: 📋 Planejado (épico)

---

## Situacao atual

Hoje há **zero LLM server-side de consulta**: a única IA é o Gemini Flash (visão) em `shopper/server/identify-product-vision.ts` para identificar produto por foto. Nenhum Anthropic/OpenAI/embeddings.

Matéria-prima **já existe e é boa** para previsão:
- **`SalesFactDaily`** — histórico diário por vendedor (espelho Winthor), série temporal pronta para forecast/tendência.
- **`ScanEvent`** (`schema.prisma:2400`) — demanda do shopper com timestamp (o que consultam, buscas, `UNKNOWN_BARCODE`).
- **`SpaceNegotiation`** — valores negociados/vencimentos (base para "contratos a renovar").

Infra reaproveitável:
- **Oracle Explorer** (`erp-sync/server/oracle-explorer/*`): execução de SQL read-only **segura por design** — dicionário do schema, identificador nunca interpolado (`assertIdentifier`), valor sempre bind, `preflight` barra varredura sem índice, timeout 20s / 500 linhas. É a camada de acesso natural do ASTRO ao ERP.
- **Registro de widgets** (`dashboard-widgets/_registry.ts`) — ponto de plugagem para a UI das respostas.

**Não existem** métricas de ruptura / market share / sell-in-out como cálculo, nem qualquer forecast. ASTRO precisa criá-las.

---

## Abordagem proposta

**Assistente NL com tool-use seguro (o LLM NÃO escreve SQL cru).** O modelo escolhe entre **ferramentas read-only tipadas** (oRPC) que retornam dados já agregados e escopados por `organizationId`; a resposta vira texto + gráfico.

### Fase 1 — Ferramentas de dados + orquestração
- [ ] Conjunto de tools read-only: `salesTrend`, `scanDemand`, `spaceOccupancy`, `contractsExpiring`, `rankingSellers`, etc. — cada uma um procedure oRPC que já existe ou é fino sobre os modelos acima.
- [ ] Orquestrador LLM (Anthropic; default no Claude mais capaz atual — pin exato + params na implementação via skill `claude-api`) que recebe a pergunta, chama as tools, e sintetiza a resposta. Multi-tenant sagrado: `organizationId` injetado no servidor, nunca vindo do modelo.

### Fase 2 — Preditivo
- [ ] Forecast sobre `SalesFactDaily` (tendência/sazonalidade) e sinal de ruptura (queda abrupta de venda/scan).
- [ ] "Contratos a renovar" preditivo (probabilidade de renovação) usando histórico de `SpaceNegotiation`.

### Fase 3 — UI
- [ ] Chat do ASTRO (nova página `/astro` ou painel) com respostas em cards/gráficos (Recharts), citando os números-fonte.

## Criterios de aceite

- [ ] Pergunta em português retorna resposta correta com dados reais da org, com gráfico quando fizer sentido.
- [ ] O LLM **nunca** executa SQL cru nem recebe `organizationId` do cliente — só chama tools tipadas escopadas no servidor.
- [ ] Toda tool é read-only e respeita multi-tenant; nenhuma escrita a partir do ASTRO.
- [ ] Chave de IA gated por env var; degradação graciosa se ausente (feature desligada, sem quebrar o app).
- [ ] Custos/latência controlados: cache de respostas determinísticas, limite de tokens, modelo padrão adequado a custo.

---

## Decisoes tomadas

- **Assistente em linguagem natural** (dev) — não são só previsões em telas fixas; é conversa. (Previsões pontuais entram como as tools/Fase 2 por baixo.)
- **Tool-use, não text-to-SQL** — segurança e multi-tenant. Reusar a camada segura do Oracle Explorer apenas para as tools que tocam o Winthor.
- **Anthropic/Claude** — primeira camada LLM de consulta do produto; modelo e parâmetros definidos na implementação (skill `claude-api`).
- **Depende de** `auditoria-sincronizacao` (saber quais séries estão íntegras) e se beneficia de métricas criadas em outros specs.

---

## Melhorias futuras (nao urgentes)

- [ ] Alertas proativos ("ruptura subindo na loja Y") empurrados sem pergunta.
- [ ] Recomendação dentro do QR/scanner (linha de receita do modelo comercial).
