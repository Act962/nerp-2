# Desktop (Tauri) + Offline-First — relatório arquitetural e roadmap

> Proposta para um app **desktop em Tauri** com operação **offline-first** (banco local + sync por operações), reaproveitando a API oRPC do ERP web sem alterar o que está em produção.
> Feature: `apps/desktop` (novo) · `packages/{core,api,ui,types,utils}` (novos) · `apps/web` (intocado)
> Criado em: 2026-08-18 · Atualizado em: 2026-08-18
> Status: 📋 Planejado (proposta arquitetural)

---

## 0. Restrição inegociável

**Não mexer no ERP web em produção.** Toda a Fase 0–1 é *aditiva*: novos arquivos type-only, novos packages, config de CORS/origens. Nenhuma mudança de comportamento no `apps/web`. Só quando o desktop estiver validado é que se considera extrair código do web para packages (Fase 5, opcional).

---

## 1. Estado atual (o que já temos a favor e contra)

### 1.1 O que joga a favor

| Fato no código | Por que importa para o desktop |
|---|---|
| **oRPC com um único `router` raiz** (`apps/web/src/app/router/index.ts`) tipando todo o cliente via `RouterClient<typeof router>` | O desktop ganha um cliente **totalmente tipado de graça** importando só o *tipo* do router — mesmo mecanismo do tRPC em monorepo. |
| **Dualidade servidor/cliente do `orpc`** (`src/lib/orpc.ts`: `globalThis.$client ?? createORPCClient(link)`) | O desktop é sempre *cliente* → sempre usa `RPCLink` HTTP. Só que o `RPCLink` atual aponta para `window.location.origin` — o desktop precisa de **base URL configurável**. Achado concreto: o factory de cliente tem que ser parametrizável. |
| **Rota `/api/rpc` já aceita auth não-cookie** (`route.ts` + `nasa-s2s-verify.ts`): HMAC + `x-nerp-api-key` + timestamp com drift de 5 min, injetando `isS2S/s2sOrg/s2sUser/s2sScopes` | Prova que os middlewares toleram um cliente sem sessão de browser. É o precedente para autenticar um dispositivo desktop. |
| **`SyncOutbox` + `sync-payloads.ts` + entrega Inngest** com idempotência por `id` (cuid) e backoff exponencial | Já existe um **modelo mental de outbox operacional** no projeto (hoje NERP→NASA). O sync do desktop é o mesmo padrão espelhado (device→server / server→device). |
| **Numeração de venda server-authoritative** (`sales/create.ts`: `lastSaleNumber` com `increment` atômico dentro de `$transaction`) | Casa exatamente com a decisão "server assigns" do `pdv-offline.md`: o device nunca decide `saleNumber`. |
| **Vendas são append-only** (cada venda é uma linha nova, não uma edição concorrente) | É o que torna o sync **por operações tratável sem CRDT**. Duas vendas offline em devices diferentes não "colidem" — são dois eventos distintos. |
| **`specs/pdv-offline.md` já existe** (offline transparente do PDV via PWA + IndexedDB) | O desktop e o PWA compartilham a mesma filosofia. A recomendação aqui é fazer o **motor de offline** num package compartilhável, para os dois consumirem depois. |

### 1.2 O que joga contra (riscos estruturais)

| Risco | Descrição | Severidade |
|---|---|---|
| **Multi-tenancy manual** | Não há RLS: cada handler filtra por `organizationId` na mão (CLAUDE.md §4.2). No replay do outbox, o `orgId` **nunca** pode vir do payload da fila — tem que ser reamarrado ao contexto autenticado do device no servidor. Mesma classe do IDOR do `90cd7d6`. | 🔴 Alta |
| **Acoplamento por tipo web↔desktop** | O desktop se fixa no tipo do `router` do web. Um deploy do server que **remova/renomeie** campo quebra o cliente e, pior, quebra operações **já enfileiradas** offline contra o schema antigo. | 🔴 Alta |
| **Auth em webview nativo** | Cookie de sessão do Better Auth em Tauri é frágil (o histórico do `crossLoginPlugin` já mostra dor com cookies). Precisa de token de dispositivo em keychain do SO, não cookie. | 🟠 Média |
| **CORS / origens** | Web é same-origin; desktop é *cross-origin* (`tauri://localhost` ou custom scheme) batendo na API do Coolify. Precisa CORS em `/api/rpc` e `trustedOrigins` no Better Auth. Hoje não existe. | 🟠 Média |
| **Estoque offline** | `sales/create.ts` decrementa `currentStock`. Vendas offline concorrentes entre devices podem "furar" o estoque. Não dá para bloquear venda por falta de rede. | 🟠 Média |
| **Fiscal (NFCe)** | Exige SEFAZ online. Venda offline sai não-fiscal/contingência; nota emitida ao reconectar. Já registrado como fora do MVP no `pdv-offline.md`. | 🟡 Baixa (escopo) |
| **Migrações do SQLite local** | O banco local versiona junto com o app; toda atualização de app precisa migrar o schema local sem perder o outbox pendente. | 🟠 Média |
| **Prisma 7 só server-side** | O client do Prisma (`@/generated/prisma`) não roda no device. Reforça: o device **nunca** fala com Postgres direto — só via API. | 🟢 Info |

---

## 2. Estrutura Turborepo alvo

```
apps/
  web/            @nerp/web    — Next.js em produção (INTOCADO)
  desktop/        @nerp/desktop — Tauri + Vite + React (SPA), novo
e2e/              @nerp/e2e
packages/
  types/          @nerp/types  — tipos de domínio, enums, schemas Zod, DTOs de sync (framework-free)
  api/            @nerp/api    — contrato oRPC (tipo AppRouter) + factory de cliente tipado (base-url parametrizável)
  core/           @nerp/core   — motor offline: schema SQLite (Drizzle), outbox, orquestrador de sync, detecção de conexão, lógica de domínio que roda offline (carrinho, espelho de preço)
  ui/             @nerp/ui     — componentes React compartilhados (primitivos shadcn + componentes de PDV)
  utils/          @nerp/utils  — helpers puros (formatadores: CNPJ, moeda, telefone…)
  typescript-config/  vitest-config/   (já existem)
```

### 2.1 Papel de cada package e ordem de dependência

```
types  ─────────────┐
utils  ─────────────┤
                    ├──►  api (client)  ──►  core (offline engine)  ──►  apps/desktop
ui  ────────────────┘                                                    apps/web (consome ui/utils quando conveniente)
```

- **`@nerp/types`** — verdade de tipos que os dois lados compartilham: enums de domínio (espelho dos enums do Prisma, escritos à mão para não puxar o client do Prisma para o device), schemas Zod de entrada/saída e, principalmente, os **DTOs do envelope de operação** (§3.3). Zero dependência de framework.
- **`@nerp/api`** — a ponte. Exporta:
  1. `export type AppRouter = …` — o **tipo** do router (import type-only, apagado no build; não arrasta código de servidor).
  2. `createClient({ baseUrl, getToken, fetch })` → cliente oRPC tipado (`RouterClient<AppRouter>`). É o que resolve o achado do §1.1: base URL parametrizável (web passa `window.location.origin`, desktop passa a URL do Coolify) e injeção do token de device.
- **`@nerp/core`** — o motor offline-first, **agnóstico de plataforma** (TS puro): schema do SQLite (Drizzle), repositório de outbox, orquestrador de drain/pull, detecção de conectividade, e a lógica de PDV que precisa rodar offline (montagem de carrinho, cálculo de total, espelho do `resolve-price`). É consumido pelo desktop hoje e pelo PWA (`pdv-offline.md`) depois — **um motor, dois hosts**.
- **`@nerp/ui`** — componentes React. Extração incremental (Tailwind 4 é CSS-first: exige reconfigurar `@source`/`@theme` para varrer o package). Começa pequeno (só os componentes de PDV que o desktop precisa) e cresce.
- **`@nerp/utils`** — os formatadores puros de `apps/web/src/utils/*`. Extração de baixo risco, mas mexe em muitos imports no web → fazer por último e de forma incremental (ou duplicar o punhado que o desktop precisa em Fase 1 e unificar depois).

### 2.2 O nó do acoplamento por tipo (decisão importante)

Mover o `router` inteiro para `packages/api` seria o padrão tRPC-monorepo mais limpo, **mas viola "não mexer no web"** (são ~55 entidades com imports de Prisma/env de servidor). Então:

- **Fase 0–4 (recomendado):** o `router` **fica em `apps/web`**. Adiciona-se um entrypoint *type-only* novo — `apps/web/src/rpc-type.ts` com `export type AppRouter = typeof import("./app/router").router` — que é aditivo e não muda runtime nenhum. `@nerp/api` consome esse tipo e expõe o factory de cliente. Import type-only é apagado na compilação → o bundle do desktop **não** leva Prisma nem código de servidor.
- **Fase 5 (opcional, depois):** extrair de fato o `router` para `packages/api`, deixando `apps/web` só montando o handler HTTP. Só quando fizer sentido pagar esse custo.

> Trade-off assumido: uma dependência type-only de `apps/desktop`/`@nerp/api` sobre `apps/web` é levemente incomum (app→app), mas é **só tipo**, custo zero em runtime, e evita a migração arriscada agora.

### 2.3 Framework do desktop: Vite + React SPA (não Next)

O `apps/web` depende de RSC + `orpc.server` in-process (`src/app/layout.tsx` importa `@/lib/orpc.server` como side-effect). Nada disso roda dentro do Tauri, que serve um frontend estático. Reaproveitar o Next por `output: export` traria toda a bagagem de SSR sem o benefício. **Recomendação: `apps/desktop` é um SPA Vite + React**, 100% cliente, todo dado via o cliente oRPC HTTP (mesmo caminho do browser). UI vem de `@nerp/ui`, lógica de `@nerp/core`. Simples, rápido, sem SSR.

---

## 3. Offline-first: banco local + sync por operações

### 3.1 Banco local — avaliação

| Opção | Veredito |
|---|---|
| **SQLite embarcado** (via `@tauri-apps/plugin-sql`, ou Drizzle sobre esse driver) | ✅ **Recomendado.** Nativo no Tauri, transacional, robusto, aguenta catálogo grande, queries SQL de verdade. Com **Drizzle** as queries ficam tipadas em TS e reusáveis em `@nerp/core`. |
| **LibSQL / Turso (embedded replica)** | ❌ para o sync, ✅ só como SQLite. A replicação embarcada do libSQL faz **replicação de linhas** contra um servidor libSQL — o que exigiria um **segundo sistema de banco** ao lado do Postgres/Neon e, pior, **não roda as invariantes do servidor** (numeração, estoque, escopo de tenant, fiscal). Para ERP isso é o modelo errado (ver §3.2). Se um dia quiser o driver libSQL local no lugar do SQLite puro, tudo bem — mas o **sync não passa por ele**. |
| **PGlite (Postgres WASM)** | ❌ Overkill. Casa a semântica do Postgres, mas é pesado e o Tauri já entrega SQLite nativo. |
| **IndexedDB / Dexie** | ➖ É o caminho do **PWA** (`pdv-offline.md`), não do desktop. No Tauri, SQLite nativo é superior (SQL, transações, volume). O motor de `@nerp/core` pode abstrair o storage para servir os dois no futuro. |

**Decisão:** SQLite embarcado no device via `@tauri-apps/plugin-sql` + **Drizzle** como camada tipada, dentro de `@nerp/core`. Migrações do schema local versionadas e aplicadas no boot do app.

### 3.2 Por que sync por OPERAÇÕES e não replicação de linhas

Num ERP, o servidor precisa **rodar regras** ao aceitar uma escrita: atribuir `saleNumber` atômico, baixar estoque, resolver preço por tabela/cliente, revalidar `organizationId`, futuramente emitir fiscal. Replicação de linhas (libSQL/CRDT genérico) **pula toda essa lógica**. 

Sync por operações = o device grava **comandos** (as próprias mutações oRPC) numa outbox e, ao reconectar, **as reproduz chamando os mesmos procedures** com uma chave de idempotência. Isso **reaproveita 100% da lógica de negócio já existente** em vez de reimplementá-la num motor de sync. É exatamente a filosofia do `SyncOutbox` que já está no projeto, espelhada para device→server.

> A insight que torna isso tratável: **PDV é um log append-only**. Vendas não são edições concorrentes de um registro compartilhado — são eventos novos. A maior parte da complexidade de conflito de CRDT simplesmente não existe aqui.

### 3.3 O envelope de operação (`@nerp/types`)

```ts
type Operation = {
  id: string;            // uuid v7 (ordenável por tempo) — chave de idempotência
  deviceId: string;      // dispositivo que originou
  orgId: string;         // só para roteamento LOCAL; o server IGNORA e usa o contexto autenticado
  type: "sale.create" | "cashSession.open" | "cashSession.close" | "stock.adjust" | ...;
  payload: unknown;      // validado por Zod no server, por `type`
  schemaVersion: number; // versão do contrato desta operação
  createdAt: string;     // ISO (tempo do device — NÃO é a verdade de negócio)
  status: "pending" | "syncing" | "done" | "conflict";
};
```

### 3.4 Fluxo device → server (drain do outbox)

1. Mutação offline (ex.: fechar venda) grava (a) o efeito local no SQLite (venda com **id temporário** + número provisório de contingência) e (b) uma `Operation` na tabela `outbox`. Transação local única: nunca perde a venda.
2. Ao reconectar (§3.6), o orquestrador drena o outbox **em ordem** (uuid v7), chamando o procedure oRPC correspondente com header de **idempotência** = `operation.id`.
3. **No servidor:** um ledger `DeviceOperation (deviceId, operationId) @@unique` deduplica replays. O handler **reamarra o `organizationId` ao contexto autenticado do device** (nunca ao payload), roda a lógica normal, atribui o `saleNumber` autoritativo e devolve o registro canônico.
4. O device **reconcilia** a linha local: id temporário → id real, número provisório → `saleNumber` do server, marca a operação `done`.

> Isto exige uma adição server-side pequena e aditiva: aceitar o header de idempotência e gravar no ledger. Não altera o comportamento das chamadas online (sem header = fluxo atual).

### 3.5 Fluxo server → device (pull de dados de referência)

Catálogo, preços, clientes e um snapshot de estoque descem por **cursor incremental** (`updatedSince`), não pull completo. Requer watermarks `updatedAt` já presentes na maioria dos models. São *read models* — o device lê offline, o server continua dono da verdade.

### 3.6 Detecção de conexão, conflitos e relógio

- **Conectividade:** `navigator.onLine` + heartbeat leve contra um endpoint `/health` (distinguir "sem rede" de "server fora") — igual ao previsto no `pdv-offline.md`. Troca de modo transparente, indicador discreto.
- **Conflitos:**
  - *Vendas* → append-only, não conflitam. Server atribui número. Reconciliação trivial.
  - *Estoque* → quantidade derivada. Offline é **advisório**: a venda **nunca** é bloqueada por rede; oversell é aceito e **sinalizado** para reconciliação/relatório ao sincronizar.
  - *Numeração* → server assigns, sempre.
- **Relógio:** o `createdAt` do device é ordenação/auditoria, **não** verdade de negócio. O server é a fonte do tempo (o S2S já valida drift de 5 min). uuid v7 dá ordem estável sem confiar no relógio do device.

### 3.7 Auth do device

Reusar o mecanismo NASA S2S **não** serve direto: ele é chave *de máquina por org* atrelada a um usuário que consentiu (`NasaIntegrationKey`), pensado para a integração NASA — não é auth *de usuário por dispositivo*. Recomendação:

- **Token de dispositivo** emitido após login do usuário (Better Auth — bearer/API-key plugin, ou um fluxo "vincular este dispositivo"), guardado no **keychain do SO** via `tauri-plugin-stronghold`/keyring, **não** em cookie.
- O `@nerp/api` injeta esse token como `Authorization: Bearer` no `RPCLink`. Os middlewares `requireAuthMiddleware`/`requireOrgMiddleware` ganham um ramo que valida bearer (aditivo, ao lado do ramo S2S existente — a arquitetura já comporta isso).
- CORS em `/api/rpc` e `trustedOrigins` no Better Auth passam a incluir a origem do desktop.

---

## 4. Roadmap em fases

Cada fase é um branch/PR (convenção do projeto). O web e o deploy no Coolify seguem intocados até a Fase 5.

### Fase 0 — Fundações, sem tocar no web
> Design detalhado: [`desktop-fase-0.md`](./desktop-fase-0.md).

- `packages/types`, `packages/api` (factory de cliente base-url-parametrizável + `AppRouter` type-only via novo `apps/web/src/rpc-type.ts`).
- CORS em `/api/rpc` + `trustedOrigins`; token de dispositivo (Better Auth bearer) — **tudo aditivo**.
- **Prova:** um script Node usando `@nerp/api` autentica por bearer e chama um procedure contra staging. Sem UI ainda.

### Fase 1 — Desktop online-only (de-risk de empacotamento/auth/CORS)
- `apps/desktop`: Tauri + Vite + React. Login contra a API, tela de PDV consumindo `@nerp/api` **sem offline**.
- Entrega um desktop que já vende **quando há rede** — valida bundle Tauri, auth em webview, keychain e CORS antes de investir no offline.

### Fase 2 — Banco local + leitura offline
- `@nerp/core`: SQLite (Drizzle + `@tauri-apps/plugin-sql`), migrações locais.
- Pull incremental de catálogo/preços/clientes/estoque (cursor `updatedSince`).
- PDV **lê** offline: busca de produto, preço, carrinho e total — tudo sem rede. Ainda **sem** escrever offline.

### Fase 3 — Escrita offline (o marco central)
- Outbox local + replay por operação (§3.4): idempotência, ledger `DeviceOperation` no server, numeração server-assigns, reconciliação de estoque.
- Detecção de conexão + indicadores ("N vendas pendentes de sincronização").
- Sessão de caixa (`pdv-caixa`) espelhada offline.

### Fase 4 — Endurecimento
- Relatório de anomalias (oversell, divergências), auto-update do Tauri (updater assinado), storage seguro de token, observabilidade de *lag* de sync.
- Handoff de contingência fiscal (emitir NFCe ao reconectar) — se/quando `fiscal-emissao` existir.

### Fase 5 — Convergência (opcional)
- Extrair o `router` para `packages/api` de verdade (web vira só o mount HTTP).
- `@nerp/ui` e `@nerp/utils` compartilhados de fato entre web e desktop.
- Levar o **mesmo `@nerp/core`** para o PWA do `pdv-offline.md` → um motor de offline, dois hosts (desktop nativo + PWA no navegador).

---

## 5. Impacto no deploy (preservado)

- **Coolify / web:** nada muda. O único acréscimo server-side é aditivo (CORS, bearer, ledger de idempotência, header opcional). `.nixpacks.toml` e `vercel.json` intactos.
- **Desktop:** **não** vai para o Coolify. Bundles Tauri são artefatos por SO (Windows/macOS/Linux), gerados em CI separado (`tauri build`) e distribuídos pelo **updater do Tauri** — canal de distribuição independente do deploy do backend.
- **Turbo:** `apps/desktop` ganha tasks próprias (`dev`, `build`, `tauri:build`) com `cache: false` no que envolve toolchain nativa. O `build` do web continua isolado por `--filter`.

---

## 6. Decisoes tomadas (resumo)

- **Sync por operações via oRPC**, não replicação de linhas — reaproveita a lógica de negócio e as invariantes do server; casa com o `SyncOutbox` existente.
- **SQLite embarcado + Drizzle** no device; libSQL/Turso descartado como camada de *sync*.
- **Server-authoritative** em numeração, estoque e fiscal; vendas são append-only (sem CRDT).
- **`orgId` do payload é ignorado no replay** — reamarrado ao contexto autenticado (regra de multi-tenancy manual).
- **Desktop = Vite+React SPA** (não Next); sempre cliente HTTP.
- **Router permanece em `apps/web`** (type-only export) até a Fase 5; nada de mover ~55 entidades agora.
- **Auth por token de dispositivo** em keychain (bearer), não cookie.

## 7. Melhorias futuras / questões em aberto

- [ ] Versionamento do contrato de operação (`schemaVersion`) e política de *expand-only* no schema para não quebrar operações enfileiradas contra server já atualizado.
- [ ] Estratégia de migração do SQLite local preservando outbox pendente entre updates de app.
- [ ] Decidir emissor do token de device: Better Auth API-key plugin vs. fluxo custom de "vincular dispositivo".
- [ ] Métricas de tempo offline / vendas em contingência (também citadas no `pdv-offline.md`).
