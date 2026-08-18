# Desktop — Fase 0: fundações (design detalhado)

> Design executável da Fase 0 do [desktop-offline.md](./desktop-offline.md): habilitar um cliente tipado, autenticado por device e cross-origin contra a API oRPC, **sem alterar nenhum caminho existente** do ERP web.
> Feature: `packages/{types,api}` (novos) · `apps/web` (só adições) · migration `Device`
> Criado em: 2026-08-18 · Atualizado em: 2026-08-18
> Status: ✅ Implementado na branch `feat/desktop-fase-0` (check-types, lint dos arquivos novos, build e 26 testes verdes). Falta abrir o PR.

---

## Premissas fixadas

- **Auth do device:** token **opaco** (bearer) emitido num fluxo de *pareamento* após login interativo; guardado no keychain do SO. Verificação **espelha o mecanismo S2S** (`nasa-s2s-verify.ts`), injetando um principal "device" no contexto — **não** usa plugin do Better Auth (evita brigar com `getFullOrganization` fora do browser).
- **Tenancy:** **single-tenant por instalação** — o token nasce amarrado à org ativa do usuário no pareamento. Trocar de org = re-parear.
- **Objetivo da fase:** um script Node (proto do desktop) que autentica por bearer e chama um procedure real contra staging, com escopo de org correto. Sem UI, sem SQLite, sem offline.

## Regra de ouro desta fase: aditivo, nunca modificativo

Nenhum caminho atual muda de comportamento. Prova disso, ponto a ponto:

| Adição | Por que não afeta o que existe |
|---|---|
| Model `Device` + migration | Tabela nova; nenhum model existente muda de coluna. |
| `verifyDeviceAuth()` | Só dispara quando há header `Authorization: Bearer` **e** o token bate num `Device` válido. Request de cookie/web nunca entra aqui. |
| Ramo "device" em `requireAuthMiddleware`/`requireOrgMiddleware` | Novo `if (context.isDevice)` **antes** do fluxo de sessão; sem token de device, cai no fluxo atual, intacto. |
| CORS em `/api/rpc` | Só ecoa origin cross-origin que esteja na allowlist do desktop. Web same-origin não manda `Origin` cross-site → não ativa nada. |
| `trustedOrigins` += origin do desktop | Acrescenta itens ao array; os existentes seguem. |
| `router/device/*` (pair/list/revoke) | Entidade nova no router; procedures existentes não mudam. |

---

## 1. `packages/types` (@nerp/types)

Verdade de tipos compartilhada, **framework-free** (sem Prisma, sem React).

```
packages/types/
  src/
    operations.ts   # envelope de operação + união de OperationType + payloads por tipo
    enums.ts        # espelho manual dos enums de domínio que o device precisa
    sync.ts         # DTOs do pull incremental (cursor updatedSince)
    index.ts
  package.json      # exports "." → ./src/index.ts
  tsconfig.json     # extends @nerp/typescript-config/base.json
```

`operations.ts` (o contrato que a Fase 3 vai usar, definido já aqui para o desktop nascer sabendo):

```ts
export type OperationType =
  | "sale.create"
  | "cashSession.open"
  | "cashSession.close"
  | "stock.adjust";

export type OperationEnvelope<T extends OperationType = OperationType> = {
  id: string;            // uuid v7 — chave de idempotência e ordenação
  deviceId: string;
  orgId: string;         // roteamento LOCAL apenas; o server ignora e usa o principal autenticado
  type: T;
  payload: OperationPayload[T];
  schemaVersion: number; // versão do contrato desta operação
  createdAt: string;     // ISO (auditoria, não é verdade de negócio)
};

export type OperationPayload = {
  "sale.create": SaleCreatePayload;
  "cashSession.open": CashSessionOpenPayload;
  // ...
};
```

**Risco: drift dos enums** (`enums.ts` reescrito à mão pode divergir de `@/generated/prisma/enums`). Mitigação: um teste em `apps/web` que importa os dois e assere igualdade — quebra o CI no dia em que um enum do Prisma mudar sem atualizar o espelho.

---

## 2. `packages/api` (@nerp/api)

A ponte cliente. **Genérica sobre o tipo do router** — assim `@nerp/api` **não** depende de `apps/web` (o desktop é quem junta os dois). Grafo limpo: `api` não conhece o web; `desktop` conhece ambos.

```ts
// packages/api/src/client.ts
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient, AnyRouter } from "@orpc/server";

export type NerpClientOptions = {
  baseUrl: string;                              // ex.: https://erp.suaempresa.com
  getToken?: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;                         // desktop injeta o fetch do Tauri se preciso
};

export function createNerpClient<TRouter extends AnyRouter>(
  options: NerpClientOptions,
): RouterClient<TRouter> {
  const link = new RPCLink({
    url: `${options.baseUrl.replace(/\/$/, "")}/api/rpc`,
    fetch: options.fetch,
    headers: async () => {
      const token = await options.getToken?.();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
  return createORPCClient(link);
}
```

Isto resolve o achado do relatório: o `RPCLink` do web é preso a `window.location.origin` (`src/lib/orpc.ts`); aqui a **base URL é parâmetro** e o token entra por callback (lido do keychain no desktop).

O **tipo** do router é exposto pelo web num entrypoint type-only novo (aditivo, sem runtime):

```ts
// apps/web/src/rpc-type.ts   (NOVO — só tipo, apagado no build)
import type { router } from "./app/router";
export type AppRouter = typeof router;
```

E `apps/web/package.json` ganha o subpath export:

```jsonc
"exports": { "./rpc-type": "./src/rpc-type.ts" }
```

Consumo no proto/desktop (import type-only → o bundle **não** leva Prisma nem código de servidor):

```ts
import type { AppRouter } from "@nerp/web/rpc-type";
import { createNerpClient } from "@nerp/api";

const client = createNerpClient<AppRouter>({
  baseUrl: process.env.NERP_API_URL!,
  getToken: () => readDeviceTokenFromKeychain(),
});

const { suppliers } = await client.supplier.list({ page: 1, pageSize: 10 });
```

---

## 3. Auth de device (server, espelhando o S2S)

### 3.1 Model `Device` (migration aditiva + bump do `SCHEMA_VERSION`)

```prisma
model Device {
  id             String    @id @default(cuid())
  organizationId String                 // sem @relation p/ manter a migration self-contained
  userId         String                 // (não altera Organization/User)
  name           String                 // "Caixa 01 — Loja Centro"
  platform       String                 // "windows" | "macos" | "linux"
  tokenHash      String    @unique       // sha256 do token opaco; o token NUNCA é gravado
  scopes         String[]  @default([])
  lastSeenAt     DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([organizationId])
  @@map("devices")
}
```

> Postura de segurança: guarda-se só o **hash** do token (como senha). Vazou o banco, não vaza token utilizável. Sobre TLS, bearer opaco basta — não precisa do HMAC do S2S (que existe porque o NASA guarda segredo compartilhado para assinar).

### 3.2 `verifyDeviceAuth()` (`src/lib/device-auth-verify.ts`)

Espelha `verifyNasaS2S`: lê o bearer, hasheia, busca o `Device`, valida, resolve org+user.

```ts
export type DevicePrincipal = { org: Organization; user: User; device: Device; scopes: string[] };

export async function verifyDeviceAuth(request: Request): Promise<DevicePrincipal | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;          // sem bearer → não é device; segue fluxo atual
  const token = auth.slice(7);
  const tokenHash = sha256hex(token);

  const device = await prisma.device.findUnique({ where: { tokenHash } });
  if (!device || device.revokedAt) return null;           // token inválido/revogado → 401 pelos middlewares

  const [org, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: device.organizationId } }),
    prisma.user.findUnique({ where: { id: device.userId } }),
  ]);
  if (!org || !user) return null;

  void prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return { org, user, device, scopes: device.scopes };
}
```

### 3.3 Injeção na rota (`route.ts`) — ao lado do S2S

```ts
const s2s = await verifyNasaS2S(request).catch(rethrowResponse);
const device = s2s ? null : await verifyDeviceAuth(request);   // bearer só quando não é S2S

const { response } = await handler.handle(request, {
  prefix: "/api/rpc",
  context: {
    headers: request.headers,
    ...(s2s && { isS2S: true as const, s2sOrg: s2s.org, s2sUser: s2s.user, s2sScopes: s2s.scopes }),
    ...(device && { isDevice: true as const, deviceOrg: device.org, deviceUser: device.user, deviceScopes: device.scopes }),
  },
});
```

### 3.4 `BaseContext` (`middlewares/base.ts`) — campos novos, opcionais

```ts
export type BaseContext = {
  headers: Headers;
  isS2S?: true;  s2sOrg?: Organization;  s2sUser?: User;  s2sScopes?: string[];
  isDevice?: true; deviceOrg?: Organization; deviceUser?: User; deviceScopes?: string[];
};
```

### 3.5 Ramo device nos middlewares (aditivo, antes do fluxo de sessão)

```ts
// requireAuthMiddleware
if (context.isDevice && context.deviceUser && context.deviceOrg) {
  return next({ context: { session: syntheticSession(context.deviceUser, context.deviceOrg), user: context.deviceUser } });
}
// requireOrgMiddleware
if (context.isDevice && context.deviceOrg) {
  return next({ context: { org: asFullOrg(context.deviceOrg) } });
}
```

> **Regra de multi-tenancy no replay (Fase 3, mas nasce aqui):** o handler **sempre** usa `context.org.id` (o do principal device), **nunca** o `orgId` do payload da operação. É o mesmo cuidado do IDOR `90cd7d6`.

### 3.6 Pareamento (`router/device/*`) — emissão do token

```ts
// device.pair — exige login interativo (auth + org normais)
export const pairDevice = base
  .use(requireAuthMiddleware).use(requireOrgMiddleware)
  .input(z.object({ name: z.string().min(1), platform: z.enum(["windows","macos","linux"]) }))
  .output(z.object({ deviceId: z.string(), token: z.string() }))  // token devolvido UMA vez
  .handler(async ({ context, input }) => {
    const token = randomToken(32);                                 // opaco, alta entropia
    const device = await prisma.device.create({
      data: {
        organizationId: context.org.id, userId: context.user.id,   // amarra à org ativa (single-tenant)
        name: input.name, platform: input.platform, tokenHash: sha256hex(token),
      },
      select: { id: true },
    });
    return { deviceId: device.id, token };                          // desktop grava no keychain e descarta
  });
```

Companheiros: `device.list` (admin vê terminais da org) e `device.revoke` (mata um device — seta `revokedAt`). Ambos escopados por `context.org.id`.

---

## 4. CORS (`/api/rpc`) — cross-origin só para o desktop

O desktop é cross-origin (`tauri://localhost` / `https://tauri.localhost`, por SO). Web same-origin não é afetado.

```ts
// helper aplicado no route.ts
const ALLOWED = (process.env.DESKTOP_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin || !ALLOWED.includes(origin)) return {};           // web same-origin: sem Origin cross-site → {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "false",                  // device usa bearer, não cookie
    "Vary": "Origin",
  };
}

export const OPTIONS = (req: Request) =>
  new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
```

E as respostas de `handleRequest` passam a mesclar `corsHeaders(origin)`. `Allow-Credentials: false` é proposital — device não manda cookie, e liberar credenciais cross-origin seria expor a sessão do web.

Config correlata: `trustedOrigins` do Better Auth ganha as origins do desktop (para o login interativo do pareamento funcionar cross-origin).

---

## 5. Verificação da fase

**Automática (integração, roda no `db-test`):** `tests/integration/device-auth.test.ts`, no molde do `supplier-list.test.ts`:
1. cria org A + org B + usuário/member em A;
2. `pairDevice` no contexto de A → obtém token/deviceId; confere que só o hash foi gravado;
3. monta um `deviceContext` (principal device de A) e chama `supplier.list` via `call()` — **afirma que não enxerga fornecedor de B**. Regressão da regra de tenancy para o novo caminho de auth.

**Manual (prova de ponta a ponta contra staging):** script Node usando `@nerp/api`:
1. sign-in email/senha (Better Auth) → sessão;
2. `device.pair` → token;
3. `createNerpClient<AppRouter>({ baseUrl: staging, getToken: () => token })`;
4. `client.product.list(...)` retorna dados **só** da org do device. Valida CORS, ramo bearer, factory e inferência de tipos de uma vez.

**Sanidade do monorepo:** `pnpm check-types` (o import type-only de `AppRouter` resolve sem arrastar server code) + `pnpm lint`.

---

## 6. Pendencias (checklist da fase)

### Server (aditivo)
- [x] Model `Device` + migration `20260818120000_device` + bump `SCHEMA_VERSION` (`v61-device`). `scopes` ficou sem `@default([])` (casa com `nasa_integration_keys`; o `pair` sempre envia `[]`).
- [x] `src/lib/device-auth-verify.ts` + `src/lib/device-token.ts` (gera/hasheia).
- [x] `BaseContext` += campos device; ramo device em `auth.ts` e `org.ts`.
- [x] Injeção no `route.ts` + `src/lib/desktop-cors.ts` + `OPTIONS`.
- [x] `router/device/{pair,list,revoke}.ts` + `index.ts` + merge no router raiz (`device:`).
- [x] `trustedOrigins` += origins do desktop; `DESKTOP_ALLOWED_ORIGINS` no `turbo.json` globalEnv.

### Packages
- [x] `packages/types` (operations/enums/sync) + teste de paridade de enums (4 casos, verde).
- [x] `packages/api` (`createNerpClient` genérico).
- [x] `apps/web/src/rpc-type.ts` + subpath export `@nerp/web/rpc-type`.

### Verificação
- [x] `tests/integration/device-auth.test.ts` (4 testes: hash, resolução de principal, rejeição de inválido/revogado, isolamento de org).
- [x] Script de prova `scripts/proof-device-client.ts` (compila; roda contra staging com `NERP_API_URL`+`NERP_DEVICE_TOKEN`). Bônus: teste unitário do `desktopCorsHeaders`.

---

## 7. Decisoes tomadas

- **Auth de device espelha o S2S** (principal injetado no contexto), não o plugin do Better Auth — não briga com a resolução de org fora do browser e reusa um padrão já testado.
- **Bearer opaco com hash-at-rest**, não HMAC — sobre TLS é suficiente e mais simples que o S2S; server nunca guarda token utilizável.
- **`@nerp/api` genérico sobre o router**, sem depender de `apps/web` — o desktop é quem junta tipo + factory. Grafo de dependência limpo.
- **`Device` sem `@relation`** para Organization/User — mantém a migration self-contained e não toca os models existentes (FK a nível de app, via `verifyDeviceAuth`).
- **Pareamento exige login interativo** e amarra o token à org ativa (single-tenant por instalação).

## 8. Em aberto

- [ ] Escopos do device (`scopes`): começar com um único escopo "pdv" ou já granular? (afeta `device.pair`).
- [ ] Origin exata do Tauri por SO (v2 usa protocolo custom) → fixar os valores de `DESKTOP_ALLOWED_ORIGINS` na Fase 1.
- [ ] Rotação/expiração do token de device (hoje: sem expiração, só revogação manual).
