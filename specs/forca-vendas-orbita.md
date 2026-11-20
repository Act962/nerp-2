# Força de Vendas ÓRBITA — módulo de campo do NERP

> O consultor externo abre um módulo no celular e tem na mão a carteira, o produto com tudo o que importa (estoque, preço do cliente, cubagem, últimas compras, inadimplência), o pedido, a rota, o WhatsApp oficial da empresa, as campanhas, o Star Friends e o Astro. O gestor acompanha tudo ao vivo pelo ERP. Épico — várias fases, uma branch por fase.
> Feature: `src/features/forca-vendas` (novo) + `src/app/router/forca-vendas` (novo) + `src/app/(forca-vendas)/forca-de-vendas` (novo, celular) + `src/app/(main)/(rest)/vendas/forca-de-vendas` (novo, gestor)
> Branch de integração: `feat/forca-vendas` · Pilar: Distribuidor (metas, representantes, vendedores, cobertura, positivação)
> Criado em: 2026-10-16 · Atualizado em: 2026-10-16 (MVP)
> Status: 🟡 MVP implementado na `feat/forca-vendas-mvp`, aguardando teste do dev (ver "Estado do MVP")

---

## Visão

O NERP caminha para ser o **sistema operacional da empresa** — gestão, marketing, atendimento, comercial, contábil, jurídico, RH, logística e vendas no mesmo ecossistema. A Força de Vendas é a vitrine disso: é o ponto em que o ERP (produto, estoque, preço, financeiro, fiscal), a comunicação do Órbita (WhatsApp oficial, CRM, campanhas, fidelidade) e o Astro (IA) chegam juntos na mão de quem vende.

O diferencial não é ter mais telas que a Máxima ou a Concretize — é ser **mais simples** e **mais inteligente**:

- **Home em grade de ambientes**, botões grandes, um toque para cada coisa. Só aparece o ambiente que a empresa contratou e liberou para aquele vendedor.
- **Uma busca que responde tudo** sobre o produto e o cliente, sem o vendedor ligar para o escritório.
- **O cliente do vendedor é cliente da empresa**: as conversas passam pelo número oficial da organização, a carteira fica no sistema e não vai embora com o vendedor.
- **IA que trabalha junto**: pedido montado a partir da foto da lista do cliente, mix sugerido, melhor dia de visita, quem está parando de comprar.

É um **módulo dentro do NERP**, igual ao App Promotor: abre no navegador do celular, sem loja de aplicativo e sem app separado em `apps/`.

### A home

```
┌──────────────────────────────────┐
│ ☰  Olá, Ana              🔔 ⟳   │
│ Meta do mês 64%   Saldo flex R$ 312 │
│ ┌──────────────────────────────┐ │
│ │ 📣 Aviso do gestor           │ │
│ │ Promoção de óleo até sexta.  │ │
│ └──────────────────────────────┘ │
│ [Clientes] [Pedidos]  [Produtos] │
│ [Ofertas]  [Rota]     [Mensagens]│
│ [Campanhas][Metas]    [Consultas]│
│ [Avisos]   [Astro]  [Star Friends]│
└──────────────────────────────────┘
```

---

## Estado do MVP (2026-10-16)

Branch `feat/forca-vendas-mvp`, saída de `feat/forca-vendas`. Tudo lê dados do próprio NERP; o Winthor entra depois pelas portas descritas em **Arquitetura**.

**Entregue**
- [x] Módulo `/forca-de-vendas` com layout de celular, home em grade de 12 ambientes (Campanhas, Astro e Star Friends aparecem como "Em breve"), atalho na tela inicial (`app-manifest`).
- [x] Permissões `forca-vendas` (campo), `forca-vendas-gestao` (painel) e a ação `forca-vendas-aprovar`; item "App Força de Vendas" e grupo "Força de Vendas" no menu; `/forca-de-vendas` na lista do `middleware.ts`.
- [x] Escopo de equipe (`server/escopo-equipe.ts`): vendedor vê a carteira dele, supervisor a da equipe, admin/coordenação/gestão todos.
- [x] Carteira (`CarteiraCliente`) e ficha 360º do cliente: crédito, vencidos, títulos, últimas compras, ticket médio, dias sem comprar, ligar, WhatsApp, como chegar, check-in.
- [x] Produto 360º: busca por nome/código/marca e leitor de código de barras, preço do cliente, estoque disponível (físico − comprometido) e por filial, cubagem, o que o cliente comprou, giro de 30 dias; Ofertas do dia (desconto vigente + catálogos).
- [x] Pedido, orçamento, bonificação e troca, com simulação ao vivo no servidor (preço de tabela, desconto, flex, motivos de aprovação), idempotência por `clientOperationId` e envio ao destino `NATIVO`.
- [x] Receptor no ERP (`/vendas/forca-de-vendas/pedidos`): aprovar/recusar com motivo, cortar quantidade e faturar (baixa de estoque, um título por parcela da condição, CMV e lançamento do flex); supervisor também aprova pelo celular.
- [x] Saldo flex com extrato e ajuste manual do gestor; política comercial e condições de pagamento editáveis.
- [x] Rota por dia da semana (adicionar, reordenar, organizar pelo menor caminho), check-in/out com raio e justificativa, jornada com localização enquanto o módulo está aberto, mapa ao vivo com trajeto do dia e planejado × visitado.
- [x] Chat da carteira reaproveitando a conversa do Atendimento; mensagem de cliente da carteira chega com o vendedor principal como responsável.
- [x] Avisos do gestor com prioridade, vigência, "Li e entendi" (URGENTE trava a home) e "lido por X de Y".
- [x] Correções no que já existia: pedido de campo fora da fila de aprovação do PDV (`list-pending-approval`, `approve-pending`), `isCatalogOrigin` pela lista explícita, VENDEDOR fora da liderança de campo (`scripts/vendedores-sem-lideranca.ts` lista quem perdeu acesso).

**Validação feita**: Biome; unitários (`regras-pedido`, `parcelas`, `sale-entries`, `catalog-order-status`); fluxo completo contra o banco de dev numa empresa sandbox (carteira → simulação com DESCONTO e FLEX_NEGATIVO → envio idempotente → aprovação → faturamento com corte → estoque, 2 parcelas, CMV e flex conferidos → aviso urgente → roteiro, check-in, jornada e mapa); telas abertas no navegador em 375px e no desktop.

**Não rodado aqui**: `pnpm check-types` (só quando o dev pedir) e o teste de integração `tests/integration/forca-vendas-escopo.test.ts` (precisa do `db-test`).

**Pendente para fechar o MVP**
- [ ] Web Push (VAPID) para aviso e pedido decidido — hoje o aviso aparece ao abrir o módulo. Depende das chaves VAPID.
- [ ] Restringir também no servidor o histórico e o envio de mensagens (`message.list`/`message.send`) à carteira do vendedor: a lista de conversas do módulo já filtra, mas essas duas procedures do Atendimento só conferem a organização.
- [ ] PDF do pedido (hoje o resumo vai em texto pelo WhatsApp).
- [ ] Cron de expurgo das localizações pela retenção configurada.

---

## Situação atual

O NERP já tem quase todas as peças — falta juntá-las para o vendedor externo e preencher o que é específico de força de vendas (carteira, pedido de campo, visita, flex, aviso do gestor).

| O que já existe | Onde | Como a Força de Vendas usa |
|---|---|---|
| App Promotor / App Vendedor (padrão do módulo de campo, layout mobile sem sidebar, onboarding com selfie e WhatsApp, GPS, "Estou aqui", rota, catálogos) | `src/app/(promotor)/*`, `src/features/promotor/components/*` | Molde do módulo novo; componentes reaproveitados como ambientes |
| Rota do promotor com otimização 2-opt | `router/promoter-route/_optimize.ts` | O otimizador é genérico; a rota de vendas ganha modelo próprio sobre `Customer` |
| Mapa de campo e trajeto (inferido das fotos) | `router/field-map/_trail.ts`, `/trade/mapa-de-campo` | `TRAIL_POINT_KINDS` já reserva `CHECKIN`/`CHECKOUT` |
| Produto com estoque por filial, tabelas de preço, faixas por quantidade, descontos por categoria, medidas e caixa | `Product` (`widthMm`, `heightMm`, `depthMm`, `grossWeightG`, `packQty`, `pack*Mm`), `ProductBranchStock`, `PriceList`, `ProductPrice`, `PriceListCategoryDiscount` | Produto 360º; cubagem derivada das medidas |
| Preço por cliente | `src/features/precos/server/resolve-price.ts`, `precos.resolveMany` | Preço do cliente na busca e no pedido |
| Leitor de código de barras (zxing wasm) | `src/features/shopper/components/barcode-scanner.tsx` | Busca por bipe |
| Catálogos promocionais com "não visto" | `promotionalCatalog.listForSeller`, `unseenCount`, `/promocao/[shareToken]` | Ambiente "Ofertas do dia" |
| Contas a receber com vencidos | `PaymentEntry` (RECEIVABLE, OVERDUE), `router/financeiro` | Inadimplência do cliente |
| Carteira do Winthor lida do Oracle (cadastro, dívida vencida, pedidos, o que comprou, consultor `CODUSUR1`) | `src/features/erp-carteira/server/carteira-winthor.ts`, `erpCarteira.listar` | Fonte para orgs Winthor (F11a) |
| CRM, WhatsApp oficial (Cloud API), campanhas em lote, automações com espera, agenda, ★ | `src/features/{crm,whatsapp-chat,campanhas,automacoes,agenda,stars}` — ver `whatsapp-crm-campanhas.md` | Chat da carteira, follow-ups, campanhas do vendedor |
| Venda com idempotência e sem caixa obrigatório | `Sale.clientOperationId @unique`, `Sale.cashSessionId` opcional | O pedido de campo é uma `Sale` |
| Venda pendente sem baixa de estoque | `src/features/storefront/server/create-pending-sale.ts` | Padrão do pedido que nasce pendente |
| Metas e ranking | `SalesGoalPeriod/Branch/Entry`, `router/ranking`, `/ranking-publico` | Ambiente "Metas" |
| Astro com ferramentas, ações com cartão de aprovação, cobrança em ★, voz | `src/features/astro/server/tools/*`, `acoes/aprovacao.ts`, `packages/astro-widget` | Astro no módulo, filtrado pela carteira |
| Outbox e catálogo offline em IndexedDB | `packages/core/src/adapters/indexeddb-{outbox,catalog}.ts` | Offline do módulo (fase própria) |
| Manifest por loja ("vitrine como app") | `src/app/(storefront)/[subdomain]/app-manifest` | Molde do atalho na tela inicial |
| Star Friends (fidelidade) | **só no Órbita**: `nasaex-wey/prisma/schema.prisma` (`Loyalty*`), `nasaex-wey/src/features/star-friends` | Portar para o NERP |
| Web Push (VAPID) | **só no Órbita**: `nasaex-wey/src/lib/notifications/*` | Portar para o NERP |

O que **não existe** hoje: pedido criado pelo vendedor para um cliente, carteira (cliente ↔ vendedor), aniversário/limite de crédito/geolocalização no `Customer`, check-in, rastreio contínuo, saldo flex, aviso do gestor, push, importação de contatos, agendamento de campanha (`Broadcast.scheduledAt` não tem quem dispare), processador de `Reminder`, fidelidade, comissão, emissão de NF-e.

---

## O que os concorrentes têm e nós ainda não

Levantamento de 2026-10-16 nas páginas públicas da Máxima Tech (maxPedido, maxGestão, maxPromotor, maxPag) e da Concretize (Flow Vendas, Cefas Nexus, Cefas Hub, Cefas Log). Fontes no fim.

| Recurso | Máxima | Concretize | NERP hoje | Fase |
|---|:-:|:-:|:-:|:-:|
| Pedido, orçamento, pré-venda no app | ✅ | ✅ | ❌ | F3 |
| Bonificação, troca, brinde | ✅ | ✅ | ❌ | F3 |
| Aprovação de desconto/preço com rentabilidade | ✅ | — | ❌ | F3 |
| Conta corrente / saldo flex do vendedor | ✅ | ✅ | ❌ | F3 |
| Limite de crédito no pedido, bloqueio de cliente | ✅ | ✅ | ❌ | F3 |
| Consulta de estoque, preço e histórico do cliente | ✅ | ✅ | parcial | F2 |
| Itens focais, ofertas do dia | ✅ | parcial | parcial (catálogos) | F2 |
| Carteirização | ✅ | ✅ | ❌ | F1 |
| Check-in/out com geocerca, auditoria de visita | ✅ | — | ❌ | F4 |
| Localização ao vivo com bateria e versão | ✅ | ✅ | ❌ | F4 |
| Roteirização, planejado × executado, agenda | ✅ | parcial | parcial (rota do promotor) | F4 |
| Mensagem do gestor para o vendedor | ✅ | — | ❌ | F6 |
| Offline | ✅ | ❌ | ❌ | F-off |
| Pedido por foto/PDF/planilha (IA) | ✅ | — | ❌ | F7 |
| Mix sugerido, venda casada, melhor dia de visita | ✅ | parcial | ❌ | F7 |
| Assistente por conversa e voz | — | ✅ | ✅ (Astro, fora do campo) | F7 |
| Metas por produto/marca/fornecedor, comissão | ✅ | ✅ | parcial | F9 |
| Positivação, cortes e faltas, inativos com valor de recuperação | ✅ | ✅ | ❌ | F9 |
| Mapa de calor de vendas | ✅ | ✅ | ❌ | F9 |
| Compartilhar pedido, DANFE, boleto | ✅ | parcial | ❌ | F3/F10 |
| Link de pagamento Pix/cartão | ✅ | — | ❌ | depende de `pagamentos-gateway.md` |
| Integração com vários ERPs | ✅ (50+) | ❌ (só o próprio) | Winthor leitura | F11 |

**O que nenhum dos dois tem — e é onde o NERP passa na frente:**

1. **CRM e WhatsApp oficial dentro do app do vendedor**, com o número da empresa centralizando todos os clientes (a Concretize tem WhatsApp só no CRM do escritório; a Máxima só notifica entrega).
2. **Campanhas e follow-ups a partir da carteira do vendedor** — aniversário, pós-pedido, "sumiu há 30 dias" — automáticos.
3. **Importar a agenda do celular** para dentro do sistema, com opt-in.
4. **Programa de fidelidade** (Star Friends) visível na ficha do cliente.
5. **IA com contexto do ERP inteiro** (vendas, estoque, financeiro, trade) e não só do pedido.
6. **Funciona em Android e iPhone** — os dois concorrentes são só Android.
7. **Trade e vendas no mesmo lugar** — foto do PDV, catálogo, mapa da loja e pedido.

---

## Decisões tomadas

- **Módulo dentro do NERP, ao lado do App Promotor** — rota, permissão e item de menu próprios. Nada de app separado em `apps/`, nada de app nativo, nada de loja de aplicativo. Menos barreira para colocar na rua e ver o produto. O **App Vendedor** atual (`/vendedor`) continua como está.
- **Motor de comunicação = o do NERP** (porte do Órbita já mesclado na PR #82): `CrmLead`, `Conversation`, `Broadcast`, `CrmWorkflow`, `WhatsAppConnection`. O **Star Friends** é portado do `nasaex-wey` para o NERP.
- **O pedido cai no receptor do próprio NERP.** O Winthor é uma integração opcional (adaptador em Integrações), não uma dependência. Escrever no Winthor só na F11b.
- **O pedido é uma `Sale`** com `origin = FORCA_VENDAS` e uma extensão 1:1 `PedidoForcaVendas`. `Sale.cashSessionId` já é opcional, então não precisa de caixa. Tem procedure e receptor próprios — **não** passa por `sales.create` (exige caixa aberto e recalcula preço) nem por `approvePending` (devolve os itens ao carrinho do PDV).
- **Login = a sessão do ERP** (Better Auth). Sem token de dispositivo.
- **Uma função decide quem vê o quê**: `features/forca-vendas/server/escopo-equipe.ts`. Admin/coordenador/`forca-vendas-ver-todos` → todos; SUPERVISOR → subordinados por `Member.supervisorId` e ele mesmo; VENDEDOR → só ele. Carteira, pedidos, mapa, chat, avisos e metas filtram por ela.
- **MVP lê só o NERP, atrás de portas.** `FonteComercial` (`server/fontes/porta.ts`) entrega dívida, histórico e estoque; o adaptador `nativa.ts` lê o NERP e o do Winthor entra em `fontes/index.ts` sem mudar tela nem regra. A saída do pedido é a porta `DestinoDePedido` (`server/destino`): `NATIVO` hoje, `WINTHOR` reservado.
- **Estoque baixa no faturamento.** Até lá o pedido aprovado ou em aprovação segura a quantidade: o vendedor vê "disponível = físico − comprometido". O flex também é lançado no faturamento, já com o corte.
- **Venda que conta é a régua única do ERP** (`features/sales/lib/venda-valida.ts`: CONFIRMED, PROCESSING, COMPLETED): pedido de campo aprovado entra nos relatórios na data do pedido; cancelado sai.
- **Fiscal pela Nota Gateway** (ex-eNotas Gateway) — entra como provedor ao lado do Focus NFe, atrás de uma porta `ProvedorFiscal`.
- **Fluxo de branches igual ao do desktop**: tudo acumula em `feat/forca-vendas`; cada fase sai dela (`feat/forca-vendas-fase-N`) e volta para ela; **nada vai para a `main` sem pedido explícito do dev**.

---

## Arquitetura

### Onde cada coisa mora

| Peça | Caminho |
|---|---|
| Módulo de campo (celular) | `src/app/(forca-vendas)/forca-de-vendas/` — `layout.tsx` copiado de `(promotor)/layout.tsx`; `page.tsx` = home; um diretório por ambiente (`clientes/`, `pedidos/`, `produtos/`, `ofertas/`, `rota/`, `mensagens/`, `campanhas/`, `metas/`, `consultas/`, `avisos/`, `astro/`, `star-friends/`) |
| Painel do gestor (ERP) | `src/app/(main)/(rest)/vendas/forca-de-vendas/` — `pedidos`, `carteiras`, `vendedores`, `mapa`, `rotas`, `visitas`, `avisos`, `metas`, `configuracoes` |
| UI | `src/features/forca-vendas/{components,hooks,server,engine}` |
| Procedures | `src/app/router/forca-vendas/<area>/<verbo>.ts`, exportadas como `forcaVendas.*` |
| Middleware novo | `src/app/middlewares/vendedor.ts` → `requireVendedorMiddleware` injeta `context.vendedor` (`Member`, `VendedorPerfil`, membros visíveis) |

Encadeamento padrão de uma procedure do módulo:

```ts
export const listarCarteira = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVendedorMiddleware)
  .input(z.object({ busca: z.string().optional(), cursor: z.string().optional() }))
  .handler(async ({ input, context }) =>
    listarCarteiraDoVendedor({ orgId: context.org.id, membros: context.vendedor.membrosVisiveis, ...input }),
  );
```

O módulo reaproveita do App Promotor: `promoter-onboarding` (selfie + WhatsApp), `gps-status-banner`, `here-now-canvas`, `promoter-route-tab`, `catalogos-tab` e `capture-wizard`.

### Atalho na tela inicial e push

- `manifest` e service worker com **escopo restrito a `/forca-de-vendas`** — não tocam no ERP, no PDV nem na vitrine. O vendedor "instala" o atalho e o módulo abre em tela cheia (mesmo padrão do `[subdomain]/app-manifest` da vitrine).
- **Web Push com VAPID**, portado de `nasaex-wey/src/lib/notifications/*` (`vapid.ts`, `web-push-channel.ts`). Modelo `PushToken`; envio pelo Inngest `push-enviar` (lotes, inscrição expirada marcada como inativa).
- No iPhone o push só funciona com o atalho instalado (iOS 16.4+). A tela de boas-vindas ensina a instalar.
- Gatilhos: aviso do gestor, pedido aprovado/recusado, mensagem nova de cliente da carteira, lembrete, aniversário do dia, meta batida.

### Limites do navegador (assumidos)

| Necessidade | No navegador | Como fica |
|---|---|---|
| Localização em tempo real | Só com o módulo aberto | `watchPosition` durante a jornada + Wake Lock (tela acesa) + um ponto a cada ação (check-in, pedido, foto). Não rastreia com a tela bloqueada. |
| Importar contatos | Contact Picker só no Chrome/Android | Android: seletor de contatos. iPhone e geral: upload de `.vcf` (exportado da agenda) ou CSV. |
| Offline | Possível | Fase própria: IndexedDB do `@nerp/core` + cache do service worker. |
| Biometria | Possível | Passkey do Better Auth (melhoria futura). |
| Código de barras | Já existe | `barcode-scanner.tsx` (zxing wasm). |

### Pedido e receptor

- `forcaVendas.pedidos.enviar` — idempotente por `clientOperationId` (o mesmo envio repetido devolve o mesmo pedido).
  1. Preço de tabela pelo `resolve-price.ts`.
  2. Política de desconto: limite do vendedor (`VendedorPerfil.descontoMaximoPercent`) ou o padrão da org.
  3. **Flex**: vender acima da tabela credita o saldo; desconto além do livre debita.
  4. **Crédito**: exposição = títulos em aberto + pedidos confirmados não faturados; acima do limite vai para aprovação.
  5. Motivos de aprovação calculados (`DESCONTO`, `LIMITE_CREDITO`, `INADIMPLENTE`, `BONIFICACAO`, `FLEX_NEGATIVO`, `PRECO_ALTERADO`). Sem motivo e com autoaprovação ligada → `CONFIRMED`; senão `PENDING_APPROVAL`.
- **Ao faturar** (decisão do dev: o estoque baixa no faturamento): baixa de estoque (`applySaleStockOut` em `features/sales/server/stock-out.ts`), títulos a receber por parcela da condição de pagamento (variante de `createSaleFinanceEntries` em `features/financeiro/server/sale-entries.ts`), lançamentos de flex com débito atômico no padrão de `features/stars/server/debitar.ts`.
- **Cancelar ou cortar** estorna estoque, financeiro e flex com lançamentos novos — nada é apagado.
- **Receptor** no ERP (`/vendas/forca-de-vendas/pedidos`): fila, aprovar/reprovar com motivo, cortar quantidade, marcar faturado/entregue. O supervisor também aprova pelo celular.
- **Porta `DestinoDePedido`** (`features/forca-vendas/server/destino/porta.ts`) com `enviar`, `consultar?`, `cancelar?`. Adaptador `NATIVO` (padrão: o NERP é o receptor) e `WINTHOR` (F11b). Estado em `PedidoEnvioDestino`; envio pelo Inngest `fv-pedido-enviar-destino` com retry, idempotente por `(saleId, destino)`.
- **Correções no que já existe** (obrigatórias na F3):
  - `sales/list-pending-approval.ts` passa a listar só as origens do catálogo — senão o pedido de campo cai na fila do PDV.
  - `sales/approve-pending.ts` recusa `FORCA_VENDAS`.
  - `ranking/_sales-aggregation.ts` passa a creditar `Sale.sellerMemberId` (pedido digitado pelo escritório em nome do vendedor), caindo em `createdById` quando vazio.
  - Auditar os ~32 lugares que leem `Sale`: o que cada um entende por `CONFIRMED` × `COMPLETED` (dashboard, relatórios, Astro).

### Saldo flex (conta corrente do vendedor)

É o "caixinha" que a Máxima e a Concretize oferecem: o vendedor ganha margem de negociação quando vende acima da tabela e gasta quando dá desconto.

- Vendeu **acima** da tabela → (preço − tabela) × quantidade × `%crédito` entra no saldo.
- Deu desconto **além do livre** → a diferença sai do saldo.
- Saldo abaixo de `−limiteNegativo` → pedido vai para aprovação (`FLEX_NEGATIVO`).
- Cancelamento ou corte → estorno automático. Fechamento mensal configurável (zera ou acumula).
- Desconto dado depois pelo gestor, no faturamento, **não** consome o flex do vendedor.

### Comunicação (CRM e WhatsApp)

- O número oficial da org (`WhatsAppConnection`, ligado a um `CrmFunnel`) é o **centralizador**: o cliente fala com a empresa, o vendedor atende pelo módulo.
- Mensagem que chega de um telefone de cliente da carteira é atribuída ao vendedor principal daquele cliente — o gancho é `features/whatsapp-chat/lib/inbound/persist-inbound-message.ts`, que hoje cria o lead sem `responsibleId`, usando `features/crm/server/casar-cliente.ts`.
- O vendedor só lê e responde conversas de leads dele ou da carteira dele — filtro **no servidor**.
- Follow-ups automáticos viram gatilhos novos do `CrmWorkflow` (aniversário, sem comprar há N dias, pós-pedido), no padrão de espera que já existe em `features/automacoes/server/executar-no.ts`.
- Campanha agendada: `Broadcast.scheduledAt` + Inngest com `step.sleepUntil`, reaproveitando a reivindicação atômica de `features/campanhas/server/disparar.ts`.
- Contato importado do celular **não entra em campanha de marketing sem opt-in** (template de pedido de opt-in, ou o vendedor marca "cliente autorizou" com registro de quem e quando). "SAIR"/"PARAR" marca opt-out.

### Offline (fase própria)

- Leitura: carteira, produtos, preços das tabelas da carteira, estoque por filial, ofertas e resumo dos clientes em IndexedDB (`indexeddb-catalog`), com sync incremental por cursor `(updatedAt, id)`.
- Escrita: pedido, check-in/out e leitura de aviso na outbox (`indexeddb-outbox`) com `clientOperationId`.
- A drenagem do `drainOutbox` para no primeiro erro porque o caixa é uma cadeia causal; a força de vendas não é. Acrescentar uma opção **não causal** — sem mudar o comportamento do desktop — em que erro de regra (4xx tipado) marca o item como recusado e segue a fila; erro de rede/5xx continua sendo nova tentativa.
- O cálculo puro de preço sai de `resolve-price.ts` para `packages/core`, usado pelo servidor e pelo navegador, com suíte de paridade. O servidor continua decidindo: preço que mudou entre o offline e a chegada manda o pedido para aprovação (`PRECO_ALTERADO`), não recusa.

### Astro no módulo

- O mesmo `/api/astro/chat`, com o contexto do vendedor: as ferramentas existentes (`clientes`, `vendas`, `erp`) passam a filtrar pela carteira.
- Ferramentas novas: mix sugerido, venda casada (itens que saem juntos), melhor dia de visita (dias da semana em que o cliente compra), clientes a reativar com valor estimado.
- **Pedido por foto, PDF ou planilha**: extração por visão (padrão de `promotional-catalog/extract-offers-from-file`) + casamento com o catálogo (`match-products-by-name`) → **rascunho** com confiança por linha que o vendedor confere. O Astro nunca envia pedido sozinho.

---

## Modelo de dados

Convenção do porte do CRM: colunas snake_case com `@map`, `@@map` no plural, `organizationId` em toda tabela (inclusive as filhas). Cada migration é escrita à mão, aplicada com `migrate deploy` e acompanhada do bump de `SCHEMA_VERSION` em `src/lib/db.ts`.

| Fase | Modelo / campo | Reuso ou novo |
|---|---|---|
| F1 | `VendedorPerfil` (1:1 `Member`: ativo, código, `externalSellerId`, `descontoMaximoPercent`, `flexHabilitado`, última posição/bateria) | novo |
| F1 | `CarteiraCliente` (`Customer` ↔ `Member`, `principal`, `origem` MANUAL/IMPORTACAO/ERP, `ativo`) — tabela de ligação porque o ERP tem até 3 vendedores por cliente | novo |
| F1 | `Customer` + `tradeName`, `birthDate`, `creditLimit`, `latitude`, `longitude`, `geoSource`, `segment`, `erpCode`, `stateRegistration`, `ibgeCityCode`, `bloqueado`, `bloqueioMotivo`, `condicaoPagamentoId` | estende |
| F1 | `ConfiguracaoForcaVendas` (1:1 org: ambientes ligados, política de desconto, raio de check-in, jornada, retenção, destino do pedido, regras do flex, funil do WhatsApp) | novo |
| F2 | — lê `Product`, `ProductBranchStock`, `PriceList`, `ProductPrice`, `PriceListCategoryDiscount`, `PromotionalCatalog`, `PaymentEntry` | reuso |
| F3 | `SaleOrigin.FORCA_VENDAS`; `Sale.sellerMemberId` | estende |
| F3 | `SaleItem` + `tableUnitPrice`, `requestedQuantity`, `kind` (VENDA/BONIFICACAO/TROCA) | estende |
| F3 | `PedidoForcaVendas` (1:1 `Sale`: tipo, condição, visita, motivos de aprovação, aprovador, flex previsto, capturado em, lat/lng) | novo |
| F3 | `CondicaoPagamento` (parcelas e prazos) | novo |
| F3 | `ContaFlex` + `LancamentoFlex` (idempotente por `(saleId, saleItemId, tipo)`) | novo |
| F3 | `PedidoEnvioDestino` | novo |
| F4 | `RoteiroVisita` (por dia da semana), `VisitaPlanejada` (agenda do dia), `VisitaCliente` (check-in/out, distância, fora do raio, justificativa, resultado, fotos, `clientOperationId`), `JornadaVendedor`, `LocalizacaoVendedor` | novo |
| F5 | `CrmLead` + `birthDate`, `optOutAt`; gatilhos `TRIGGER_ANIVERSARIO`, `TRIGGER_SEM_COMPRA`, `TRIGGER_POS_PEDIDO`; nós `SEND_TEMPLATE`, `NOTIFY_RESPONSIBLE`; `CrmWorkflowRun.dedupeKey` | estende |
| F5 | `Broadcast` + aprovação; `Reminder`/`ReminderOccurrence` ganham processador | estende / reuso |
| F5 | `ImportacaoContatos` (lote, consentimento, auditoria) | novo |
| F6 | `AvisoGestor` + `AvisoGestorLeitura` (entregue, visualizado, confirmado) | novo |
| F6 | `PushToken` (`canal` WEB_PUSH, endpoint, chaves, `userId`, ativo) | novo |
| F8 | 9 modelos `Loyalty*` + enums do Órbita, com `organizationId` em todas as filhas, `LoyaltyMember.customerId` e fonte `VENDA` | porte |
| F9 | `MetaItemVendedor` (produto, marca, fornecedor, categoria), `RegraComissao`; reaproveita `SalesGoalPeriod/Branch/Entry` | novo + reuso |
| F10 | `FiscalProvider.NOTA_GATEWAY`; `FiscalConfig` + chave cifrada, empresa, segredo do webhook; usa `FiscalDocument` (já tem `NFE`, `xmlKey`, `pdfKey`) | estende / reuso |
| F11 | espelhos de leitura do Winthor (títulos e histórico por cliente) | novo, opcional |

---

## Fases

Toda procedure nova ganha teste de integração com **duas organizações e dois vendedores**, provando que uma org não vê a outra e que um vendedor não vê a carteira do colega (padrão de `tests/integration/supplier-list.test.ts`). Tamanho relativo: P, M, G, GG.

### F1 — Módulo, home de ambientes e carteira (G) · MVP

- [ ] Grupo de rotas `(forca-vendas)/forca-de-vendas` com layout mobile, chave `forca-vendas` em `PAGE_PERMISSIONS`, item "App Força de Vendas" no `app-sidebar.tsx` (nos dois blocos onde estão App Promotor e App Vendedor), `/forca-de-vendas` na lista de passagem do `middleware.ts`.
- [ ] Home em grade com os ambientes ligados em `ConfiguracaoForcaVendas`; cabeçalho "Olá, \<nome\>" com vendido hoje e no mês.
- [ ] `VendedorPerfil`, `CarteiraCliente`, campos novos de `Customer`, `ConfiguracaoForcaVendas`.
- [ ] `requireVendedorMiddleware` + `escopo-equipe.ts`.
- [ ] Ambiente **Clientes**: busca na carteira, ficha com ligar, WhatsApp e "como chegar".
- [ ] Gestor: `/vendas/forca-de-vendas/carteiras` (atribuição em lote por cidade, segmento ou planilha) e `/vendedores` (perfil, limite de desconto, liberar acesso).
- [ ] Importador de clientes ganha colunas: vendedor, aniversário, limite, nome fantasia, IE, código ERP (`features/custom/import-fields.ts`).
- [ ] Geocodificação dos clientes por Inngest com `lib/geocode/nominatim.ts` (1 req/s).
- [ ] **Correção**: tirar `VENDEDOR` de `FIELD_LEADERSHIP_TRADE_ROLES` em `src/lib/permissions.ts` — hoje o vendedor vê o trajeto de todo mundo e gerencia o calendário. Script em `apps/web/scripts/` lista quem perde o acesso para o João conceder `mapa-ver-todos`/`trade-calendario` onde fizer sentido.

**Critérios de aceite**
- [ ] O vendedor A não lista nem abre pelo id um cliente da carteira do B; o supervisor vê só os subordinados; admin vê todos.
- [ ] Sem a permissão `forca-vendas`, `/forca-de-vendas` redireciona como o App Promotor faz.
- [ ] Só os ambientes ligados aparecem na home.
- [ ] VENDEDOR deixa de ver o trajeto dos outros (teste de `canSeeAllTrails`).
- [ ] Home e ficha de cliente usáveis em 375px, sem scroll horizontal.

**Depende de:** nada. **João fornece:** a org piloto e a lista de vendedores e carteiras.

### F2 — Produto 360º e cliente 360º (G) · MVP

- [ ] Ambiente **Produtos**: busca por nome, SKU ou bipe; ficha com estoque por filial, preço do cliente selecionado, cubagem (volume e peso da unidade e da caixa, a partir de `widthMm`/`heightMm`/`depthMm`/`grossWeightG` e `pack*`), últimas compras daquele cliente, mais vendidos em 30 dias.
- [ ] Ambiente **Ofertas do dia**: catálogos vigentes (`listForSeller`, badge de não visto) + preço promocional e descontos de categoria vigentes; compartilhar no WhatsApp.
- [ ] **Cliente 360º**: inadimplência (`PaymentEntry` RECEIVABLE OVERDUE), limite disponível, últimas compras, ticket médio, dias sem comprar.
- [ ] Ambiente **Consultas**: títulos em aberto e vencidos da carteira.

**Critérios de aceite**
- [ ] O preço mostrado é igual ao de `precos.resolveMany` para o mesmo cliente e quantidade.
- [ ] O card de inadimplência bate com `/financeiro`.
- [ ] Busca com 20 mil produtos responde em menos de 1 s no 4G.
- [ ] Os números do cliente 360º mostram "atualizado há X".

**Depende de:** F1. Para org Winthor, títulos e histórico reais dependem da F11a.

### F3 — Pedido, orçamento e receptor (GG) · MVP

- [ ] Modelos da F3 (tabela acima) e `forcaVendas.pedidos.{enviar,listar,detalhe,cancelar}` com a sequência descrita em **Pedido e receptor**.
- [ ] Ambiente **Pedidos**: carrinho a partir da ficha do cliente, tipo (venda, orçamento, bonificação, troca), condição de pagamento, desconto por item, saldo flex ao vivo, aviso de limite/inadimplência antes de enviar.
- [ ] Receptor no ERP `/vendas/forca-de-vendas/pedidos` e aprovação no celular para supervisor.
- [ ] Destino `NATIVO` + infraestrutura de destinos.
- [ ] PDF do pedido e compartilhar no WhatsApp.
- [ ] Cron de fechamento mensal do flex.
- [ ] As correções em `list-pending-approval`, `approve-pending`, ranking e a auditoria dos consumidores de `Sale`.

**Critérios de aceite**
- [ ] Enviar o mesmo pedido 3 vezes gera **uma** venda.
- [ ] Desconto dentro do limite com flex positivo entra `CONFIRMED`; acima do limite entra `PENDING_APPROVAL` com motivo `DESCONTO`.
- [ ] Cliente acima do limite de crédito vai para aprovação com `LIMITE_CREDITO`.
- [ ] Ao faturar: estoque baixado e um título por parcela.
- [ ] Cancelar estorna estoque, financeiro e flex com lançamentos novos.
- [ ] Dois pedidos simultâneos não levam o flex abaixo de `−limiteNegativo`.
- [ ] O pedido de campo não aparece na fila do PDV.
- [ ] O ranking credita o vendedor quando o pedido vira `COMPLETED`.

**Depende de:** F1, F2. **João fornece:** política padrão do flex e do desconto; regra de baixa de estoque (ver perguntas).

### F4 — Rota, check-in e localização ao vivo (G) · MVP

- [ ] `RoteiroVisita` (clientes por dia da semana), `VisitaPlanejada` (agenda do dia por cron), `VisitaCliente`, `JornadaVendedor`, `LocalizacaoVendedor`.
- [ ] Otimizador 2-opt movido de `router/promoter-route/_optimize.ts` para `src/lib/roteirizacao.ts` e usado pelos dois.
- [ ] Ambiente **Rota**: agenda do dia ordenada, "como chegar" (Google Maps/Waze), check-in e check-out com geocerca (raio configurável, `lib/geo-distance.ts`); fora do raio exige justificativa e fica marcado; resultado da visita (pedido, sem pedido + motivo, fechado, ausente) e foto.
- [ ] Jornada: iniciar/encerrar; durante a jornada, pontos a cada ~60 s ou 50 m com o módulo aberto (Wake Lock) + ponto em cada ação; bateria pela Battery API quando disponível.
- [ ] `field-map/_trail.ts` passa a emitir `CHECKIN`/`CHECKOUT` e a linha dos pontos.
- [ ] Gestor: `/vendas/forca-de-vendas/mapa` (ao vivo, polling de 30 s, última posição, bateria, última sincronização) e `/visitas` (planejado × visitado × positivado, fora do raio).
- [ ] Cron de expurgo das localizações (retenção configurável, 90 dias por padrão).

**Critérios de aceite**
- [ ] Distância e "fora do raio" corretos (testes com coordenadas fixas).
- [ ] Pontos só existem com jornada aberta; o servidor recusa ponto sem jornada.
- [ ] Supervisor vê só a equipe no mapa.
- [ ] Expurgo apaga só o que passou da retenção.

**Depende de:** F1 (o vínculo "visita gerou pedido" usa a F3). **João fornece:** texto do termo de consentimento revisado (ver riscos).

### F5a — Chat da carteira (M) · MVP

- [ ] `forcaVendas.conversas.*` filtrando no servidor por `responsibleId` ou carteira.
- [ ] Atribuição da mensagem que chega pela carteira (gancho em `persist-inbound-message.ts`) e reatribuição quando a carteira muda.
- [ ] Ambiente **Mensagens**: texto, mídia, áudio, template quando a janela de 24 h fechou, "enviar oferta" (produto com foto e preço do cliente).
- [ ] Tempo real pelo Pusher num canal por vendedor (`lib/realtime/channel-authorizers.ts`).

**Critérios de aceite**
- [ ] O vendedor B não lê nem responde conversa de lead do A.
- [ ] Mensagem de cliente da carteira cai com o responsável certo.
- [ ] Janela de 24 h fechada oferece template; o envio cobra ★ e estorna se falhar.

**Depende de:** F1. **João fornece:** número oficial da org na Meta (WABA verificada) e o funil configurado.

### F6 — Aviso do gestor e push (P/M) · MVP

- [ ] `AvisoGestor`, `AvisoGestorLeitura`, `PushToken`, porte do Web Push (VAPID) e Inngest `push-enviar`.
- [ ] Manifest e service worker com escopo `/forca-de-vendas`; tela que ensina a instalar o atalho.
- [ ] Editor em `/vendas/forca-de-vendas/avisos`: público (todos, equipe, pessoas), prioridade (normal, importante, urgente), vigência, imagem, link, exigir confirmação.
- [ ] No celular: o aviso abre como popover na home; **URGENTE bloqueia a home até "Li e entendi"**; ambiente **Avisos** com histórico.
- [ ] Painel "lido por X de Y" com quem não leu.

**Critérios de aceite**
- [ ] Só o público escolhido recebe.
- [ ] Aviso urgente bloqueia a home até a confirmação.
- [ ] O aviso some depois do fim da vigência.
- [ ] Push chega no Android (Chrome) e no iPhone com o atalho instalado.

**Depende de:** F1. Pode correr em paralelo a F2–F4. **João fornece:** chaves VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).

### F-off — Offline (G) · v1.1

- [ ] Sync incremental para IndexedDB (carteira, produtos, preços, estoque, ofertas, resumo de clientes).
- [ ] Outbox para pedido, check-in/out e leitura de aviso; modo não causal no `drainOutbox`.
- [ ] Cálculo de preço em `packages/core` com suíte de paridade.
- [ ] Indicador "x operações pendentes" e tela de recusados.

**Critérios de aceite**
- [ ] Busca e pedido funcionam em modo avião; ao voltar a rede, o pedido sobe uma vez só.
- [ ] Pedido recusado por regra aparece como recusado e não trava a fila.
- [ ] Os testes do modo causal do desktop continuam verdes.

### F5b — Contatos, aniversários, follow-ups e campanhas (G) · v1.1

- [ ] Importar contatos: seletor do Android ou upload de `.vcf`/CSV → prévia classificada (novo, já é cliente, já é lead, inválido, duplicado) → `CrmLead` com `responsibleId` do vendedor e `birthDate`.
- [ ] Opt-in/opt-out; contato sem opt-in fora de campanha de marketing.
- [ ] Gatilhos de aniversário, sem comprar há N dias e pós-pedido; cron diário com deduplicação.
- [ ] Processador de `Reminder` com push.
- [ ] Ambiente **Campanhas**: campanha da carteira com template aprovado, agendamento (`Broadcast.scheduledAt` + `step.sleepUntil`), aprovação do supervisor opcional.

**Critérios de aceite**
- [ ] Importar a mesma lista duas vezes não duplica.
- [ ] Aniversário dispara uma vez por ano por lead mesmo com o cron repetido.
- [ ] Reagendar não dispara duas vezes; cancelar impede o envio.
- [ ] Quem pediu opt-out fica de fora.

**João fornece:** templates aprovados na Meta (aniversário, follow-up, opt-in, oferta) e o preço em ★ das ações novas.

### F7 — Astro no módulo (G) · v1.1

- [ ] Ambiente **Astro** com o widget e a voz que já existem, no contexto do vendedor.
- [ ] Ferramentas filtradas pela carteira + mix sugerido, venda casada, melhor dia de visita, clientes a reativar.
- [ ] Pedido por foto/PDF/planilha → rascunho conferido pelo vendedor.

**Critérios de aceite**
- [ ] Nenhuma ferramenta devolve cliente fora da carteira (teste).
- [ ] Foto de uma lista manuscrita vira rascunho com confiança por linha.
- [ ] Cobrança em ★ e teto diário respeitados.

### F8 — Star Friends (M/G) · v1.2

- [ ] Porte dos modelos e da lógica do `nasaex-wey/src/features/star-friends` para `src/features/fidelidade/`.
- [ ] Estrela creditada quando a venda vira `COMPLETED` (idempotente por `(source, sourceId, type)`).
- [ ] Admin em `/fidelidade`; no módulo, nível e saldo na ficha do cliente e pedido de resgate.

**Critérios de aceite:** reprocessar a mesma venda não credita em dobro; resgate sem saldo é recusado; expiração por cron.

### F9 — Metas, comissão e painel gerencial (G) · v1.2

- [ ] `MetaItemVendedor`, `RegraComissao` e previsão de comissão.
- [ ] Positivação (clientes com pedido / carteira ativa), cortes e faltas (`requestedQuantity` × `quantity`), inativos com valor de recuperação, mapa de calor por localização do cliente, eficiência (agendado × visitado × positivado).
- [ ] Ambiente **Metas** com ranking e gráfico semanal reais na home.

**Critérios de aceite:** os números batem com consultas de referência sobre uma massa de teste fixa.

### F10 — Fiscal pela Nota Gateway (G) · v1.3

- [ ] Porta `ProvedorFiscal` em `src/lib/fiscal/provedor.ts` (emitir, consultar, cancelar, baixar XML e PDF) com dois adaptadores: o `focus-nfe.ts` atual e o novo `nota-gateway.ts`.
- [ ] Webhook `/api/fiscal/nota-gateway/webhook` com verificação de assinatura; XML e PDF no bucket privado (`lib/fiscal/storage.ts`).
- [ ] "Faturar" no receptor emite a NF-e do pedido; volumes e peso pela cubagem.
- [ ] Compartilhar DANFE e XML pelo módulo.
- [ ] Card "Nota Gateway" em `features/integracoes/catalog/nativos.ts`.

**Pré-requisito:** fechar as lacunas de `fiscal-tributacao.md` (alíquotas, IE e código IBGE do cliente). **A confirmar no sandbox:** URL base, cabeçalho de autenticação e eventos do webhook (a documentação pública mostra pouco além de NFS-e). **João fornece:** conta e chaves da Nota Gateway (homologação e produção), cada empresa cadastrada com o certificado A1.

### F11 — Winthor, opcional (sob demanda)

- **F11a, leitura:** reaproveita `erp-carteira/server/carteira-winthor.ts` (já lê `PCCLIENT`, `PCPREST`, `PCPEDC`, `PCMOV` e o consultor `CODUSUR1`) para alimentar `CarteiraCliente`, títulos e últimas compras; condições de pagamento de `PCPLPAG`. Tudo pela camada só-leitura.
- **F11b, escrita:** adaptador `winthor.ts` gravando nas tabelas de integração de força de vendas do Winthor (a confirmar com a TOTVS e o cliente), por **outra conexão**, com usuário Oracle que só tem `INSERT` nessas tabelas — fora da camada só-leitura. Status lido de volta para `PedidoEnvioDestino`.

**João fornece:** usuário Oracle de escrita, rotina de importação configurada no Winthor, rede até o Oracle.

---

## Corte e dependências

```
F1 ─┬→ F2 → F3 ─┬→ F10 → (F11b)
    ├→ F4 ──────┤
    ├→ F5a → F5b│
    ├→ F6       └→ F7, F8, F9
    └→ F-off (depois de F3 e F4)
F11a entra logo após F2 se a org piloto usar Winthor.
```

| Versão | Fases | O que dá para vender |
|---|---|---|
| **MVP** | F1, F2, F3, F4, F5a, F6 | Carteira, produto 360º, pedido com flex e crédito, rota com check-in, mapa ao vivo, chat da carteira, aviso do gestor |
| v1.1 | F-off, F5b, F7 | Offline, campanhas e follow-ups, Astro |
| v1.2 | F8, F9 | Fidelidade, metas e comissão |
| v1.3 | F10 | NF-e |
| Sob demanda | F11 | Winthor |

### Proposta de pacotes (para discutir)

| | Essencial | Pro | Plus |
|---|:-:|:-:|:-:|
| Home, carteira, produto 360º, ofertas do dia | ✅ | ✅ | ✅ |
| Pedido e orçamento, receptor, aprovação | ✅ | ✅ | ✅ |
| Aviso do gestor | ✅ | ✅ | ✅ |
| Rota simples | ✅ | ✅ | ✅ |
| Check-in com geocerca, mapa ao vivo, planejado × executado | — | ✅ | ✅ |
| Saldo flex, limite de crédito, bloqueio | — | ✅ | ✅ |
| Chat da carteira (WhatsApp oficial) | — | ✅ | ✅ |
| Metas e ranking, offline | — | ✅ | ✅ |
| Campanhas, follow-ups, importar contatos | — | — | ✅ |
| Astro (pedido por foto, mix, melhor dia) | — | — | ✅ |
| Star Friends, comissão, positivação, mapa de calor | — | — | ✅ |
| NF-e pela Nota Gateway | — | — | ✅ |

---

## Lado web

| Rota | Chave em `PAGE_PERMISSIONS` |
|---|---|
| `/forca-de-vendas/*` (módulo de campo) | `forca-vendas` |
| `/vendas/forca-de-vendas/pedidos` | `forca-vendas-pedidos` |
| `/vendas/forca-de-vendas/carteiras` | `forca-vendas-carteiras` |
| `/vendas/forca-de-vendas/vendedores` | `forca-vendas-vendedores` |
| `/vendas/forca-de-vendas/mapa` | `forca-vendas-mapa` |
| `/vendas/forca-de-vendas/rotas` e `/visitas` | `forca-vendas-rotas` |
| `/vendas/forca-de-vendas/avisos` | `forca-vendas-avisos` |
| `/vendas/forca-de-vendas/metas` | `forca-vendas-metas` |
| `/vendas/forca-de-vendas/configuracoes` | `forca-vendas-config` |
| `/fidelidade` (F8) | `fidelidade` |

Permissões de ação: `forca-vendas-aprovar` (aprovar desconto, crédito e bonificação) e `forca-vendas-ver-todos`.

Menu: item "App Força de Vendas" ao lado do App Promotor e do App Vendedor, e um grupo "Força de Vendas" com as telas do gestor.

---

## Riscos

1. **Localização só com o módulo aberto.** É o preço de não ter app instalado. Mitigação: Wake Lock, ponto em toda ação, jornada explícita. Se o piloto exigir rastreio com a tela bloqueada, reavaliar com o dev.
2. **Trabalhista e LGPD.** Rastrear fora da jornada pode virar prova de hora extra; importar contatos exige finalidade e consentimento. Precisa de revisão jurídica do termo e da política de retenção.
3. **Reusar `Sale`.** Relatórios que somam vendas podem passar a contar pedido confirmado e não faturado. A auditoria dos ~32 consumidores é obrigatória na F3.
4. **Política da Meta.** Opt-in, limite de mensagens de marketing, custo por mensagem somado ao ★, aprovação de templates.
5. **Duas identidades de vendedor** (`Member` × `ExternalSeller` do Winthor) — risco de contar duas vezes no ranking. `VendedorPerfil.externalSellerId` é a ponte.
6. **Push no iPhone** só com o atalho instalado — precisa estar na tela de boas-vindas.
7. **Escrita no Winthor** quebra a promessa de "só SELECT" do conector. Isolar em caminho, usuário e spec próprios.
8. **Órbita já recebe a carteira do Winthor** (`erpCarteira.listar`, spec 0106 do Órbita) e tem a venda guiada (spec 0104). A carteira da Força de Vendas precisa ser a mesma que alimenta o Órbita, não uma segunda.

---

## Perguntas em aberto (para o João)

1. ~~Onde estão os dados da piloto?~~ Decidido: o MVP lê do NERP; Winthor entra pelas portas depois.
2. Como o módulo é vendido: pacote próprio, licença por vendedor ou dentro do plano? Hoje os apps de campo exigem o plano OURO (`requireTradeAccess`).
3. ~~Estoque baixa na confirmação ou no faturamento?~~ Decidido: no faturamento.
4. Numeração do pedido: a mesma sequência do PDV (`saleNumber`) ou uma série própria (ex.: "PV-000123")?
5. Política padrão do flex: % de crédito, desconto livre, zera ou acumula no fechamento, bonificação debita flex?
6. Campanha criada pelo vendedor precisa de aprovação do supervisor por padrão?
7. Star Friends: para quem já usa no Órbita, qual sistema é a fonte de verdade?
8. Representante que vende para duas distribuidoras: troca de organização no módulo agora ou depois?
9. O App Vendedor atual (`/vendedor`) será desativado quando a Força de Vendas cobrir o que ele faz?

---

## Próximos passos

1. Testar o MVP na `feat/forca-vendas-mvp` e responder a pergunta 2 (cobrança).
2. Abrir `feat/forca-vendas-fase-1` a partir de `feat/forca-vendas` com a spec `forca-vendas-fase-1.md`.
3. F2 e F6 em seguida (F6 pode correr em paralelo).

---

## Melhorias futuras (não urgentes)

- [ ] Link de pagamento Pix/cartão no pedido — depende de `pagamentos-gateway.md`.
- [ ] Entregas: app do motorista com comprovante (foto, assinatura), link de acompanhamento para o cliente — o que a Máxima (maxMotorista) e a Concretize (Cefas Log) já têm.
- [ ] Portal B2B: o próprio cliente faz o pedido 24 h, creditado ao vendedor da carteira.
- [ ] Mapa de oportunidades: estabelecimentos próximos da rota que ainda não são clientes (diretório `DirectoryStore` + OSM).
- [ ] Pesquisa de preço da concorrência e foto de gôndola no check-in (integração com o TradeGram).
- [ ] Login por passkey (biometria do celular).
- [ ] Importar pedido de planilha Excel.

---

## Fontes

- Máxima Tech: [força de vendas](https://www.maximatech.com.br/forca-de-vendas/), [gestão comercial](https://www.maximatech.com.br/gestao-comercial/), [conta corrente](https://maximatech.com.br/?p=22231), [maxPag](https://www.maximatech.com.br/maxpag/), [trade marketing](https://www.maximatech.com.br/trade-marketing/), [logística](https://www.maximatech.com.br/solucoes-para-logistica/), [IA para o atacado — ABAD, 2026](https://distribuicao.abad.com.br/negocios/maximatech-lanca-novas-solucoes-de-ia-para-o-atacado-distribuidor/)
- Concretize: [home](https://concretize.com.br/), [Flow Vendas](https://concretize.com.br/flow-vendas), [Cefas Nexus](https://concretize.com.br/cefas-nexus.html), [Cefas Hub](https://concretize.com.br/cefas-hub.html), [Cefas Log](https://concretize.com.br/cefas-log.html)
- Nota Gateway: [notagateway.com.br](https://notagateway.com.br/) · documentação em docs.notagateway.com.br
