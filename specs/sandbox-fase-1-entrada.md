# Sandbox — Fase 1: entrada sem barreira

> "Começar agora" cria conta anônima + empresa de teste em um clique, com dados de exemplo do ramo e um guia por solução; tudo o que sai para o mundo exige conta Google; a sandbox some após 30 dias sem acesso. Fase 1 de 6 do épico "nerp sem barreira de entrada + Astro operacional".
> Feature: `src/lib/{sandbox-plugin,conta-verificada}.ts` + `src/app/middlewares/verified-org.ts` + `src/features/onboarding/{lib,server,components}` + `src/app/(home)/comecar` + `src/app/(main)/(rest)/vincular-conta` + `src/lib/inngest/functions.ts` (`sandbox-expire`)
> Branch: `feat/sandbox-fase-1-entrada` (empilhada por patch sobre `feat/astro-stars-planos` + `feat/sandbox-fase-0-brechas`, ambas sem commit — ao commitá-las, `git rebase` resolve: conteúdo idêntico)
> Criado em: 2026-09-11 · Atualizado em: 2026-09-11
> Status: 🟡 Em andamento

---

## Situacao atual

Antes, entrar no nerp exigia conta (o cadastro estava até escondido) e a organização era criada por formulário. Agora a home tem "Começar agora": um wizard de dois passos, ambos puláveis, sem nenhuma chamada de IA, que termina criando uma conta anônima do Better Auth e a organização de teste no mesmo request.

Arquivos principais:
- `src/lib/sandbox-plugin.ts` — plugin Better Auth: freio por IP antes do `POST /sign-in/anonymous` (3 contas/24 h, contando `Session.ipAddress`) e criação da sandbox no `after`, lendo as respostas do wizard do cookie `nerp_comecar`.
- `src/features/onboarding/server/inicializar-organizacao.ts` — tudo o que uma org recebe ao nascer (extraído do `afterCreateOrganization`, usado pelos dois caminhos): kanban, catálogos de trade, tabelas de preço, `CatalogSettings`, 50 ★, dados de exemplo por nicho e por solução, `segment`/`disabledModules`/`niche`/`interests`, `verifiedAt` (nulo em sandbox), sem subdomínio nem replicação no NASA em sandbox.
- `src/features/onboarding/server/vincular-conta.ts` — `onLinkAccount` do plugin `anonymous`: move os `Member` para a conta Google, marca `verifiedAt`, dá o subdomínio, aponta a sessão, deixa a conta provisória inerte (`linkedToUserId`) e só então replica no NASA.
- `src/lib/conta-verificada.ts` + `src/app/middlewares/verified-org.ts` — a regra única `verifiedAt != null`; erro `FORBIDDEN` com `data.code = "CONTA_NAO_VERIFICADA"` que o cliente transforma no diálogo de vínculo.
- `src/features/onboarding/lib/{nichos,solucoes,trilha,respostas}.ts` — os 6 ramos do site, as 15 soluções mapeadas a módulos do menu, os passos fixos do guia e o cookie do wizard.
- `src/features/onboarding/server/{seed-solucoes,expirar-sandbox}.ts`, `src/features/organization/server/apagar-organizacao.ts`.

---

## O que foi feito

- [x] Plugin `anonymous` (`emailDomainName: anon.nerp.local`, `generateName: "Visitante"`, `disableDeleteAnonymousUser: true`, `onLinkAccount`) + `anonymousClient()`; `organizationLimit` = 1 para conta anônima, 5 para conta real; conta anônima não vai para o outbox do NASA.
- [x] Migration `20260911130000_fase1_sandbox_anonimo`: `user.isAnonymous/linked_to_user_id`, `organization.verified_at/last_access_at/expiry_warned_at/niche/interests`, `isDemo` em `crm_funnels/crm_tags/crm_leads/calendar_events/sales/sales_goal_periods/receipt_templates`; backfill `verified_at = createdAt` em toda org existente. `SCHEMA_VERSION = v90-fase1-sandbox-anonimo`.
- [x] Wizard `/comecar` (estado na URL via nuqs): ramo (supermercados, clínicas, atacarejos, franquias, food, automotivo) → soluções (pré-marcadas pelo ramo) → cookie + `signIn.anonymous()` → `/dashboard`. Quem já tem sessão só navega.
- [x] Pacote por solução (`seed-solucoes.ts`): funil "Vendas (exemplo)" com 4 etapas, 3 etiquetas (`CrmTag`) e 5 leads ligados aos clientes de exemplo; 3 ações no calendário com checklist; 1 modelo de cupom; período de metas com 2 vendedores; 2 vendas concluídas. Tudo `isDemo`, coberto por `removerDadosDeExemplo`.
- [x] Guia (`trilha.ts` + `GuiaCard` no dashboard): passos por solução, "feito" por contagens em `onboarding.status`. "Para você" no menu: as soluções marcadas sobem em Mais Soluções (`members.getCurrent` devolve `interesses`, `sandbox`, `expiraAvisada`).
- [x] Sandbox gate em: convites (criar/reenviar), links de entrada (criar/renovar/aceitar), WhatsApp (conectar), campanhas (procedure **e** `enviarLote` no Inngest), ERP (conectar/sincronizar), integrações, importações (4), subdomínio, compra de ★, troca de plano, CNPJ em `org.updateProfile`; vitrine/checkout/catálogo público só resolvem org com `verifiedAt`.
- [x] `BannerSandbox` no leiaute logado (vermelho após o aviso), `<VincularContaDialog>` no `ModalProvider` (aberto por `avisarErro`, pelo banner, pela recarga e por `/vincular-conta?motivo=`), `CriarSandboxButton` na tela "sem empresa" (`onboarding.criarSandbox`, idempotente), `/create-organization` manda anônimo para o dashboard.
- [x] `lastAccessAt` tocado por `currentOrganization()` (throttle 1 h); Inngest `sandbox-expire` (03:30) avisa aos 23 dias e apaga aos 30 via `apagarOrganizacao` (mesma ordem de exclusão de `resetDb`, que passa a chamá-la).

---

## Pendencias

### Critico
- [ ] **Migration** `pnpm db:deploy` antes do build (Fases 0 e 1 juntas: `rateLimit`, `upload_quota_daily`, colunas do sandbox).
- [ ] **Testar o callback do Google em staging** com uma sessão anônima ativa: é o único fluxo que a suíte não cobre (Better Auth é dublado).
- [ ] **Fotos por nicho**: só o pacote `mercearia` tem fotos; os outros ramos caem nele (`nichos.ts` → `pacote`). Fotos novas em `public/exemplo/<pacote>/` e um pacote por ramo em `seed-packs/`.

### Funcional
- [ ] "Catálogo exportado" no guia está sempre falso (não há evento de exportação no servidor).
- [ ] Objetos R2 de sandbox apagada ficam órfãos (prefixo `<orgId>/` da Fase 0 permite limpar depois).
- [ ] Fechar `/cadastro` por senha quando a sessão é anônima (força o Google).

---

## Decisoes tomadas

- **Entrada em um clique, mas org só no fim do wizard** — pular os passos ainda cria; abandonar a página não cria nada (evita org por robô).
- **Sandbox: interno livre, saídas exigem conta** (dev) — a regra vive numa coluna (`verifiedAt`), não em `Account`/`emailVerified` (bloquearia todo cliente antigo).
- **Conta provisória não é apagada no vínculo** — é `createdById` de tudo; fica inerte e o histórico continua verdadeiro.
- **Onboarding 100% estático** (dev) — nenhum token de IA na porta; as 50 ★ ficam intactas até a pessoa falar com o Astro.
- **"Etiquetas" = etiquetas do CRM + modelo de cupom** — o ERP não tem etiqueta de gôndola; se for isso, é feature nova.
- **Expiração por inatividade (30 d), aviso aos 23** (dev) — `lastAccessAt`, não idade da conta.

---

## Testes

- unit: `lib/conta-verificada.test.ts`, `features/onboarding/server/expirar-sandbox.test.ts`, `features/onboarding/lib/{trilha,solucoes,respostas}.test.ts`.
- integração: `tests/integration/sandbox.test.ts`, `onboarding-packs.test.ts`, `storefront-sandbox.test.ts`.
- e2e: `e2e/tests/sandbox.spec.ts`.
