# Novos apps no monorepo — o que já vale e o que falta

> Como adicionar um app (web ou React Native) ao monorepo sem retrabalho: o que
> dá para compartilhar hoje, o que quebra, e em que ordem extrair o resto.
> Feature: raiz do repo · `packages/*` · `apps/*` · `nixpacks.toml`
> Criado em: 2026-08-24 · Atualizado em: 2026-08-24
> Status: 🟡 Em andamento — barrel do `@nerp/core` corrigido; extrações pendentes

---

## Situacao atual

O monorepo tem dois apps (`@nerp/web`, `@nerp/desktop`) e cinco packages. O
plano de produto prevê **apps React Native** e **outros apps web**, então este
spec registra o que foi *medido* — não estimado — sobre a capacidade atual de
suportar isso, e a ordem de extração que evita trabalho jogado fora.

Escala hoje (sem testes, sem código gerado):

| workspace | linhas | arquivos |
|---|---:|---:|
| `apps/web/src` | 182.576 | 1.523 |
| `apps/desktop/src` | 2.534 | 20 |
| `packages/*/src` | 1.701 | 27 |
| *(Prisma Client gerado)* | *349.359* | — |

Arquivos principais:
- `packages/core/src/` — domínio offline (venda, pagamento, caixa, outbox, sync) em ports & adapters
- `packages/api/src/contract.ts` — contrato tipado do cliente; guard em `apps/web/src/lib/desktop-contract-conformance.ts`
- `packages/types/src/enums.ts` — espelho manual de 4 dos 89 enums do Prisma, com teste de paridade
- `nixpacks.toml` — build do deploy, filtrado por app

---

## Fatos verificados

Cada item abaixo foi confirmado executando, não lido na documentação. Registrados
porque são exatamente as dúvidas que voltam quando o próximo app nascer.

- **O Next 15.5 transpila fonte TS de workspace sem `transpilePackages`.**
  Sonda importando código de *runtime* de `@nerp/api` (que exporta
  `./src/index.ts` cru) em uma route handler: `next build` compilou e passou.
  Não é preciso configurar nada para um package novo ser consumido pelo web.
  *Suspeitávamos do contrário — a suspeita era falsa.*

- **O pnpm estrito barra import de package não declarado.** A mesma sonda
  importando `@nerp/core` (que `@nerp/web` não declara) falhou com
  `Cannot find module '@nerp/core'` antes mesmo do bundler. Isso é rede de
  proteção: dependência entre workspaces só existe se declarada.

- **Adapters em subpath viram chunks separados.** Depois da correção do barrel
  (abaixo), o `vite build` do desktop emite `indexeddb-catalog`,
  `indexeddb-outbox`, `indexeddb-cash-session`, `sqlite-catalog`,
  `sqlite-outbox` e `sqlite-cash-session` como seis arquivos distintos — nenhum
  entra no bundle principal.

- **`turbo build --filter=@nerp/web` exclui os outros apps.** Grafo antes:
  `@nerp/desktop#build`, `@nerp/web#build`, `@nerp/web#db:generate`. Depois:
  só os dois últimos. É o mecanismo de deploy por app (ver § Decisoes).

- **`--filter=pkg`, `--filter=pkg...` e `--filter=...pkg` são equivalentes
  hoje.** Nenhum package interno tem script de `build`, então não há nada a
  montar upstream. Use a forma simples: se um package ganhar `build`, o
  `dependsOn: ["^build"]` do `turbo.json` já resolve sozinho.

---

## Pendencias

### Critico

- [x] **Barrel do `@nerp/core` arrastava adapter de plataforma** (`packages/core/src/index.ts`) — o barrel exportava os três adapters IndexedDB enquanto os SQLite ficavam em subpath. Um app React Native importando `@nerp/core` levaria `idb` junto, para um runtime sem `indexedDB`. Todos os adapters foram para subpath (`@nerp/core/indexeddb`, `/indexeddb-outbox`, `/indexeddb-cash-session`) e o host escolhe por import dinâmico. Barrel agora é só domínio. — ✅ 2026-08-24

### Funcional

- [ ] **`packages/ui` não existe** — um segundo app web duplicaria shadcn/ui, os tokens do Tailwind 4 (`@theme inline` em `globals.css`), `cn()` e os formatadores de `src/utils/`. Extrair **quando o segundo app web nascer**, não antes, e começando pelas folhas (utilitários e `components/ui/*`), nunca por componentes de feature — estes importam hooks, oRPC e Prisma.
- [ ] **`packages/database` não existe** — 491 arquivos importam `@/lib/db` e 149 importam `@/generated/prisma`. Só extrair se um segundo app precisar de Prisma *direto*; um app RN não precisa (fala oRPC). Sem um segundo consumidor real, é custo puro.
- [ ] **Adapters `expo-sqlite` para o RN** (`packages/core/src/adapters/`) — implementar `LocalCatalog`, `Outbox` e `CashSessionStore` sobre `expo-sqlite`, no mesmo formato dos SQLite existentes. O domínio (1.284 linhas) é reaproveitado sem alteração.

### Qualidade de codigo

- [ ] **Spike de Metro + pnpm workspaces (~30 min)** — antes de comprometer o plano do RN, validar `watchFolders`, `resolver.nodeModulesPaths` e principalmente `unstable_enablePackageExports: true`, de que os subpaths do `@nerp/core` dependem. **Não verificado** — não há app RN no repo para testar.
- [ ] **Remote caching do Turborepo** — passo intermediário barato antes de qualquer Dockerfile, se o build no Coolify incomodar.

---

## Decisoes tomadas

- **O barrel de um package carrega só domínio; todo adapter vai por subpath.**
  Adapter arrasta dependência de plataforma (`idb`, `@tauri-apps/plugin-sql`,
  amanhã `expo-sqlite`), e cada uma é peso morto — ou erro de resolução — nas
  outras. O host escolhe o seu por `await import()`. Vale para adapters de
  pagamento (TEF) também. Exceção: `createMockPaymentProcessor`, que não tem
  dependência de plataforma nenhuma.

- **Um recurso do Coolify por app; o build é filtrado.** Base Directory `/` em
  todos, variando só dois campos:

  ```
  Build Command:  pnpm turbo build --filter=@nerp/<app>
  Start Command:  pnpm --filter @nerp/<app> start
  ```

  Não é preciso listar dependências — o `dependsOn: ["^build"]` cuida.
  Colisão de porta não existe: cada recurso é um container, todos podem usar
  :3000.

- **Só UM app roda `pnpm db:deploy`.** Dois deploys concorrentes migrando o
  mesmo banco disputam a migration. Eleja o dono do schema (hoje `@nerp/web`);
  os demais ficam só com o `turbo build --filter=…`.

- **React Native não usa o Coolify.** Mobile vai para EAS/lojas, então não
  adiciona carga na VPS — adiciona um cliente a mais na MESMA API. O custo do
  RN é configuração de Metro, não infraestrutura.

- **Clientes não-Prisma consomem tipo por contrato, não por import do schema.**
  `@nerp/api` declara à mão a fatia usada e `desktop-contract-conformance.ts`
  afirma em tempo de compilação que o router real a satisfaz (o tipo do router,
  com 55 entidades, é grande demais para o TS serializar num `.d.ts` — TS7056).
  `@nerp/types` espelha só os enums necessários, com teste de paridade que
  quebra o CI se o Prisma divergir. **Um app RN usa exatamente este caminho.**

- **Nixpacks continua; Dockerfile + `turbo prune` segue adiado.** Herdado de
  [`turborepo.md`](./turborepo.md). O gatilho não é "temos mais apps" — é "o
  build no Coolify incomoda". Remote caching vem antes.

---

## Proximos passos

1. Nada agora — a correção crítica saiu. Os itens abaixo são disparados por
   evento, não por calendário.
2. **Ao nascer o 1º app RN:** spike do Metro → adapters `expo-sqlite` → app.
3. **Ao nascer o 2º app web:** extrair `packages/ui` (folhas primeiro) e criar
   o recurso no Coolify com o `--filter` próprio.
4. **Se o build incomodar:** remote caching do Turborepo.
5. **Só se ainda doer:** Dockerfile multi-stage com `turbo prune --docker`.

---

## Melhorias futuras (nao urgentes)

- [ ] Migrar o app do promotor (hoje rota web em `apps/web/src/app/(promotor)`,
      27 arquivos) para RN — é o candidato natural: o servidor já é oRPC e o
      uso é de campo, com rede instável.
- [ ] Avaliar `packages/config-tailwind` junto com `packages/ui`, para os tokens
      de design não serem copiados entre apps web.

---

## Relacao com outros specs

- [`turborepo.md`](./turborepo.md) — origem do monorepo e das decisões de deploy que este spec estende.
- [`desktop-offline.md`](./desktop-offline.md) — o design ports & adapters do `@nerp/core` que torna o reaproveitamento em RN viável.
- [`migracao-monorepo-main.md`](./migracao-monorepo-main.md) — pré-requisito: o monorepo precisa chegar na `main` antes de novos apps nascerem nele.
