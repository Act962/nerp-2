# WhatsApp + CRM + Campanhas — port do Órbita (nasaex-wey) para o nerp-2

> Um ícone "WhatsApp" no menu abre o atendimento; o CRM (funil) fica na lateral e Campanhas junto. Chat, funil, agenda, automações e disparo em massa num módulo só, com o contato do WhatsApp amarrado ao **cliente** do ERP.
> Feature: `src/features/{whatsapp-chat,crm,campanhas,agenda,stars,automacoes}` (novos) + `src/app/router/{conversation,message,crm,campanhas,agenda,stars,automacoes,whatsapp}` (novos) + `src/app/(main)/(rest)/whatsapp/*` e `src/app/(public)/publico/agenda` (novos)
> Criado em: 2026-08-30 · Atualizado em: 2026-08-30
> Status: 🟢 Fases 0 a 10 implementadas; aguardando teste do dev antes do commit

---

> **Vai mesclar e subir isso?** Leia a seção
> [Antes do merge e do deploy](#antes-do-merge-e-do-deploy--joão) primeiro: ela
> tem a ordem das migrations, as variáveis novas e o que configurar no Stripe.

## Situacao atual

O nerp-2 **não tem nenhuma camada de mensageria**. Não existe model de conversa, mensagem, lead ou campanha; não existe webhook de WhatsApp; o `Customer` não tem estágio, responsável, origem nem histórico de contato. O único traço de WhatsApp no código é link `wa.me` de compartilhamento (`src/features/promotional-catalog/lib/share.ts`, storefront e catálogo).

O projeto irmão `/Users/weydsonlima/nasaex-wey` (o Órbita, publicado em `orbita.nasaex.com`) tem esse domínio maduro e em produção, na **mesma stack** — Next + oRPC + Prisma 7 + Better Auth + Inngest + R2. São ~96 mil linhas de código de feature, fora routers, libs e webhooks:

| Origem | Linhas | O que é |
|---|---|---|
| `tracking-chat` | 23,1k | o atendimento: conversas, mensagens, mídia, painéis |
| `workflows` + `tracking-executions` + `triggers` + `tracking-chat-ai` | 25,4k | automações (editor de grafo, nós, gatilhos) e o agente de IA |
| `trackings` + `leads` + `tracking-settings` + `tags` + `contacts` + `tracking-presets` | 32,6k | o CRM: board kanban, card do lead, configurações do funil |
| `agenda` | 5,7k | agendamento tipo Calendly, com página pública de booking |
| `campanhas` | 5,7k | disparo em massa pela API oficial |
| `stars` | 3,3k | a moeda interna que cobra por mensagem |

O que **já existe no nerp-2** e vai ser reaproveitado em vez de reinventado:

- `src/lib/crypto/app-secret.ts` (`encryptAppSecret`/`decryptAppSecret`, `APP_ENCRYPTION_KEY`) — AES-256-GCM, criado exatamente para "futuras credenciais externas". É onde o token da Meta vai.
- `src/features/integracoes/server/credentials.ts` — `mascarar()` e **`sanitizarErro()`**, que tira segredo de mensagem de erro antes de virar toast. Erro da Graph API passa por ali.
- `src/lib/upload-to-r2.ts` (`uploadToR2`) — upload com retry e erro tipado, escrito para internet ruim de loja. Serve para a mídia do chat sem nenhuma adaptação.
- `src/lib/fiscal/storage.ts` — o padrão de **bucket privado** (o do fiscal). Mídia recebida no WhatsApp vai aí, não no bucket público de imagens.
- `src/lib/whatsapp.ts` — `normalizeWhatsapp` (E.164), `formatWhatsapp`, `maskWhatsapp`.
- `src/app/api/scanner/stream/route.ts` — o único canal push do projeto (SSE), já com o header `X-Accel-Buffering: no` que resolve o buffering do Nginx/Coolify. Fica como referência caso o Pusher seja trocado depois.
- `src/lib/inngest/functions.ts` — `storeImportProcess` já resolve o problema de lote/retry que o disparo de campanha tem; `erpSyncRun` já mostra `concurrency` por `organizationId`.
- **O fluxo Órbita ↔ NERP já está pronto e funcionando**: `/authorize/nasa-integration` (tela de consentimento), `NasaIntegrationConsent`, `NasaIntegrationKey`, `POST /api/integrations/nasa/exchange`, `NASA_CLIENT_ID`/`NASA_CLIENT_SECRET`/`NASA_S2S_ENCRYPTION_KEY` e a verificação S2S com `requireScope`. Falta só o ponto de entrada no catálogo de `/integracoes`.

Docs de origem que valem mais que ler o código: `nasaex-wey/specs/tracking-chat/0003-tracking-chat-baseline.md` (31 casos de borda catalogados e 10 invariantes do domínio), `docs/whatsapp-oficial-overview.md` (108 KB — contrato da Graph API, riscos e runbook de validação local), `docs/campanhas-overview.md`, `docs/STARS_OVERVIEW.md`, `src/features/trackings/README.md`.

---

## Decisoes tomadas

- **Lead vira `CrmLead`, com `customerId` opcional para o `Customer`** — não é o próprio `Customer`. Um número desconhecido que manda mensagem não pode virar cliente no ERP; o `Customer` tem CPF/CNPJ, vendas, pedidos e financeiro pendurados. A UI fala "cliente" o tempo todo; a conversão é explícita ou automática por telefone.
- **Só a API oficial da Meta (Cloud API)** — o Órbita tem dois provedores (Uazapi não-oficial e Meta) mais um canal próprio (In-Chat). Aqui entra só o oficial, que é o mesmo exigido pelas campanhas com template aprovado. A arquitetura de ports & adapters vem junto, então outro provedor depois é só um adapter.
- **Stars entra só como ledger** — saldo, extrato, regras de custo, orçamento por membro, cobrança por mensagem e recarga avulsa via Stripe. **Não** vem `Plan`/`Subscription` do Órbita: o nerp-2 já tem `TradeSubscription`, e dois sistemas de plano na mesma org é confusão garantida. O crédito mensal fica pendurado no plano que já existe.
- **Prefixo `Crm` nos models genéricos** — `Tracking`→`CrmFunnel`, `Status`→`CrmStage`, `Lead`→`CrmLead`, `Tag`→`CrmTag`. Num schema de 126 models, um model chamado só `Status` não se acha. `Conversation`, `Message`, `Broadcast`, `Agenda` e `Appointment` ficam como estão porque não colidem.
- **Realtime é Pusher** — 39 arquivos em escopo fazem bind direto; trocar por SSE agora seria reescrever a parte do chat onde mais aparece bug sutil (mensagem duplicada, badge de não-lida furado). Os binds ficam atrás de `useRealtimeChannel` para a troca ser possível depois numa PR pequena.
- **Fora do escopo, por decisão do dev**: Workspace e Formulários. Fora por consequência: In-Chat (widget público), Instagram/Facebook DM, Astro Bot, LiveKit (chamada de vídeo no header do chat).
- **`/agenda-crm`, não `/agenda`** — o nerp-2 já tem `/calendario`, que é o calendário de ações de trade com checklist. A Agenda do Órbita é outra coisa: disponibilidade e agendamento tipo Calendly. Não se misturam.
- **Uma branch, uma PR, commits por fase** — cada fase fecha algo testável isoladamente.

---

## Arquitetura

### Transporte — ports & adapters, portado inteiro

```
UI / oRPC ──► WhatsAppChatProvider (PORT)  ──► MetaCloudProvider ──► src/http/whats-oficial/
                                                  (registrado num Map,
                                                   não num enum)
```

- **PORT** (`features/whatsapp-chat/lib/providers/types.ts`): `sendText`, `sendMedia`, `sendLocation`, `sendContact`, `sendTemplate`, `verifyWebhook`, `normalizeInbound` + a união canônica `CanonicalInboundMessage`.
- **`src/http/whats-oficial/`** copiado como está — 25 arquivos, Graph v23.0, incluindo `send-marketing-message.ts` (o endpoint `/marketing_messages`, que é o das campanhas), `verify-signature.ts` (HMAC timing-safe) e **7 fixtures reais de webhook** em `jsons/webhooks/*.json`, que viram os testes do pipeline inbound.
- **`resolveOutboundProvider(funnelId)`** com cache de 30s e `invalidateOutboundProvider` — trocar credencial na tela sem invalidar deixa o envio no provedor antigo por meio minuto.

### O pipeline inbound e seus invariantes

`persistCanonicalInbound` é o **único** ponto de entrada de mensagem recebida, e é agnóstico ao provedor: I/O específico entra por strategy injetada, nunca por `if (providerId === …)`. As regras que não podem quebrar, herdadas da spec-baseline do Órbita:

- **Idempotência é `upsert` por `Message.messageId`** (`@unique` global). A Meta reentrega agressivamente em qualquer 5xx; `create` duplica a bolha na conversa.
- **`status` e `seen` são coisas diferentes**: `status` são os ticks, `seen` é o badge de não-lidas. Inbound nasce `status: SEEN, seen: false`. Mexer num sem o outro quebra o contador em silêncio.
- **Todo efeito pós-inbound entra em `firePostInboundAutomations`**, nunca replicado no webhook — foi assim que o Órbita ficou com um canal sem IA nem round-robin por copy-paste divergente.
- **Resolver o provedor antes de cobrar ★** — cobrar antes é o cliente pagar por mensagem que não saiu, sem estorno.
- **Tipo de mensagem novo toca 5 lugares**: união canônica → `normalizeInbound` do adapter → `persist<Tipo>` → render (`message-box`) → preview na lista. Faltou um, a mensagem chega e some.

O webhook (`/api/whatsapp/webhook`) mantém a ordem de segurança do original: lê o corpo **cru** primeiro (o HMAC depende dos bytes exatos), extrai o `phone_number_id`, recusa payload com mais de um número, resolve a conexão, valida `x-hub-signature-256` fail-closed (`401`), e só então faz Zod e persiste. O `GET` de verificação varre os candidatos com trabalho constante e `timingSafeEqual`.

### Tenancy — o desvio deliberado da origem

No Órbita, `Lead` **não tem `organizationId`** (a org vem por `Tracking`), e mais de 30 procedures de `status/*`, `reasons/*`, `reminder/*`, `leads/*` e `tags/*` rodam só com o middleware de auth, confiando num `trackingId`/`leadId` que veio do cliente. Isso é IDOR entre organizações.

O nerp-2 tem como regra número um o escopo manual por `context.org.id`. Então:

1. Todo model do CRM ganha `organizationId` denormalizado e indexado.
2. **Toda** procedure portada leva `requireAuthMiddleware` + `requireOrgMiddleware` e filtra por `organizationId`. Sem exceção fora das públicas de booking.
3. ID vindo do input é revalidado contra a org antes do uso (`findFirst({ where: { id, organizationId } })` → `errors.NOT_FOUND`).

Na mesma leva, corrigir o que já está furado no nerp-2: `customer.getOne`, `customer.update` e `customer.delete` vazam entre tenants — `update` nem usa `requireOrgMiddleware`. É o mesmo bug do `90cd7d6` (supplier), e o CRM vai construir tela de cliente em cima disso.

### `CrmLead` ↔ `Customer`

- Inbound de número desconhecido cria `CrmLead` **sem** `customerId` — não polui o cadastro do ERP.
- `normalizeWhatsapp()` casa o telefone com `Customer.phone`; batendo **um único** cliente da org, liga automático. Ambíguo ou nenhum, fica solto.
- "Converter em cliente" no painel do chat cria o `Customer` a partir do lead, reusando `features/custom/server/create-customer-for-org.ts`.
- `Customer.phone` hoje guarda texto mascarado, não E.164 → script de normalização único em `apps/web/scripts/`.
- `src/lib/whatsapp.ts` **rejeita telefone fixo** de propósito (exige 11 dígitos com 9 na frente, pro fluxo do promotor). O CRM precisa aceitar fixo → variante `normalizeContactPhone()` ao lado, sem alterar a existente.

### Campanhas

`Broadcast` + `BroadcastRecipient`, com envio por Inngest: `concurrency` com `key: organizationId` e `limit: 3`, lotes de 50 dentro de `step.run` (retry reenvia no máximo um lote, porque a query filtra `status: PENDING`), contadores por **recompute, nunca increment** (imune a retry e a reentrega de webhook), e o status `SENT → DELIVERED → READ` progredindo de forma monotônica, casado por `wamid` no webhook — nunca regride.

No Órbita, campanha **não cobra Stars** (está documentado como fase adiada). Aqui cobra: débito por destinatário **dentro** do `step.run`, depois do envio confirmado — antes, o retry cobraria duas vezes. Vale registrar que a Meta já cobra por conversa; o ★ é uma segunda cobrança, de plataforma.

### Órbita CRM no catálogo de Integrações

Card na nova seção **CRMs** de `/integracoes`, com `painelProprio: "orbita-crm"` (o escape hatch que o catálogo já documenta para provedor com tela própria — aqui não há formulário de credencial, é OAuth). O painel abre `https://orbita.nasaex.com/api/integrations/nerp/start` **em nova aba**, porque o `returnUrl` do lado de lá é relativo ao próprio Órbita e não volta pro NERP sozinho; o card observa o status e vira "Conectado" quando a chave é emitida. Conectado, mostra quem autorizou, quando, escopos e `lastUsedAt`, com **Revogar** (seta `revokedAt`, não deleta — preserva auditoria).

Não encosta no `FinancialConnector`, que é read-only por contrato: o Órbita CRM não vira linha de `FinancialIntegration`; a fonte de verdade continua sendo `NasaIntegrationKey`.

> A integração externa e o CRM portado convivem de propósito: quem já usa o Órbita continua usando e só sincroniza; quem não usa passa a ter o CRM dentro do próprio ERP.

---

## O que é cortado, e onde dói

**Workspace** — corte pequeno. `Action.workspaceId` é obrigatório, então `Action` e toda a família (`WorkspaceColumn`, `SubActions`, `ActionTag`, `ActionMirror`, `EventClaim`…) cai junto. No front são 7 arquivos; nos routers sai `router/column/**` inteiro e 3 procedures de `leads`. No enum de nós de workflow, os `WS_*` saem em bloco — prefixo limpo.

**Formulários** — corte fundo, encosta no card do kanban. `lead-item.tsx` tem `FormStatusIcon`, `DeadlineBadge` e um dialog acionado por `?leadForms=`; `leads/get-many.ts` (a query principal do board) faz include de `formResponses` e deriva estado e prazo no servidor; tem `forms-panel` no footer do chat, aba "Formulários" no detalhe do lead, e `merge-leads`/`detect-merge-conflicts` reatribuindo respostas. `Lead.slaDeadline` e `statusEnteredAt` **ficam** — o timer de SLA usa independente de formulário. `LeadSource.FORM` vira `OTHER`.

Também não vêm: `budget-panel` e `forge-panel` (legado morto, já substituídos por `proposals-and-budgets/`) e `painel.tsx` (stub com "Cliente 1/2/3" hard-coded).

---

## Pendencias

### Fase 0 — Fundação

- [x] **Dependências** — `pusher`, `pusher-js`, `@xyflow/react`, `react-big-calendar`, `@hello-pangea/dnd`, `@dnd-kit/modifiers`, `emoji-picker-react`, `react-resizable-panels`, `ky`, `lodash`, `nanoid`, `usehooks-ts`, `ai` + `@ai-sdk/{openai,anthropic,google}`.
- [x] **Primitivos shadcn que faltam** — `accordion`, `alert`, `alert-dialog`, `context-menu` (o resto dos 60+ que o chat usa já existe).
- [x] **`src/lib/pusher.ts` + `src/lib/realtime/*` + `/api/pusher/auth`** — o publisher/subscriber e o hook `useRealtimeChannel`, com os canais prefixados para não colidir se o app Pusher for o mesmo do Órbita.
- [x] **Envs** (`apps/web/.env` e `.env.test.example`) — `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `META_APP_ID`, `NEXT_PUBLIC_META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN_GLOBAL`, `META_OAUTH_REDIRECT_URI`, `NEXT_PUBLIC_META_LOGIN_CONFIG_ID`, `APP_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_STARS_WEBHOOK_SECRET`.
- [ ] **Assets** — `public/chat-bg/{mobile,desktop}.jpg` (o fundo padrão do chat). Entra junto da tela, na Fase 3.

### Fase 1 — Schema e migration

- [x] **36 models novos** (138 → 174) + valor `CRM` no enum `IntegrationCategory`. Os models de automação/IA ficaram para uma migration própria na Fase 8: o enum de tipos de nó depende de quais executores sobrevivem ao corte de Workspace/Formulários, e escrevê-lo agora seria adivinhar.
- [x] **Migration única, escrita à mão e idempotente** (`IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`), aplicada com `migrate deploy` — o banco compartilhado já travou com P3009 e `migrate dev` quer resetar.
- [x] **Bump do `SCHEMA_VERSION`** em `src/lib/db.ts` — sem isso o client em cache no `globalThis` sobrevive ao hot-reload e 500a nos campos novos.
- [x] **`resetDb()`** — verificado que **não precisa de linha nova**: tudo cascateia de `Organization`, e as FKs restritas para `User` não travam porque a organização é apagada antes. Registrado em comentário no helper.

> **Efeito colateral do schema maior**: `tsc --noEmit` passou a estourar o heap
> do V8 e morrer por SIGKILL (o turbo mostra só `exited (137)`, sem erro de
> tipo). Resolvido com `apps/web/scripts/check-types.mjs`, wrapper com heap de
> 8 GB — o mesmo remédio, pelo mesmo motivo, que `scripts/next-build.mjs` já
> aplicava ao build.

### Fase 2 — Transporte WhatsApp

- [x] **Cliente HTTP da Graph** em `src/lib/whatsapp-cloud/` (25 arquivos + as 7 capturas reais de webhook), seguindo o precedente de `src/lib/fiscal/focus-nfe.ts`. Diretório novo em vez de `src/lib/whatsapp.ts`, que já existe e é o normalizador de telefone.
- [x] **PORT + fábrica por registro + adapter da Meta + resolvedor**, em `src/features/whatsapp-chat/lib/providers/`. Podadas da origem a flag `markPreviousAsRead` e os campos de instância do provedor não-oficial: flag que nenhum adapter honra é mentira na interface.
- [x] **Resolvedor busca por `(funnelId, organizationId)`**, não só pelo funil — a organização vem do contexto autenticado e entra na consulta.
- [ ] **`WhatsAppConnection`** (ex-`WhatsAppInstance`, só os campos Meta) — token, appSecret e verifyToken **cifrados**; `metaPhoneNumberId` fica **texto puro e `@unique`**, porque é a chave de roteamento do webhook (no Órbita ele nasceu cifrado e teve migration só pra desfazer isso).
- [x] **Webhook** `GET`/`POST` em `/api/whatsapp/webhook`, com a ordem de segurança preservada e a varredura de trabalho constante no handshake. Verificado por curl: 403 sem token, 400 em corpo inválido, 200 em evento que não é mensagem, 401 em número desconhecido e em assinatura inválida.
- [x] **16 testes** sobre as capturas reais (`provider.test.ts`): HMAC correto, HMAC de outro segredo, corpo alterado depois de assinado, ausência de assinatura, conexão sem App Secret; normalização de texto, imagem, áudio, figurinha e documento; unicidade do `wamid`; e o nono dígito brasileiro.
- [x] **Tela de conexão** em `/whatsapp/conexao` — seletor de funil (estado na URL), formulário com os campos da Meta, botão de testar contra a Graph e desconectar. Segredo em branco mantém o guardado; segredo volta mascarado e só para admin.
- [x] **Procedures** `whatsapp.connection.{get,save,test,remove}` + `crm.funnel.{create,list}`.
- [x] **11 testes de integração** (`whatsapp-connection.test.ts`): isolamento entre organizações, segredo nunca em claro na resposta, máscara `••••1234`, credencial escondida de não-admin, funil de outra organização recusado com `NOT_FOUND`, campo em branco preservando o segredo, recusa de Phone Number ID já usado e `remove` de outra organização não apagando a linha.
- [ ] **Embedded Signup** (onboarding OAuth da Meta, que dispensa colar credencial à mão). É o que resta da Fase 2 e depende do App da Meta próprio.

> **Realtime sem costura manual de cache**: a tela recarrega a consulta em vez
> de inserir a mensagem no cache à mão. A origem faz a costura e paga por isso
> — a chave da lista tem oito posições montadas à mão e precisa ser
> reconstruída igual no tratador do evento; filtro novo em um lugar e não no
> outro faz o realtime parar de casar em silêncio. Recarregar é um pedido a
> mais e nenhuma chance de dessincronizar.

> **Mínimo de CRM antecipado**: `crm.funnel.create` e `crm.funnel.list` vieram
> para cá, fora da Fase 4, porque a conexão se liga a um funil — sem funil a
> tela não teria o que configurar. A criação já semeia os cinco estágios
> padrão numa transação: funil sem estágio não recebe lead, e a mensagem de um
> número desconhecido chegaria sem coluna onde pousar. O board, o arrastar, as
> tags e os filtros continuam na Fase 4.

### Fase 3 — Chat

- [x] **Pipeline de entrada** (`lib/inbound/persist-inbound-message.ts`) — cria lead e conversa, grava por tipo com `upsert` idempotente, reabre atendimento encerrado, liga ao `Customer` quando o telefone casa com um só, e publica no realtime. Estratégia de mídia injetada, para a pipeline não conhecer provedor.
- [x] **Tiques de entrega** (`lib/inbound/apply-status-updates.ts`) — progressão monotônica: aviso atrasado de "entregue" não desfaz o tique azul, e mensagem já lida não vira "falhou".
- [x] **Webhook ligado à pipeline**, com o lote tratado mensagem a mensagem e 500 em falha nossa (reprocessar é seguro porque a gravação é idempotente).
- [x] **Mídia no bucket privado** (`lib/media-storage.ts`), key com a organização no caminho. Aceita `WHATSAPP_S3_BUCKET_NAME` e cai no bucket do fiscal — que já é privado — para não exigir provisionar outro agora.
- [x] **`conversation.{list,markRead}` e `message.{list,send}`** — paginação por cursor nas duas listas (a caixa de entrada se reordena sozinha; página numerada faria conversa repetir na rolagem). `markRead` mexe só em `seen`, nunca em `status`.
- [x] **Envio** — resolve o provedor **antes** de qualquer efeito, grava só depois da confirmação, marca tempo de primeira resposta e tira o lead da espera. A janela de 24 horas é checada aqui e no adapter.
- [x] **`/api/whatsapp/media/{id}`** — serve o arquivo do bucket privado com duas barreiras: consulta filtrada por organização e conferência do prefixo da chave. `mediaKey` nunca atravessa a fronteira para o cliente.
- [x] **Tela `/whatsapp`** — funil, lista de conversas com busca e não-lidas, conversa com tiques e mídia, campo de envio (Enter envia, Shift+Enter quebra linha), realtime ligado, um painel por vez no celular.
- [x] **Envio de arquivo pelo atendente** — imagem, vídeo, áudio, figurinha e documento, com legenda na mesma bolha. `uploadMedia` entrou na **porta** do provedor, não no chamador: só o adapter conhece a credencial, e a alternativa (`mediaUrl`) exigiria bucket público — o nosso é privado de propósito. Sobe → cobra → envia → guarda; falha de bucket **não** desfaz o envio, porque o cliente já recebeu. O que a Meta recusaria é barrado antes do upload, com mensagem em português. Vai por rota `multipart` e não por procedure: um vídeo de 16 MB viraria 21 MB de base64.

### Fase 4 — CRM

- [x] **Painel do cliente na lateral do chat** — etapa, estado do atendimento e interesse editáveis ali mesmo, marcadores, e o que o `Customer` do ERP sabe: quantas compras, quanto gastou e as três últimas. É o ponto do módulo inteiro: quem responde vê, sem trocar de tela, se está falando com quem comprou ontem ou com quem nunca comprou.
- [x] **`crm.stage.list`, `crm.lead.{get,update}`** — mover de etapa grava histórico e reinicia o cronômetro da etapa.
- [x] **Board kanban com arrastar** em `/whatsapp/funil` — colunas com contagem e soma, card com interesse, valor, marcadores, atalho para a conversa e badge de não-lidas.
- [x] **Ordenação fracionária** — o cliente manda **quem são os vizinhos**, não a posição; quem calcula é o servidor, a partir da ordem real deles. Dois atendentes arrastando ao mesmo tempo não gravam a mesma posição por terem calculado em telas diferentes.
- [x] **Renumeração automática** quando a precisão esgota. Dividir ao meio no mesmo ponto muitas vezes faz a média entre vizinhos virar igual a um deles, e o board passa a depender do desempate do banco. Quando a folga fica abaixo do mínimo representável, a etapa é redistribuída de mil em mil. Tem teste forçando o caso.
- [x] **Etiquetas** — criadas no próprio painel enquanto se atende (busca ou cria), gerais da organização ou de um funil só. Gravam a lista inteira a cada clique, sem botão de salvar: marcar etiqueta é gesto rápido no meio da conversa, e um "salvar" esquecido é a etiqueta que ninguém vê depois. Arquivar some do seletor **sem** apagar a marcação de quem já a teve — é o histórico que responde "por que este contato foi marcado assim". Recriar uma arquivada reativa a mesma, em vez de gerar uma segunda com o mesmo nome.
- [x] **Motivos de ganho e perda** por funil, pedidos no momento do clique — depois ninguém volta para preencher. Motivo de perda num ganho é recusado: entraria no relatório do lado errado e ninguém perceberia. Reabrir volta o contato para ativo sem apagar a passagem anterior, porque um contato pode ser perdido de novo por outro motivo, e as duas passagens interessam.
- [x] **`tests/integration/crm-etiquetas.test.ts`** — 14 casos: escopo por funil, arquivamento preservando vínculo, id de outra organização recusado, histórico com uma linha por mudança (e nenhuma quando nada mudou), motivo do lado errado e de outro funil recusados.
- [ ] Grupos de etiqueta, presets de funil e configurações do funil.

### Fase 5 — Campanhas

- [x] **`campanhas.{create,list,get,addRecipientsFromLeads,listTemplates,setTemplate,send}`** e a tela em `/whatsapp/campanhas`, em três passos: quem recebe, o que é enviado, disparar.
- [x] **Audiência a partir do funil**, com os mesmos recortes do board. Quem não tem telefone fica de fora (seria falha garantida poluindo o relatório) e a unique `(broadcastId, phone)` impede o mesmo número duas vezes.
- [x] **Templates buscados ao vivo na Meta**, só os aprovados — não guardamos cópia: template reprovado lá continuaria disponível aqui. No modo demo devolve dois de exemplo.
- [x] **Disparo por Inngest**, um `step.run` por lote de 50, concorrência com chave na organização. Retentativa refaz **um lote**, e como a consulta filtra `PENDING`, refazer não reenvia.
- [x] **Reivindicação atômica** — a passagem para `SENDING` é um `updateMany` condicionado ao status: dois cliques, ou o clique junto com o agendamento, e só um encontra a campanha parada.
- [x] **Contadores recalculados, nunca incrementados** — incremento erra quando o job repete um lote ou a Meta reentrega um aviso, e a campanha apareceria com mais entregas que destinatários.
- [x] **Status de entrega** casando `wamid` no webhook, com progressão monotônica: aviso atrasado não desfaz a leitura.
- [ ] Audiência por planilha (CSV/XLSX) e agendamento.

### Fase 6 — Stars

- [x] **Saldo em `Organization`** (migration `20260830140000_stars_saldo`) — faltava na Fase 1: eu tinha criado o ledger sem a coluna do saldo. Uma conta só, sem separar bônus: o extrato registra de onde cada crédito veio.
- [x] **Débito atômico** — `updateMany` condicionado a `starsBalance >= valor`. Duas mensagens simultâneas com saldo para uma só não deixam a conta negativa; a segunda encontra zero linhas e falha. Tem teste com `Promise.allSettled`.
- [x] **A cobrança começa desligada.** Sem `StarRule` cadastrada — ou com ela valendo zero — nada é debitado e nada é bloqueado. É o que permite ligar por organização, quando o negócio decidir, sem quebrar quem já usa.
- [x] **Cobrança no envio de mensagem**, entre resolver o provedor e enviar, com **estorno** se o envio falhar. O estorno é lançamento novo, nunca remoção do débito.
- [x] **Cobrança por destinatário de campanha**, depois do envio confirmado — antes, a repetição de um lote cobraria duas vezes. Saldo acabando no meio interrompe o disparo: o que saiu está pago, o resto fica pendente.
- [x] **`/whatsapp/creditos`** — saldo, quantas mensagens ainda cabem, e o extrato com o saldo resultante de cada linha.
- [x] **Recarga via Stripe** — a tela escolhe o **pacote**, nunca o valor: preço vindo do navegador é preço que o navegador escolhe. A linha de `StarsPayment` nasce `pending` antes da sessão existir e o id dela vai nos metadados, porque é por ele que o webhook acha o que creditar sem confiar em nada que passou pelo navegador.
- [x] **Webhook próprio em `/api/stars/webhook`**, com segredo próprio (`STRIPE_STARS_WEBHOOK_SECRET`) e separado do `/api/stripe/webhooks` do checkout da loja: dois produtos de cobrança no mesmo handler é como um evento acaba processado pelo ramo errado — e aqui o ramo errado credita dinheiro. Assinatura conferida no corpo cru, dedupe por `ProcessedStripeEvent` gravado **antes** de creditar, e a quantidade lida do banco, não do payload.
- [x] **Crédito mensal do plano** — `starsPerMonth` entrou em `PlanQuotas`, junto das outras cotas (Bronze 500, Prata 1.500, Ouro 4.000). **Sem cron**: o crédito é conferido quando alguém precisa dele — ao ler o saldo e no caminho de saldo insuficiente do débito. Cron mensal roda de madrugada para todo mundo e, quando falha, ninguém percebe até a loja reclamar. A corrida na virada do mês é resolvida com `updateMany` condicionado ao ciclo antigo, no mesmo padrão do débito. `INADIMPLENTE` mantém acesso aos módulos mas **não** credita: acesso é uma coisa, crédito pré-pago é outra.
- [x] **`tests/integration/stars-recarga.test.ts`** — 13 casos: preço da tabela e não do cliente, nada creditado só por abrir o pagamento, falha do Stripe deixando rastro, crédito uma vez por mês, dois créditos simultâneos na virada, cancelada e inadimplente não creditando.
- [x] **Tela de preço das ações** em `/whatsapp/creditos` — é o que **liga a cobrança**, e por isso só administrador mexe: é a diferença entre a loja enviar à vontade e a loja parar por falta de saldo. Lista **todas** as ações do catálogo mesmo sem regra gravada, senão não haveria como cadastrar o primeiro preço. Zero desliga de novo, e é o mesmo valor de quem nunca cadastrou — um caminho só para "não cobra esta ação", em vez de "não tem linha" e "linha valendo zero" significando a mesma coisa por caminhos diferentes. As chaves de ação saíram para `lib/acoes-chaves.ts`, sem `server-only`, para a tela e o motor lerem a mesma lista. 9 testes de integração, incluindo o que prova que definir o preço faz o motor passar a debitar.

### Fase 7 — Agenda ✅

Mora em **`/whatsapp/agenda`**, não em `/agenda-crm` como o plano dizia: quando o resto das fases foi para baixo de `/whatsapp`, uma rota de topo separada passou a ser a única peça do módulo fora dele — e ainda exigiria mexer no `middleware.ts`. O motivo de não ser `/agenda` continua valendo: `/calendario` já existe e é outra coisa.

- [x] **Agendas** com grade semanal, disponibilidade por data, dias fechados e compromissos. Agenda nova nasce com segunda a sexta, 8h–12h e 14h–18h — link público criado numa agenda vazia mostra calendário sem nenhum horário, que é a pior primeira impressão possível.
- [x] **`lib/horarios.ts`** — conversão parede ↔ UTC pelo `Intl`, sem dependência nova, e `gerarEncaixes` puro (11 testes de unidade). **Desvio da origem**: o encaixe precisa caber inteiro na faixa. O Órbita oferece um encaixe começando no fim da faixa, então quem anuncia 8h–12h recebe marcação das 12h às 13h; aqui a faixa vale o que está escrito.
- [x] **Fuso da loja fixo** (`America/Fortaleza`, como vendas, alertas e crons). O Órbita aceita o fuso vindo do **cliente** — quem abre o link de outro estado veria horários deslocados e marcaria na hora errada. Quando existir organização fora deste fuso, vira coluna em `Organization`.
- [x] **`agendarCompromisso`** em transação **serializável**, um caminho só para a página pública e para o atendente. Ler "livre" e inserir é a receita de dois clientes no mesmo encaixe; serializável derruba o segundo, e o erro vira "esse horário acabou de ser preenchido". A tela interna passar pelas mesmas regras é o que impede compromisso em dia fechado pela porta dos fundos.
- [x] **Lead ao marcar** — reaproveita o lead do telefone no funil (`@@unique([phone, funnelId])`) em vez de duplicar, move para a etapa configurada na agenda, e liga ao `Customer` pelo telefone. O casamento saiu do pipeline de inbound para `features/crm/server/casar-cliente.ts`: duas heurísticas de telefone divergindo é como o mesmo cliente vira duas fichas.
- [x] **Página pública** em `/publico/agenda/[orgSlug]/[agendaSlug]` — calendário, horários livres, formulário e comprovante com "Desmarcar". `robots: noindex`: é link mandado para um cliente, não conteúdo de buscador. Só horário **livre e futuro** sai na resposta; mostrar o ocupado riscado contaria a qualquer um quantos clientes a loja atendeu no dia.
- [x] **Freio no formulário aberto**: no máximo três horários futuros por telefone na mesma agenda — sem isso um script enche a agenda em segundos, e o duplo clique de quem tem pressa marca duas vezes.
- [x] **`tests/integration/agenda.test.ts`** — 15 casos: grade, data bloqueada, disponibilidade por data vencendo a semanal, marcação simultânea no mesmo encaixe, cancelamento devolvendo o horário e isolamento entre organizações.
- [x] **Demo**: `pnpm demo:whatsapp` passa a semear a agenda "Consultoria (demo)" com um horário já marcado, e imprime o link do cliente.
- [ ] **Sync com Google Calendar** — fica para depois, e a coluna `Appointment.gcalEventId` já espera por ele. O OAuth que existe é o do **Drive** (`GoogleDriveConnection`, escopo de arquivo): ligar calendário exige pedir escopo novo, o que faz **todo mundo que já conectou o Drive reconsentir**. É mudança na integração que está funcionando, e merece a própria branch.

### Fase 8 — Automações

Em `/whatsapp/automacoes`. Migration própria: `20260830180000_crm_automacoes` — cinco tabelas e dois enums novos, nada tocado em tabela existente.

- [x] **`CrmWorkflow` / `CrmWorkflowNode` / `CrmWorkflowConnection`** com `funnelId` e **`organizationId` em todos**, inclusive nos filhos. No Órbita o nó chega à organização por dois joins e as procedures confiavam no id vindo do cliente.
- [x] **Gatilhos**: mensagem recebida, contato novo, mudança de etapa, silêncio de X minutos e manual. O prefixo `TRIGGER_` é estrutural — é como o motor separa início de ação sem manter uma lista à parte que envelhece.
- [x] **Passos**: enviar mensagem, esperar, mover de etapa, temperatura, responsável, ganho/perda, webhook e "só continuar se…".
- [x] **Motor no Inngest** — um `step.run` por nó (uma queda no meio não reenvia a mensagem que o cliente já recebeu) e `step.sleep` na espera, que é o motivo de a automação não ser um laço com `setTimeout`: espera de duas horas precisa sobreviver a deploy. `concurrency` por organização, teto de 50 nós por execução.
- [x] **`CrmWorkflowRun` / `CrmWorkflowNodeRun`** — a tela de execuções mostra passo a passo o que rodou e o que falhou. É onde se descobre por que a automação não fez o que parecia.
- [x] **Validação antes de ligar** (`lib/grafo.ts`, testada isolada): sem gatilho, dois gatilhos, gatilho sem saída, passo solto, ciclo, ligação órfã. Automação ligada que nunca dispara é pior que desligada — o operador acha que resolveu. Desligar nunca valida: precisa funcionar com o desenho quebrado, que é quando se quer desligar às pressas.
- [x] **Teto de execuções por hora** por workflow (60 por padrão). A automação que manda mensagem pode ser disparada pela resposta que ela mesma provocou; o ciclo é recusado no grafo, mas dois workflows apontando um para o outro passam por lá.
- [x] **`enviarTexto` extraído** de `message/send.ts` — resolver provedor → cobrar ★ → enviar → gravar, com estorno se falhar. A automação manda pelo mesmo caminho. No Órbita cada remetente reimplementou a sequência e dois esqueceram de cobrar.
- [x] **SSRF barrado no nó de webhook** (`server/http-seguro.ts`): só http/https, host resolvido e conferido contra loopback, faixas privadas, link-local e metadados de nuvem, sem seguir redirecionamento, com tempo e tamanho limitados. O Órbita não filtra nada disso, e quem escolhe a URL é o operador enquanto quem chama é o servidor. A janela de DNS rebinding fica registrada como exposição consciente.
- [x] **Cron de silêncio** (`*/15 6-22 * * 1-6`, fuso da loja) — dispara na **travessia** do limite, não no estado "está parado": pelo estado, os leads antigos e calados ocupariam o teto de toda varredura e os que acabaram de ficar parados nunca seriam atendidos. A repetição é controlada pelo próprio histórico, sem tabela de marcação.
- [x] **Testes** — 15 de unidade no grafo e nas condições, 23 de integração (isolamento entre organizações, etapa de outro funil recusada, responsável de fora da equipe recusado, endereços internos bloqueados, disparo só quando ligada e só no gatilho certo).

**Editor em fila, não em canvas.** O modelo no banco é um grafo com portas nomeadas, mas a tela monta uma fila: gatilho → passo → passo, com "só continuar se…" no lugar da bifurcação. Cobre o que uma loja automatiza, não precisou de dependência nova (`@xyflow/react` não foi instalado) e, quando virar canvas, os dados já estão no formato certo.

**Fora desta fase, e por quê:**

- [ ] **Modo agente** do Órbita — branches livres, loops, sub-workflows, `MERGE`, `WAIT_FOR_EVENT`. É um segundo motor de execução, não um punhado de nós a mais.
- [ ] **Nós de LLM** (`AI_DECISION`, `AI_GENERATE_TEXT`, `AI_VISION`, `READ_PDF`, `WEB_SEARCH`) e o **agente de IA do chat** com ferramentas. Dependem de chave de modelo e de uma decisão de produto que ninguém tomou ainda: um agente que responde sozinho ao cliente erra em público, e isso merece a própria branch com o dev acompanhando.
- [ ] **`SEND_VOICE`, `SEND_EMAIL`, `CHECK_PAYMENT`** — dependem de serviços que o nerp não tem (TTS, Resend, Asaas).
- [ ] `WS_*`, `SEND_FORM`, `OPEN_FORM`, `SEND_PROPOSAL`, `SEND_CONTRACT`, `SEND_LINNKER`, `SEND_NBOX`, `SEND_NASA_ROUTE` — apps que não vêm no port, como decidido no começo.

### Fase 9 — Órbita CRM em `/integracoes` ✅

- [x] **Seção CRMs + manifesto `catalog/crms.ts` + logo** — `orbita-crm` com `painelProprio`, `auth.campos` vazio (é OAuth, não há credencial para digitar) e `capacidades: []`, porque as capacidades do catálogo descrevem conciliação financeira e nenhuma se aplica a um CRM.
- [x] **Painel próprio** (`components/orbita-crm-panel.tsx`) — desconectado explica o que a conexão libera e abre `…/api/integrations/nerp/start` em **nova aba**; enquanto espera, `useOrbitaStatus(aguardando)` refaz a consulta a cada 3s e o card vira "Conectado" sozinho, sem o operador ter que recarregar.
- [x] **`integracoes.orbita.status`** — devolve só metadado: quem autorizou, quando, escopos, `lastUsedAt`. A chave e o segredo **não voltam nem mascarados**: diferente de uma credencial digitada pelo operador, esta ele nunca viu e não tem o que conferir.
- [x] **`integracoes.orbita.revoke`** — `updateMany` filtrado pela org marcando `revokedAt`, com o mesmo gate de administrador de `_access.ts`. Não deleta a linha: apagar levaria junto o registro de quem autorizou, que é justamente o que se consulta depois de revogar.
- [x] **`tests/integration/orbita-integracao.test.ts`** — 7 casos: segredo fora da resposta (`JSON.stringify` sem a chave), org A não enxerga nem revoga a chave da org B, membro comum vê o estado mas não gerencia, e a linha sobrevive à revogação.

### Ambiente de demonstração (fora das fases)

- [x] **Modo demo** (`WHATSAPP_MODO_DEMO=true`) — dubla **só o envio**; exige que o ambiente não seja produção, para uma variável esquecida não fazer a loja achar que respondeu sem ter respondido.
- [x] **`pnpm demo:whatsapp <org>`** — funil, conexão de mentira, seis conversas em situações diferentes, ligadas a clientes reais quando existem. Idempotente, com `--remover`.
- [x] **`pnpm demo:whatsapp:msg <org> "texto" [telefone]`** — simula mensagem recebida assinando o payload e postando no webhook **de verdade**: assinatura, roteamento, pipeline e gravação idempotente, sem nada dublado.
- [x] **`scripts/tsx-servidor.mjs`** — roda script `tsx` que importa módulo `server-only`, ligando a condição `react-server` em vez de duplicar a cifra num script solto.

### Fase 10 — Amarração no ERP ✅

- [x] **Sidebar** — grupo "WhatsApp" com Atendimento, Funil, Campanhas, Agenda, Automações, Créditos e Conexão. O item pai não tem permissão própria: some sozinho quando nenhum filho sobrevive ao filtro.
- [x] **`PAGE_PERMISSIONS` + `PERMISSION_GROUPS` + `requirePermission`** em toda página. A chave `whatsapp` é nova, então **ninguém a tem**: para quem já usa o ERP, nada muda — owner e admin passam pelo bypass de sempre, o resto não vê o menu nem alcança a rota.
- [x] **Pass-through no `middleware.ts`** para `/whatsapp` e `/publico/agenda`. Tudo mora sob `/whatsapp/*`, então não foi preciso abrir uma rota de topo por tela.
- [x] **`/whatsapp` em `HIDE_BREADCRUMB_ON`** — na lista exata, não na de prefixos: a caixa de entrada ocupa a altura toda e o breadcrumb empurra a conversa para fora da dobra, mas `/whatsapp/agenda` e `/whatsapp/automacoes` são páginas comuns e se beneficiam dele.
- [x] Linha em `specs/README.md`.

### Critico (atravessa todas as fases)

- [x] **Escopo por organização em toda procedure portada** — nenhuma procedure das fases 2–9 usa id vindo do cliente sem confrontar com `context.org.id` primeiro. Os testes de integração cobrem o caso "a organização vizinha tenta" em cada área: chat, funil, campanhas, agenda, automações, etiquetas, Órbita.
- [x] **IDOR pré-existente em `customer.get`/`update`/`delete`** — corrigido. Os três buscavam por `findUnique({ id })` sem confrontar a organização, e o `update` **nem tinha o middleware de organização**: qualquer usuário autenticado lia o cadastro e o histórico de compras, editava ou apagava o cliente de qualquer outra loja sabendo um id — que sai em URL, em exportação e em log. O `update` também aceitava vincular tabela de preço de outra organização. `tests/integration/customer-tenancy.test.ts` é a regressão, e foi conferido que ele falha contra o código antigo.
- [x] **Segredo nunca volta pro client** — token da Meta mascarado no read-back, `apiKey` do Órbita não sai **nem mascarada**, e todo erro de provedor passa por `sanitizarErro()` antes de virar toast ou `lastError`. Coberto por teste em `whatsapp-connection` e `orbita-integracao`.

### Qualidade de codigo

- [ ] **Query keys escritas à mão** — o Órbita monta `["conversations.list", …]` com 9 posições e reconstrói o mesmo array no handler de realtime; filtro novo tem que ser adicionado nos dois lugares ou o realtime para de casar. Migrar para `orpc.*.key()` onde der.
- [ ] **19 componentes chamam `orpc` direto** na origem — no nerp-2 tudo passa por hook de feature. Não replicar a dívida.
- [ ] `Decimal` → `Number` e `Date` → ISO no limite do handler, como manda o `CLAUDE.md`.

---

## Antes do merge e do deploy — João

> Esta seção existe porque `.env` é gitignored: nada do que está escrito lá chega
> a quem faz o deploy. O que segue é o que precisa acontecer **fora do código**
> para esta branch funcionar em produção, na ordem.

### 1. As três migrations precisam rodar ANTES do código novo servir

```
20260830120000_crm_whatsapp_campanhas   36 tabelas novas
20260830140000_stars_saldo              2 colunas em `organization`
20260830180000_crm_automacoes           5 tabelas novas
```

As três são **puramente aditivas** — auditadas, zero `DROP`/`TRUNCATE`/`DELETE`,
e a única alteração em tabela existente são duas colunas com default em
`organization`. São idempotentes (`IF NOT EXISTS` em tudo), então repetir é
inofensivo.

**A ordem não é detalhe.** O Better Auth lê a tabela `organization` a cada
requisição autenticada. Se o código novo subir antes da migration, o Prisma
Client pede `stars_balance` numa tabela que ainda não tem a coluna e **todo
usuário logado cai de uma vez** — é o erro `The column (not available) does not
exist`, que aconteceu no ambiente de desenvolvimento por exatamente isso.

- **Coolify** já faz certo: `nixpacks.toml` roda `pnpm db:deploy` antes do build.
- **Vercel** não: o `vercel.json` habilita deploy na `main` e não define
  `buildCommand`, então roda `turbo build` — que **por desenho não roda
  migration**. Antes de mesclar, confirme para onde a Vercel aponta. Se for o
  banco de produção, o deploy da `main` derruba a aplicação inteira.

O caminho inverso é seguro: durante o build, o código **antigo** rodando contra o
schema **novo** não conhece as colunas novas e simplesmente não as seleciona.

### 2. Stripe — recarga de créditos

O código está pronto e testado com o Stripe dublado. Falta a configuração da
conta, que é sua:

1. Stripe → Developers → Webhooks → **Add endpoint**
2. URL: `https://<domínio>/api/stars/webhook`
3. Evento: **apenas** `checkout.session.completed`
4. Copie o *signing secret* (`whsec_…`) para a variável
   **`STRIPE_STARS_WEBHOOK_SECRET`** no ambiente do Coolify.

**Endpoint separado de propósito.** Já existe um webhook em
`/api/stripe/webhooks`, que é do checkout da loja e usa `STRIPE_WEBHOOK_SECRET`.
Não aponte os dois para o mesmo lugar nem reaproveite o segredo: dois produtos de
cobrança no mesmo handler é como um evento acaba processado pelo ramo errado — e
aqui o ramo errado credita dinheiro.

Sem a variável, `/api/stars/webhook` responde **500 "não configurado"**. Isso é
proposital: o Stripe reentrega até o endpoint existir, então nenhuma recarga paga
se perde enquanto a configuração não estiver de pé. O resto do sistema continua
funcionando normalmente — só a recarga fica parada.

`STRIPE_SECRET_KEY` já existe no ambiente e é reaproveitada.

### 3. Variáveis de ambiente novas

Nenhuma delas é lida no carregamento do módulo, então **faltar não derruba o
boot** — cada uma degrada só a própria função.

| Variável | Sem ela | Necessária para |
|---|---|---|
| `APP_ENCRYPTION_KEY` | erro claro ao salvar/ler credencial da Meta | **obrigatória** — cifra o token do WhatsApp |
| `META_APP_SECRET` | nada, **se** cada conexão tiver o próprio App Secret salvo na tela de Conexão. É só o valor de reserva para conexões sem um | conexões sem segredo próprio |
| `META_VERIFY_TOKEN_GLOBAL` | nada, **se** cada conexão tiver o próprio token de verificação | conexões sem token próprio |
| `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | chat funciona, mas sem tempo real: só aparece ao recarregar | mensagem chegando sozinha na tela |
| `STRIPE_STARS_WEBHOOK_SECRET` | recarga responde 500 | recarga de créditos |
| `WHATSAPP_S3_BUCKET_NAME` | cai no `FISCAL_S3_BUCKET_NAME` | separar mídia de conversa do bucket fiscal |
| `WHATSAPP_MODO_DEMO` | — | **não definir em produção.** O código já ignora a variável quando `NODE_ENV=production`, mas não a coloque lá |

### 4. O build precisa de mais memória

`scripts/next-build.mjs` foi de **4096 para 8192 MB**. Não é enfeite: com o
schema em 179 modelos e o client do Prisma em 23 MB, o build falhava com
`Ineffective mark-compacts near heap limit` — medido duas vezes.

**É teto do V8, não RAM da máquina.** Se o servidor de build do Coolify tiver
menos que ~8 GB disponíveis, o processo é morto pelo kernel antes de o teto
valer. Vale conferir antes do primeiro deploy — build que falha não substitui o
container (a versão antiga continua servindo), então não há queda, mas o deploy
não sai.

### 5. Um cron novo no Inngest

`crm-automacao-varrer-ociosos` — `*/15 6-22 * * 1-6`, fuso da loja, para o
gatilho "cliente sem resposta há X". Mesma janela dos crons que já existem, pelo
mesmo motivo (custo do Inngest fora do horário comercial). Se ninguém criar
automação com esse gatilho, ele roda, não acha nada e sai.

### 6. O que muda para quem já usa o ERP hoje

**Nada.** A chave de permissão `whatsapp` é nova e ninguém a tem: owner e admin
passam pelo bypass de sempre e veem o menu novo; qualquer outro cargo não vê e
não alcança as rotas.

A cobrança de ★ **nasce desligada** — sem `StarRule` cadastrada, `custoDaAcao`
devolve 0 e nada é debitado nem bloqueado. Dá para subir tudo sem decidir preço
ainda.

### 7. A parte do diff que merece leitura atenta

Quase tudo aqui é código novo. **A exceção é `src/app/router/customer/`**, que já
está em produção hoje e tinha três vazamentos entre organizações:

- `customer.get` devolvia o cadastro **e todas as vendas** de cliente de outra loja
- `customer.update` **não tinha o middleware de organização** — editava qualquer cliente
- `customer.delete` tinha o middleware mas não usava o `organizationId`

Bastava saber um id, que sai em URL, em exportação e em log. A correção só aperta
o filtro: nenhum usuário legítimo perde acesso ao que já via. A regressão está em
`tests/integration/customer-tenancy.test.ts`, e foi conferido que ela falha
contra o código antigo.

### 8. Sanidade depois do deploy

1. `/whatsapp` abre para um owner e a lista de conversas carrega.
2. `/integracoes` mostra a seção **CRMs** com o card do Órbita.
3. `/whatsapp/creditos` abre e o saldo aparece (zero é o esperado).
4. Uma recarga de teste no Stripe cai como `TOPUP_PURCHASE` no extrato — é o que
   prova a assinatura do webhook e o crédito de ponta a ponta.
5. Uma loja qualquer que **não** usa WhatsApp continua entrando e vendendo
   normalmente.

---

## Proximos passos

1. Fase 0 (fundação) e Fase 1 (schema + migration) — é o que destrava todo o resto.
2. Fase 9 (card do Órbita) pode ser antecipada: é curta, independente e entrega algo visível antes do port pesado.
3. Fases 2 → 3 (transporte e chat), que é o núcleo sem o qual nada funciona.

---

## Melhorias futuras (nao urgentes)

- [ ] Trazer o projeto **COMMENTS** (automação de comentários de Instagram/Facebook) para dentro do módulo WhatsApp — no Órbita ele é um app externo consumido por OAuth (`src/http/comments/`), então entra como integração, não como port.
- [ ] Trocar Pusher por SSE reusando o padrão de `api/scanner/stream`, se o custo do Pusher incomodar.
- [ ] Adapter de provedor não-oficial (QR Code) para quem não quer aprovação da Meta — o factory já aceita sem mexer no core.
- [ ] Ler saldo/fundos da Meta pela API de billing e alertar antes de acabar (é a fase que o Órbita nunca fez).
- [ ] Analytics de WhatsApp (`conversation_analytics` da Graph) como aba do módulo.
