# Migração do monorepo para a `main` — plano de integração

> Como levar `feat/desktop` (monorepo + app desktop) para a `main`, que continua single-app e andou 27 commits em paralelo. O nó não é o desktop: é o **lift-and-shift de caminhos** (`src/` → `apps/web/src/`) colidindo com 104 arquivos que a `main` mexeu nesses mesmos caminhos.
> Feature: raiz do repo · `apps/web` · `packages/*` · `.nixpacks.toml` · Coolify/Vercel
> Criado em: 2026-08-21 · Atualizado em: 2026-08-21
> Status: 📋 Planejado — **não executar sem decisão explícita do dev**

---

## Situacao atual

`origin/main` e `feat/desktop` divergiram do merge-base `57ef73a` (2026-08-17) e
seguem em layouts **incompatíveis**.

> ⚠️ **Os números abaixo são um snapshot de 2026-08-21 e envelhecem sozinhos** —
> a `main` continua recebendo PRs. Não confie neles na hora de executar:
> remeça com o § Como remedir. O que **não** envelhece é a *forma* do problema
> (layouts incompatíveis) e a estratégia — só a contagem muda.

| | `origin/main` | `feat/desktop` |
|---|---|---|
| Layout | single-app (`src/`, `prisma/` na raiz) | monorepo (`apps/web/`, `packages/*`) |
| Commits desde o base | 27 *(snapshot)* | 31 *(snapshot)* |
| Arquivos alterados | 104 (+9.717 / −733) *(snapshot)* | 1.911 *(snapshot)* — dos quais ~1.800 são **só o movimento** de caminho; o trabalho de desktop em si é 153 arquivos (+15.788 / −33) |
| `package.json` (raiz) | `erp-limas`, Next direto | `nerp`, só delega ao `turbo` |
| Migration no build | **sim** (`prisma migrate deploy` dentro do `build`) | não — `pnpm db:deploy` no `.nixpacks.toml` |
| `SCHEMA_VERSION` | `v64-catalog-views` | `v63-caixa-client-ids` |

O que a `main` construiu no período: catálogo promocional (editor visual,
padrões, busca SKU/EAN, correções de produto fantasma/preço zero), store-map
(negociação por prateleira, gôndola no painel), TradeGram (contratos por ID de
espaço), financeiro (DRE/DRO).

**49 arquivos foram tocados nos dois lados** (lista completa em § Superfície de
conflito). Nenhum deles é do desktop — são todos do `apps/web`, o que confirma
que o desktop em si é aditivo e o conflito é do *rebase de layout*.

---

## O problema central

A `main` mudou 104 arquivos em caminhos como `src/features/promotional-catalog/…`.
No `feat/desktop` esses arquivos vivem em `apps/web/src/features/promotional-catalog/…`.
Um `git merge` ingênuo trata isso como **"deletado de um lado, modificado do outro"**
em escala e produz centenas de conflitos falsos — ou, pior, descarta trabalho da
`main` em silêncio.

A saída é **não pedir ao git para adivinhar**: aplicar o mesmo lift-and-shift na
`main` primeiro, e só então mesclar árvores já alinhadas.

### O custo só cresce

A divergência é **monotônica**: cada PR novo na `main` mexe em mais arquivos sob
`src/`, e todo arquivo que a `main` toca e que o desktop moveu vira mais uma
colisão. Não existe cenário em que esperar reduza o trabalho.

Consequência prática — só há duas saídas sãs, e a escolha é do dev:

- **Migrar cedo**, aceitando a superfície de conflito de hoje; ou
- **Congelar a `main`** por uma janela curta e migrar dentro dela.

O que **não** funciona é "vamos deixar para depois, quando estiver mais calmo":
depois é sempre pior. Isso não é argumento para migrar já — é argumento para a
decisão ser **consciente e datada**, não adiada por inércia.

---

## Como remedir (rode antes de executar)

Os números deste spec são de 2026-08-21. Para regerá-los no dia da migração:

```bash
git fetch origin && BASE=$(git merge-base origin/main feat/desktop) && echo "merge-base: $BASE" && echo "main→ $(git log --oneline origin/main --not feat/desktop | wc -l) commits / $(git diff --name-only $BASE origin/main | wc -l) arquivos" && echo "desktop→ $(git log --oneline feat/desktop --not origin/main | wc -l) commits / $(git diff --name-only $BASE feat/desktop | wc -l) arquivos"
```

Para recalcular a **lista de colisões** (mapeando os caminhos da `main` para o
layout do monorepo):

```bash
git fetch origin && BASE=$(git merge-base origin/main feat/desktop) && comm -12 <(git diff --name-only $BASE origin/main | sed -E 's#^(src/|prisma/|public/|scripts/|tests/)#apps/web/\1#' | sort -u) <(git diff --name-only $BASE feat/desktop | sort -u)
```

Para checar se **novas colisões de timestamp de migration** apareceram (o risco 🔴
mais fácil de passar batido):

```bash
git fetch origin && BASE=$(git merge-base origin/main feat/desktop) && { git diff --name-only $BASE origin/main; git diff --name-only $BASE feat/desktop; } | grep -oE '[0-9]{14}_[a-z0-9_]+' | sort | cut -d_ -f1 | uniq -d
```

Se o último comando imprimir qualquer coisa, há prefixos de timestamp repetidos —
resolver antes do merge (§ Superfície de conflito).

---

## Estrategia recomendada

**Direção: trazer a `main` para dentro do monorepo, em uma branch de integração —
nunca mesclar direto na `main`.**

```
origin/main ──┐
              ├─► chore/integracao-monorepo   ← branch de integração (nova)
feat/desktop ─┘        │
                       └─► PR único para a main (decisão exclusiva do dev)
```

Passo a passo:

1. **Branch de integração** a partir de `feat/desktop` (que já tem o layout alvo).
2. **Mover os caminhos da `main`** para o layout do monorepo antes de mesclar:
   mesclar `origin/main` com `-X rename-threshold=25` (ou preparar um commit
   "só move" na `main` espelhando o lift-and-shift do `feat/turborepo`, e mesclar
   a partir dele — mais previsível, à custa de um commit extra na história).
3. **Resolver os 49 arquivos colididos** manualmente, por ordem de risco (§ abaixo).
4. **Validar** com o pipeline completo (§ Validação).
5. **PR único** `chore/integracao-monorepo` → `main`, com o dev revisando.

> **Alternativa descartada:** mesclar `main` → `feat/desktop` repetidamente ao
> longo do tempo. Sem o alinhamento de caminhos, cada merge repete o mesmo
> conflito de layout do zero. Um alinhamento único custa menos que N parciais.

---

## Superfície de conflito

### 🔴 Crítico — resolver com atenção individual

- [ ] **`prisma/schema.prisma`** — os dois lados só **adicionaram** (main +78 linhas: templates/assets/views de catálogo, contrato de espaço, categoria operacional; desktop +30/−4: `Device`, `clientOperationId`, IDs de caixa). Como são blocos disjuntos, o merge tende a ser mecânico — mas revise linha a linha: `−4` do desktop indica **alteração** de modelo existente, não só adição.
- [ ] **Colisão de timestamp de migration** — **três** migrations compartilham o prefixo `20260819120000`:
  - `20260819120000_payment_category_operational` (main)
  - `20260819120000_promotional_catalog_templates` (main)
  - `20260819120000_caixa_client_ids` (desktop)

  O Prisma ordena migrations pelo **nome do diretório**; prefixos idênticos deixam a ordem ambígua e dependente de desempate lexicográfico do sufixo. Como são hand-authored (§ CLAUDE.md), **renomeie a do desktop** para um timestamp posterior (ex.: `20260821120000_caixa_client_ids`) antes do merge. Renomear migration **já aplicada** em qualquer banco exige acertar a tabela `_prisma_migrations` — decidir isso *antes* de tocar em produção.
- [ ] **`src/lib/db.ts` — `SCHEMA_VERSION`** — main em `v64-catalog-views`, desktop em `v63-caixa-client-ids`. O merge deve resultar em um **`v65-…` novo** que cubra os dois conjuntos; herdar qualquer um dos dois deixa o cache do Prisma stale em dev (a causa nº 1 de "500 impossível", § Gotchas).
- [ ] **`package.json` (raiz)** — conflito **semântico**, não textual: a `main` é `erp-limas` com `prisma generate && prisma migrate deploy && next build` dentro do `build`; o monorepo é `nerp` delegando ao `turbo`, com a migration fora do build de propósito (build cacheável pularia a migration em silêncio). **Vence a versão do monorepo** — e isso exige o passo de deploy abaixo.
- [ ] **Deploy: `.nixpacks.toml` × build da `main`** — a `main` não tem `.nixpacks.toml` e depende da migration embutida no `build`. Ao migrar, o Coolify precisa de **Base Directory `/`**, start command `pnpm start` e o `pnpm db:deploy` do `.nixpacks.toml` rodando antes do build. Sem isso, **o primeiro deploy do monorepo sobe sem aplicar migration**.
- [ ] **`pnpm-lock.yaml`** — não resolver à mão. Descartar e regerar com `pnpm install` após unificar todos os `package.json`.

### 🟠 Funcional — conflitos reais de conteúdo (revisar cada um)

- [ ] **`src/lib/permissions.ts`** — os dois lados provavelmente adicionaram chaves em `PAGE_PERMISSIONS`. União simples, mas confira que nenhuma página nova ficou sem chave (§ Auth & permissions).
- [ ] **`src/components/app-sidebar.tsx`**, `app-header.tsx`, `breadcrumb-nav.tsx` — entradas de menu das features novas da `main`.
- [ ] **`src/app/(main)/layout.tsx`** — atenção ao `import "@/lib/orpc.server"` da linha 1: removê-lo quebra toda chamada oRPC server-side em silêncio.
- [ ] **Catálogo promocional** (16 arquivos: `router/promotional-catalog/*`, `features/promotional-catalog/**`, incl. `cards/*`) — área de maior atividade da `main`. Em quase todos, **a `main` vence** (o desktop só os tocou pelo movimento de caminho).
- [ ] **Store-map** (8 arquivos: `components/*`, `engine/scene-store.ts`, `renderers/konva/*`) — idem.
- [ ] **Financeiro** (4), **TradeGram/space-negotiation** (4), **products/planogram** (3), **promotor** (2) — idem.

### 🟡 Higiene

- [ ] **Scripts `apply-*-migration.mjs` da raiz** — a `main` tem 13; o working tree atual já apaga 7 deles (mudança local não commitada). Decidir de uma vez: são one-offs já aplicados e devem sair na migração, ou viram `apps/web/scripts/`.
- [ ] **`bash.exe.stackdump`** — lixo versionado na `main`; aproveitar para remover.
- [ ] **Scripts untracked** (`apps/web/scripts/list-orgs.ts`, `load-upload-env.ts`, `move-orphan-images.ts`, `reset-local-password.ts`, `upload-product-images.ts`) — commitar ou descartar antes de começar; não deixar boiando no meio de um merge grande.
- [ ] **`vercel.json`** — a `main` restringe deploy a `main`. Confirmar se continua válido no layout de monorepo (Root Directory do projeto na Vercel).
- [ ] **Renormalização de EOL** — rodar `git add --renormalize .` num commit próprio **depois** do merge (pendência herdada do `turborepo.md`); fazer antes polui o diff do merge.

---

## Decisoes tomadas

- **Sentido do merge: `main` → monorepo, em branch de integração.** A `main` é a que precisa mudar de layout; o monorepo já está no formato alvo. Mesclar na direção oposta significaria desfazer o lift-and-shift.
- **Um PR único, não incremental.** A mudança de layout é atômica — não existe estado intermediário coerente onde metade dos arquivos está em `apps/web/` e metade na raiz.
- **A migration sai do `build`** (decisão herdada do `turborepo.md`, § Decisoes) — não devolver para dentro do `build` só para facilitar o deploy da `main`.
- **Nada vai para a `main` sem validação explícita do dev** (§ CLAUDE.md / `desktop-offline.md`). Este spec descreve *como* migrar quando decidirem; não autoriza migrar.

---

## Validacao (antes de abrir o PR)

Ordem importa — os passos baratos primeiro:

1. `pnpm install` (lockfile regenerado) e `pnpm db:generate`.
2. `pnpm check-types` — pega quebra de contrato entre `@nerp/api`/`@nerp/types` e o desktop.
3. `pnpm build` — o app inteiro compila no layout novo.
4. `pnpm test` (unit + component) e `pnpm test:integration` (exige `docker compose up -d db-test`) — a suíte de integração é o que pega vazamento cross-tenant.
5. `pnpm test:e2e`.
6. **`prisma migrate deploy` num banco limpo** — prova que a ordem das migrations (pós-renomeação do timestamp colidido) aplica do zero sem erro. **Este é o passo que não pode ser pulado.**
7. `pnpm --filter @nerp/desktop tauri build` — o desktop ainda empacota depois do merge.
8. Smoke manual: login, PDV/caixa, catálogo promocional, store-map, financeiro.

> Se o CI de [`ci-turborepo.md`](#) / `.github/workflows/ci.yml` já estiver na
> branch, os passos 2–5 e 7 saem de graça no PR.

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Merge de layout descarta trabalho da `main` em silêncio | 🔴 perda de código | Conferir `git diff origin/main -- apps/web/src` no fim: só devem aparecer mudanças do desktop |
| Migration colidida aplica fora de ordem | 🔴 schema divergente entre ambientes | Renomear antes do merge + validar `migrate deploy` em banco limpo (passo 6) |
| Primeiro deploy do monorepo sem migration | 🔴 produção quebrada | Ajustar Coolify (Base Directory, start command) **antes** do merge |
| `SCHEMA_VERSION` herdado de um lado só | 🟠 500s "impossíveis" em dev | Bump para `v65-…` cobrindo os dois |
| `main` continuar andando durante a integração | 🟠 retrabalho | Janela curta; idealmente congelar merges na `main` durante a integração |

---

## Proximos passos (quando o dev decidir migrar)

1. Congelar merges na `main` (janela combinada) e commitar/descartar o working tree atual.
2. Renomear a migration `20260819120000_caixa_client_ids` do desktop para timestamp posterior.
3. Criar `chore/integracao-monorepo` a partir de `feat/desktop` e alinhar os caminhos da `main`.
4. Resolver os 49 conflitos na ordem do § Superfície de conflito (🔴 → 🟠 → 🟡).
5. Regerar o lockfile e rodar a validação inteira (§ Validação).
6. Ajustar Coolify/Vercel para o layout de monorepo.
7. Abrir o PR único e revisar com o dev.
8. Pós-merge: `git add --renormalize .` em commit próprio.

---

## Fora de escopo

- Assinatura/distribuição do instalador desktop — ver [`desktop-release.md`](./desktop-release.md).
- Extrair `packages/database` / `packages/ui` — continua adiado (`turborepo.md`, § Decisoes).
- Limpar os ~324 diagnósticos de lint pré-existentes — não misturar com um merge desta escala.

---

## Relacao com outros specs

- [`turborepo.md`](./turborepo.md) — origem do lift-and-shift e das decisões de deploy que este spec preserva.
- [`desktop-offline.md`](./desktop-offline.md) — § Fluxo de branches: a regra de que nada sobe para a `main` sem decisão do dev.
- [`desktop-release.md`](./desktop-release.md) — o passo seguinte, depois que o monorepo estiver na `main`.
