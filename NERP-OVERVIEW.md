# NERP — Visão Geral do Projeto

> Documento de referência para consultas (ex.: colar no ChatGPT). Descreve arquitetura, stack, domínio e convenções do NERP.
> Gerado a partir do código em `2026-08-05`. Nome do pacote: `erp-limas` (v0.1.0).

---

## 1. O que é o NERP

ERP multi-tenant (SaaS) em português (pt-BR) voltado para varejo e **Trade Marketing**. Uma mesma base atende vários tipos de operação, ativados por módulo e por permissão:

- **ERP de varejo**: produtos, estoque, clientes, fornecedores, frente de caixa (PDV/vendas), pedidos de cozinha, catálogo online (storefront por subdomínio).
- **Trade Marketing**: mapa de campo, promotores, books de fotos de PDV, planograma, catálogo PDV, negociação de espaços, distribuidores, diretório de empresas, cupons, TradeGram, insights do cliente.
- **Integrações**: sincronização com ERP externo (NASA), Oracle, importações em massa (produtos/clientes/fornecedores/lojas), billing (Stripe/Asaas).

Cada empresa é uma **organização** (tenant). Usuários pertencem a organizações via *membros*, com cargos e permissões por página.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 15.5** (App Router, Turbopack) + **React 19** |
| Linguagem | TypeScript 5 (estrito — `any` é proibido) |
| API/RPC | **oRPC** 1.13 (`@orpc/server`, `@orpc/client`, `@orpc/tanstack-query`) |
| ORM/DB | **Prisma 7** + PostgreSQL 17 (adapter `@prisma/adapter-pg`) |
| Auth | **Better Auth** 1.4 (plugin `organization` + `crossLoginPlugin` custom) |
| Jobs | **Inngest** 4.5 (background jobs) |
| Estado (cliente) | TanStack Query 5, Zustand 5, nuqs 2 (state na URL) |
| UI | shadcn/ui (new-york) + Radix UI + **Tailwind CSS 4** (CSS-first, sem `tailwind.config`) + lucide-react |
| Forms | react-hook-form + zod 4 (`zodResolver`) |
| Mapas/Canvas | Konva + react-konva (editores), Leaflet (mapas geográficos) |
| PDF | @react-pdf/renderer, jspdf |
| Storage | AWS S3 (`@aws-sdk/client-s3`) |
| Pagamentos | Stripe + Asaas (`ASSAS_*`) |
| E-mail | Resend |
| Planilhas | xlsx (importações) |
| IA | Gemini (Vision para fotos de PDV) |
| Lint/Format | **Biome 2.2** (NÃO ESLint) — 2 espaços, aspas duplas, import sorting off |
| Package manager | **pnpm** 10.26 (Node ≥ 22) |

---

## 3. Comandos

```bash
pnpm dev              # dev server (Turbopack) na :3000
pnpm build            # copy-zxing-wasm + prisma generate + migrate deploy + next build
pnpm lint             # Biome check (NÃO ESLint)
pnpm format           # Biome format --write
npx tsc --noEmit      # typecheck (não há script npm — rode direto)
pnpm db:migrate       # prisma migrate dev
pnpm db:generate      # regenera Prisma Client (obrigatório após pull do schema)
pnpm db:studio
pnpm db:seed          # prisma/seed.ts
pnpm inngest:dev      # Inngest dev server na :8299 (necessário p/ jobs)
docker compose up -d  # Postgres 17, host port 5433
```

> **Não há suíte de testes** (sem Vitest/Jest/Playwright, sem CI). Verificação = `pnpm lint` + `npx tsc --noEmit` + exercitar o fluxo no navegador. Não invente `pnpm test`.

> `pnpm build` roda `prisma migrate deploy` — uma migration ruim quebra o **build**, não só o runtime. Deploy: só `main` sobe na Vercel (`vercel.json`); `.nixpacks.toml` é um segundo alvo Nixpacks.

---

## 4. Arquitetura

Next.js 15 App Router + oRPC + Prisma + Better Auth + Inngest. Alias único: `@/*` → `./src/*`.

### 4.1 O servidor oRPC vive em `src/app/` (não em `src/server` nem `src/rpc`)

- `src/app/middlewares/{base,auth,org}.ts` — procedure `base` + erros tipados; `requireAuthMiddleware` injeta `context.user`/`context.session`; `requireOrgMiddleware` injeta `context.org`.
- `src/app/router/<entidade>/<verbo>.ts` — **um procedure por arquivo**, reexportado no `index.ts` da pasta, mesclado no objeto raiz em `src/app/router/index.ts`. Esse objeto raiz é a **única fonte de inferência de tipos** para todo o cliente.
- `src/app/api/rpc/[[...rest]]/route.ts` — o mount HTTP, que também verifica requisições máquina-a-máquina (S2S) e injeta `isS2S`/`s2sOrg`/`s2sUser` no contexto.

**Não existe `publicProcedure`/`protectedProcedure`.** Você opta encadeando middlewares:

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

### 4.2 Multi-tenancy é MANUAL — a regra mais importante

`requireOrgMiddleware` dá `context.org` mas **não escopa nenhuma query**. Não há RLS nem extensão Prisma. **Todo handler precisa passar `organizationId: context.org.id` explicitamente** — omitir é vazamento silencioso entre tenants. Qualquer ID vindo do input deve ser revalidado contra a org antes do uso:

```ts
const supplier = await prisma.supplier.findFirst({
  where: { id: input.supplierId, organizationId: context.org.id },
  select: { id: true },
});
if (!supplier) throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
```

Erros sempre via objeto tipado `errors`, **nunca** `throw new Error`.

Exceção: procedures públicas da vitrine (`router/catalog/public.ts`, `checkout/`, `pedidos/public-*`) usam `base` puro sem auth, recebem `subdomain` como input e resolvem a org sozinhas.

### 4.3 Dualidade servidor/cliente do `orpc`

`src/app/layout.tsx` linha 1 é `import "@/lib/orpc.server"` — import de efeito colateral que seta `globalThis.$client` para um client in-process direto. `src/lib/orpc.ts` então faz `globalThis.$client ?? createORPCClient(link)`. Ou seja: o **mesmo** import `orpc` é chamada in-process no servidor e fetch HTTP no browser. **Remover esse import do layout quebra silenciosamente toda chamada oRPC server-side.**

### 4.4 Módulos de feature (server e client separados em duas árvores)

`src/app/router/<entidade>/` = procedures; `src/features/<feature>/` = UI:

```
src/features/<feature>/
  components/*.tsx        componentes "use client"
  hooks/use-<feature>.ts  TODOS os wrappers useQuery/useMutation aqui
  server/                 lógica de negócio "gorda" server-only (opcional)
  params.ts               parsers nuqs (opcional)
```

Sem `procedures/`, sem `actions/`, sem `schemas/` por feature (schemas Zod são inline). Server Actions **não** é o padrão — tudo passa por oRPC.

Componentes nunca chamam `orpc` direto; passam por um hook de feature que dá toast no erro e invalida no sucesso:

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

`page.tsx` fica fino — `await requirePermission("<key>")` e renderiza um container de `src/features/`.

### 4.5 Prisma

Gerado em `src/generated/prisma` (gitignored). **Importe de `@/generated/prisma/client` e `@/generated/prisma/enums` — nunca `@prisma/client`.** O client é o **export default** de `@/lib/db`: `import prisma from "@/lib/db"`. Schema único de ~1471 linhas em `prisma/schema.prisma`. Converta `Decimal` → `Number` e `Date` → ISO string na fronteira do handler.

### 4.6 Auth & permissões

Better Auth (`src/lib/auth.ts`) com plugin `organization` + `crossLoginPlugin` custom (cookies cross-subdomain foram removidos de propósito — Chrome rejeita `Domain=.localhost`). `src/middleware.ts` **não** protege rotas; só reescreve subdomínios para `/[subdomain]/...` (storefronts). A proteção vive nos layouts (`requireAuth()` de `src/lib/auth-utils.ts`) e nos middlewares oRPC.

Nova página admin → adicione uma chave em `PAGE_PERMISSIONS` (`src/lib/permissions.ts`), proteja a page com `requirePermission(key)`, adicione item na sidebar (`src/components/app-sidebar.tsx`) e, se for path top-level novo, inclua na allowlist de `src/middleware.ts`. **Owner/admin bypassam todas as permissões.**

Modelo de permissões (de `src/lib/permissions.ts`):
- **Cargos (Better Auth)**: `owner`, `admin`, `member`. Owner/admin veem tudo (`hasFullAccess`).
- **Permissões de página** (`PAGE_PERMISSIONS`): ~33 chaves (dashboard, produtos, estoque, clientes, catalogo, fornecedores, trade-painel, mapa-de-campo, lojas, books, planograma, tradegram, etc.). Cada uma abre uma página e um item de menu.
- **Permissões de ação** (`ACTION_PERMISSIONS`): não abrem página, liberam um botão. Ex.: `books-aprovar`, `mapa-ver-todos`.
- **Cargo no Trade** (`TradeRole`, separado de `role`): `COORDENADOR_TRADE`, `SUPERVISOR` — papel de campo, não permissão.
- **Visibilidade de módulos**: camada separada da segurança (`isModuleVisible`) — org desabilita módulos e usuário esconde módulos, mas quem tem permissão + URL ainda entra. `dashboard` e `configuracoes` são sempre visíveis.

### 4.7 Background jobs (Inngest)

Cliente/eventos em `src/lib/inngest/client.ts`, array de funções em `src/lib/inngest/functions.ts`, servido em `src/app/api/inngest/route.ts`. Padrão: um procedure grava linha de status (`GENERATING`/`PENDING`) e envia o evento; o corpo da função é um `step.run` fino delegando a `src/features/<domínio>/server/*`, com `onFailure` marcando a linha como `FAILED`; o cliente faz poll via `refetchInterval` na chave de status.

Funções existentes:
- `sync-nasa-delivery` — sincronização com ERP NASA (SyncOutbox)
- `product-import-process`, `supplier-import-process`, `customer-import-process`, `store-import-process` — importações em massa (xlsx)
- `book-generate` — geração de PDF de Books
- `trade-catalog-generate` — geração de catálogo PDV
- `shopper-price-alert` — alerta de mudança de preço (shopper)
- `erp-sync-schedule`, `erp-sync-deep-schedule`, `erp-sync-run` — agenda/roda sync de ERP externo
- `dashboard-alert-check` — checagem de alertas de dashboard

### 4.8 Route groups (`src/app/`)

- `(main)/(rest)/` — o ERP autenticado (shell com sidebar, `requireAuth()` + `currentOrganization()`)
- `(auth)` — login/cadastro
- `(home)` — landing
- `(org)/create-organization`
- `(storefront)/[subdomain]` — loja pública por tenant
- `(waiter)` — app de garçom
- `(pedidos-display)/painel` — painel de pedidos (cozinha/display)
- `(pdv)`, `(promotor)`, `(public)`, `authorize` — apps/rotas auxiliares

---

## 5. Domínio (modelos Prisma)

O `schema.prisma` tem ~180 modelos/enums em 42+ áreas. Principais blocos:

### Núcleo / Auth / Tenant
`User`, `Session`, `Account`, `Verification`, `Organization` (+ `PlanType`, `OrganizationStatus`), `Member` (+ `TradeRole`), `Invitation`, `OrganizationJoinLink`.

### Catálogo & Produtos
`Category`, `Product` (+ `ProductUnit`), `CatalogSettings` (+ `CatalogSortOrder`, `CatalogOperationMode`, `DeliveryMethod`, `FreightOption`, `FreightChargeType`), `PromotionalCatalog`, `Brand`.

### Estoque
`StockMovement` (+ `MovementType`), `StoreProduct`, `ProductBatch` (+ `BatchStatus`), `StoreInventory`.

### Vendas / PDV / Cozinha
`Sale` (+ `SaleStatus`, `PaymentMethod`), `SaleItem`, `Customer` (+ `PersonType`), `Supplier`, `CatalogUser`, `KitchenColumn`, `KitchenOrder`, `KitchenOrderEvent` (+ event/actor types), `Collaborator`.

### Compras & Financeiro
`Purchase` (+ `PurchaseStatus`), `PurchaseItem`, `FinancialAccount` (+ `AccountType`), `Transaction` (+ `TransactionType`, `TransactionCategory`, `TransactionStatus`).

### Integrações / Importações
`NasaIntegrationConsent`, `NasaIntegrationKey`, `SyncOutbox`, `ProductImport`, `SupplierImport`, `CustomerImport`, `StoreImport` (+ status enums), `ErpConnection` (+ `ErpConnectionKind`, `ErpConnectionStatus`), `ExternalSeller`.

### Metas & Ranking
`SalesGoalPeriod`, `SalesGoalBranch`, `SalesGoalEntry`, `SalesGoalRankingSettings` (+ period/entry/theme enums).

### Trade Marketing — Mapas & PDV
`Store` (+ geo enums), `Book` (+ `BookStatus`, `BookItem`, `BookItemApproval`, templates), `TradeCatalog` (+ `TradeCatalogStatus`, `TradeCatalogPage`), `PdvPhoto` (+ `PdvPhotoLayoutPattern`), `MediaModelPhoto`, `MapObject`/`MapShapeKind`/`MapObjectType`, `MapAnnotation` (+ type), `FloorPlan`, `MapLayer`.

### Trade — Negociação de Espaços
`SpaceNegotiation`, `MediaType`, `NegotiationType`, `StoreSector`, `MediaTypePrice`, `TradePricingSettings`, `RegionCostBenchmark`, `SpaceInterest` (+ kind/status), enums `MapSpaceState`, `NegotiationStatus`, `SpaceTier`, `SpaceFlowLevel`, `SpaceVisibility`.

### Trade — Promotores, Distribuidores, Diretório
`PromoterSupplier`, `PromoterStore`, `PromoterFavoriteStore`, `PromoterFavoriteSupplier`, `PromoterDistributor`, `Distributor`, `DistributorIndustry`, `StoreDistributor`, `DirectoryCompany`, `DirectoryStore`, `PromoterRoute`, `PromoterRouteStop`, `CompanyClaim` (+ `CompanyType`, `OrgSegment`, `CompanySource`, `CompanyClaimStatus`).

### Trade — TradeGram / Shopper / Cupons
`TradeSubscription` (+ `TradePlanTier`, `TradeSubscriptionStatus`), `ScanEvent` (+ `ScanEventKind`), `Shopper`, `Favorite`, `Coupon` (+ `CouponType`), `CouponRedemption`.

### Planograma
`Planogram` (+ `PlanogramStatus`), `PlanogramFixture` (+ `FixtureKind`), `PlanogramFixtureTemplate`, `PlanogramModule`, `PlanogramShelf` (+ `ShelfKind`, `ShelfLayoutMode`), `PlanogramItem` (+ `ItemOrientation`), `PlanogramVersion`.

### Dashboards / BI
`SalesFactDaily`, `DashboardWidget` (+ display/chart enums), `OracleWidgetSnapshot`, `OracleQueryTemplate`, `DashboardManualMetric`, `OrgDashboard`, `OrgDashboardPanel`, `OrgDashboardWidget`, `OrgDashboardMemberPermission`.

### Calendário (Trade)
`CalendarEvent` (+ `CalendarEventType`, `CalendarEventStatus`, `CalendarVisibility`), `CalendarEventStore`, `CalendarEventSupplier`, `CalendarEventAssignee`, `CalendarChecklistItem`, `CalendarChecklistCompletion`, `CalendarNoteTask`, `CalendarNote`.

---

## 6. Entidades do router (`src/app/router/`)

São **404 procedures** em ~55 entidades:

```
billing, book, brand, calendar, catalog, category, checkout, collaborators,
coupon, customer, dashboard, dashboard-widgets, directory, distributor,
erp-sync, field-map, floor-plan, invitation, map-annotation, map-layer,
map-object, media-model-photo, members, oracle-explorer, org, org-dashboard,
pdv-photo, pedidos, planogram, products, promoter-route, promotional-catalog,
promotor, ranking, sales, shopper, shopper-insights, space-negotiation, stock,
store, store-inventory, supplier, trade-catalog, trade-dashboard, trade-interest,
tradegram-public
```

---

## 7. Páginas do ERP (`(main)/(rest)/`)

Varejo: `/dashboard`, `/dashboard-organizacao`, `/vendas` (+ `/novo`), `/pedidos`, `/produtos` (+ `/novo`, `/[id]`, `/[id]/editar`, `/categorias`, `/importar`), `/estoque` (+ `/movimentacoes`), `/clientes` (+ `/importar`), `/fornecedores` (+ `/importar`), `/catalogo`, `/catalogo-promocional` (+ `/[catalogId]`), `/colaboradores`, `/ranking`, `/integracoes`, `/configuracoes`, `/lojas` (+ `/[storeId]`, `/[storeId]/mapa`, `/[storeId]/reposicao`, `/importar`), `/books` (+ `/[bookId]`).

Trade (`/trade/...`): `painel`, `calendario`, `mapa-de-campo`, `cadastros`, `catalogo-pdv` (+ `/[catalogId]`), `cupons`, `diretorio`, `distribuidores`, `insights`, `interesses`, `plano`, `planograma` (+ `/[planogramId]` + `editar`/`revisoes`/`visao-geral`), `promotor-vinculos`, `qr-preco`, `tradegram`.

---

## 8. Variáveis de ambiente

Referenciadas no código:

```
# DB / Auth
DATABASE_URL
AUTH_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BETTER_AUTH_EMAIL
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# Domínios (subdomínios / storefront)
NEXT_PUBLIC_BASE_DOMAIN, NEXT_PUBLIC_DOMAIN

# Storage S3
AWS_ENDPOINT_URL_S3, NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES, NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL

# Pagamentos
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
ASSAS_ACCESS_TOKEN, ASSAS_API_URL

# E-mail
RESEND_API_KEY

# IA (Vision p/ fotos de PDV)
GEMINI_API_KEY, GEMINI_VISION_MODEL

# Geocoding / mapas
GEOCODE_CONTACT_EMAIL, NOMINATIM_URL, OVERPASS_URL

# Integração ERP NASA (S2S)
NASA_CLIENT_ID, NASA_CLIENT_SECRET, NASA_SYNC_BASE_URL
SYNC_API_KEY, SYNC_SHARED_SECRET, SYNC_REQUEST_TIMEOUT_MS

# Outros
WHATSAPP_NUMBER, NODE_ENV
```

> Os docs/README derivam de versões antigas — confie no código e no `docker-compose.yml` (Postgres na porta host **5433**).

---

## 9. Convenções

- **Tipagem estrita — `any` é proibido.** Use tipos gerados do Prisma, `z.infer` ou tipos de domínio.
- Clean code, sem comentário supérfluo — comente só o "porquê" não óbvio.
- Reuse primitivas existentes antes de criar novas (`cn()`, `constructUrl` em `src/hooks/use-construct-url.ts`, formatadores em `src/utils/*`, shadcn/ui).
- **Tailwind 4 é CSS-first — não há `tailwind.config.*`.** Tokens de design ficam nos blocos `@theme inline` + `:root`/`.dark` de `src/app/globals.css`.
- shadcn/ui (new-york, ícones lucide) em `src/components/ui/`. Prefira `flex` + `gap-*` a `space-x/y-*`; `size-*` a `w-N h-N`; tokens semânticos a `dark:` manual.
- **Forms**: react-hook-form + `zodResolver` com schema inline, usando `<Controller>` + a família `Field`/`FieldGroup`/`FieldLabel`/`FieldError` — **não** o wrapper `<Form>/<FormField>` do shadcn. Exemplo canônico: `src/features/supplier/components/add-supplier.tsx`.
- **Tabelas são feitas à mão** com primitivas de `components/ui/table.tsx` — `@tanstack/react-table` não é usado. Paginação por cursor via `src/hooks/use-cursor-pagination.ts`.
- Biome (2 espaços, aspas duplas, **import sorting desligado de propósito**). Rode `pnpm biome check --write` em arquivos novos.
- **Commits**: Conventional Commits com assunto e escopo em português — `feat(store-map): M9 — régua com ticks`, `fix(build): resolve 'canvas' do konva`.
- **Git**: nunca `git commit`/`git push` sem pedido explícito do dev. Resolver conflito ou finalizar tarefa não é autorização para commitar — deixe no working tree e avise que está pronto para revisão.

---

## 10. Gotchas (pegadinhas)

- O alias `canvas: false` no `next.config.ts` é *load-bearing*: Konva puxa um build Node que faz `require('canvas')`, que quebra builds de produção sem isso. Editores Konva são `ssr: false`.
- `images.remotePatterns` deriva um hostname de `NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL`; se não setado, vira hostname vazio silenciosamente.
- `src/context/` e `src/schemas/` são anteriores à convenção `src/features/` e são vestigiais — não adicione neles.
- Docs desatualizados: template de env do README, porta do DB (compose diz 5433) e paths em `docs/catalogo-promocional/`. Confie no código e no `docker-compose.yml`.
- Após rodar migration, **bump do `SCHEMA_VERSION`** — sem isso o dev roda com o Prisma Client antigo e o campo novo dá 500.
- Multi-tenancy manual (§4.2) é a maior fonte de bugs de segurança: sempre filtrar por `organizationId`.

---

## 11. Docs de referência no repo

- `docs/TRADE_MARKETING.md` — módulo de mapa/PDV/Book: modelo de dados, o domínio em metros desacoplado do renderer Konva (`src/features/store-map/engine/`), roadmap M1–M9, convenções (§9), issues conhecidas (§11).
- `docs/catalogo-promocional/` — spec do catálogo promocional (paths parcialmente desatualizados).
- `.agents/skills/` — skills de terceiros vendored (shadcn, vercel-react-best-practices, web-design-guidelines, context7).
- `CLAUDE.md` — instruções para o Claude Code (fonte deste resumo).
