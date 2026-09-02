# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

- **NUNCA** faça `git commit` ou `git push` sem uma solicitação explícita do dev. Resolver conflitos, corrigir código ou finalizar uma tarefa NÃO é autorização para commitar — deixe as mudanças no working tree e informe que estão prontas para revisão.
- **App desktop (Tauri) — branch de integração `feat/desktop`.** Todo o trabalho do desktop se ACUMULA em `feat/desktop` (a "principal" do desktop). As branches de cada fase (`feat/desktop-fase-N`) **partem de `feat/desktop` e voltam para ela** — nunca direto para a `main`. **NÃO subir NADA na `main` até o dev validar e testar o fluxo inteiro na branch.** Abrir PR para a `main` é decisão **exclusiva e explícita do dev** — não é disparada por "MVP pronto", "todas as fases feitas" nem nenhum outro marco automático; não sugira/prepare PR para a `main` sem pedido explícito. Base: `feat/desktop` descende de `feat/turborepo` (o monorepo). Detalhes em `specs/desktop-offline.md` (§ Fluxo de branches).

## Monorepo layout

Turborepo + pnpm workspaces. Everything runs from the **repo root**; the root `package.json` only delegates.

```
apps/web/            @nerp/web — the Next.js app (src/, prisma/, public/, scripts/, .env)
e2e/                 @nerp/e2e — Playwright
packages/
  typescript-config/ @nerp/typescript-config — base / nextjs / react-library
  vitest-config/     @nerp/vitest-config — node & jsdom presets
scripts/             repo-level tooling only (preview-all.mjs)
turbo.json  pnpm-workspace.yaml  biome.json (root config)
```

The `@/*` alias still points at `apps/web/src` — no import inside the app changed when it moved. `packages/database` and `packages/ui` were deliberately **not** extracted; see `specs/turborepo.md` for why and when.

## Commands

```bash
pnpm dev              # turbo dev → copy-zxing-wasm + next dev (Turbopack) on :3000
pnpm build            # turbo build → copy-zxing-wasm + next build (cacheable, NO migration)
pnpm db:deploy        # prisma migrate deploy — explicit step, run before deploying
pnpm lint             # turbo lint → Biome check (NOT ESLint)
pnpm format           # Biome format --write
pnpm check-types      # turbo check-types → tsc --noEmit in every workspace
pnpm test             # turbo test → Vitest unit + component
pnpm test:integration # Vitest integration (needs the db-test container)
pnpm test:e2e         # Playwright
pnpm db:migrate       # prisma migrate dev
pnpm db:generate      # regenerate Prisma client (required after pulling schema changes)
pnpm db:studio
pnpm db:seed          # runs apps/web/prisma/seed.ts via tsx (wired in prisma.config.ts)
pnpm inngest:dev      # Inngest dev server on :8299 (needed for background jobs)
pnpm preview:all      # rebuild branch `preview/tudo-local` merging every remote feat/*
docker compose up -d  # Postgres 17 — db on host port 5433, db-test on 5434
```

Scope a task to one workspace with `--filter`: `pnpm --filter @nerp/web test`, `turbo build --filter=@nerp/web`.

**Migrations are no longer part of `build`.** `turbo build` is cached, so a restored build would skip `prisma migrate deploy` silently. `nixpacks.toml` runs `pnpm db:deploy` before `pnpm build`. Don't move it back into the build script.

Only `main` deploys on Vercel (`vercel.json`); `nixpacks.toml` is the Coolify target.

`.claude/launch.json` defines the preview targets: `nerp` (pnpm dev, :3000), `nerp-attach` (attach to an already-running server), `inngest` (:8299).

`apps/web/scripts/*.ts` are one-off seed/audit/backfill scripts run with `tsx`. Several read `SEED_DATABASE_URL` rather than `DATABASE_URL` on purpose, so a worktree seed can't write to the wrong database.

## Testing

| tipo | onde | roda com |
|---|---|---|
| unit | `apps/web/src/**/*.test.ts` | `pnpm test` |
| component | `apps/web/src/**/*.test.tsx` (jsdom) | `pnpm test` |
| integration | `apps/web/tests/integration/**/*.test.ts` | `pnpm test:integration` |
| e2e | `e2e/tests/*.spec.ts` | `pnpm test:e2e` |

There is one worked example of each — copy the nearest one instead of inventing a setup:

- `src/utils/format-cnpj.test.ts` — pure function.
- `src/features/caixa/components/caixa-status-badge.test.tsx` — presentational component.
- `src/features/supplier/components/add-supplier.test.tsx` — the canonical form (RHF + zodResolver + `Controller`), mocking the **feature hook** (`vi.mock("../hooks/use-supplier")`). That mock is also what keeps `@/lib/orpc` — and the whole server tree behind it — out of jsdom.
- `tests/integration/supplier-list.test.ts` — calls a procedure with `call()` from `@orpc/server` and the S2S context helper in `tests/integration/helpers.ts`, no Next server involved. It seeds **two** orgs and asserts one can't see the other's data: that is the regression test for manual multi-tenancy, and the shape to replicate procedure by procedure.
- `e2e/tests/login.spec.ts` — Playwright against the built app.

Integration tests need `apps/web/.env.test` (copy `.env.test.example`) and `docker compose up -d db-test`. `tests/integration/env.ts` refuses to run if `DATABASE_URL` doesn't contain "test" — the suite truncates tables, so that guard is what stops it from wiping the dev database.

React Testing Library cannot render async Server Components. Component tests target `"use client"` components, which is where the interactive UI lives anyway.

## Architecture

Next.js 15 App Router + React 19 + oRPC + Prisma 7 + Better Auth + Inngest. Multi-tenant ERP for retail and Trade Marketing, Portuguese domain language (pt-BR). Single path alias: `@/*` → `./src/*`.

> Every path in this section is relative to **`apps/web/`** — `src/lib/db.ts` means `apps/web/src/lib/db.ts`.

### The oRPC server lives in `src/app/`

Not `src/server` or `src/rpc`:

- `src/app/middlewares/{base,auth,org,scope}.ts` — `base` procedure + typed errors; `requireAuthMiddleware` injects `context.user`/`context.session`; `requireOrgMiddleware` injects `context.org`; `requireScope("<scope>")` restricts what an S2S integration key may reach (a logged-in user passes straight through).
- `src/app/router/<entity>/<verb>.ts` — one procedure per file, re-exported from that folder's `index.ts`, merged into the root object in `src/app/router/index.ts` (~55 entities). That root object is the single source of type inference for the whole client.
- `src/app/api/rpc/[[...rest]]/route.ts` — the HTTP mount, which also verifies machine-to-machine (S2S) requests and injects `isS2S`/`s2sOrg`/`s2sUser`/`s2sScopes` into context before the handler runs.

There is no `publicProcedure`/`protectedProcedure`. You opt in by chaining:

```ts
export const createBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ name: z.string().min(1, "Informe o nome do book") }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.create({
      data: { organizationId: context.org.id, createdById: context.user.id, name: input.name },
      select: { id: true },
    });
    return { id: book.id };
  });
```

### Multi-tenancy is manual — the most important rule

`requireOrgMiddleware` gives you `context.org` but **does not scope any query**. There is no RLS and no Prisma extension. Every handler must pass `organizationId: context.org.id` itself; omitting it is a silent cross-tenant data leak (see `90cd7d6`, an IDOR in supplier get/update/delete). Any ID arriving from input must be re-validated against the org before use, rather than trusted:

```ts
const supplier = await prisma.supplier.findFirst({
  where: { id: input.supplierId, organizationId: context.org.id },
  select: { id: true },
});
if (!supplier) throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
```

Throw via the typed `errors` object, never `throw new Error`.

Public procedures are the exception (`router/catalog/public.ts`, `checkout/`, `pedidos/public-*`, `tradegram-public/`, share-token readers): they use bare `base` with no auth middleware, take a `subdomain` or share token as input, and resolve the org themselves.

### Server/client duality of `orpc`

`src/app/layout.tsx` line 1 is `import "@/lib/orpc.server"` — a side-effect import that sets `globalThis.$client` to a direct in-process router client. `src/lib/orpc.ts` then does `globalThis.$client ?? createORPCClient(link)`. So the same `orpc` import is an in-process call on the server and an HTTP fetch in the browser. **Removing that layout import silently breaks every server-side oRPC call.**

### Feature modules

Server and client are split across two trees. `src/app/router/<entity>/` holds the procedures; `src/features/<feature>/` holds the UI:

```
src/features/<feature>/
  components/*.tsx        "use client" components
  hooks/use-<feature>.ts  ALL useQuery/useMutation wrappers live here
  server/                 server-only "fat" business logic (optional)
  engine/                 pure domain logic + zustand stores, renderer-agnostic (store-map, planogram)
  params.ts               nuqs parsers (optional)
```

No `procedures/`, no `actions/`, no per-feature `schemas/` (Zod schemas are inline). Server Actions are not the pattern — everything goes through oRPC.

Components never call `orpc` directly; they go through a feature hook that toasts on error and invalidates on success:

```ts
export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation(orpc.book.create.mutationOptions({
    onSuccess: () => {
      toast.success("Book criado");
      queryClient.invalidateQueries({ queryKey: orpc.book.list.key() });
    },
    onError: (error) => toast.error(error.message),
  }));
}
```

`page.tsx` stays thin — `await requirePermission("<key>")` then render a container from `src/features/`.

### Prisma

Generated to `src/generated/prisma` (gitignored). **Import from `@/generated/prisma/client` and `@/generated/prisma/enums` — never `@prisma/client`.** The client is the *default* export of `@/lib/db`: `import prisma from "@/lib/db"`. Single ~4.5k-line `prisma/schema.prisma` with ~126 models and ~89 enums, ~148 migrations, on the `@prisma/adapter-pg` driver adapter. Convert `Decimal` → `Number` and `Date` → ISO string at the handler boundary.

**After every migration, bump `SCHEMA_VERSION` in `src/lib/db.ts`.** The Prisma client is cached on `globalThis` and survives dev hot-reload, so without the bump the dev server keeps the OLD client and selecting a newly added field 500s against an already-migrated database. Recent migrations are hand-authored with manual timestamps and applied with `migrate deploy` (schema drift makes `migrate dev` want to reset), so `prisma generate` + the version bump are the manual steps that go with them.

### Auth & permissions

Better Auth (`src/lib/auth.ts`) with the `organization` plugin plus a custom `crossLoginPlugin` (cross-subdomain cookies were deliberately removed — Chrome rejects `Domain=.localhost`). `src/middleware.ts` does **not** protect routes; it only rewrites subdomains to `/[subdomain]/...` for storefronts, and `/catalogo/<slug>` into that same storefront tree. Enforcement lives in layouts (`requireAuth()`, `requirePermission(key)`, `requireViewAccess(key)` from `src/lib/auth-utils.ts`) and the oRPC middlewares.

`src/lib/permissions.ts` holds three layers that must not be conflated:

- **`PAGE_PERMISSIONS`** — the page-key registry; this is security. Owner/admin bypass all checks.
- **`TradeRole` helpers** (`canManageCalendar`, `canSeeAllTrails`) — field-leadership capabilities layered on top of page keys, kept separate on purpose so a promoter with a menu item doesn't also get the whole team's location history.
- **Module visibility** (`isModuleVisible`, `HIDEABLE_MODULES`) — org/user preference, *not* security; hiding a module never blocks the route. `dashboard` and `configuracoes` are never hideable.

New admin page → add a key to `PAGE_PERMISSIONS`, guard the page with `requirePermission(key)` (or `requireViewAccess` where read-only viewers are allowed), add a sidebar entry in `src/components/app-sidebar.tsx`, and if it's a new **top-level** path add it to the pass-through list in `src/middleware.ts` so subdomain rewriting doesn't hijack it. Nesting under an already-allowlisted path (e.g. `/vendas/caixa`) avoids the middleware edit entirely.

### Site institucional e o admin dele

O site institucional é um app próprio, `apps/site`, e o admin que o alimenta
fica aqui no `apps/web`, em `/site`. A divisão segue o que o `apps/desktop` já
faz: **o `apps/web` é dono do estado** (banco, better-auth, R2, admin) e o
outro app só desenha, consumindo `/api/site/content` e `/api/site/page/<slug>`
por HTTP. O contrato entre os dois é o pacote `@nerp/site-content`; nenhum app
importa de dentro do outro.

As duas rotas públicas devolvem só o que já está no ar — nada de rascunho — e
o `apps/site` tem o próprio conteúdo de reserva, então ele continua de pé com
este app fora do ar.

Duas coisas fogem do padrão do resto do app, de propósito:

- **As tabelas `site_*` são GLOBAIS** — não têm `organizationId`. O site é um
  só; não é "o site de uma organização". Por isso as procedures em
  `src/app/router/site/` usam `requireSiteAdminMiddleware`
  (`src/app/middlewares/site-admin.ts`) no lugar de `requireOrgMiddleware`, e a
  regra de multi-tenancy manual não se aplica a elas. Se um dia existir site por
  inquilino, o caminho é acrescentar `organizationId` — não reaproveitar estas
  tabelas para dois significados.
- **O acesso não vem de `Member`** — vem de `SiteAdmin` mais um super admin fixo
  em `SITE_SUPER_ADMIN_EMAIL` (padrão `weydsonlima@gmail.com`), que não pode ser
  removido nem rebaixado pela tela. `requireSiteAdmin()` em
  `src/lib/site-admin.ts` é a guarda das páginas.

Uma página interna (`/solucoes/<slug>`, servida pelo `apps/site`) é uma LISTA DE
BLOCOS em JSON, validada por `@nerp/site-content`. `blocks` é o rascunho, `publishedBlocks` é o
que o site lê: salvar mexe só no rascunho, publicar copia um no outro, e uma
página em rascunho é 404 no site. Ao criar um bloco novo, campo novo entra
opcional ou com `.default()` — obrigatório invalidaria todas as páginas já
salvas de uma vez.

O menu sai do banco com fallback, e o fallback mora no outro app
(`apps/site/src/orbita/data/content.ts`): painel que volta vazio cai no
conteúdo que vem no código. É o que permite subir o admin antes de cadastrar
qualquer coisa. `pnpm --filter @nerp/web exec tsx scripts/seed-site-content.ts`
leva o catálogo atual para as tabelas — é idempotente e não sobrescreve o que
já foi editado na tela.

**O catálogo é lido de dois jeitos.** `MENU_COLUMNS` dá as seis colunas do
painel (28 ferramentas, incluindo os módulos do NERP); `ORBIT_TOOLS` dá as 19
que são estação na órbita. A cena deriva a geometria da CONTAGEM de estações —
ângulo de cada esfera, janela de scroll de cada categoria — então o menu pode
crescer sem apertar a animação. Ferramenta que entra só no menu leva
`orbitStation: false`.

As estações não são editáveis pelo admin: elas são a própria cena. Editar o
menu não muda a cena — é essa a divisão.

Uma página vive em um dos três trechos (`SitePageSection`), que é o primeiro
pedaço da URL. O slug é único no site inteiro, e a seção é o que impede
`/solucoes/<slug>` e `/segmentos/<slug>` de devolverem a mesma coisa.

### Background jobs (Inngest)

Client/events in `src/lib/inngest/client.ts`, functions array in `src/lib/inngest/functions.ts`, served at `src/app/api/inngest/route.ts`. The pattern: a procedure writes a status row (`GENERATING`/`PENDING`) then sends the event; the function body is a thin `step.run` delegating to `src/features/<domain>/server/*`, with `onFailure` marking the row `FAILED`; the client polls via `refetchInterval` keyed on status.

Current functions: `sync-nasa-delivery`; the four spreadsheet importers (`product-`/`supplier-`/`customer-`/`store-import-process` — the store one loops chunked `step.run`s so a retry replays at most one batch instead of the whole file); `book-generate`; `trade-catalog-generate`; `shopper-price-alert`; `erp-sync-schedule` / `erp-sync-deep-schedule` / `erp-sync-run`; `dashboard-alert-check`. Crons are `TZ=America/Fortaleza` and deliberately windowed (Mon–Sat, 6h–22h) to control Inngest billing — read the doc comments before widening one.

### External ERP sync (Winthor / Oracle)

`src/features/erp-sync/server/` reads a customer's on-prem Oracle (`oracledb`) read-only: `connectors/winthor.ts` mirrors orders/customers on a schedule, and `oracle-explorer/` is a guarded ad-hoc query builder — `read-only-sql.ts`, `identifier.ts` and `preflight.ts` are its safety layer, so route any new query path through them. Outbound sync to the NASA ERP goes the other direction, via `SyncOutbox` + `src/lib/sync-*.ts` and the S2S endpoints under `src/app/api/`.

### Route groups

`(main)/(rest)/` is the authenticated ERP (sidebar shell, `requireAuth()` + `currentOrganization()`). Others: `(auth)`, `(home)`, `(org)/create-organization`, `(storefront)/[subdomain]` (public per-tenant store), `(waiter)`, `(pedidos-display)/painel`, `(pdv)/mapa/[storeId]` (in-store map on the PDV device), `(promotor)` (field promoter/seller mobile app), `(public)` (share-token pages: catálogo PDV, public dashboard, ranking, TradeGram), plus `authorize`/`autorizar` (supervisor cancel approval on mobile).

## Conventions

- **Strict typing — `any` is forbidden.** Use Prisma generated types, `z.infer`, or domain types.
- Clean code, no superfluous comments — comment only the non-obvious "why". Existing comments are in Portuguese and explain the reasoning behind a decision; match that register.
- Reuse existing primitives before writing new ones (`cn()`, `constructUrl` in `src/hooks/use-construct-url.ts`, `src/utils/*` formatters, shadcn/ui).
- **Tailwind 4 is CSS-first — there is no `tailwind.config.*`.** Design tokens go in the `@theme inline` + `:root`/`.dark` blocks of `src/app/globals.css`.
- shadcn/ui (new-york, lucide icons) in `src/components/ui/`. Prefer `flex` + `gap-*` over `space-x/y-*`; `size-*` over `w-N h-N`; semantic tokens over manual `dark:` overrides.
- **Forms**: react-hook-form + `zodResolver` with the schema inline, using `<Controller>` + the `Field`/`FieldGroup`/`FieldLabel`/`FieldError` family — *not* shadcn's `<Form>/<FormField>` wrapper. Canonical example: `src/features/supplier/components/add-supplier.tsx`.
- **Tables are hand-rolled** with `components/ui/table.tsx` primitives — `@tanstack/react-table` is not used. Cursor pagination via `src/hooks/use-cursor-pagination.ts`.
- Client state: TanStack Query for server state, zustand for local editor/session stores, nuqs for URL state.
- Biome (2 spaces, double quotes, **import sorting deliberately off**; `noArrayIndexKey` off). Run `pnpm biome check --write` on new files.
- Commits: Conventional Commits with Portuguese subjects and scopes — `feat(store-map): M9 — régua com ticks`, `fix(build): resolve 'canvas' do konva`.

## Gotchas

- **Bump `SCHEMA_VERSION` after every migration** (see Prisma above) — the most common source of "impossible" 500s in dev.
- The `canvas: false` webpack alias in `next.config.ts` is load-bearing: Konva pulls a Node build that `require('canvas')`, which breaks production builds without it. Konva editors are `ssr: false`.
- `images.remotePatterns` derives a hostname from `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL`; unset, it silently becomes an empty hostname.
- `src/context/` and `src/schemas/` predate the `src/features/` convention and are vestigial — don't add to them.
- **`.env` lives in `apps/web/`, not the repo root** — Next.js reads it from the app directory. Same for `.env.local` and `.env.test`. On Coolify the variables are injected into the environment, so this only affects local dev.
- The repo's blobs are LF and `.gitattributes` pins `eol=lf`. On a Windows checkout made **before** that file existed, the working tree is CRLF and Biome flags every file as misformatted; `git add --renormalize .` fixes it once.
- **`pnpm.packageExtensions` in the root `package.json` declares `vitest` as an optional peer of `@testing-library/jest-dom`** — don't drop it. jest-dom's `dist/vitest.mjs` does `import { expect } from "vitest"` without declaring the peer, so under pnpm's strict (non-hoisted) layout that import can't resolve: every `*.test.tsx` fails to collect *and* `toBeInTheDocument` stops type-checking. The extension makes pnpm link `vitest` into jest-dom's own `node_modules`.
- Docs drift from code: the README env template and the `docs/catalogo-promocional/` route paths are out of date. Trust the code, `apps/web/.env`, and `docker-compose.yml` (Postgres on host port **5433**, test database on **5434**).

## Reference docs

- `NERP-OVERVIEW.md` — the fullest single-file tour: stack table, domain model grouped by area, router entity list, ERP page list, full env-var inventory. Start here for breadth; it's a generated snapshot predating the monorepo move, so prefix its `src/…` paths with `apps/web/` and verify specifics against code.
- `specs/turborepo.md` — why the monorepo is shaped the way it is, and what was deliberately left out (`packages/database`, `packages/ui`, Dockerfile + `turbo prune`, desktop app).
- `specs/` — the planning workflow the dev uses. `specs/README.md` is the index; `VISAO-PRODUTO.md` the product vision, `MAPA-PROJETO.md` the project map, `_TEMPLATE.md` the format for new specs, `COMO-SOLICITAR.md` how requests should be phrased. Convention: **one spec = one branch = one PR**, with a numbered order for the retail-ERP roadmap (pdv-caixa → pagamentos-gateway → financeiro-contas → fiscal-tributacao → fiscal-emissao → impressao-cupom → pdv-atalhos-ui → pdv-offline). Read the relevant spec before starting work in an area — decisions already taken (and rejected alternatives) are recorded there.
- `docs/TRADE_MARKETING.md` — the map/PDV/Book module: data model, the meters-based domain decoupled from the Konva renderer (`src/features/store-map/engine/`), roadmap M1–M9, conventions (§9), known issues (§11 — the cross-tenant leak it reports in `supplier/update.ts`/`delete.ts` was fixed in `90cd7d6`, so the doc is stale there).
- `docs/PROMOTOR_RASTREABILIDADE.md`, `docs/PLANO_VISUALIZACAO_MAPA_TRADE.md` — field-promoter traceability and trade map visualization.
- `docs/catalogo-promocional/` — promotional catalog spec (paths partly stale).
- `.agents/skills/` — vendored third-party skills (shadcn, vercel-react-best-practices, web-design-guidelines, frontend-design, context7-cli).
