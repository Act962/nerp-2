# Turborepo — monorepo e infraestrutura de testes

> Migração do repositório de app único para Turborepo + pnpm workspaces, com Vitest e Playwright.
> Feature: raiz do repo · `apps/web` · `packages/*` · `e2e`
> Criado em: 2026-08-18 · Atualizado em: 2026-08-18
> Status: ✅ Entregue — build, typecheck e as quatro suítes verificados; falta abrir o PR

---

## Situacao atual

O app inteiro virou `apps/web` (`@nerp/web`) sem que nenhum import mudasse: o alias `@/*` continua apontando para `apps/web/src`. A raiz virou um workspace privado que só delega ao `turbo`. Deploy segue no Coolify por Nixpacks.

Arquivos principais:
- `turbo.json` — tasks `build`, `dev`, `lint`, `check-types`, `test`, `test:integration`, `test:e2e`, `db:generate`
- `pnpm-workspace.yaml` — `apps/*`, `packages/*`, `e2e`
- `packages/typescript-config` — `base` / `nextjs` / `react-library`
- `packages/vitest-config` — presets `node` e `jsdom` (alias de `server-only`, `vite-tsconfig-paths`)
- `apps/web/vitest.config.ts` — projects `unit`, `component`, `integration`
- `e2e/playwright.config.ts` — sobe `pnpm --filter @nerp/web start`
- `.nixpacks.toml` — `pnpm db:deploy` **antes** de `pnpm build`

---

## Decisoes tomadas

- **Lift-and-shift, sem extrair `packages/database` nem `packages/ui`** — 495 arquivos importam `@/lib/db` e 161 importam `@/generated/prisma`. Extrair agora custaria uma reescrita de ~650 arquivos (ou um mapeamento de paths disfarçando a origem) sem um segundo consumidor que justificasse. Fica para quando o app desktop existir.
- **Nixpacks, não Dockerfile + `turbo prune`** — o caminho recomendado pela doc do Turborepo exige `output: "standalone"` e resolver `oracledb`, `bcrypt` e `sharp` numa imagem própria. Risco alto para ganho nenhum enquanto só existe um app. Reavaliar quando o build no Coolify começar a incomodar.
- **`prisma migrate deploy` saiu do `build`** — o `build` do turbo é cacheável; uma build restaurada do cache pularia a migration em silêncio. Virou `pnpm db:deploy`, passo explícito do `.nixpacks.toml`. **Não devolver para dentro do `build`.**
- **Banco de teste separado (`db-test`, porta 5434, `tmpfs`)** — a suíte de integração trunca tabelas. `tests/integration/env.ts` recusa rodar se o `DATABASE_URL` não tiver "test" no nome.
- **Integração chama procedure por `call()` com contexto S2S** — `requireAuthMiddleware` e `requireOrgMiddleware` já têm ramo para integrações máquina-a-máquina, então o teste entra por ali em vez de forjar sessão do Better Auth. Sem subir o Next.
- **`.gitattributes` com `eol=lf`** — com `core.autocrlf=true` no Windows, o working tree ficava CRLF e o Biome acusava erro de formatação em 1.556 arquivos, tornando `pnpm lint` inútil.

---

## Pendencias

### Critico

- [x] **Validar `pnpm test:integration`** — 148 migrations aplicadas no `db-test`, 2 testes passando. Confirmado que pegam o vazamento: comentar o `organizationId` de `supplier/list.ts` derruba os dois — ✅ 2026-08-18
- [x] **Validar `pnpm test:e2e`** — 3 testes de login passando contra o app buildado — ✅ 2026-08-18

### Funcional

- [ ] **Renormalizar o working tree** — `git add --renormalize .` uma vez, depois do merge, para o `.gitattributes` valer nos arquivos já em disco.
- [ ] **Conferir o start command no painel do Coolify** — precisa ser `pnpm start` (delega para `apps/web` com o cwd certo) e Base Directory `/`.

### Qualidade de codigo

- [ ] **~324 diagnósticos de lint pré-existentes em `apps/web`** (`noImgElement`, `useImportType`, `useExhaustiveDependencies`, `noExplicitAny`…). Não vieram da migração, mas mantêm `pnpm lint` vermelho. Limpar aos poucos ou baixar as regras conscientemente.
- [ ] **CI** — não existe workflow. Com `turbo` + as tasks prontas, um GitHub Actions rodando `check-types`, `lint`, `test` e `test:integration` é barato agora.

---

## Proximos passos

1. Abrir PR de `feat/turborepo`.
2. Conferir o start command no Coolify antes do primeiro deploy do monorepo.
3. Depois do merge: `git add --renormalize .` num commit próprio.
4. Criar o workflow de CI.

---

## Melhorias futuras (nao urgentes)

- [ ] `packages/database` quando houver um segundo consumidor do Prisma.
- [ ] `packages/ui` quando o desktop precisar dos componentes (exige reconfigurar o `@source` do Tailwind 4 e o `components.json` do shadcn).
- [ ] Dockerfile multi-stage com `turbo prune --docker` como alvo alternativo no Coolify.
- [ ] `apps/desktop` (Electron/Tauri) consumindo a API por HTTP — o que ele precisa compartilhar é o **tipo** do router, não o servidor.
- [ ] Remote caching do Turborepo, se o build no Coolify virar gargalo.
